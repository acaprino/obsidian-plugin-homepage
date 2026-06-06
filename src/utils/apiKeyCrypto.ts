/**
 * WebCrypto helpers for encrypting Whisper / Gemini API keys at rest.
 *
 * Threat model
 * ------------
 * The plugin's data.json lives inside the Obsidian vault, so it gets synced by whatever
 * tool the user runs on the vault (Obsidian Sync, iCloud, Dropbox, git, …). A plaintext
 * apiKey ends up readable by anyone with access to the sync stream. Encryption at rest
 * raises the bar from "cat data.json" to "run code inside this Obsidian install and
 * retrieve the non-extractable key from IndexedDB".
 *
 * Key storage
 * -----------
 * An AES-GCM-256 CryptoKey is generated once per device and stored in IndexedDB as a
 * non-extractable key. Storing it inside IndexedDB (not localStorage) is what makes
 * the "non-extractable" guarantee meaningful — structured clone serialises the key
 * reference without exposing raw bytes. The key is therefore scoped to this browser
 * profile / Obsidian install — a freshly-synced vault on another device will see the
 * ciphertext but cannot decrypt it; the user has to re-enter the apiKey there.
 *
 * Wire format
 * -----------
 *   "enc:v1:<base64-iv>:<base64-ciphertext>"
 *
 * Anything not prefixed with `enc:v1:` is treated as plaintext (migration support —
 * existing plaintext keys get encrypted on the next saveLayout).
 */

const DB_NAME = 'homepage-blocks-kv';
const DB_STORE = 'keys';
const DB_RECORD = 'apiKeyDeviceKey';
const PREFIX = 'enc:v1:';

let cachedKey: CryptoKey | null = null;

function hasWebCrypto(): boolean {
  return typeof window.crypto?.subtle?.generateKey === 'function'
      && typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'));
  });
}

function idbSet(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'));
  });
}

/**
 * Outcome of a device-key load. `transient` distinguishes "WebCrypto/IndexedDB
 * hiccupped just now" (preserve ciphertext, retry later) from a permanent
 * "WebCrypto is absent on this platform" or a successful load. Returned per
 * call (not stashed in a module global) so concurrent encrypt/decrypt calls —
 * e.g. desktop + mobile arrays under `Promise.all` — never read each other's
 * result.
 */
interface DeviceKeyResult { key: CryptoKey | null; transient: boolean; }

/**
 * Return the device's persistent AES-GCM key, generating and storing it on first use.
 * `key` is null if WebCrypto / IndexedDB are unavailable or generation fails — callers
 * should fall back to storing plaintext (only when `transient` is false).
 */
async function loadDeviceKey(): Promise<DeviceKeyResult> {
  if (cachedKey) return { key: cachedKey, transient: false };
  // Permanent: WebCrypto is missing entirely. Callers rely on transient=false
  // here to know the plaintext fallback is the only option on this platform.
  if (!hasWebCrypto()) return { key: null, transient: false };

  try {
    const db = await openDb();
    try {
      const existing = await idbGet(db, DB_RECORD);
      if (existing instanceof CryptoKey) {
        cachedKey = existing;
        return { key: existing, transient: false };
      }
      const fresh = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable
        ['encrypt', 'decrypt'],
      );
      await idbSet(db, DB_RECORD, fresh);
      cachedKey = fresh;
      return { key: fresh, transient: false };
    } finally {
      db.close();
    }
  } catch (err) {
    // Transient: IndexedDB threw (e.g., quota, locked, profile-under-stress).
    // Signal transient=true so callers preserve ciphertext / refuse to write
    // plaintext, rather than treating it as "device key wiped".
    console.error('[Homepage Blocks] device key unavailable (transient)', err instanceof Error ? err.message : 'unknown error');
    return { key: null, transient: true };
  }
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** True for anything in the `enc:v1:<iv>:<ct>` wire format. */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Result of encryptString — the caller can tell whether the value is real ciphertext
 * (`enc:v1:...`) or plaintext that fell through because WebCrypto was unavailable.
 * The `fallback` flag lets the higher-level encrypt loop refuse to overwrite a
 * previously-stored ciphertext with plaintext on the next save (which would otherwise
 * downgrade the security guarantee for users on cross-platform vault sync).
 */
export type EncryptResult =
  | { ok: true; value: string }
  | { ok: false; reason: 'fallback-plaintext' | 'crypto-error'; value: string; transient: boolean };

/**
 * Encrypt a string with the device key. Returns the ciphertext on success,
 * or the original plaintext when WebCrypto is unavailable. The structured
 * result lets callers distinguish "got real ciphertext" from "had to fall
 * back to plaintext" so they can refuse to overwrite stored ciphertext.
 */
export async function encryptStringEx(plaintext: string): Promise<EncryptResult> {
  if (!plaintext) return { ok: true, value: plaintext };
  if (isEncrypted(plaintext)) return { ok: true, value: plaintext }; // already encrypted, idempotent
  const { key, transient } = await loadDeviceKey();
  if (!key) {
    if (!transient) {
      console.warn('[Homepage Blocks] WebCrypto unavailable — apiKey will be stored in plaintext on disk');
    }
    return { ok: false, reason: 'fallback-plaintext', value: plaintext, transient };
  }

  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
    return { ok: true, value: `${PREFIX}${toBase64(iv)}:${toBase64(ct)}` };
  } catch (err) {
    // A thrown encrypt() with a successfully-loaded key is almost always a
    // transient WebCrypto hiccup, not a permanent platform limitation. Mark it
    // transient:true so the caller preserves any prior ciphertext or drops the
    // key from the persisted copy, rather than downgrading it to plaintext at
    // rest (the in-memory layout keeps the plaintext; the next save retries).
    console.error('[Homepage Blocks] API key encryption failed — key left unencrypted this save, will retry', err instanceof Error ? err.message : 'unknown error');
    return { ok: false, reason: 'crypto-error', value: plaintext, transient: true };
  }
}

/**
 * Convenience wrapper that returns just the value string. Kept for callers that
 * don't care whether the result was real ciphertext or a plaintext fallback.
 */
export async function encryptString(plaintext: string): Promise<string> {
  const r = await encryptStringEx(plaintext);
  return r.value;
}

/**
 * Result of decryptString — distinguishes "transient crypto failure" (preserve
 * ciphertext on disk) from "definitely corrupt or wrong device" (clear the key).
 * Without this distinction, a single QuotaExceededError or transient IndexedDB
 * hiccup would destroy the user's encrypted ciphertext on the next save.
 */
export type DecryptResult =
  | { ok: true; plaintext: string }
  | { ok: false; reason: 'no-key' | 'corrupt'; transient: boolean };

/**
 * Decrypt a string previously produced by encryptString — rich-result variant.
 * Use this when you need to act differently for transient failures (preserve
 * ciphertext) versus permanent ones (clear and let the user re-enter).
 */
export async function decryptStringEx(value: string): Promise<DecryptResult> {
  if (!isEncrypted(value)) return { ok: true, plaintext: value }; // plaintext or empty
  const { key, transient } = await loadDeviceKey();
  if (!key) {
    return { ok: false, reason: 'no-key', transient };
  }

  const body = value.slice(PREFIX.length);
  const sep = body.indexOf(':');
  if (sep < 0) return { ok: false, reason: 'corrupt', transient: false };
  const ivB64 = body.slice(0, sep);
  const ctB64 = body.slice(sep + 1);

  try {
    // The Uint8Array returned by fromBase64 has `ArrayBufferLike` as its buffer
    // type — WebCrypto wants a narrower ArrayBuffer. Rewrap to satisfy TS.
    const ivBytes = fromBase64(ivB64);
    const ctBytes = fromBase64(ctB64);
    const iv = new Uint8Array(ivBytes.length); iv.set(ivBytes);
    const ct = new Uint8Array(ctBytes.length); ct.set(ctBytes);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return { ok: true, plaintext: new TextDecoder().decode(pt) };
  } catch {
    // AES-GCM authenticated decryption failed — ciphertext is tampered or the
    // device key doesn't match (cross-device sync, IndexedDB wiped). Either way
    // the value can never be recovered with this key.
    return { ok: false, reason: 'corrupt', transient: false };
  }
}

/**
 * Decrypt a string previously produced by encryptString. Returns the decrypted
 * plaintext, or null on any failure (missing device key, tampered ciphertext,
 * cross-device import). Kept for callers that don't need the transient/permanent
 * distinction; new code should prefer decryptStringEx.
 */
export async function decryptString(value: string): Promise<string | null> {
  const r = await decryptStringEx(value);
  return r.ok ? r.plaintext : null;
}

/** Test hook — drops the cached key so loadDeviceKey re-reads from IndexedDB. */
export function _resetDeviceKeyCache(): void {
  cachedKey = null;
}
