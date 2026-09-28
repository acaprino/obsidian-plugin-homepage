import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { App } from 'obsidian';
import { VoiceDictationBlock } from '../../src/blocks/VoiceDictationBlock';
import type { IHomepagePlugin, BlockInstance } from '../../src/types';

/** A key this device cannot decrypt stays in the layout in its at-rest form. */
const CIPHERTEXT = 'enc:v1:AAAAAAAAAAAAAAAA:BBBBBBBBBBBB';

function makeBlock(config: Record<string, unknown>): VoiceDictationBlock {
  const instance: BlockInstance = { id: 'v1', type: 'voice-dictation', x: 0, y: 0, w: 2, h: 3, config };
  return new VoiceDictationBlock({} as App, instance, {} as IHomepagePlugin);
}

// Recording needs MediaRecorder and getUserMedia, which happy-dom lacks. Stub both
// so the only thing that can disable the mic in these tests is the API key.
let restoreRecording: () => void = () => {};
beforeEach(() => {
  document.body.empty();
  const g = globalThis as Record<string, unknown>;
  const prevRecorder = g.MediaRecorder;
  g.MediaRecorder = class { static isTypeSupported(): boolean { return true; } };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: () => Promise.reject(new Error('not used by these tests')) },
  });
  restoreRecording = () => {
    g.MediaRecorder = prevRecorder;
    delete (navigator as unknown as Record<string, unknown>).mediaDevices;
  };
});
afterEach(() => restoreRecording());

function typeInto(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function renderKeyField(draft: Record<string, unknown>): HTMLInputElement {
  const body = document.body.createDiv();
  makeBlock({}).renderContentSettings(body, draft);
  return body.querySelector('input[type="password"]') as HTMLInputElement;
}

describe('VoiceDictationBlock API key setting', () => {
  it('shows an empty field for a key saved on another device, and keeps that key when left empty (RF-S1)', () => {
    const draft: Record<string, unknown> = { provider: 'whisper', apiKey: CIPHERTEXT };
    const field = renderKeyField(draft);

    expect(field.value).toBe('');
    typeInto(field, 'sk-typo');
    typeInto(field, '');
    expect(draft.apiKey).toBe(CIPHERTEXT);
  });

  it('replaces a key saved on another device when a new key is entered', () => {
    const draft: Record<string, unknown> = { provider: 'whisper', apiKey: CIPHERTEXT };
    const field = renderKeyField(draft);

    typeInto(field, '  sk-new-key  ');
    expect(draft.apiKey).toBe('sk-new-key');
  });

  it('still clears a key this device can read when the field is emptied', () => {
    const draft: Record<string, unknown> = { provider: 'whisper', apiKey: 'sk-readable' };
    const field = renderKeyField(draft);

    expect(field.value).toBe('sk-readable');
    typeInto(field, '');
    expect(draft.apiKey).toBe('');
  });
});

describe('VoiceDictationBlock with a key it cannot use', () => {
  it('does not offer to record with a key saved on another device (RF-S1, RF-R16)', () => {
    const el = document.body.createDiv();
    makeBlock({ apiKey: CIPHERTEXT }).render(el);

    const mic = el.querySelector('button.voice-mic') as HTMLButtonElement;
    expect(mic.disabled).toBe(true);
    expect(el.querySelector('.voice-status')?.textContent).toMatch(/unavailable on this device/i);
  });

  it('offers to record with a key this device can use', () => {
    const el = document.body.createDiv();
    makeBlock({ apiKey: 'sk-plain-key' }).render(el);

    const mic = el.querySelector('button.voice-mic') as HTMLButtonElement;
    expect(mic.disabled).toBe(false);
  });
});
