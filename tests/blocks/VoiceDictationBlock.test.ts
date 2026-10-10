import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Modal } from 'obsidian';
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

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported(): boolean { return true; }
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: unknown) { FakeRecorder.instances.push(this); }
  start(): void { this.state = 'recording'; }
  stop(): void { this.state = 'inactive'; this.onstop?.(); }
}

describe('VoiceDictationBlock recording lifecycle', () => {
  let micRequests = 0;
  let openMic: (() => void) = () => {};
  let track = { stopped: false, stop() { this.stopped = true; } };

  beforeEach(() => {
    FakeRecorder.instances = [];
    micRequests = 0;
    track = { stopped: false, stop() { this.stopped = true; } };
    (globalThis as Record<string, unknown>).MediaRecorder = FakeRecorder;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => new Promise(resolve => {
          micRequests++;
          openMic = () => resolve({ getTracks: () => [track] });
        }),
      },
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  function mountRecorder(config: Record<string, unknown>, consent: Record<string, boolean> | null = { whisper: true }) {
    let stored: unknown = consent;
    const app = { loadLocalStorage: () => stored, saveLocalStorage: (_k: string, v: unknown) => { stored = v; } } as unknown as App;
    const instance: BlockInstance = { id: 'v1', type: 'voice-dictation', x: 0, y: 0, w: 2, h: 3, config: { apiKey: 'sk-key', ...config } };
    const block = new VoiceDictationBlock(app, instance, {} as IHomepagePlugin);
    const el = document.body.createDiv();
    block.load();
    block.render(el);
    const mic = el.querySelector('button.voice-mic') as HTMLButtonElement;
    return { block, el, mic, consent: () => stored };
  }
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  it('starts one recorder for a double tap while the microphone opens (M16)', async () => {
    const { mic } = mountRecorder({ triggerMode: 'tap' });

    mic.click();
    mic.click();
    openMic();
    await settle();

    expect(micRequests).toBe(1);
    expect(FakeRecorder.instances).toHaveLength(1);
  });

  it('records nothing and closes the stream when push-to-talk is released before the microphone opens (S1)', async () => {
    const { el, mic } = mountRecorder({ triggerMode: 'push' });

    mic.dispatchEvent(new Event('pointerdown'));
    mic.dispatchEvent(new Event('pointerup'));
    openMic();
    await settle();

    expect(FakeRecorder.instances).toHaveLength(0);
    expect(track.stopped).toBe(true);
    expect(el.dataset.voiceState).toBe('idle');
  });

  it('only asks for consent on the first push-to-talk press; the next press records (S1)', async () => {
    vi.spyOn(Modal.prototype, 'open').mockImplementation(function (this: Modal) {
      this.onOpen();
      (this.contentEl.querySelector('button.mod-cta') as HTMLButtonElement).click();
    });
    const { mic, consent } = mountRecorder({ triggerMode: 'push' }, null);

    mic.dispatchEvent(new Event('pointerdown'));
    await settle();
    expect(consent()).toEqual({ whisper: true });
    expect(micRequests).toBe(0);

    mic.dispatchEvent(new Event('pointerdown'));
    openMic();
    await settle();
    expect(FakeRecorder.instances).toHaveLength(1);
  });

  it('closes the stream of a start that was still pending when the block unloaded (N21)', async () => {
    const { block, mic } = mountRecorder({ triggerMode: 'tap' });

    mic.click();
    block.unload();
    openMic();
    await settle();

    expect(FakeRecorder.instances).toHaveLength(0);
    expect(track.stopped).toBe(true);
  });
});

describe('VoiceDictationBlock without an API key (N9)', () => {
  it('says so in its status line and disables the mic', () => {
    const el = document.body.createDiv();
    makeBlock({}).render(el);

    expect(el.querySelector('.voice-status')?.textContent).toMatch(/API key/);
    expect((el.querySelector('button.voice-mic') as HTMLButtonElement).disabled).toBe(true);
  });
});
