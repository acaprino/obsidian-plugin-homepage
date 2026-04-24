import { describe, it, expect } from 'vitest';
import { sanitizeImportedConfig, sanitizeImportedLayout } from '../../src/utils/importSanitizer';
import type { LayoutConfig } from '../../src/types';
import { getDefaultLayout } from '../../src/validation';
import { BlockRegistry } from '../../src/BlockRegistry';

// importSanitizer consults BlockRegistry to decide which keys a factory declares.
// Register a minimal stub for each type we touch so the whitelist has known-good
// keys to compare against.
function stubFactories(): void {
  BlockRegistry.clear();
  BlockRegistry.register({
    type: 'voice-dictation',
    displayName: 'Voice',
    defaultConfig: { folder: '', model: '', language: '', apiKey: '' },
    defaultSize: { w: 1, h: 1 },
    create: () => ({} as never),
  });
  BlockRegistry.register({
    type: 'button-grid',
    displayName: 'Buttons',
    defaultConfig: { columns: 2, items: [], customCss: '' },
    defaultSize: { w: 1, h: 1 },
    create: () => ({} as never),
  });
  BlockRegistry.register({
    type: 'clock',
    displayName: 'Clock',
    defaultConfig: { showSeconds: false, showDate: true },
    defaultSize: { w: 1, h: 1 },
    create: () => ({} as never),
  });
}

describe('sanitizeImportedConfig', () => {
  it('strips apiKey unconditionally', () => {
    stubFactories();
    const { config, stripped } = sanitizeImportedConfig('voice-dictation', {
      folder: 'Voice',
      apiKey: 'sk-very-secret',
    });
    expect(config.apiKey).toBeUndefined();
    expect(config.folder).toBe('Voice');
    expect(stripped).toContain('apiKey');
  });

  it('keeps known keys declared by the factory', () => {
    stubFactories();
    const { config, stripped } = sanitizeImportedConfig('clock', {
      showSeconds: true,
      showDate: false,
    });
    expect(config).toEqual({ showSeconds: true, showDate: false });
    expect(stripped).toEqual([]);
  });

  it('strips unknown non-underscore keys', () => {
    stubFactories();
    const { config, stripped } = sanitizeImportedConfig('clock', {
      showSeconds: true,
      maliciousKey: 'payload',
    });
    expect(config.maliciousKey).toBeUndefined();
    expect(stripped).toContain('maliciousKey');
  });

  it('keeps `_`-prefixed shared styling keys (even unknown ones) to survive future additions', () => {
    stubFactories();
    const { config, stripped } = sanitizeImportedConfig('clock', {
      _titleLabel: 'My clock',
      _futureStylingKey: 'future',
    });
    expect(config._titleLabel).toBe('My clock');
    expect(config._futureStylingKey).toBe('future');
    expect(stripped).toEqual([]);
  });

  it('preserves customCss on button-grid (the factory declares it)', () => {
    stubFactories();
    const { config, stripped } = sanitizeImportedConfig('button-grid', {
      columns: 3,
      customCss: '--hp-btn-color: red',
    });
    expect(config.customCss).toBe('--hp-btn-color: red');
    expect(stripped).toEqual([]);
  });
});

describe('sanitizeImportedLayout', () => {
  it('applies config sanitization to both desktop and mobile blocks and reports total strips', () => {
    stubFactories();
    const layout: LayoutConfig = {
      ...getDefaultLayout(),
      blocks: [
        { id: 'a', type: 'voice-dictation', x: 0, y: 0, w: 1, h: 1,
          config: { folder: '', apiKey: 'sk-LEAKED', bogus: 1 } },
      ],
      mobileBlocks: [
        { id: 'b', type: 'clock', x: 0, y: 0, w: 1, h: 1,
          config: { showSeconds: true, bogus: 'x' } },
      ],
    };
    const { layout: safe, strippedCount } = sanitizeImportedLayout(layout);
    expect(safe.blocks[0].config.apiKey).toBeUndefined();
    expect(safe.blocks[0].config.bogus).toBeUndefined();
    expect(safe.mobileBlocks[0].config.bogus).toBeUndefined();
    expect(safe.mobileBlocks[0].config.showSeconds).toBe(true);
    expect(strippedCount).toBe(3); // apiKey + desktop bogus + mobile bogus
  });
});
