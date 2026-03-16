# Voice Dictation Block — Implementation Plan

> **For agentic workers:** Use subagent-driven execution (if subagents available) or ai-tooling:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `voice-dictation` block that lets users tap a mic button to record a voice note, which is automatically transcribed (Web Speech API or OpenAI Whisper) and saved as a timestamped Markdown file in a configured vault folder.

**Architecture:** Single new file `src/blocks/VoiceDictationBlock.ts` contains the block class and its settings modal. State machine driven by `el.dataset.voiceState`; CSS handles all visibility. Web Speech is the default backend; Whisper is activated when the user provides an API key in block settings.

**Tech Stack:** TypeScript (strict), Obsidian Plugin API (`Component`, `Modal`, `Setting`, `Notice`, `setIcon`, `moment`), Web Speech API (`SpeechRecognition`), `MediaRecorder` + `fetch` (Whisper path), GridStack (no changes needed).

---

## Chunk 1: Registration scaffold

Register the block type so the project compiles cleanly before any implementation.

**Files:**
- Modify: `src/types.ts` — add `'voice-dictation'` to `BLOCK_TYPES`
- Modify: `src/main.ts` — add block factory registration
- Modify: `src/EditToolbar.ts` — add `BLOCK_META` entry
- Create: `src/blocks/VoiceDictationBlock.ts` — stub class

---

### Task 1: Add `'voice-dictation'` to `BLOCK_TYPES`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Open `src/types.ts` and add the new type**

  Find the `BLOCK_TYPES` array (line ~3). Add `'voice-dictation'` as the last entry:

  ```typescript
  export const BLOCK_TYPES = [
    'greeting', 'folder-links', 'button-grid',
    'quotes-list', 'image-gallery', 'clock', 'embedded-note',
    'static-text', 'html', 'video-embed',
    'bookmarks', 'recent-files', 'pomodoro', 'spacer', 'random-note',
    'voice-dictation',
  ] as const;
  ```

---

### Task 2: Create stub `VoiceDictationBlock.ts`

This stub satisfies the factory `create` call. The real implementation comes in Chunk 2.

**Files:**
- Create: `src/blocks/VoiceDictationBlock.ts`

- [ ] **Step 1: Create the stub file**

  ```typescript
  import { App } from 'obsidian';
  import { BlockInstance, IHomepagePlugin } from '../types';
  import { BaseBlock } from './BaseBlock';

  export class VoiceDictationBlock extends BaseBlock {
    constructor(app: App, instance: BlockInstance, plugin: IHomepagePlugin) {
      super(app, instance, plugin);
    }

    render(el: HTMLElement): void {
      el.setText('Voice dictation — coming soon');
    }
  }
  ```

---

### Task 3: Register in `main.ts`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add import at top of `main.ts`** (alongside other block imports)

  ```typescript
  import { VoiceDictationBlock } from './blocks/VoiceDictationBlock';
  ```

- [ ] **Step 2: Add factory to `registerBlocks()` (after the `random-note` entry, before the closing `}`)**

  ```typescript
  BlockRegistry.register({
    type: 'voice-dictation',
    displayName: 'Voice notes',
    defaultConfig: {
      folder: '',
      triggerMode: 'tap',
      whisperApiKey: '',
      whisperLanguage: '',
      noteTemplate: '',
    },
    defaultSize: { w: 2, h: 3 },
    create: (app, instance, plugin) => new VoiceDictationBlock(app, instance, plugin),
  });
  ```

---

### Task 4: Add `BLOCK_META` entry in `EditToolbar.ts`

**Files:**
- Modify: `src/EditToolbar.ts`

- [ ] **Step 1: Add entry to `BLOCK_META` (after `'random-note'` entry)**

  ```typescript
  'voice-dictation': { icon: '🎙️', desc: 'Record voice notes saved automatically to a folder' },
  ```

---

### Task 5: Type-check and commit scaffold

- [ ] **Step 1: Run TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: zero errors.

- [ ] **Step 2: Run ESLint**

  ```bash
  npx eslint src/
  ```

  Expected: zero errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/types.ts src/main.ts src/EditToolbar.ts src/blocks/VoiceDictationBlock.ts
  git commit -m "feat: register voice-dictation block type (stub)"
  ```

---

## Chunk 2: Block class — DOM, state machine, settings modal

**Files:**
- Modify: `src/blocks/VoiceDictationBlock.ts` — replace stub with full class

---

### Task 6: Config type, DOM render, setState helper

- [ ] **Step 1: Replace stub with full DOM render**

  Replace the entire content of `src/blocks/VoiceDictationBlock.ts`:

  ```typescript
  import { App, Modal, Notice, Setting, moment, setIcon } from 'obsidian';
  import { BlockInstance, IHomepagePlugin } from '../types';
  import { BaseBlock } from './BaseBlock';
  import { FolderSuggestModal } from '../utils/FolderSuggestModal';

  interface VoiceDictationConfig {
    folder?: string;
    triggerMode?: 'tap' | 'push';
    whisperApiKey?: string;
    whisperLanguage?: string;
    noteTemplate?: string;
  }

  type VoiceState = 'idle' | 'recording' | 'transcribing' | 'saved';

  export class VoiceDictationBlock extends BaseBlock {
    private statusEl: HTMLElement | null = null;
    private micBtn: HTMLButtonElement | null = null;
    private micIconEl: HTMLElement | null = null;
    private timerEl: HTMLElement | null = null;

    // Web Speech
    private recognition: SpeechRecognition | null = null;
    private pendingTranscript = '';
    private speechErrored = false;

    // Whisper
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private fetchAbortCtrl: AbortController | null = null;

    // Elapsed timer handle
    private elapsedSeconds = 0;
    private elapsedIntervalRef: number | null = null;

    constructor(app: App, instance: BlockInstance, plugin: IHomepagePlugin) {
      super(app, instance, plugin);
    }

    render(el: HTMLElement): void {
      const cfg = this.instance.config as VoiceDictationConfig;
      el.addClass('voice-block');
      this.containerEl = el;
      this.setState(el, 'idle');

      this.renderHeader(el, 'Voice notes');

      const body = el.createDiv({ cls: 'voice-body' });

      // Status label
      this.statusEl = body.createDiv({ cls: 'voice-status', text: 'Tap to record' });

      // Mic zone
      const micZone = body.createDiv({ cls: 'voice-mic-zone' });
      this.micBtn = micZone.createEl('button', { cls: 'voice-mic' });
      this.micBtn.setAttribute('aria-label', 'Start recording voice note');
      this.micIconEl = this.micBtn.createSpan({ cls: 'voice-mic-icon' });
      setIcon(this.micIconEl, 'microphone');
      this.timerEl = micZone.createDiv({ cls: 'voice-timer', text: '0:00' });

      // Saved flash
      const flash = body.createDiv({ cls: 'voice-saved-flash' });
      const checkIconEl = flash.createSpan();
      setIcon(checkIconEl, 'check');
      flash.createSpan({ cls: 'voice-saved-label', text: 'Saved' });

      // Check SpeechRecognition availability
      const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
        ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
      if (!SR && !cfg.whisperApiKey) {
        new Notice('Speech recognition not supported on this platform');
        this.micBtn.disabled = true;
        this.micBtn.addClass('voice-mic--unavailable');
        return;
      }

      // Wire trigger mode
      if (cfg.triggerMode === 'push') {
        this.micBtn.setAttribute('aria-label', 'Hold to record voice note');
        this.micBtn.addEventListener('pointerdown', () => { void this.startRecording(); });
        const stop = () => { if (this.getState(el) === 'recording') void this.stopRecording(el, cfg); };
        this.micBtn.addEventListener('pointerup', stop);
        this.micBtn.addEventListener('pointercancel', stop);
      } else {
        this.micBtn.addEventListener('click', () => {
          if (this.getState(el) === 'idle') {
            void this.startRecording();
          } else if (this.getState(el) === 'recording') {
            void this.stopRecording(el, cfg);
          }
        });
      }

      // Cleanup on unload
      this.register(() => {
        this.fetchAbortCtrl?.abort();
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.ondataavailable = null;
          this.mediaRecorder.onstop = null;
          this.mediaRecorder.stop();
        }
        this.mediaRecorder?.stream.getTracks().forEach(t => t.stop());
        this.recognition?.abort();
        if (this.elapsedIntervalRef !== null) window.clearInterval(this.elapsedIntervalRef);
      });
    }

    private getState(el: HTMLElement): VoiceState {
      return (el.dataset.voiceState ?? 'idle') as VoiceState;
    }

    private setState(el: HTMLElement, state: VoiceState): void {
      el.dataset.voiceState = state;

      if (!this.statusEl || !this.micBtn || !this.micIconEl) return;

      const labels: Record<VoiceState, string> = {
        idle: 'Tap to record',
        recording: 'Recording…',
        transcribing: 'Transcribing…',
        saved: '',
      };
      this.statusEl.setText(labels[state]);

      if (state === 'recording') {
        this.micBtn.setAttribute('aria-label', 'Stop recording');
        setIcon(this.micIconEl, 'square');
        this.startElapsedTimer();
      } else {
        const cfg = this.instance.config as VoiceDictationConfig;
        const ariaLabel = cfg.triggerMode === 'push'
          ? 'Hold to record voice note'
          : 'Start recording voice note';
        this.micBtn.setAttribute('aria-label', ariaLabel);
        setIcon(this.micIconEl, 'microphone');
        this.stopElapsedTimer();
      }
    }

    private startElapsedTimer(): void {
      this.elapsedSeconds = 0;
      if (this.timerEl) this.timerEl.setText('0:00');
      // registerInterval takes a pre-created interval id, not a callback+delay
      this.elapsedIntervalRef = this.registerInterval(window.setInterval(() => {
        this.elapsedSeconds++;
        const m = Math.floor(this.elapsedSeconds / 60);
        const s = String(this.elapsedSeconds % 60).padStart(2, '0');
        if (this.timerEl) this.timerEl.setText(`${m}:${s}`);
      }, 1000));
    }

    private stopElapsedTimer(): void {
      if (this.elapsedIntervalRef !== null) {
        window.clearInterval(this.elapsedIntervalRef);
        this.elapsedIntervalRef = null;
      }
      if (this.timerEl) this.timerEl.setText('0:00');
    }

    private showSavedFlash(el: HTMLElement): void {
      this.setState(el, 'saved');
      const id = window.setTimeout(() => { this.setState(el, 'idle'); }, 1500);
      this.register(() => window.clearTimeout(id));
    }

    // ── Note creation ──────────────────────────────────────────────────────

    private async saveNote(transcript: string, cfg: VoiceDictationConfig): Promise<void> {
      if (!transcript.trim()) return;

      const folder = (cfg.folder ?? '').trim();
      const timestamp = moment().format('YYYY-MM-DD HH-mm-ss');
      const notePath = folder ? `${folder}/${timestamp}.md` : `${timestamp}.md`;

      // Recursive folder creation
      if (folder) {
        const segments = folder.split('/').filter(Boolean);
        let accumulated = '';
        for (const seg of segments) {
          accumulated = accumulated ? `${accumulated}/${seg}` : seg;
          if (!this.app.vault.getAbstractFileByPath(accumulated)) {
            await this.app.vault.createFolder(accumulated);
          }
        }
      }

      const content = (cfg.noteTemplate ?? '')
        ? (cfg.noteTemplate ?? '').replaceAll('{{transcript}}', transcript)
        : transcript;
      await this.app.vault.create(notePath, content);
    }

    // ── Web Speech path ────────────────────────────────────────────────────

    private async startRecording(): Promise<void> {
      // Implemented in Task 7
    }

    private async stopRecording(el: HTMLElement, cfg: VoiceDictationConfig): Promise<void> {
      // Implemented in Task 8
    }

    // ── Settings modal ─────────────────────────────────────────────────────

    override openSettings(onSave: (config: Record<string, unknown>) => void): void {
      new VoiceDictationSettingsModal(this.app, this.instance.config as VoiceDictationConfig, onSave).open();
    }
  }

  // ── Settings Modal ─────────────────────────────────────────────────────────

  class VoiceDictationSettingsModal extends Modal {
    private draft: VoiceDictationConfig;

    constructor(
      app: App,
      private config: VoiceDictationConfig,
      private onSave: (config: Record<string, unknown>) => void,
    ) {
      super(app);
      this.draft = { ...config };
    }

    onOpen(): void {
      const { contentEl } = this;
      contentEl.empty();

      new Setting(contentEl).setName('Voice notes settings').setHeading();

      // Folder
      new Setting(contentEl)
        .setName('Destination folder')
        .setDesc('New voice notes will be created here. Leave empty for vault root.')
        .addText(t => {
          t.setPlaceholder('e.g. Voice Notes')
           .setValue(this.draft.folder ?? '')
           .onChange(v => { this.draft.folder = v.trim(); });
          t.inputEl.addEventListener('click', () => {
            new FolderSuggestModal(this.app, (folder) => {
              this.draft.folder = folder;
              t.setValue(folder);
            }).open();
          });
        });

      // Trigger mode
      new Setting(contentEl)
        .setName('Trigger mode')
        .setDesc('How the mic button activates recording.')
        .addDropdown(d => {
          d.addOption('tap', 'Tap to record')
           .addOption('push', 'Push to talk')
           .setValue(this.draft.triggerMode ?? 'tap')
           .onChange(v => { this.draft.triggerMode = v as 'tap' | 'push'; });
        });

      // Whisper API key
      new Setting(contentEl)
        .setName('Whisper API key')
        .setDesc('OpenAI API key for higher-quality transcription. Leave empty to use built-in speech recognition.')
        .addText(t => {
          t.inputEl.type = 'password';
          t.setPlaceholder('sk-...')
           .setValue(this.draft.whisperApiKey ?? '')
           .onChange(v => { this.draft.whisperApiKey = v.trim(); });
        });

      // Whisper language
      new Setting(contentEl)
        .setName('Whisper language')
        .setDesc('ISO-639-1 code e.g. en, it, fr. Leave empty for auto-detect. Only used with Whisper API key.')
        .addText(t => {
          t.setPlaceholder('auto')
           .setValue(this.draft.whisperLanguage ?? '')
           .onChange(v => { this.draft.whisperLanguage = v.trim(); });
        });

      // Note template
      new Setting(contentEl)
        .setName('Note template')
        .setDesc('Optional. Use {{transcript}} where the text should appear. All occurrences are replaced.')
        .addTextArea(t => {
          t.setPlaceholder('{{transcript}}')
           .setValue(this.draft.noteTemplate ?? '')
           .onChange(v => { this.draft.noteTemplate = v; });
          t.inputEl.rows = 4;
        });

      // Save button
      new Setting(contentEl).addButton(b => {
        b.setButtonText('Save').setCta().onClick(() => {
          this.onSave(this.draft as Record<string, unknown>);
          this.close();
        });
      });
    }

    onClose(): void {
      this.contentEl.empty();
    }
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: zero errors.

- [ ] **Step 3: ESLint**

  ```bash
  npx eslint src/blocks/VoiceDictationBlock.ts
  ```

  Expected: zero errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/blocks/VoiceDictationBlock.ts
  git commit -m "feat: voice-dictation block DOM, state machine, settings modal"
  ```

---

## Chunk 3: Web Speech transcription path

**Files:**
- Modify: `src/blocks/VoiceDictationBlock.ts` — implement `startRecording` and `stopRecording` for Web Speech

---

### Task 7: Implement Web Speech `startRecording`

- [ ] **Step 1: Replace the stub `startRecording` method with the Web Speech implementation**

  Find the `private async startRecording()` stub and replace it:

  ```typescript
  private async startRecording(): Promise<void> {
    const el = this.containerEl;
    if (!el) return;
    const cfg = this.instance.config as VoiceDictationConfig;

    // Use Whisper path if API key present
    if (cfg.whisperApiKey) {
      await this.startWhisperRecording(el);
      return;
    }

    // Web Speech path
    const SR = (window as unknown as {
      SpeechRecognition?: typeof SpeechRecognition;
      webkitSpeechRecognition?: typeof SpeechRecognition;
    }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SR) {
      new Notice('Speech recognition not supported on this platform');
      return;
    }

    this.recognition = new SR();
    this.recognition.interimResults = false;
    this.recognition.continuous = false;
    this.pendingTranscript = '';
    this.speechErrored = false;

    this.recognition.onresult = (event) => {
      this.pendingTranscript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join(' ')
        .trim();
    };

    this.recognition.onerror = (event) => {
      this.speechErrored = true;
      this.setState(el, 'idle');
      if (event.error === 'not-allowed') {
        new Notice('Microphone access denied');
      } else {
        new Notice('Speech recognition error: ' + event.error);
      }
    };

    this.recognition.onend = () => {
      // onerror sets speechErrored so we skip the save
      if (this.speechErrored) return;
      if (this.pendingTranscript) {
        const saveCfg = this.instance.config as VoiceDictationConfig;
        this.saveNote(this.pendingTranscript, saveCfg)
          .then(() => { this.showSavedFlash(el); })
          .catch((e: unknown) => {
            console.error('[VoiceDictation] save failed', e);
            new Notice('Failed to save note');
            this.setState(el, 'idle');
          });
      } else {
        this.setState(el, 'idle');
      }
    };

    this.recognition.start();
    this.setState(el, 'recording');
  }
  ```

---

### Task 8: Implement Web Speech `stopRecording`

- [ ] **Step 1: Replace the stub `stopRecording` method**

  Find the `private async stopRecording` stub and replace:

  ```typescript
  private async stopRecording(el: HTMLElement, _cfg: VoiceDictationConfig): Promise<void> {
    // Web Speech path: stopping the recognizer triggers onend
    if (this.recognition) {
      this.recognition.stop();
      // State transitions happen in onend / onerror
      return;
    }
    // Whisper path: handled in stopWhisperRecording
    await this.stopWhisperRecording(el);
  }
  ```

  Also add two stub Whisper methods (needed for compile; implemented in Chunk 4):

  ```typescript
  private async startWhisperRecording(_el: HTMLElement): Promise<void> {
    // Implemented in Chunk 4
  }

  private async stopWhisperRecording(_el: HTMLElement): Promise<void> {
    // Implemented in Chunk 4
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: zero errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/blocks/VoiceDictationBlock.ts
  git commit -m "feat: voice-dictation Web Speech transcription path"
  ```

---

## Chunk 4: Whisper transcription path

**Files:**
- Modify: `src/blocks/VoiceDictationBlock.ts` — implement `startWhisperRecording` and `stopWhisperRecording`

---

### Task 9: Implement Whisper recording and transcription

- [ ] **Step 1: Replace `startWhisperRecording` stub**

  ```typescript
  private async startWhisperRecording(el: HTMLElement): Promise<void> {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      new Notice('Microphone access denied');
      return;
    }

    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(stream);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      void this.handleWhisperStop(el);
    };

    this.mediaRecorder.start();
    this.setState(el, 'recording');
  }
  ```

- [ ] **Step 2: Replace `stopWhisperRecording` stub**

  ```typescript
  private async stopWhisperRecording(el: HTMLElement): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.setState(el, 'transcribing');
      this.mediaRecorder.stop();
      // onstop fires asynchronously → handleWhisperStop
    }
  }
  ```

- [ ] **Step 3: Add `handleWhisperStop` method**

  Add after `stopWhisperRecording`:

  ```typescript
  private async handleWhisperStop(el: HTMLElement): Promise<void> {
    const cfg = this.instance.config as VoiceDictationConfig;

    // Collect blob
    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
    this.audioChunks = [];

    // Stop stream tracks
    this.mediaRecorder?.stream.getTracks().forEach(t => t.stop());

    if (blob.size === 0) {
      new Notice('No audio captured');
      this.setState(el, 'idle');
      return;
    }

    // Build form data
    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    form.append('model', 'whisper-1');
    if (cfg.whisperLanguage) form.append('language', cfg.whisperLanguage);

    this.fetchAbortCtrl = new AbortController();

    let transcript = '';
    try {
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.whisperApiKey ?? ''}` },
        body: form,
        signal: this.fetchAbortCtrl.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => String(res.status));
        new Notice('Transcription failed: ' + errText);
        this.setState(el, 'idle');
        return;
      }

      const json = await res.json() as { text?: string };
      transcript = (json.text ?? '').trim();
    } catch (err: unknown) {
      // Aborted during cleanup — block is unloading, ignore silently
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[VoiceDictation] Whisper fetch error', err);
      new Notice('Transcription failed');
      this.setState(el, 'idle');
      return;
    }

    if (!transcript) {
      this.setState(el, 'idle');
      return;
    }

    try {
      await this.saveNote(transcript, cfg);
      this.showSavedFlash(el);
    } catch (e: unknown) {
      console.error('[VoiceDictation] save failed', e);
      new Notice('Failed to save note');
      this.setState(el, 'idle');
    }
  }
  ```

- [ ] **Step 4: Type-check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: zero errors.

- [ ] **Step 5: ESLint**

  ```bash
  npx eslint src/blocks/VoiceDictationBlock.ts
  ```

  Expected: zero errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/blocks/VoiceDictationBlock.ts
  git commit -m "feat: voice-dictation Whisper transcription path"
  ```

---

## Chunk 5: CSS styles

**Files:**
- Modify: `styles.css` — add voice dictation block styles

---

### Task 10: Add CSS

- [ ] **Step 1: Find the insertion point in `styles.css`**

  Locate the line containing `/* ── Random Note Block` (around line 947). Insert the new section **before** it.

- [ ] **Step 2: Insert the following CSS block**

  ```css
  /* ── Voice Dictation Block ──────────────────────────────── */
  .voice-block {
    container-type: size;
    height: 100%;
    --voice-recording-color: hsl(0, 72%, 56%);
  }

  .voice-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 3cqh, 16px);
    height: 100%;
    padding: clamp(4px, 2cqh, 8px) 0;
  }

  /* Status label */
  .voice-status {
    font-size: clamp(0.7rem, 3.5cqw, 0.8125rem);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    text-align: center;
    min-height: 1.2em;
  }

  [data-voice-state="recording"] .voice-status {
    color: var(--voice-recording-color);
  }

  /* Mic zone */
  .voice-mic-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
  }

  [data-voice-state="saved"] .voice-mic-zone,
  [data-voice-state="transcribing"] .voice-mic-zone {
    display: none;
  }

  /* Mic button */
  .voice-mic {
    --voice-mic-size: 64px;
    position: relative;
    width: var(--voice-mic-size);
    height: var(--voice-mic-size);
    border-radius: 50%;
    border: none;
    background: var(--block-accent, var(--color-accent));
    color: var(--text-on-accent, #fff);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease-out, transform 0.1s ease-out;
    flex-shrink: 0;
  }

  .voice-mic:active {
    transform: scale(0.95);
  }

  .voice-mic--unavailable {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .voice-mic-icon svg {
    width: 24px;
    height: 24px;
  }

  /* Pulse ring (recording state) */
  .voice-mic::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid var(--voice-recording-color);
    opacity: 0;
    pointer-events: none;
  }

  [data-voice-state="recording"] .voice-mic {
    background: var(--voice-recording-color);
  }

  [data-voice-state="recording"] .voice-mic::after {
    animation: voice-pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes voice-pulse {
    0%   { transform: scale(1);   opacity: 0.6; }
    100% { transform: scale(1.6); opacity: 0; }
  }

  /* Transcribing state: dim mic, add spinner */
  [data-voice-state="transcribing"] .voice-mic {
    background: var(--background-modifier-hover);
    pointer-events: none;
  }

  [data-voice-state="transcribing"] .voice-mic-icon {
    animation: voice-spin 1s linear infinite;
  }

  @keyframes voice-spin {
    to { transform: rotate(360deg); }
  }

  /* Elapsed timer */
  .voice-timer {
    font-size: clamp(0.75rem, 4cqw, 0.875rem);
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    text-align: center;
    min-height: 1.2em;
    display: none;
  }

  [data-voice-state="recording"] .voice-timer {
    display: block;
  }

  /* Saved flash */
  .voice-saved-flash {
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--block-accent, var(--color-accent));
  }

  [data-voice-state="saved"] .voice-saved-flash {
    display: flex;
    animation: voice-flash-in 0.3s ease-out;
  }

  [data-voice-state="saved"] .voice-status {
    display: none;
  }

  .voice-saved-flash svg {
    width: 32px;
    height: 32px;
  }

  .voice-saved-label {
    font-size: 0.8125rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  @keyframes voice-flash-in {
    from { opacity: 0; transform: scale(0.8); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* Narrow block (< 200px wide) */
  @container (max-width: 200px) {
    .voice-mic {
      --voice-mic-size: 48px;
    }
    .voice-mic-icon svg {
      width: 20px;
      height: 20px;
    }
  }

  /* Short block (< 180px tall) */
  @container (max-height: 180px) {
    .voice-body {
      gap: 4px;
      padding: 2px 0;
    }
    .voice-mic-zone {
      padding: 4px 0;
    }
    .voice-mic {
      --voice-mic-size: 48px;
    }
    .voice-status {
      font-size: 0.65rem;
    }
  }

  /* Mobile */
  .is-mobile .voice-mic {
    --voice-mic-size: 64px;
  }

  .is-mobile .voice-mic:hover,
  .is-mobile .voice-mic:active {
    transform: none;
  }

  /* Single-column grid */
  .homepage-grid.grid-stack.hp-single-column .voice-mic {
    --voice-mic-size: 56px;
  }
  ```

- [ ] **Step 3: Type-check (CSS doesn't affect TS, but run as sanity check)**

  ```bash
  npx tsc --noEmit
  ```

  Expected: zero errors.

- [ ] **Step 4: Commit**

  ```bash
  git add styles.css
  git commit -m "feat: voice-dictation block CSS styles"
  ```

---

## Chunk 6: Build and final verification

---

### Task 11: Full build and lint

- [ ] **Step 1: Full build**

  ```bash
  npm run build
  ```

  Expected: `main.js` produced with no errors.

- [ ] **Step 2: Full TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: zero errors.

- [ ] **Step 3: Full ESLint**

  ```bash
  npx eslint src/
  ```

  Expected: zero errors.

- [ ] **Step 4: Final commit**

  ```bash
  git add -A
  git commit -m "feat: complete voice-dictation block (Web Speech + Whisper)"
  ```

---

## Manual smoke test checklist

After loading the plugin in Obsidian:

- [ ] "Voice notes" block appears in the Add Block modal with 🎙️ icon
- [ ] Block renders mic button in idle state
- [ ] Tapping mic starts recording (button turns red, pulse ring animates, timer ticks)
- [ ] Tapping mic again stops recording; note appears in configured folder
- [ ] Note filename is `YYYY-MM-DD HH-mm-ss.md`
- [ ] Note content is the transcribed text
- [ ] "Saved" flash appears for ~1.5 s then returns to idle
- [ ] Empty speech returns silently to idle (no note created)
- [ ] Configuring a nested folder (`a/b/c`) auto-creates the hierarchy
- [ ] Push-to-talk mode: hold creates note, release saves
- [ ] Block settings modal opens and saves all five fields
- [ ] Entering a Whisper API key switches to Whisper path (test with real key)
- [ ] On mobile: mic button is 64px, tap targets work
