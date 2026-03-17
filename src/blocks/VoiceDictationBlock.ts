import { App, Modal, Notice, Setting, TFolder, moment, setIcon } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';
import { FolderSuggestModal } from '../utils/FolderSuggestModal';

// SpeechRecognition is available in Chromium/Electron but not always typed in lib.dom.d.ts
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface ISpeechRecognition {
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => ISpeechRecognition;

type TranscriptionProvider = 'whisper' | 'gemini';

interface VoiceDictationConfig {
  folder?: string;
  triggerMode?: 'tap' | 'push';
  transcriptionProvider?: TranscriptionProvider;
  whisperApiKey?: string;
  whisperLanguage?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  noteTemplate?: string;
}

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'saved';

export class VoiceDictationBlock extends BaseBlock {
  private statusEl: HTMLElement | null = null;
  private micBtn: HTMLButtonElement | null = null;
  private micIconEl: HTMLElement | null = null;
  private timerEl: HTMLElement | null = null;

  // Web Speech
  private recognition: ISpeechRecognition | null = null;
  private pendingTranscript = '';
  private speechErrored = false;

  // Cloud transcription (Whisper / Gemini)
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
    const SR = (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
    if (!SR && !cfg.whisperApiKey && !cfg.geminiApiKey) {
      new Notice('Speech recognition not supported on this platform');
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

  // ── Note creation ──────────────────────────────────────────────────────────

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

  // ── Web Speech path ────────────────────────────────────────────────────────

  private async startRecording(): Promise<void> {
    const el = this.containerEl;
    if (!el) return;
    const cfg = this.instance.config as VoiceDictationConfig;

    // Use cloud transcription if an API key is configured
    const provider = cfg.transcriptionProvider ?? 'whisper';
    if (provider === 'gemini') {
      if (!cfg.geminiApiKey) { new Notice('Gemini API key required — configure it in block settings'); return; }
      await this.startCloudRecording(el);
      return;
    }
    if (cfg.whisperApiKey) {
      await this.startCloudRecording(el);
      return;
    }

    // Web Speech path
    const SR = (window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;

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
      } else if (event.error === 'network' || event.error === 'service-not-allowed') {
        new Notice('Speech recognition is not available in desktop Obsidian. Add a Whisper or Gemini API key in block settings.');
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

    try {
      this.recognition.start();
    } catch {
      new Notice('Speech recognition is not available in desktop Obsidian. Add a Whisper or Gemini API key in block settings.');
      this.setState(el, 'idle');
      return;
    }
    this.setState(el, 'recording');
  }

  private stopRecording(el: HTMLElement): void {
    // Web Speech path: stopping the recognizer triggers onend
    if (this.recognition) {
      this.recognition.stop();
      // State transitions happen in onend / onerror
      return;
    }
    // Cloud path (Whisper / Gemini): handled in stopCloudRecording
    this.stopCloudRecording(el);
  }

  // ── Cloud recording (shared MediaRecorder for Whisper & Gemini) ─────────

  private async startCloudRecording(el: HTMLElement): Promise<void> {
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
      void this.handleCloudStop(el);
    };

    this.mediaRecorder.start();
    this.setState(el, 'recording');
  }

  private stopCloudRecording(el: HTMLElement): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.setState(el, 'transcribing');
      this.mediaRecorder.stop();
      // onstop fires asynchronously → handleCloudStop
    }
  }

  private async handleCloudStop(el: HTMLElement): Promise<void> {
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

    this.fetchAbortCtrl = new AbortController();
    const timeoutId = window.setTimeout(() => this.fetchAbortCtrl?.abort(), 30_000);

    let transcript = '';
    try {
      transcript = cfg.transcriptionProvider === 'gemini' && cfg.geminiApiKey
        ? await this.transcribeWithGemini(blob, cfg)
        : await this.transcribeWithWhisper(blob, cfg);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[VoiceDictation] transcription error', err);
      new Notice('Transcription failed');
      this.setState(el, 'idle');
      return;
    } finally {
      window.clearTimeout(timeoutId);
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
    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    form.append('model', 'whisper-1');
    if (cfg.whisperLanguage) form.append('language', cfg.whisperLanguage);

    // requestUrl does not support multipart/form-data (binary audio blob);
    // fetch is the only viable option for the Whisper API binary upload.
    // eslint-disable-next-line no-restricted-globals
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.whisperApiKey ?? ''}` },
      body: form,
      signal: this.fetchAbortCtrl!.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => String(res.status));
      throw new Error('Whisper API error: ' + errText);
    }

    const json = await res.json() as { text?: string };
    return (json.text ?? '').trim();
  }

  // ── Gemini transcription ────────────────────────────────────────────────

  private async transcribeWithGemini(blob: Blob, cfg: VoiceDictationConfig): Promise<string> {
    // Convert audio blob to base64 via FileReader (avoids O(n^2) string concatenation)
    const base64Audio = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1]);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    const rawModel = cfg.geminiModel || 'gemini-2.0-flash';
    if (!/^[a-zA-Z0-9._-]+$/.test(rawModel)) {
      throw new Error('Invalid Gemini model name');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:generateContent`;

    const lang = cfg.whisperLanguage ?? '';
    const langHint = /^[a-z]{2,3}(-[A-Z]{2})?$/.test(lang)
      ? ` The audio is in language code "${lang}".`
      : '';

    // eslint-disable-next-line no-restricted-globals
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cfg.geminiApiKey ?? '',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `Transcribe this audio exactly. Output only the transcription, nothing else.${langHint}` },
            { inlineData: { mimeType: 'audio/webm', data: base64Audio } },
          ],
        }],
      }),
      signal: this.fetchAbortCtrl!.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => String(res.status));
      throw new Error('Gemini API error: ' + errText);
    }

    interface GeminiResponse {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    }
    const json = await res.json() as GeminiResponse;
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

    // Transcription provider
    new Setting(contentEl)
      .setName('Transcription provider')
      .setDesc('Choose the cloud service for voice transcription.')
      .addDropdown(d => {
        d.addOption('whisper', 'OpenAI Whisper')
         .addOption('gemini', 'Google Gemini')
         .setValue(this.draft.transcriptionProvider ?? 'whisper')
         .onChange(v => { this.draft.transcriptionProvider = v as TranscriptionProvider; });
      });

    // Whisper API key
    new Setting(contentEl)
      .setName('Whisper API key')
      .setDesc('OpenAI API key for Whisper transcription.')
      .addText(t => {
        t.inputEl.type = 'password';
        t.setPlaceholder('sk-...')
         .setValue(this.draft.whisperApiKey ?? '')
         .onChange(v => { this.draft.whisperApiKey = v.trim(); });
      });

    // Gemini API key
    new Setting(contentEl)
      .setName('Gemini API key')
      .setDesc('Google AI API key for Gemini transcription.')
      .addText(t => {
        t.inputEl.type = 'password';
        t.setPlaceholder('AIza...')
         .setValue(this.draft.geminiApiKey ?? '')
         .onChange(v => { this.draft.geminiApiKey = v.trim(); });
      });

    // Gemini model
    new Setting(contentEl)
      .setName('Gemini model')
      .setDesc('Model to use for transcription. Default: gemini-2.0-flash.')
      .addText(t => {
        t.setPlaceholder('gemini-2.0-flash')
         .setValue(this.draft.geminiModel ?? '')
         .onChange(v => { this.draft.geminiModel = v.trim(); });
      });

    // Language
    new Setting(contentEl)
      .setName('Language')
      .setDesc('Language code for transcription (en, it, fr). Leave empty for auto-detect.')
      .addText(t => {
        t.setPlaceholder('Auto')
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
