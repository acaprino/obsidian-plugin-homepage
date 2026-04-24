import { describe, it, expect, beforeEach } from 'vitest';
import { decryptString, encryptString, isEncrypted, _resetDeviceKeyCache } from '../../src/utils/apiKeyCrypto';

/**
 * These tests only run in environments where WebCrypto + IndexedDB are available.
 * Happy-dom exposes both. When the crypto helpers can't initialise (missing key
 * generation / IDB support) encryptString falls back to plaintext — the tests
 * marked (crypto) skip themselves in that case so CI on bare-node won't fail.
 */
const hasCryptoAndIdb =
  typeof globalThis.crypto?.subtle?.generateKey === 'function' &&
  typeof globalThis.indexedDB !== 'undefined';

beforeEach(() => {
  _resetDeviceKeyCache();
});

describe('isEncrypted', () => {
  it('detects the enc:v1: wire-format prefix', () => {
    expect(isEncrypted('enc:v1:iv:ct')).toBe(true);
    expect(isEncrypted('plain value')).toBe(false);
    expect(isEncrypted('')).toBe(false);
    expect(isEncrypted('enc:v0:iv:ct')).toBe(false); // different version
  });
});

describe('encryptString / decryptString', () => {
  it.skipIf(!hasCryptoAndIdb)('round-trips any plaintext (crypto)', async () => {
    const plaintexts = ['sk-short', 'sk-live-' + 'x'.repeat(48), 'unicode → 🔐 ∂', '   whitespace   '];
    for (const pt of plaintexts) {
      const enc = await encryptString(pt);
      expect(isEncrypted(enc)).toBe(true);
      expect(enc).not.toContain(pt); // sanity
      const dec = await decryptString(enc);
      expect(dec).toBe(pt);
    }
  });

  it('is idempotent for empty strings (no encryption needed)', async () => {
    expect(await encryptString('')).toBe('');
    expect(await decryptString('')).toBe('');
  });

  it.skipIf(!hasCryptoAndIdb)('is idempotent — encrypting an already-encrypted value is a no-op (crypto)', async () => {
    const enc = await encryptString('sk-secret');
    expect(isEncrypted(enc)).toBe(true);
    expect(await encryptString(enc)).toBe(enc);
  });

  it.skipIf(!hasCryptoAndIdb)('returns null when ciphertext is tampered (crypto)', async () => {
    const enc = await encryptString('sk-secret');
    // Flip the last base64 character — AES-GCM authenticates, so this must fail.
    const tampered = enc.slice(0, -2) + (enc.at(-2) === 'a' ? 'b' : 'a') + enc.at(-1);
    const result = await decryptString(tampered);
    expect(result).toBeNull();
  });

  it('returns null on malformed enc:v1: payloads', async () => {
    expect(await decryptString('enc:v1:no-separator')).toBeNull();
  });

  it('treats non-encrypted input as plaintext pass-through', async () => {
    expect(await decryptString('plain')).toBe('plain');
  });

  it.skipIf(!hasCryptoAndIdb)('two encryptions of the same plaintext produce different ciphertexts (IV reuse check)', async () => {
    const a = await encryptString('sk-same');
    const b = await encryptString('sk-same');
    expect(a).not.toBe(b);
    expect(await decryptString(a)).toBe('sk-same');
    expect(await decryptString(b)).toBe('sk-same');
  });
});
