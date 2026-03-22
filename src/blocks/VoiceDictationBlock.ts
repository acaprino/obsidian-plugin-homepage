import { App, Modal, Notice, Setting, TFolder, moment, setIcon, requestUrl } from 'obsidian';
import { BaseBlock } from './BaseBlock';
import { FolderSuggestModal } from '../utils/FolderSuggestModal';

type TranscriptionProvider = 'whisper' | 'gemini';

const WHISPER_MODELS: Record<string, string> = {
  'whisper-1': 'Whisper 1',
  'gpt-4o-transcribe': 'GPT-4o Transcribe',
  'gpt-4o-mini-transcribe': 'GPT-4o Mini Transcribe',
};

const GEMINI_MODELS: Record<string, string> = {
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
};

interface VoiceDictationConfig {
  folder?: string;
  triggerMode?: 'tap' | 'push';
  provider?: TranscriptionProvider;
  apiKey?: string;
  model?: string;
  language?: string;
  noteTemplate?: string;
}

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'saved';

export class VoiceDictationBlock extends BaseBlock {
  private statusEl: HTMLElement | null = null;
  private micBtn: HTMLButtonElement | null = null;
  private micIconEl: HTMLElement | null = null;
  private timerEl: HTMLElement | null = null;

  // Cloud transcription (Whisper / Gemini)
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordedMimeType = 'audio/webm';
  private activeStream: MediaStream | null = null;

  // Elapsed timer handle
  private elapsedSeconds = 0;
  private elapsedIntervalRef: number | null = null;

  render(el: HTMLElement): void {
    const cfg = this.instance.config as VoiceDictationConfig;
    el.addClass('voice-block');
    this.containerEl = el;
    this.setState(el, 'idle');
    // Single cleanup registration for the active mic stream on unload
    this.register(() => this.stopActiveStream());

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

    // Require an API key
    if (!cfg.apiKey) {
      new Notice('Voice notes require an API key. Configure it in block settings.');
      this.micBtn.disabled = true;
      this.micBtn.addClass('voice-mic--unavailable');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      new Notice('Audio recording is not supported on this platform');
      this.micBtn.disabled = true;
      this.micBtn.addClass('voice-mic--unavailable');
      return;
    }

    // Wire trigger mode
    if (cfg.triggerMode === 'push') {
      this.micBtn.setAttribute('aria-label', 'Hold to record voice note');
      this.micBtn.addEventListener('pointerdown', () => { void this.startRecording(); });
      const stop = () => { if (this.getState(el) === 'recording') this.stopRecording(el); };
      this.micBtn.addEventListener('pointerup', stop);
      this.micBtn.addEventListener('pointercancel', stop);
    } else {
      this.micBtn.addEventListener('click', () => {
        if (this.getState(el) === 'idle') {
          void this.startRecording();
        } else if (this.getState(el) === 'recording') {
          this.stopRecording(el);
        }
      });
    }

    // Cleanup on unload
    this.register(() => {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.ondataavailable = null;
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
      }
      this.stopActiveStream();
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
      recording: 'Recording\u2026',
      transcribing: 'Transcribing\u2026',
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

  // ── Note creation ──────────────────────────────────────────────────────────

  private async saveNote(transcript: string, cfg: VoiceDictationConfig): Promise<void> {
    if (!transcript.trim()) return;

    const folder = (cfg.folder ?? '').trim();
    // Reject path traversal attempts
    const segments = folder.split(/[/\\]/).filter(Boolean);
    if (segments.some(s => s === '..')) return;
    const safePath = segments.join('/');
    const timestamp = moment().format('YYYY-MM-DD HH-mm-ss');
    const notePath = safePath ? `${safePath}/${timestamp}.md` : `${timestamp}.md`;

    // Recursive folder creation
    if (safePath) {
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

  // ── Recording ─────────────────────────────────────────────────────────────

  private async startRecording(): Promise<void> {
    const el = this.containerEl;
    if (!el) return;
    const cfg = this.instance.config as VoiceDictationConfig;

    if (!cfg.apiKey) {
      new Notice('API key required — configure it in block settings');
      return;
    }

    // Stop any previous stream before acquiring a new one
    this.stopActiveStream();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      new Notice('Microphone access denied');
      return;
    }
    this.activeStream = stream;

    // Pick a supported mime type — webm on desktop/Android, mp4 on iOS
    this.recordedMimeType = 'audio/webm';
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg'];
    for (const mt of candidates) {
      if (MediaRecorder.isTypeSupported(mt)) {
        this.recordedMimeType = mt.split(';')[0];
        break;
      }
    }

    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported(this.recordedMimeType)
        ? this.recordedMimeType
        : undefined,
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      void this.handleCloudStop(el);
    };

    this.mediaRecorder.start();
    this.setState(el, 'recording');
  }

  private stopRecording(el: HTMLElement): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.setState(el, 'transcribing');
      this.mediaRecorder.stop();
    }
  }

  private stopActiveStream(): void {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach(t => t.stop());
      this.activeStream = null;
    }
  }

  private async handleCloudStop(el: HTMLElement): Promise<void> {
    const cfg = this.instance.config as VoiceDictationConfig;

    const blob = new Blob(this.audioChunks, { type: this.recordedMimeType });
    this.audioChunks = [];

    this.stopActiveStream();

    if (blob.size === 0) {
      new Notice('No audio captured');
      this.setState(el, 'idle');
      return;
    }

    let transcript = '';
    try {
      transcript = (cfg.provider ?? 'whisper') === 'gemini'
        ? await this.transcribeWithGemini(blob, cfg)
        : await this.transcribeWithWhisper(blob, cfg);
    } catch (err: unknown) {
      console.error('[VoiceDictation] transcription error', err);
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

  // ── Whisper transcription ───────────────────────────────────────────────

  private async transcribeWithWhisper(blob: Blob, cfg: VoiceDictationConfig): Promise<string> {
    const ext = this.recordedMimeType.includes('mp4') ? 'mp4'
      : this.recordedMimeType.includes('ogg') ? 'ogg'
      : this.recordedMimeType.includes('aac') ? 'aac'
      : 'webm';

    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const encoder = new TextEncoder();

    const textFields: Record<string, string> = { model: cfg.model || 'whisper-1' };
    if (cfg.language) textFields['language'] = cfg.language;

    let preamble = '';
    for (const [key, value] of Object.entries(textFields)) {
      preamble += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
    }
    preamble += `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${this.recordedMimeType}\r\n\r\n`;

    const prefix = encoder.encode(preamble);
    const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
    const fileBytes = new Uint8Array(await blob.arrayBuffer());
    const body = new Uint8Array(prefix.length + fileBytes.length + suffix.length);
    body.set(prefix, 0);
    body.set(fileBytes, prefix.length);
    body.set(suffix, prefix.length + fileBytes.length);

    const res = await requestUrl({
      url: 'https://api.openai.com/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.apiKey ?? ''}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: body.buffer,
      throw: false,
    });

    if (res.status !== 200) {
      throw new Error('Whisper API error: ' + (res.text || String(res.status)));
    }

    const json = res.json as { text?: string };
    return (json.text ?? '').trim();
  }

  // ── Gemini transcription ────────────────────────────────────────────────

  private async transcribeWithGemini(blob: Blob, cfg: VoiceDictationConfig): Promise<string> {
    const base64Audio = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1]);
      };
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });

    const rawModel = cfg.model || 'gemini-2.0-flash';
    if (!/^[a-zA-Z0-9._-]+$/.test(rawModel)) {
      throw new Error('Invalid Gemini model name');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:generateContent`;

    const lang = cfg.language ?? '';
    const langHint = /^[a-z]{2,3}(-[A-Z]{2})?$/.test(lang)
      ? ` The audio is in language code "${lang}".`
      : '';

    const res = await requestUrl({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cfg.apiKey ?? '',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `Transcribe this audio exactly. Output only the transcription, nothing else.${langHint}` },
            { inlineData: { mimeType: this.recordedMimeType, data: base64Audio } },
          ],
        }],
      }),
      throw: false,
    });

    if (res.status !== 200) {
      throw new Error('Gemini API error: ' + (res.text || String(res.status)));
    }

    interface GeminiResponse {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    }
    const json = res.json as GeminiResponse;
    return (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  }

  // ── Settings modal ─────────────────────────────────────────────────────────

  override openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new VoiceDictationSettingsModal(this.app, this.instance.config as VoiceDictationConfig, onSave).open();
  }
}

// ── Settings Modal ─────────────────────────────────────────────────────────────

class VoiceDictationSettingsModal extends Modal {
  private draft: VoiceDictationConfig;

  constructor(
    app: App,
    config: VoiceDictationConfig,
    private onSave: (config: Record<string, unknown>) => void,
  ) {
    super(app);
    this.draft = { ...config };
  }

  onOpen(): void {
    this.renderSettings();
  }

  private renderSettings(): void {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl).setName('Voice notes settings').setHeading();

    // Folder
    new Setting(contentEl)
      .setName('Destination folder')
      .setDesc('New voice notes will be created here. Leave empty for vault root.')
      .addText(t => {
        t.setPlaceholder('Voice notes')
         .setValue(this.draft.folder ?? '')
         .onChange(v => { this.draft.folder = v.trim(); });
        t.inputEl.addEventListener('click', () => {
          new FolderSuggestModal(this.app, (folder: TFolder) => {
            this.draft.folder = folder.path;
            t.setValue(folder.path);
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

    // Provider
    new Setting(contentEl)
      .setName('Transcription provider')
      .setDesc('Cloud service for voice transcription.')
      .addDropdown(d => {
        d.addOption('whisper', 'Whisper')
         .addOption('gemini', 'Gemini')
         .setValue(this.draft.provider ?? 'whisper')
         .onChange(v => {
           this.draft.provider = v as TranscriptionProvider;
           // Reset model to default for new provider
           this.draft.model = v === 'gemini' ? 'gemini-2.0-flash' : 'whisper-1';
           // Re-render modal to update model dropdown and API key placeholder
           this.renderSettings();
         });
      });

    // API key (label + placeholder change based on provider)
    const isGemini = (this.draft.provider ?? 'whisper') === 'gemini';
    new Setting(contentEl)
      .setName('API key')
      .setDesc(isGemini
        ? 'Google AI API key for Gemini. Stored in plaintext in your vault data folder.'
        : 'OpenAI API key for Whisper. Stored in plaintext in your vault data folder.')
      .addText(t => {
        t.inputEl.type = 'password';
        t.setPlaceholder(isGemini ? 'AIza...' : 'sk-...')
         .setValue(this.draft.apiKey ?? '')
         .onChange(v => { this.draft.apiKey = v.trim(); });
      });

    // Model (options change based on provider)
    const models = isGemini ? GEMINI_MODELS : WHISPER_MODELS;
    const defaultModel = isGemini ? 'gemini-2.0-flash' : 'whisper-1';
    new Setting(contentEl)
      .setName('Model')
      .setDesc('Model to use for transcription.')
      .addDropdown(d => {
        for (const [value, label] of Object.entries(models)) {
          d.addOption(value, label);
        }
        d.setValue(this.draft.model && this.draft.model in models
          ? this.draft.model
          : defaultModel);
        d.onChange(v => { this.draft.model = v; });
      });

    // Language
    new Setting(contentEl)
      .setName('Language')
      .setDesc('Language code for transcription (en, it, fr). Leave empty for auto-detect.')
      .addText(t => {
        t.setPlaceholder('Auto')
         .setValue(this.draft.language ?? '')
         .onChange(v => { this.draft.language = v.trim(); });
      });

    // Note template
    new Setting(contentEl)
      .setName('Note template')
      .setDesc('Optional. Use {{transcript}} where the text should appear.')
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
