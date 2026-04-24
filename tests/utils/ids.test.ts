import { describe, it, expect, vi } from 'vitest';
import { newId } from '../../src/utils/ids';

describe('newId', () => {
  it('returns the native crypto.randomUUID when it is available', () => {
    const spy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
    expect(newId()).toBe('00000000-0000-4000-8000-000000000000');
    spy.mockRestore();
  });

  it('falls back to a URL-safe id when crypto.randomUUID is missing', () => {
    const original = globalThis.crypto.randomUUID;
    // Emulate a WebView that stripped randomUUID from the crypto global.
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const id = newId();
      expect(id).toMatch(/^hp-[a-z0-9]+$/);
      expect(id.length).toBeGreaterThan(6);
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });

  it('produces a different id on each call', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(newId());
    expect(ids.size).toBe(100);
  });
});
