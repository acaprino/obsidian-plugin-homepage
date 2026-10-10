import { describe, it, expect, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { decryptApiKeys, encryptApiKeys, persistableLayout, unreadableKeyNotice } from '../../src/utils/apiKeyLayout';
import { _resetDeviceKeyCache, decryptStringEx, isEncrypted } from '../../src/utils/apiKeyCrypto';
import { getDefaultLayout } from '../../src/validation';
import type { LayoutConfig } from '../../src/types';

const originalIndexedDb = globalThis.indexedDB;

/**
 * Switch to a fresh device: each Obsidian install keeps its encryption key in its
 * own IndexedDB, so a new, empty IndexedDB is a new device.
 */
function useNewDevice(): void {
  globalThis.indexedDB = new IDBFactory();
  _resetDeviceKeyCache();
}

afterEach(() => {
  globalThis.indexedDB = originalIndexedDb;
  _resetDeviceKeyCache();
});

function layoutWithVoiceKey(apiKey: string): LayoutConfig {
  const layout = getDefaultLayout();
  layout.blocks = [{ id: 'voice', type: 'voice-dictation', x: 0, y: 0, w: 2, h: 3, config: { provider: 'whisper', apiKey } }];
  layout.mobileBlocks = [];
  return layout;
}

describe('API keys in a data.json synced between devices', () => {
  it('keeps a key saved on another device through this device\'s load and next save (RF-S1)', async () => {
    useNewDevice(); // device A saves its key
    const onDiskFromA = await encryptApiKeys(layoutWithVoiceKey('sk-device-a'), null);
    const ciphertext = onDiskFromA.blocks[0].config.apiKey as string;
    expect(isEncrypted(ciphertext)).toBe(true);

    useNewDevice(); // device B opens the synced data.json
    expect((await decryptStringEx(ciphertext)).ok).toBe(false); // harness check: B really cannot read A's key

    const { layout: loadedOnB, unreadable } = await decryptApiKeys(structuredClone(onDiskFromA));
    expect(loadedOnB.blocks[0].config.apiKey).toBe(ciphertext);
    expect(unreadable).toEqual({ blocks: ['voice'], mobileBlocks: [] });

    // Whatever B saves next (drag, setting, the post-load resave) still carries A's key.
    const onDiskFromB = await persistableLayout(loadedOnB, async () => onDiskFromA);
    expect(onDiskFromB.blocks[0].config.apiKey).toBe(ciphertext);
  });

  it('still decrypts a key saved on the same device', async () => {
    useNewDevice();
    const onDisk = await encryptApiKeys(layoutWithVoiceKey('sk-same-device'), null);
    // A new session on the same device: the key comes back from IndexedDB, not
    // from memory (M126).
    _resetDeviceKeyCache();

    const { layout: loaded, stable, unreadable } = await decryptApiKeys(structuredClone(onDisk));

    expect(stable).toBe(true);
    expect(unreadable).toEqual({ blocks: [], mobileBlocks: [] });
    expect(loaded.blocks[0].config.apiKey).toBe('sk-same-device');
  });
});

describe('persistableLayout', () => {
  it('writes a layout whose keys are empty or ciphertext as it is, without reading the file', async () => {
    const layout = layoutWithVoiceKey('enc:v1:AAAAAAAAAAAAAAAA:BBBBBBBB');
    layout.blocks.push({ id: 'voice2', type: 'voice-dictation', x: 0, y: 3, w: 2, h: 3, config: { apiKey: '' } });
    let priorReads = 0;

    const out = await persistableLayout(layout, async () => { priorReads++; return null; });

    expect(out).toBe(layout);
    expect(priorReads).toBe(0);
  });

  it('encrypts a plaintext key, reading the file once for the refuse-to-downgrade check', async () => {
    useNewDevice();
    let priorReads = 0;

    const out = await persistableLayout(layoutWithVoiceKey('sk-plain'), async () => { priorReads++; return null; });

    expect(isEncrypted(out.blocks[0].config.apiKey as string)).toBe(true);
    expect(priorReads).toBe(1);
  });
});

describe('unreadableKeyNotice', () => {
  const unreadable = (blocks: string[], mobileBlocks: string[] = []) => ({ blocks, mobileBlocks });

  it('says nothing about a key in the block array this device does not render (Separate mode)', () => {
    const r = unreadableKeyNotice(unreadable([], ['phone-voice']), 'blocks', null);
    expect(r.notify).toBe(false);
  });

  it('tells once about a block whose key this device cannot read', () => {
    const first = unreadableKeyNotice(unreadable(['voice']), 'blocks', null);
    expect(first.notify).toBe(true);

    const nextLaunch = unreadableKeyNotice(unreadable(['voice']), 'blocks', first.record);
    expect(nextLaunch.notify).toBe(false);
  });

  it('does not tell again when the device that owns the key saves it anew (Unified mode)', async () => {
    useNewDevice(); // device A: two sessions with the same key, each save a fresh IV
    const firstSave = await encryptApiKeys(layoutWithVoiceKey('sk-device-a'), null);
    _resetDeviceKeyCache(); // A restarts: its next session encrypts anew
    const secondSave = await encryptApiKeys(layoutWithVoiceKey('sk-device-a'), null);
    expect(secondSave.blocks[0].config.apiKey).not.toBe(firstSave.blocks[0].config.apiKey);

    useNewDevice(); // device B launches after each of A's sessions
    const launch1 = await decryptApiKeys(structuredClone(firstSave));
    const told = unreadableKeyNotice(launch1.unreadable, 'blocks', null);
    const launch2 = await decryptApiKeys(structuredClone(secondSave));
    const again = unreadableKeyNotice(launch2.unreadable, 'blocks', told.record);

    expect(told.notify).toBe(true);
    expect(again.notify).toBe(false);
  });

  it('tells again when a key that had become readable here turns unreadable again', () => {
    const first = unreadableKeyNotice(unreadable(['voice']), 'blocks', null);
    const readable = unreadableKeyNotice(unreadable([]), 'blocks', first.record); // a key entered here
    const replaced = unreadableKeyNotice(unreadable(['voice']), 'blocks', readable.record); // replaced elsewhere

    expect(readable.notify).toBe(false);
    expect(replaced.notify).toBe(true);
  });

  it('tells about a key on the mobile array when that is the one rendered', () => {
    const r = unreadableKeyNotice(unreadable([], ['voice']), 'mobileBlocks', null);
    expect(r.notify).toBe(true);
  });

  it('treats a malformed record as nothing told yet', () => {
    const r = unreadableKeyNotice(unreadable(['voice']), 'blocks', { not: 'an array' });
    expect(r.notify).toBe(true);
  });
});

describe('decryptApiKeys leaves its input alone', () => {
  it('returns the decrypted blocks in a new layout object', async () => {
    useNewDevice();
    const atRest = await encryptApiKeys(layoutWithVoiceKey('sk-test'), null);
    const before = structuredClone(atRest);

    const { layout } = await decryptApiKeys(atRest);

    expect(atRest).toStrictEqual(before);
    expect(layout.blocks[0].config.apiKey).toBe('sk-test');
  });
});

describe('persistableLayout reuses the ciphertext of an unchanged key (M57)', () => {
  it('writes the same ciphertext on every save, without reading the file again', async () => {
    useNewDevice();
    let reads = 0;
    const readPrior = async () => { reads++; return null; };
    const layout = layoutWithVoiceKey('sk-same');

    const first = await persistableLayout(layout, readPrior);
    const second = await persistableLayout(layout, readPrior);

    expect(second.blocks[0].config.apiKey).toBe(first.blocks[0].config.apiKey);
    expect(reads).toBe(1);
  });

  it('writes back the ciphertext it decrypted at load', async () => {
    useNewDevice();
    const atRest = await encryptApiKeys(layoutWithVoiceKey('sk-loaded'), null);
    const { layout } = await decryptApiKeys(structuredClone(atRest));
    let reads = 0;

    const saved = await persistableLayout(layout, async () => { reads++; return null; });

    expect(saved.blocks[0].config.apiKey).toBe(atRest.blocks[0].config.apiKey);
    expect(reads).toBe(0);
  });

  it('encrypts a key that changed', async () => {
    useNewDevice();
    const first = await persistableLayout(layoutWithVoiceKey('sk-one'), async () => null);
    const second = await persistableLayout(layoutWithVoiceKey('sk-two'), async () => null);

    expect(second.blocks[0].config.apiKey).not.toBe(first.blocks[0].config.apiKey);
    expect((await decryptStringEx(second.blocks[0].config.apiKey as string))).toMatchObject({ ok: true, plaintext: 'sk-two' });
  });
});

describe('no plaintext key reaches data.json (M14)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('keeps the stored ciphertext when encryption fails this save', async () => {
    useNewDevice();
    const stored = await encryptApiKeys(layoutWithVoiceKey('sk-old'), null);
    _resetDeviceKeyCache();
    vi.spyOn(crypto.subtle, 'encrypt').mockRejectedValue(new Error('OperationError'));

    const written = await persistableLayout(layoutWithVoiceKey('sk-new'), async () => stored);

    expect(written.blocks[0].config.apiKey).toBe(stored.blocks[0].config.apiKey);
  });

  it('writes no key at all when encryption fails and nothing was stored', async () => {
    useNewDevice();
    vi.spyOn(crypto.subtle, 'encrypt').mockRejectedValue(new Error('OperationError'));

    const written = await persistableLayout(layoutWithVoiceKey('sk-new'), async () => null);

    expect(written.blocks[0].config.apiKey).toBe('');
  });

  it('encrypts a key held only by a mobile block', async () => {
    useNewDevice();
    const layout = getDefaultLayout();
    layout.blocks = [];
    layout.mobileBlocks = [{ id: 'm', type: 'voice-dictation', x: 0, y: 0, w: 2, h: 3, config: { apiKey: 'sk-mobile' } }];

    const written = await persistableLayout(layout, async () => null);

    expect(isEncrypted(written.mobileBlocks[0].config.apiKey as string)).toBe(true);
  });
});
