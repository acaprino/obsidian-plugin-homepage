import { App, Modal, Notice, Setting, TFolder, moment, normalizePath, setIcon, requestUrl } from 'obsidian';
import { BaseBlock } from './BaseBlock';
import { FolderSuggestModal } from '../utils/FolderSuggestModal';

const CONSENT_STORAGE_KEY = 'hp-voice-consent';

function hasMediaRecorderSupport(): boolean {
  if (typeof MediaRecorder === 'undefined') return false;
  const md = (navigator as unknown as { mediaDevices?: { getUserMedia?: unknown } }).mediaDevices;
  return typeof md?.getUserMedia === 'function';
}

function hasConsent(provider: TranscriptionProvider): boolean {
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed[provider] === true;
  } catch {
    return false;
  }
}

function setConsent(provider: TranscriptionProvider): void {
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Record<string, boolean> : {};
    parsed[provider] = true;
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    /* localStorage may be unavailable — the user will re-consent next time */
  }
}

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
  private activeStream: MediaStream | null = null;
  // Generation counter: invalidates stale async callbacks (onstop, transcription result) after
  // a re-render, plugin unload, or a rapid stop→start sequence. Every recording captures the
  // generation it started with and checks it before touching DOM / calling saveNote.
  private recordingGen = 0;

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
    if (!hasMediaRecorderSupport()) {
      if (this.statusEl) this.statusEl.setText('Not available on this platform');
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
      // Invalidate any in-flight transcription so its result is discarded instead
      // of hitting a detached DOM or creating a ghost saved-note.
      this.recordingGen++;
      if (this.mediaRecorder) {
        // Detach callbacks first so the stop event can't re-enter handleCloudStop.
        this.mediaRecorder.ondataavailable = null;
        this.mediaRecorder.onstop = null;
        if (this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
        this.mediaRecorder = null;
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
    const id = window.setTimeout(() => {
      if (el.isConnected) this.setState(el, 'idle');
    }, 1500);
    this.register(() => window.clearTimeout(id));
  }

  // ── Note creation ──────────────────────────────────────────────────────────

  private async saveNote(transcript: string, cfg: VoiceDictationConfig): Promise<void> {
    if (!transcript.trim()) return;

    // Defence in depth — strip anything that could escape the vault:
    //   leading slashes, tilde, Windows drive prefix (C:), NUL, backslashes.
    const rawFolder = (cfg.folder ?? '')
      .replace(/^[/\\~]+/, '')
      .replace(/^[A-Za-z]:/, '')
      // eslint-disable-next-line no-control-regex -- NUL byte is a classic path-escape trick on some filesystems; stripping it is intentional defence in depth
      .replace(/\x00/g, '')
      .replace(/\\/g, '/')
      .trim();
    const segments = rawFolder.split('/').filter(Boolean);
    if (segments.some(s => s === '..')) return;
    const safePath = normalizePath(segments.join('/'));
    const timestamp = moment().format('YYYY-MM-DD HH-mm-ss');
    const notePath = safePath && safePath !== '/' ? `${safePath}/${timestamp}.md` : `${timestamp}.md`;

    // Recursive folder creation
    if (safePath && safePath !== '/') {
      let accumulated = '';
      for (const seg of safePath.split('/')) {
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

    const provider = cfg.provider ?? 'whisper';
    if (!hasConsent(provider)) {
      const confirmed = await confirmVoiceConsent(this.app, provider);
      if (!confirmed) return;
      setConsent(provider);
    }

    // Stop any previous stream before acquiring a new one
    this.stopActiveStream();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name ?? '';
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        new Notice('No microphone found on this device');
      } else if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        new Notice('Microphone access denied');
      } else {
        new Notice('Microphone unavailable');
      }
      return;
    }

    // Pick a supported mime type — webm on desktop/Android, mp4 on iOS
    let recordedMimeType = 'audio/webm';
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg'];
    for (const mt of candidates) {
      if (MediaRecorder.isTypeSupported(mt)) {
        recordedMimeType = mt.split(';')[0];
        break;
      }
    }

    // Per-recording state — bound into the onstop closure so a rapid stop→start
    // can't make the previous recorder's onstop clobber the new recording's chunks.
    const chunks: Blob[] = [];
    const gen = ++this.recordingGen;
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported(recordedMimeType) ? recordedMimeType : undefined,
    });

    this.activeStream = stream;
    this.mediaRecorder = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      // Stale recorder from a previous tap: the block has already started a
      // new recording or was unloaded. Drop these chunks, don't touch DOM.
      if (gen !== this.recordingGen) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      void this.handleCloudStop(el, gen, chunks, recordedMimeType);
    };

    recorder.start();
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

  private async handleCloudStop(
    el: HTMLElement,
    gen: number,
    chunks: Blob[],
    mimeType: string,
  ): Promise<void> {
    const cfg = this.instance.config as VoiceDictationConfig;
    const blob = new Blob(chunks, { type: mimeType });

    this.stopActiveStream();

    if (blob.size === 0) {
      if (gen === this.recordingGen && el.isConnected) {
        new Notice('No audio captured');
        this.setState(el, 'idle');
      }
      return;
    }

    let transcript = '';
    try {
      transcript = (cfg.provider ?? 'whisper') === 'gemini'
        ? await this.transcribeWithGemini(blob, cfg, mimeType)
        : await this.transcribeWithWhisper(blob, cfg, mimeType);
    } catch (err: unknown) {
      // Log only the status / message — the raw body may contain user-supplied text.
      const safe = err instanceof Error ? err.message : 'unknown error';
      console.error('[Homepage Blocks] VoiceDictation transcription failed:', safe);
      if (gen === this.recordingGen && el.isConnected) {
        new Notice('Transcription failed');
        this.setState(el, 'idle');
      }
      return;
    }

    // Bail if the recording was superseded OR the block was unloaded while we were
    // waiting on the API. Without this, the transcript would be persisted anyway
    // and surface as a ghost note the user didn't expect.
    if (gen !== this.recordingGen || !el.isConnected) return;

    if (!transcript) {
      this.setState(el, 'idle');
      return;
    }

    try {
      await this.saveNote(transcript, cfg);
      if (gen === this.recordingGen && el.isConnected) this.showSavedFlash(el);
    } catch (e: unknown) {
      const safe = e instanceof Error ? e.message : 'unknown error';
      console.error('[Homepage Blocks] VoiceDictation save failed:', safe);
      if (gen === this.recordingGen && el.isConnected) {
        new Notice('Failed to save note');
        this.setState(el, 'idle');
      }
    }
  }

  // ── Whisper transcription ───────────────────────────────────────────────

  private async transcribeWithWhisper(blob: Blob, cfg: VoiceDictationConfig, mimeType: string): Promise<string> {
    const ext = mimeType.includes('mp4') ? 'mp4'
      : mimeType.includes('ogg') ? 'ogg'
      : mimeType.includes('aac') ? 'aac'
      : 'webm';

    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const encoder = new TextEncoder();

    const textFields: Record<string, string> = { model: cfg.model || 'whisper-1' };
    if (cfg.language) textFields['language'] = cfg.language;

    let preamble = '';
    for (const [key, value] of Object.entries(textFields)) {
      preamble += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
    }
    preamble += `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`;

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
      // Don't include the raw body — it may echo user-supplied content or bits of the audio filename.
      throw new Error(`Whisper API error ${res.status}`);
    }

    const json = res.json as { text?: string };
    return (json.text ?? '').trim();
  }

  // ── Gemini transcription ────────────────────────────────────────────────

  private async transcribeWithGemini(blob: Blob, cfg: VoiceDictationConfig, mimeType: string): Promise<string> {
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
            { inlineData: { mimeType, data: base64Audio } },
          ],
        }],
      }),
      throw: false,
    });

    if (res.status !== 200) {
      throw new Error(`Gemini API error ${res.status}`);
    }

    interface GeminiResponse {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    }
    const json = res.json as GeminiResponse;
    return (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  }

  override renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    const cfg = draft as VoiceDictationConfig;
    const renderSettings = () => {
      body.empty();

      // Folder
      new Setting(body)
        .setName('Destination folder')
        .setDesc('Where new voice notes go. Leave blank for vault root.')
        .addText(t => {
          t.setPlaceholder('Voice notes')
           .setValue(cfg.folder ?? '')
           .onChange(v => { cfg.folder = v.trim(); });
          t.inputEl.addEventListener('click', () => {
            new FolderSuggestModal(this.app, (folder: TFolder) => {
              cfg.folder = folder.path;
              t.setValue(folder.path);
            }).open();
          });
        });

      // Trigger mode
      new Setting(body)
        .setName('Trigger mode')
        .setDesc('How the mic button starts recording.')
        .addDropdown(d => {
          d.addOption('tap', 'Tap to record')
           .addOption('push', 'Push to talk')
           .setValue(cfg.triggerMode ?? 'tap')
           .onChange(v => { cfg.triggerMode = v as 'tap' | 'push'; });
        });

      // Provider
      new Setting(body)
        .setName('Transcription provider')
        .setDesc('Service used for transcription.')
        .addDropdown(d => {
          d.addOption('whisper', 'Whisper')
           .addOption('gemini', 'Gemini')
           .setValue(cfg.provider ?? 'whisper')
           .onChange(v => {
             cfg.provider = v as TranscriptionProvider;
             // Reset model to default for new provider
             cfg.model = v === 'gemini' ? 'gemini-2.0-flash' : 'whisper-1';
             // Re-render body to update model dropdown and API key placeholder
             renderSettings();
           });
        });

      // API key (label + placeholder change based on provider)
      const isGemini = (cfg.provider ?? 'whisper') === 'gemini';
      new Setting(body)
        .setName('API key')
        .setDesc(isGemini
          ? 'Google AI API key for Gemini. Stored in plaintext in your vault data folder.'
          : 'OpenAI API key for Whisper. Stored in plaintext in your vault data folder.')
        .addText(t => {
          t.inputEl.type = 'password';
          t.setPlaceholder(isGemini ? 'AIza...' : 'sk-...')
           .setValue(cfg.apiKey ?? '')
           .onChange(v => { cfg.apiKey = v.trim(); });
        });

      // Model (options change based on provider)
      const models = isGemini ? GEMINI_MODELS : WHISPER_MODELS;
      const defaultModel = isGemini ? 'gemini-2.0-flash' : 'whisper-1';
      new Setting(body)
        .setName('Model')
        .setDesc('Transcription model.')
        .addDropdown(d => {
          for (const [value, label] of Object.entries(models)) {
            d.addOption(value, label);
          }
          d.setValue(cfg.model && cfg.model in models
            ? cfg.model
            : defaultModel);
          d.onChange(v => { cfg.model = v; });
        });

      // Language
      new Setting(body)
        .setName('Language')
        .setDesc('Language code (en, it, fr). Leave blank to auto-detect.')
        .addText(t => {
          t.setPlaceholder('Auto')
           .setValue(cfg.language ?? '')
           .onChange(v => { cfg.language = v.trim(); });
        });

      // Note template
      new Setting(body)
        .setName('Note template')
        .setDesc('Optional. Use {{transcript}} where the text should appear.')
        .addTextArea(t => {
          t.setPlaceholder('{{transcript}}')
           .setValue(cfg.noteTemplate ?? '')
           .onChange(v => { cfg.noteTemplate = v; });
          t.inputEl.rows = 4;
        });
    };
    renderSettings();
  }
}

/**
 * Shows a one-time consent modal before the first transcription with a given provider.
 * Users need to explicitly acknowledge that audio will be uploaded to a third party.
 */
class VoiceConsentModal extends Modal {
  private confirmed = false;
  constructor(
    app: App,
    private provider: TranscriptionProvider,
    private onResult: (confirmed: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    new Setting(contentEl).setName('Voice dictation consent').setHeading();
    const providerName = this.provider === 'gemini' ? 'Google Gemini' : 'OpenAI Whisper';
    const endpoint = this.provider === 'gemini'
      ? 'generativelanguage.googleapis.com'
      : 'api.openai.com';
    contentEl.createEl('p', {
      text: `Recording voice notes sends the captured audio to ${providerName} (${endpoint}) for transcription. Your API key is attached to the request.`,
    });
    contentEl.createEl('p', {
      text: `Do not record sensitive information unless you trust ${providerName}'s data handling.`,
    });
    contentEl.createEl('p', {
      text: 'This confirmation is remembered per provider — you will not see it again for this provider.',
      cls: 'setting-item-description',
    });
    const buttons = contentEl.createDiv({ cls: 'modal-button-container' });
    const cancel = buttons.createEl('button', { text: 'Cancel' });
    cancel.addEventListener('click', () => this.close());
    const confirm = buttons.createEl('button', { text: 'Upload audio to ' + providerName, cls: 'mod-cta' });
    confirm.addEventListener('click', () => {
      this.confirmed = true;
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
    this.onResult(this.confirmed);
  }
}

function confirmVoiceConsent(app: App, provider: TranscriptionProvider): Promise<boolean> {
  return new Promise(resolve => {
    new VoiceConsentModal(app, provider, resolve).open();
  });
}
