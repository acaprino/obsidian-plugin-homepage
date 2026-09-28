import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeImportedConfig, sanitizeImportedLayout } from '../../src/utils/importSanitizer';
import type { BlockType, LayoutConfig } from '../../src/types';
import { getDefaultLayout } from '../../src/validation';
import { BlockRegistry } from '../../src/BlockRegistry';
import { registerBlocks } from '../../src/main';

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
    defaultConfig: { columns: 2, items: [] },
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

  it('drops an imported __proto__ key instead of failing the whole import', () => {
    stubFactories();
    const imported = JSON.parse('{"__proto__": {"polluted": true}, "showSeconds": true}') as Record<string, unknown>;
    const { config, stripped } = sanitizeImportedConfig('clock', imported);
    expect(config).toEqual({ showSeconds: true });
    expect(stripped).toEqual(['__proto__']);
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

});

describe('sanitizeImportedConfig with the production block factories', () => {
  beforeEach(() => { registerBlocks(); });

  it('keeps every setting of a manual-text quotes block (AP-5)', () => {
    const exported = {
      source: 'text', quotes: 'Stay hungry\nStay foolish', tag: '', columns: 1, maxItems: 0,
      heightMode: 'wrap', textAlign: 'center', verticalAlign: 'middle', showAccentBar: false,
      quoteStyle: 'card', fontStyle: 'serif', customFont: '', dailySeed: false, showNoteTitle: false,
      _titleLabel: 'Mottos',
    };
    const { config, stripped } = sanitizeImportedConfig('quotes-list', exported);
    expect(stripped).toEqual([]);
    expect(config).toEqual(exported);
  });

  it('keeps custom greeting salutations and emoji (AP-5)', () => {
    const exported = {
      name: 'Alfio', showTime: false, showEmoji: true, emojiMode: 'custom',
      emojiMorning: '☕', emojiAfternoon: '🍝', emojiEvening: '🍷', emojiNight: '😴',
      emojiPool: '🌞 🌙', emojiDailySeed: true,
      salutationMode: 'custom', salutationPreset: 'en',
      salutMorning: 'Morning!', salutAfternoon: 'Afternoon!', salutEvening: 'Evening!',
    };
    const { config, stripped } = sanitizeImportedConfig('greeting', exported);
    expect(stripped).toEqual([]);
    expect(config).toEqual(exported);
  });

  it.each([
    ['clock', { showSeconds: true, showDate: false, clockStyle: 'large', format: 'HH:mm' }],
    ['folder-links', { folder: 'Projects', links: [], folderEmoji: '📁', linkAlign: 'center' }],
    ['image-gallery', { folder: 'Art', columns: 2, maxItems: 12, layout: 'masonry', heightMode: 'fixed' }],
    ['embedded-note', { filePath: 'Home.md', showTitle: false, heightMode: 'grow' }],
    ['static-text', { content: 'Hello', heightMode: 'fixed' }],
    ['pomodoro', { workMinutes: 50, breakMinutes: 10, longBreakMinutes: 20, sessionsBeforeLong: 3, soundType: 'bowl', autoStartCycle: true }],
  ])('keeps every %s setting (AP-5)', (type, exported) => {
    const { config, stripped } = sanitizeImportedConfig(type as BlockType, exported);
    expect(stripped).toEqual([]);
    expect(config).toEqual(exported);
  });

  it('strips customCss, which export also removes', () => {
    const { config, stripped } = sanitizeImportedConfig('button-grid', {
      columns: 2, items: [], customCss: '--hp-btn-bg: #000',
    });
    expect('customCss' in config).toBe(false);
    expect(stripped).toContain('customCss');
  });

  it.each([
    ['button-grid', 'items', null],
    ['bookmarks', 'items', {}],
    ['folder-links', 'links', 5],
    ['recent-files', 'excludeFolders', ['Archive']],
    ['video-embed', 'url', 42],
    ['quotes-list', 'maxItems', '10'],
  ])('drops a %s %s whose type differs from the declared default (RF-S3)', (type, key, bad) => {
    const { config, stripped } = sanitizeImportedConfig(type as BlockType, { [key]: bad });
    expect(key in config).toBe(false);
    expect(stripped).toEqual([key]);
  });

  it('keeps only a primitive for a declared setting that has no default', () => {
    const { config, stripped } = sanitizeImportedConfig('greeting', {
      salutMorning: { text: 'Morning!' },
      salutEvening: 'Sera',
    });
    expect('salutMorning' in config).toBe(false);
    expect(stripped).toEqual(['salutMorning']);
    expect(config.salutEvening).toBe('Sera');
  });
});

describe('imported styling values follow the settings ranges (AP-4)', () => {
  // The bounds the block settings sliders offer (BlockSettingsModal), written out by hand.
  it.each([
    ['_titleGap', 0, 48],
    ['_cardPadding', -48, 48],
    ['_bgOpacity', 0, 100],
    ['_backdropBlur', 0, 20],
    ['_borderWidth', 0, 4],
    ['_borderRadius', 0, 24],
    ['_elevation', 0, 3],
    ['_accentIntensity', 5, 100],
    ['_gradientAngle', 0, 360],
  ])('%s keeps every value from %i to %i and clamps the rest to that range', (key, min, max) => {
    stubFactories();
    const imported = (v: number) => sanitizeImportedConfig('clock', { [key]: v }).config[key];
    expect(imported(min)).toBe(min);
    expect(imported(max)).toBe(max);
    expect(imported(min - 1)).toBe(min);
    expect(imported(max + 1)).toBe(max);
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
