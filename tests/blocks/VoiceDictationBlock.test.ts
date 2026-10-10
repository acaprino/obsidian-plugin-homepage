import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Modal, Notice, TFolder, requestUrlMock } from 'obsidian';
import type { App } from 'obsidian';
import { VoiceDictationBlock, whisperTextFields } from '../../src/blocks/VoiceDictationBlock';
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

  it('keeps a key saved on another device after typing, switching provider and clearing the field (M56)', () => {
    const draft: Record<string, unknown> = { provider: 'whisper', apiKey: CIPHERTEXT };
    const body = document.body.createDiv();
    makeBlock({}).renderContentSettings(body, draft);
    typeInto(body.querySelector('input[type="password"]') as HTMLInputElement, 'sk-typo');
    const provider = [...body.querySelectorAll('.setting-item')]
      .find(el => el.querySelector('.setting-item-name')?.textContent === 'Transcription provider')!
      .querySelector('select') as HTMLSelectElement;
    provider.value = 'gemini';
    provider.dispatchEvent(new Event('change')); // re-renders the settings

    typeInto(body.querySelector('input[type="password"]') as HTMLInputElement, '');

    expect(draft.apiKey).toBe(CIPHERTEXT);
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
  static failStart = false;
  static isTypeSupported(): boolean { return true; }
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: unknown) { FakeRecorder.instances.push(this); }
  timeslice: number | undefined;
  start(timeslice?: number): void {
    if (FakeRecorder.failStart) throw new Error('NotSupportedError');
    this.timeslice = timeslice;
    this.state = 'recording';
  }
  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio bytes']) });
    this.onstop?.();
  }
}

describe('VoiceDictationBlock recording lifecycle', () => {
  let micRequests = 0;
  let openMic: (() => void) = () => {};
  let track = { stopped: false, stop() { this.stopped = true; } };

  beforeEach(() => {
    FakeRecorder.instances = [];
    FakeRecorder.failStart = false;
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

  it('returns to idle and closes the stream when the recorder cannot start', async () => {
    FakeRecorder.failStart = true;
    const { el, mic } = mountRecorder({ triggerMode: 'tap' });

    mic.click();
    openMic();
    await settle();

    expect(el.dataset.voiceState).toBe('idle');
    expect(track.stopped).toBe(true);
  });

  it('says in the consent dialog that the consent can be withdrawn (N18)', async () => {
    let text = '';
    vi.spyOn(Modal.prototype, 'open').mockImplementation(function (this: Modal) {
      this.onOpen();
      text = this.contentEl.textContent ?? '';
      this.close();
    });
    const { mic } = mountRecorder({ triggerMode: 'tap' }, null);

    mic.click();
    await settle();

    expect(text).toMatch(/block settings/);
    expect(text).not.toMatch(/not see it again/);
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

describe('Whisper form fields (N20)', () => {
  it('sends the model and a language code', () => {
    expect(whisperTextFields({ language: 'it' })).toEqual({ model: 'gpt-transcribe', language: 'it' });
  });

  it('leaves out a language that is not a language code, so it cannot change the request body', () => {
    expect(whisperTextFields({ language: 'en\r\n--x' })).toEqual({ model: 'gpt-transcribe' });
  });

  it('refuses a model name with characters no model name has (N20)', () => {
    expect(() => whisperTextFields({ model: 'whisper-1"\r\n' })).toThrow('Invalid Whisper model name');
  });
});

describe('VoiceDictationBlock upload consent (N18)', () => {
  it('forgets the consent this device gave when asked', () => {
    let stored: unknown = { whisper: true };
    const app = { loadLocalStorage: () => stored, saveLocalStorage: (_k: string, v: unknown) => { stored = v; } } as unknown as App;
    const instance: BlockInstance = { id: 'v1', type: 'voice-dictation', x: 0, y: 0, w: 2, h: 3, config: {} };
    const body = document.body.createDiv();
    new VoiceDictationBlock(app, instance, {} as IHomepagePlugin).renderContentSettings(body, { provider: 'whisper' });

    ([...body.querySelectorAll('button')].find(b => b.textContent === 'Forget') as HTMLButtonElement).click();

    expect(stored).toEqual({ whisper: false });
    expect([...body.querySelectorAll('button')].some(b => b.textContent === 'Forget')).toBe(false);
  });
});

/** A vault double that records the notes and files the block writes. */
function makeVault(folders: string[] = []) {
  const created: Record<string, string> = {};
  const binaries: string[] = [];
  const createdFolders: string[] = [];
  const root = new TFolder();
  root.path = '';
  const folderObjs = folders.map(path => {
    const f = new TFolder();
    f.path = path;
    (f as unknown as { name: string }).name = path.split('/').pop() ?? path;
    return f;
  });
  root.children = folderObjs;
  const byPath = (p: string) => folderObjs.find(f => f.path === p) ?? (p in created ? { path: p } : null);
  return {
    created, binaries, createdFolders,
    vault: {
      getRoot: () => root,
      getAbstractFileByPath: (p: string) => byPath(p),
      createFolder: async (p: string) => {
        if (folders.some(f => f.toLowerCase() === p.toLowerCase())) throw new Error('Folder already exists.');
        createdFolders.push(p);
      },
      create: async (p: string, data: string) => { created[p] = data; return {}; },
      createBinary: async (p: string) => { binaries.push(p); return {}; },
    },
  };
}

describe('VoiceDictationBlock transcription and saving', () => {
  let openMic: () => void = () => {};
  const settle = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms));

  beforeEach(() => {
    FakeRecorder.instances = [];
    FakeRecorder.failStart = false;
    Notice.messages = [];
    requestUrlMock.reset();
    (globalThis as Record<string, unknown>).MediaRecorder = FakeRecorder;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => new Promise(resolve => { openMic = () => resolve({ getTracks: () => [{ stop() {} }] }); }) },
    });
  });
  afterEach(() => { requestUrlMock.reset(); vi.restoreAllMocks(); });

  function mountWithVault(config: Record<string, unknown>, folders: string[] = []) {
    const v = makeVault(folders);
    const app = { loadLocalStorage: () => ({ whisper: true, gemini: true }), saveLocalStorage: () => {}, vault: v.vault } as unknown as App;
    const instance: BlockInstance = { id: 'v1', type: 'voice-dictation', x: 0, y: 0, w: 2, h: 3, config: { apiKey: 'sk-key', triggerMode: 'tap', ...config } };
    const block = new VoiceDictationBlock(app, instance, {} as IHomepagePlugin);
    const el = document.body.createDiv();
    block.load();
    block.render(el);
    const mic = el.querySelector('button.voice-mic') as HTMLButtonElement;
    const record = async () => { mic.click(); openMic(); await settle(); };
    const stop = async () => { mic.click(); await settle(); };
    return { ...v, el, mic, record, stop };
  }

  it('sends the current default model, gpt-transcribe (M15)', async () => {
    requestUrlMock.handler = async () => ({ status: 200, text: '', json: { text: 'hello' } });
    const b = mountWithVault({});
    await b.record();
    await b.stop();

    const body = new TextDecoder().decode(requestUrlMock.calls[0].body as ArrayBuffer);
    expect(body).toContain('gpt-transcribe');
  });

  it('says which model the key cannot use on a 404 (M15)', async () => {
    requestUrlMock.handler = async () => ({ status: 404, text: '', json: {} });
    const b = mountWithVault({ provider: 'gemini', model: 'gemini-9-ultra' });
    await b.record();
    await b.stop();

    expect(Notice.messages.some(m => m.includes('gemini-9-ultra'))).toBe(true);
  });

  it('keeps the recording as a file, linked from a note, when transcription fails (M19)', async () => {
    requestUrlMock.handler = async () => ({ status: 500, text: '', json: {} });
    const b = mountWithVault({ folder: 'Voice' }, ['Voice']);
    await b.record();
    await b.stop();

    expect(b.binaries).toHaveLength(1);
    expect(b.binaries[0]).toMatch(/^Voice\/.+\.webm$/);
    const note = Object.values(b.created)[0];
    expect(note).toContain(`![[${b.binaries[0].split('/').pop()}]]`);
  });

  it('keeps the recording and says why when Gemini returns no text (M63)', async () => {
    requestUrlMock.handler = async () => ({ status: 200, text: '', json: { promptFeedback: { blockReason: 'SAFETY' } } });
    const b = mountWithVault({ provider: 'gemini' });
    await b.record();
    await b.stop();

    expect(b.binaries).toHaveLength(1);
    expect(Notice.messages.some(m => /blocked: SAFETY/.test(m))).toBe(true);
  });

  it('stops recording before the provider size limit (M19)', async () => {
    const b = mountWithVault({});
    await b.record();
    const rec = FakeRecorder.instances[0];
    expect(rec.timeslice).toBeGreaterThan(0);

    rec.ondataavailable?.({ data: { size: 30 * 1024 * 1024 } as Blob });
    await settle();

    expect(rec.state).toBe('inactive');
    expect(Notice.messages.some(m => /limit/i.test(m))).toBe(true);
  });

  it('saves into an existing folder whose name differs only in letter case (M18)', async () => {
    requestUrlMock.handler = async () => ({ status: 200, text: '', json: { text: 'hello' } });
    const b = mountWithVault({ folder: 'voice' }, ['Voice']);
    await b.record();
    await b.stop();

    expect(b.createdFolders).toEqual([]);
    expect(Object.keys(b.created)[0]).toMatch(/^Voice\/.+\.md$/);
  });
});

describe('VoiceDictationBlock push-to-talk (M62)', () => {
  beforeEach(() => {
    FakeRecorder.instances = [];
    (globalThis as Record<string, unknown>).MediaRecorder = FakeRecorder;
  });

  it('can be held with Space or Enter from the keyboard', async () => {
    let opened = 0;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => { opened++; return Promise.resolve({ getTracks: () => [{ stop() {} }] }); } },
    });
    const app = { loadLocalStorage: () => ({ whisper: true }), saveLocalStorage: () => {} } as unknown as App;
    const instance: BlockInstance = { id: 'v1', type: 'voice-dictation', x: 0, y: 0, w: 2, h: 3, config: { apiKey: 'sk-key', triggerMode: 'push' } };
    const block = new VoiceDictationBlock(app, instance, {} as IHomepagePlugin);
    const el = document.body.createDiv();
    block.load();
    block.render(el);
    const mic = el.querySelector('button.voice-mic') as HTMLButtonElement;

    mic.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(el.dataset.voiceState).toBe('recording');
    mic.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));

    expect(opened).toBe(1);
    expect(FakeRecorder.instances[0].state).toBe('inactive');
  });

  it('is not cancelled by a slight pan: the button takes no touch gestures', () => {
    const app = { loadLocalStorage: () => ({ whisper: true }), saveLocalStorage: () => {} } as unknown as App;
    const instance: BlockInstance = { id: 'v1', type: 'voice-dictation', x: 0, y: 0, w: 2, h: 3, config: { apiKey: 'sk-key', triggerMode: 'push' } };
    const el = document.body.createDiv();
    new VoiceDictationBlock(app, instance, {} as IHomepagePlugin).render(el);

    expect(el.querySelector('button.voice-mic')?.classList.contains('voice-mic--push')).toBe(true);
  });
});
