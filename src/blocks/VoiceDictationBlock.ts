import { App, Modal, Notice, Setting, TFolder, moment, setIcon, requestUrl } from 'obsidian';
import { BaseBlock } from './BaseBlock';
import { FolderSuggestModal } from '../utils/FolderSuggestModal';
import { isEncrypted } from '../utils/apiKeyCrypto';
import { buildNoteContent, sanitizeVoiceFolder, uniqueFilePath } from '../utils/voiceNote';
import { DEFAULT_MODELS, PROVIDER_MAX_BYTES, PROVIDER_MODELS, PROVIDER_STOP_BYTES, effectiveModel, geminiEmptyReason, type TranscriptionProvider } from '../utils/voiceProviders';
import { RequestTimeoutError, withTimeout } from '../utils/timeout';
import { blockTitle } from '../blockMeta';

const CONSENT_STORAGE_KEY = 'hp-voice-consent';

function hasMediaRecorderSupport(): boolean {
  if (typeof MediaRecorder === 'undefined') return false;
  const md = (navigator as unknown as { mediaDevices?: { getUserMedia?: unknown } }).mediaDevices;
  return typeof md?.getUserMedia === 'function';
}

/**
 * Consent must stay per-device AND per-vault — a synced data.json or a shared
 * layout pointing at someone else's API endpoint must not inherit it. Obsidian's
 * App.loadLocalStorage/saveLocalStorage scope keys to the vault automatically
 * (by real vault ID, unlike the old vault-name suffix), so consent granted in
 * vault A never auto-applies in vault B.
 */
function readConsent(app: App): Record<string, boolean> {
  try {
    const raw = app.loadLocalStorage(CONSENT_STORAGE_KEY) as Record<string, boolean> | null;
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function hasConsent(app: App, provider: TranscriptionProvider): boolean {
  return readConsent(app)[provider] === true;
}

function setConsent(app: App, provider: TranscriptionProvider): void {
  try {
    app.saveLocalStorage(CONSENT_STORAGE_KEY, { ...readConsent(app), [provider]: true });
  } catch {
    /* storage may be unavailable — the user will re-consent next time */
  }
}

/** Withdraw the consent this device gave for `provider` (N18). */
function forgetConsent(app: App, provider: TranscriptionProvider): void {
  try {
    app.saveLocalStorage(CONSENT_STORAGE_KEY, { ...readConsent(app), [provider]: false });
  } catch {
    /* storage unavailable: nothing was remembered either */
  }
}


const PROVIDER_NAMES: Record<TranscriptionProvider, string> = { whisper: 'OpenAI Whisper', gemini: 'Google Gemini' };

/** A transcription that has not answered by then is reported, not awaited forever (R10). */
const TRANSCRIBE_TIMEOUT_MS = 120_000;
/** Model names as the providers spell them. */
const MODEL_NAME_RE = /^[a-zA-Z0-9._-]+$/;
/** ISO 639 language codes, optionally with a region (en, it, pt-BR). */
const LANGUAGE_RE = /^[a-z]{2,3}(-[A-Z]{2})?$/;

/**
 * The text fields of the Whisper upload. Both values come from block config,
 * which an import can set: a language or model holding CR/LF or quotes would
 * change the multipart body, so a language that is not a code is left out and
 * such a model name is refused (N20).
 */
export function whisperTextFields(cfg: { model?: string; language?: string }): Record<string, string> {
  const model = effectiveModel('whisper', cfg.model);
  if (!MODEL_NAME_RE.test(model)) throw new Error('Invalid Whisper model name');
  const fields: Record<string, string> = { model };
  if (cfg.language && LANGUAGE_RE.test(cfg.language)) fields.language = cfg.language;
  return fields;
}

interface VoiceDictationConfig {
  folder?: string;
  triggerMode?: 'tap' | 'push';
  provider?: TranscriptionProvider;
  apiKey?: string;
  model?: string;
  language?: string;
  noteTemplate?: string;
}

type VoiceState = 'idle' | 'starting' | 'recording' | 'transcribing' | 'saved';

/** A save failure whose message can be shown to the user as it is. */
class NoteSaveError extends Error {}

/** The provider refused the model for this key (HTTP 403 or 404), say a retired or unreleased one. */
class ModelUnavailableError extends Error {
  constructor(readonly model: string) { super(`model ${model} unavailable`); }
}

/** The provider answered without any text; `reason` says why when it told. */
class EmptyTranscriptError extends Error {}

/** The recording is larger than the provider accepts. */
class RecordingTooLargeError extends Error {}

/** The Notice for a failed transcription. */
function failureMessage(err: unknown): string {
  if (err instanceof RequestTimeoutError) return 'Transcription timed out.';
  if (err instanceof ModelUnavailableError) {
    return `The transcription model “${err.model}” is not available to this API key. Pick another model in block settings.`;
  }
  if (err instanceof EmptyTranscriptError) return `No transcript (${err.message}).`;
  if (err instanceof RecordingTooLargeError) return 'The recording is larger than the transcription service accepts.';
  return 'Transcription failed.';
}

/** File extension of a recorded mime type. */
function audioExtension(mimeType: string): string {
  return mimeType.includes('mp4') ? 'mp4'
    : mimeType.includes('ogg') ? 'ogg'
    : mimeType.includes('aac') ? 'aac'
    : 'webm';
}

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

  /** Push-to-talk: the button is pressed now. */
  private pushHeld = false;
  /** Returns the status to idle after "Saved". */
  private flashTimer: number | null = null;

  // Elapsed timer handle
  private elapsedSeconds = 0;
  private elapsedIntervalRef: number | null = null;

  render(el: HTMLElement): void {
    const cfg = this.instance.config as VoiceDictationConfig;
    el.addClass('voice-block');
    this.containerEl = el;
    this.setState(el, 'idle');
    // Single cleanup registration for the active mic stream and the saved flash on unload
    this.register(() => {
      this.stopActiveStream();
      if (this.flashTimer !== null) window.clearTimeout(this.flashTimer);
    });

    this.renderHeader(el, blockTitle('voice-dictation'));

    const body = el.createDiv({ cls: 'voice-body' });

    // Status label
    this.statusEl = body.createDiv({
      cls: 'voice-status',
      text: 'Tap to record',
      // Announce recording / transcribing / saved transitions to screen readers.
      attr: { role: 'status', 'aria-live': 'polite' },
    });

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
      // A status line, not a Notice: render runs at every open, settings save and
      // edit-mode exit, and a Notice each time nags (N9).
      this.statusEl.setText('Add an API key in block settings');
      this.micBtn.disabled = true;
      this.micBtn.addClass('voice-mic--unavailable');
      return;
    }
    // Still encrypted: the key was saved on another device (or this device's key
    // store is unavailable). The ciphertext must never be sent as a credential;
    // the load-time Notice has already said why.
    if (isEncrypted(cfg.apiKey)) {
      this.statusEl.setText('API key unavailable on this device');
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
      const mic = this.micBtn;
      // touch-action: none, so a slight pan is not a pointercancel that ends the hold (M62).
      mic.addClass('voice-mic--push');
      mic.addEventListener('pointerdown', (e: PointerEvent) => {
        this.pushHeld = true;
        // Keep the release on the button even when the pointer leaves it.
        try { mic.setPointerCapture(e.pointerId); } catch { /* not an active pointer (synthetic event) */ }
        void this.startRecording();
      });
      const release = () => {
        this.pushHeld = false;
        const state = this.getState(el);
        if (state === 'recording') this.stopRecording(el);
        else if (state === 'starting') this.cancelStart(el);
      };
      mic.addEventListener('pointerup', release);
      mic.addEventListener('pointercancel', release);
      // Held from the keyboard too: Space or Enter down starts, up stops (M62).
      const isHoldKey = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Enter';
      mic.addEventListener('keydown', (e: KeyboardEvent) => {
        if (!isHoldKey(e)) return;
        e.preventDefault();
        if (e.repeat) return;
        this.pushHeld = true;
        void this.startRecording();
      });
      mic.addEventListener('keyup', (e: KeyboardEvent) => {
        if (!isHoldKey(e)) return;
        e.preventDefault();
        release();
      });
    } else {
      this.micBtn.addEventListener('click', () => {
        const state = this.getState(el);
        if (state === 'idle') void this.startRecording();
        else if (state === 'recording') this.stopRecording(el);
        // 'starting': a second tap while the microphone opens is ignored (M16).
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
      starting: 'Starting…',
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
    // One handle, cleared by stopElapsedTimer and the unload cleanup: a
    // registerInterval() per recording piled up until unload.
    if (this.elapsedIntervalRef !== null) window.clearInterval(this.elapsedIntervalRef);
    this.elapsedSeconds = 0;
    if (this.timerEl) this.timerEl.setText('0:00');
    this.elapsedIntervalRef = window.setInterval(() => {
      this.elapsedSeconds++;
      const m = Math.floor(this.elapsedSeconds / 60);
      const s = String(this.elapsedSeconds % 60).padStart(2, '0');
      if (this.timerEl) this.timerEl.setText(`${m}:${s}`);
    }, 1000);
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
    // One handle, cleared at unload: a register() per saved note piled up.
    if (this.flashTimer !== null) window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => {
      this.flashTimer = null;
      if (el.isConnected) this.setState(el, 'idle');
    }, 1500);
  }

  // ── Note creation ──────────────────────────────────────────────────────────

  private async saveNote(transcript: string, cfg: VoiceDictationConfig): Promise<{ templateIgnored: boolean }> {
    if (!transcript.trim()) return { templateIgnored: false };
    const dir = await this.resolveFolder(cfg.folder ?? '');
    const path = uniqueFilePath(dir, moment().format('YYYY-MM-DD HH-mm-ss'), 'md', this.fileExists);
    const { content, templateIgnored } = buildNoteContent(cfg.noteTemplate ?? '', transcript);
    await this.app.vault.create(path, content);
    return { templateIgnored };
  }

  /**
   * Keep a recording whose transcription failed: the audio as a file and a note
   * that names the reason and embeds it, in the destination folder, so the user
   * can listen to it or try again instead of losing it (M19, M63). Returns the
   * audio file name.
   */
  private async saveFailedRecording(blob: Blob, mimeType: string, cfg: VoiceDictationConfig, reason: string): Promise<string> {
    const dir = await this.resolveFolder(cfg.folder ?? '');
    const stamp = moment().format('YYYY-MM-DD HH-mm-ss');
    const audioPath = uniqueFilePath(dir, stamp, audioExtension(mimeType), this.fileExists);
    await this.app.vault.createBinary(audioPath, await blob.arrayBuffer());
    const name = audioPath.slice(audioPath.lastIndexOf('/') + 1);
    await this.app.vault.create(uniqueFilePath(dir, stamp, 'md', this.fileExists), `${reason}\n\n![[${name}]]\n`);
    return name;
  }

  private readonly fileExists = (path: string): boolean => this.app.vault.getAbstractFileByPath(path) !== null;

  /**
   * The destination folder, created when missing. Defence in depth:
   * sanitizeVoiceFolder strips anything that could escape the vault, and a `..`
   * segment is an error the user is told about, not a silent skip (M17). Each
   * segment matches an existing folder whatever its letter case, and "already
   * exists" counts as success: on a case-insensitive file system, a folder that
   * differed only in case made every save fail (M18).
   */
  private async resolveFolder(folder: string): Promise<string> {
    const dir = sanitizeVoiceFolder(folder);
    if (dir === null) throw new NoteSaveError('The destination folder can’t contain “..”.');
    let parent: TFolder | null = this.app.vault.getRoot();
    let path = '';
    for (const seg of dir.split('/').filter(Boolean)) {
      const match: TFolder | undefined = parent?.children.find(
        (c): c is TFolder => c instanceof TFolder && c.name.toLowerCase() === seg.toLowerCase(),
      );
      path = path ? `${path}/${match?.name ?? seg}` : (match?.name ?? seg);
      if (match) {
        parent = match;
        continue;
      }
      try {
        await this.app.vault.createFolder(path);
      } catch (e: unknown) {
        if (!/already exists/i.test(e instanceof Error ? e.message : '')) throw e;
      }
      const created = this.app.vault.getAbstractFileByPath(path);
      parent = created instanceof TFolder ? created : null;
    }
    return path;
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  private async startRecording(): Promise<void> {
    const el = this.containerEl;
    if (!el || this.getState(el) !== 'idle') return;
    const cfg = this.instance.config as VoiceDictationConfig;

    if (!cfg.apiKey || isEncrypted(cfg.apiKey)) {
      new Notice('API key required — configure it in block settings');
      return;
    }

    // Claim the start now: while the consent modal or getUserMedia is pending the
    // state is 'starting', so a second tap is ignored (M16); a release, an unload
    // or a re-render bumps recordingGen, which cancels this start (S1, N21).
    const gen = ++this.recordingGen;
    this.setState(el, 'starting');
    const live = () => gen === this.recordingGen && el.isConnected;
    const push = cfg.triggerMode === 'push';

    const provider = cfg.provider ?? 'whisper';
    if (!hasConsent(this.app, provider)) {
      const confirmed = await confirmVoiceConsent(this.app, provider);
      if (confirmed) setConsent(this.app, provider);
      // The press that opened the modal no longer holds the button: push-to-talk
      // records from the next press, never unattended (S1).
      if (!confirmed || push || !live()) {
        if (live()) this.setState(el, 'idle');
        return;
      }
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
      if (live()) this.setState(el, 'idle');
      return;
    }

    // Released, unloaded or superseded while the microphone opened: close the
    // stream now, or it stays open with nothing left to stop it (S1, M16, N21).
    if (!live() || (push && !this.pushHeld)) {
      stream.getTracks().forEach(t => t.stop());
      if (live()) this.setState(el, 'idle');
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
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(recordedMimeType) ? recordedMimeType : undefined,
      });
    } catch (err: unknown) {
      this.abandonStart(el, stream, err);
      return;
    }

    this.activeStream = stream;
    this.mediaRecorder = recorder;

    // Data arrives every second, so the recording stops before the provider's
    // size limit instead of failing after it (M19).
    const cap = PROVIDER_STOP_BYTES[provider];
    let recorded = 0;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
      recorded += e.data.size;
      if (recorded >= cap && recorder.state !== 'inactive' && gen === this.recordingGen) {
        new Notice(`Recording stopped near the ${Math.round(PROVIDER_MAX_BYTES[provider] / 1_000_000)} MB limit of the transcription service.`);
        this.stopRecording(el);
      }
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

    try {
      recorder.start(1000);
    } catch (err: unknown) {
      this.abandonStart(el, stream, err);
      return;
    }
    this.setState(el, 'recording');
  }

  /** The recorder could not be created or started: close the stream and go back to idle. */
  private abandonStart(el: HTMLElement, stream: MediaStream, err: unknown): void {
    console.error('[Homepage Blocks] VoiceDictation recorder failed to start:', err instanceof Error ? err.message : 'unknown error');
    stream.getTracks().forEach(t => t.stop());
    if (this.activeStream === stream) this.activeStream = null;
    this.mediaRecorder = null;
    new Notice('Recording could not start on this device');
    this.setState(el, 'idle');
  }

  /** Push-to-talk released while the start was pending: cancel it. */
  private cancelStart(el: HTMLElement): void {
    this.recordingGen++;
    this.setState(el, 'idle');
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

    const provider = cfg.provider ?? 'whisper';
    let transcript = '';
    try {
      if (blob.size > PROVIDER_MAX_BYTES[provider]) throw new RecordingTooLargeError('recording too large');
      transcript = provider === 'gemini'
        ? await this.transcribeWithGemini(blob, cfg, mimeType)
        : await this.transcribeWithWhisper(blob, cfg, mimeType);
    } catch (err: unknown) {
      // Log only the status / message — the raw body may contain user-supplied text.
      const safe = err instanceof Error ? err.message : 'unknown error';
      console.error('[Homepage Blocks] VoiceDictation transcription failed:', safe);
      // Kept whatever happened to the block meanwhile: a sync reload, a settings
      // change or a closed tab during the request must not lose the recording.
      const reason = failureMessage(err);
      const saved = await this.saveFailedRecording(blob, mimeType, cfg, reason).catch((e: unknown) => {
        console.error('[Homepage Blocks] VoiceDictation could not keep the recording:', e instanceof Error ? e.message : 'unknown error');
        return null;
      });
      new Notice(saved ? `${reason} The recording was saved as ${saved}.` : reason, 10_000);
      if (gen === this.recordingGen && el.isConnected) this.setState(el, 'idle');
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
      const { templateIgnored } = await this.saveNote(transcript, cfg);
      if (templateIgnored) new Notice('Note template ignored: {{transcript}} sits inside a link or an HTML tag.');
      if (gen === this.recordingGen && el.isConnected) this.showSavedFlash(el);
    } catch (e: unknown) {
      const safe = e instanceof Error ? e.message : 'unknown error';
      console.error('[Homepage Blocks] VoiceDictation save failed:', safe);
      if (gen === this.recordingGen && el.isConnected) {
        new Notice(e instanceof NoteSaveError ? e.message : 'Failed to save note');
        this.setState(el, 'idle');
      }
    }
  }

  // ── Whisper transcription ───────────────────────────────────────────────

  private async transcribeWithWhisper(blob: Blob, cfg: VoiceDictationConfig, mimeType: string): Promise<string> {
    const ext = audioExtension(mimeType);

    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const encoder = new TextEncoder();

    const textFields = whisperTextFields(cfg);

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

    const res = await withTimeout(requestUrl({
      url: 'https://api.openai.com/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.apiKey ?? ''}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: body.buffer,
      throw: false,
    }), TRANSCRIBE_TIMEOUT_MS);

    if (res.status === 403 || res.status === 404) throw new ModelUnavailableError(textFields.model);
    if (res.status !== 200) {
      // Don't include the raw body — it may echo user-supplied content or bits of the audio filename.
      throw new Error(`Whisper API error ${res.status}`);
    }

    const json = res.json as { text?: string };
    const text = (json.text ?? '').trim();
    if (!text) throw new EmptyTranscriptError('no speech recognised');
    return text;
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

    const rawModel = effectiveModel('gemini', cfg.model);
    if (!MODEL_NAME_RE.test(rawModel)) {
      throw new Error('Invalid Gemini model name');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:generateContent`;

    const lang = cfg.language ?? '';
    const langHint = LANGUAGE_RE.test(lang)
      ? ` The audio is in language code "${lang}".`
      : '';

    const res = await withTimeout(requestUrl({
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
    }), TRANSCRIBE_TIMEOUT_MS);

    if (res.status === 403 || res.status === 404) throw new ModelUnavailableError(rawModel);
    if (res.status !== 200) {
      throw new Error(`Gemini API error ${res.status}`);
    }

    interface GeminiResponse {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    }
    const json = res.json as GeminiResponse;
    const text = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    if (!text) throw new EmptyTranscriptError(geminiEmptyReason(json));
    return text;
  }

  override renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    const cfg = draft as VoiceDictationConfig;
    // A key still encrypted here was saved on another device. Captured once, when
    // the settings open: a re-render after typing (a provider change) must not
    // lose it, or clearing the field would erase it for that device (M56).
    const otherDeviceKey = cfg.apiKey && isEncrypted(cfg.apiKey) ? cfg.apiKey : null;
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
             cfg.model = DEFAULT_MODELS[v as TranscriptionProvider];
             // Re-render body to update model dropdown and API key placeholder
             renderSettings();
           });
        });

      // Consent is remembered per provider on this device; this is the way back (N18).
      const provider = cfg.provider ?? 'whisper';
      if (hasConsent(this.app, provider)) {
        new Setting(body)
          .setName('Upload consent')
          .setDesc(`You allowed recordings to be uploaded to ${PROVIDER_NAMES[provider]} on this device.`)
          .addButton(b => b.setButtonText('Forget').onClick(() => { forgetConsent(this.app, provider); renderSettings(); }));
      }

      // API key (label + placeholder change based on provider)
      const isGemini = (cfg.provider ?? 'whisper') === 'gemini';
      // Show an empty field for another device's key, and keep that key unless a
      // new one is typed, so clearing the field cannot erase it for that device.
      new Setting(body)
        .setName('API key')
        .setDesc(`${isGemini ? 'Google AI API key for Gemini.' : 'OpenAI API key for Whisper.'} Encrypted at rest with a key that never leaves this device, so other devices cannot read it; entering a key on another device replaces it. Never included in layout exports.`)
        .addText(t => {
          t.inputEl.type = 'password';
          t.setPlaceholder(otherDeviceKey ? 'Stored key unreadable on this device' : isGemini ? 'AIza...' : 'sk-...')
           .setValue(cfg.apiKey && isEncrypted(cfg.apiKey) ? '' : cfg.apiKey ?? '')
           .onChange(v => { cfg.apiKey = v.trim() || (otherDeviceKey ?? ''); });
        });

      // Model: the current models of the provider, or any id typed as a custom one (M15)
      const modelProvider = cfg.provider ?? 'whisper';
      const models = PROVIDER_MODELS[modelProvider];
      const current = effectiveModel(modelProvider, cfg.model);
      const isCustom = !(current in models);
      let customEl: HTMLElement | null = null;
      new Setting(body)
        .setName('Model')
        .setDesc('Transcription model.')
        .addDropdown(d => {
          for (const [value, label] of Object.entries(models)) d.addOption(value, label);
          d.addOption('custom', 'Custom…');
          d.setValue(isCustom ? 'custom' : current);
          d.onChange(v => {
            if (v !== 'custom') cfg.model = v;
            customEl?.toggleClass('hp-hidden', v !== 'custom');
          });
        });
      const custom = new Setting(body)
        .setName('Custom model')
        .setDesc('A model ID the provider offers, for example one released after this plugin version.')
        .addText(t => {
          t.setPlaceholder(DEFAULT_MODELS[modelProvider])
           .setValue(isCustom ? current : '')
           .onChange(v => {
             const id = v.trim();
             if (id === '' || MODEL_NAME_RE.test(id)) cfg.model = id;
           });
        });
      customEl = custom.settingEl;
      customEl.toggleClass('hp-hidden', !isCustom);

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
    const providerName = PROVIDER_NAMES[this.provider];
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
      text: 'This confirmation is remembered per provider on this device. You can withdraw it in the block settings.',
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
