import type { BlockInstance, LayoutConfig } from '../types';
import { decryptStringEx, encryptStringEx, isEncrypted, knownCiphertextFor, rememberCiphertext } from './apiKeyCrypto';

// ── API key encryption helpers ──────────────────────────────────────────────
//
// Walked every save / load. Only block types whose defaultConfig declares `apiKey`
// currently need this (voice-dictation today), but checking by key name makes
// this future-proof — any new block that names its field `apiKey` gets encrypted
// automatically.

/**
 * True when a block on either platform array holds a key that still needs
 * encrypting: a non-empty plaintext. An empty key and a ciphertext (this
 * device's, or another device's it cannot read) are written as they are.
 */
function needsEncryption(layout: LayoutConfig): boolean {
  const anyIn = (blocks: BlockInstance[] | undefined): boolean =>
    Array.isArray(blocks) && blocks.some(
      b => typeof b?.config?.apiKey === 'string' && b.config.apiKey !== '' && !isEncrypted(b.config.apiKey),
    );
  return anyIn(layout.blocks) || anyIn(layout.mobileBlocks);
}

/**
 * The layout saveLayout writes. When no key needs encrypting (the common case,
 * which covers every drag and auto-height persist) it is the layout itself, and
 * the prior-on-disk read is skipped. Otherwise keys are encrypted, with
 * `readPrior` supplying the file's current content for encryptApiKeys'
 * refuse-to-downgrade lookup.
 */
export async function persistableLayout(
  layout: LayoutConfig,
  readPrior: () => Promise<LayoutConfig | null>,
): Promise<LayoutConfig> {
  const known = withKnownCiphertext(layout);
  if (!needsEncryption(known)) return known;
  return encryptApiKeys(known, await readPrior());
}

/**
 * `layout` with each plaintext key this device already encrypted or decrypted
 * replaced by that same ciphertext (M57): an unchanged key costs no encryption,
 * no read of data.json and no change to the file.
 */
function withKnownCiphertext(layout: LayoutConfig): LayoutConfig {
  let changed = false;
  const swap = (blocks: BlockInstance[]): BlockInstance[] => blocks.map(b => {
    const k = b.config.apiKey;
    if (typeof k !== 'string' || !k || isEncrypted(k)) return b;
    const ct = knownCiphertextFor(k);
    if (!ct) return b;
    changed = true;
    return { ...b, config: { ...b.config, apiKey: ct } };
  });
  const blocks = swap(layout.blocks);
  const mobileBlocks = swap(layout.mobileBlocks);
  return changed ? { ...layout, blocks, mobileBlocks } : layout;
}

/**
 * Encrypt every BlockInstance.config.apiKey on the given layout. Returns a new
 * layout with new block objects — never mutates the input.
 *
 * If WebCrypto is unavailable, encryptStringEx returns `ok: false`. To avoid
 * downgrading already-stored ciphertext to plaintext (which would propagate via
 * vault sync), we look up the previously-persisted apiKey from `priorOnDisk` and
 * keep its ciphertext value when the encrypt step fell back to plaintext.
 */
export async function encryptApiKeys(layout: LayoutConfig, priorOnDisk: LayoutConfig | null): Promise<LayoutConfig> {
  const buildPriorMap = (blocks: BlockInstance[] | undefined): Map<string, string> => {
    const m = new Map<string, string>();
    if (!Array.isArray(blocks)) return m;
    for (const b of blocks) {
      const k = b?.config?.apiKey;
      if (typeof k === 'string' && k) m.set(b.id, k);
    }
    return m;
  };
  const priorDesktop = buildPriorMap(priorOnDisk?.blocks);
  const priorMobile = buildPriorMap(priorOnDisk?.mobileBlocks);

  const encryptBlocks = async (blocks: BlockInstance[], prior: Map<string, string>): Promise<BlockInstance[]> =>
    Promise.all(blocks.map(async (b) => {
      const key = b.config.apiKey;
      if (typeof key !== 'string' || !key || isEncrypted(key)) return b;
      const r = await encryptStringEx(key);
      if (!r.ok) {
        // Refuse to overwrite a previously-stored ciphertext with plaintext.
        const previously = prior.get(b.id);
        if (typeof previously === 'string' && isEncrypted(previously)) {
          return { ...b, config: { ...b.config, apiKey: previously } };
        }
        // Transient WebCrypto/IndexedDB failure with no prior ciphertext to
        // fall back to (e.g. import / copy-to-mobile re-minted the id, so the
        // refuse-to-downgrade lookup above missed). Never write plaintext at
        // rest just because crypto hiccupped: drop the key from the persisted
        // copy. The runtime in-memory layout keeps it, and the next save once
        // WebCrypto recovers will encrypt it properly.
        if (r.transient) {
          return { ...b, config: { ...b.config, apiKey: '' } };
        }
        // Permanent (no WebCrypto on this platform) with no prior ciphertext:
        // nothing to protect, so let the plaintext fallback proceed (the warn
        // is logged inside encryptStringEx).
      }
      if (r.ok) rememberCiphertext(key, r.value);
      return { ...b, config: { ...b.config, apiKey: r.value } };
    }));

  const [blocks, mobileBlocks] = await Promise.all([
    encryptBlocks(layout.blocks, priorDesktop),
    encryptBlocks(layout.mobileBlocks, priorMobile),
  ]);
  return { ...layout, blocks, mobileBlocks };
}

/** Ids of the blocks whose key this device could not decrypt, by the block array that holds them. */
export interface UnreadableKeys {
  blocks: string[];
  mobileBlocks: string[];
}

/**
 * Decrypt apiKey fields into a new layout; the input is not modified.
 * A key this device cannot decrypt is left as ciphertext, never cleared: it
 * usually belongs to another device, and a save of a cleared value would
 * erase it for every device through sync. Those blocks are returned in
 * `unreadable` for the caller to report (see unreadableKeyNotice). `stable` is
 * `false` only when the device key was transiently unavailable; callers should
 * skip the post-load resave then and say so. A permanently unreadable key stays
 * stable, because a resave writes the same ciphertext back.
 *
 * The layout, its blocks and their configs are new objects: mutating the input
 * leaked into shared fixtures, and into callers that kept the loaded value.
 */
export async function decryptApiKeys(layout: LayoutConfig): Promise<{ layout: LayoutConfig; stable: boolean; unreadable: UnreadableKeys }> {
  let stable = true;
  const unreadable: UnreadableKeys = { blocks: [], mobileBlocks: [] };

  const decryptBlocks = async (blocks: BlockInstance[], unreadableHere: string[]): Promise<BlockInstance[]> => {
    const out: BlockInstance[] = [];
    for (const b of blocks) {
      const key = b.config.apiKey;
      if (typeof key !== 'string' || !key || !isEncrypted(key)) {
        out.push(b);
        continue;
      }
      const r = await decryptStringEx(key);
      if (r.ok) {
        rememberCiphertext(r.plaintext, key);
        out.push({ ...b, config: { ...b.config, apiKey: r.plaintext } });
      } else if (r.reason === 'no-key' && r.transient) {
        // IndexedDB/WebCrypto hiccuped. Keep the ciphertext on disk untouched
        // (we leave b.config.apiKey alone in memory; blocks treat the encrypted
        // form as no usable key on this device until the next launch retries).
        stable = false;
        out.push(b);
      } else {
        // Permanent failure: most often a key saved on another device, whose
        // device key never leaves that device (also: tampered ciphertext, or no
        // WebCrypto here). Keep the ciphertext: every later save writes the
        // in-memory layout, so clearing it here would erase the key from the
        // synced data.json on every device. Blocks treat an encrypted value as
        // "no usable key on this device"; entering a key replaces it.
        out.push(b);
        unreadableHere.push(b.id);
      }
    }
    return out;
  };

  const desktop = await decryptBlocks(layout.blocks, unreadable.blocks);
  const mobile = await decryptBlocks(layout.mobileBlocks, unreadable.mobileBlocks);
  return { layout: { ...layout, blocks: desktop, mobileBlocks: mobile }, stable, unreadable };
}

/**
 * Whether to tell the user that a key can't be read on this device. Only keys
 * in the block array this device renders count (in Separate mode the other
 * array is the other platform's, and its key is no concern here), and each
 * block is reported once while its key stays unreadable: `recorded` holds the
 * block ids stored at the previous launch, and `record` is what to store now.
 * Block ids, not ciphertexts: the device that owns a key re-encrypts it with a
 * fresh IV at every save, so the ciphertext changes while nothing changed for
 * this device. A block whose key became readable here and later unreadable
 * again drops out of the record in between, so it is reported again.
 */
export function unreadableKeyNotice(
  unreadable: UnreadableKeys,
  renderedArray: keyof UnreadableKeys,
  recorded: unknown,
): { notify: boolean; record: string[] } {
  const told = new Set(Array.isArray(recorded) ? recorded.filter((v): v is string => typeof v === 'string') : []);
  const record = [...unreadable[renderedArray]];
  return { notify: record.some(id => !told.has(id)), record };
}
