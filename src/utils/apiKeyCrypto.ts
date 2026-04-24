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
  return typeof globalThis.crypto?.subtle?.generateKey === 'function'
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
 * Return the device's persistent AES-GCM key, generating and storing it on first use.
 * Returns null if WebCrypto / IndexedDB are unavailable or generation fails — callers
 * should fall back to storing plaintext.
 */
async function loadDeviceKey(): Promise<CryptoKey | null> {
  if (cachedKey) return cachedKey;
  if (!hasWebCrypto()) return null;

  try {
    const db = await openDb();
    try {
      const existing = await idbGet(db, DB_RECORD);
      if (existing instanceof CryptoKey) {
        cachedKey = existing;
        return existing;
      }
      const fresh = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable
        ['encrypt', 'decrypt'],
      );
      await idbSet(db, DB_RECORD, fresh);
      cachedKey = fresh;
      return fresh;
    } finally {
      db.close();
    }
  } catch {
    return null;
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
 * Encrypt a string with the device key. Returns the ciphertext on success,
 * or the original plaintext when WebCrypto is unavailable (we can't refuse to
 * save — the user would lose their config — so we log and fall back).
 */
export async function encryptString(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  if (isEncrypted(plaintext)) return plaintext; // already encrypted, idempotent
  const key = await loadDeviceKey();
  if (!key) return plaintext;

  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
    return `${PREFIX}${toBase64(iv)}:${toBase64(ct)}`;
  } catch (err) {
    console.error('[Homepage Blocks] API key encryption failed — storing plaintext', err);
    return plaintext;
  }
}

/**
 * Decrypt a string previously produced by encryptString. Returns the decrypted
 * plaintext, or null on any failure (missing device key, tampered ciphertext,
 * cross-device import). Callers should treat null as "key unrecoverable — clear it".
 */
export async function decryptString(value: string): Promise<string | null> {
  if (!isEncrypted(value)) return value; // plaintext or empty
  const key = await loadDeviceKey();
  if (!key) return null;

  const body = value.slice(PREFIX.length);
  const sep = body.indexOf(':');
  if (sep < 0) return null;
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
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

/** Test hook — drops the cached key so loadDeviceKey re-reads from IndexedDB. */
export function _resetDeviceKeyCache(): void {
  cachedKey = null;
}
