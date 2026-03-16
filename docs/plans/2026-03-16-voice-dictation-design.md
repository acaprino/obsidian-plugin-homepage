# Voice Dictation Block — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Block type:** `voice-dictation`

---

## 1. Overview

A homepage block for capturing quick voice notes. The user taps (or holds) a mic button, speaks, and a new timestamped Markdown note is created silently in a configured vault folder. No preview, no confirmation — fully automatic.

---

## 2. Use Case & Constraints

- **Primary use case:** Quick voice capture — speed over accuracy
- **Output:** New note `{folder}/{YYYY-MM-DD HH-mm-ss}.md` containing the transcript text
- **Post-transcription:** Always silent/automatic — no preview, no confirm/discard
- **Platforms:** Desktop (Electron/Chromium) + Obsidian mobile (Android/iOS)

---

## 3. Configuration (`VoiceDictationConfig`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `folder` | `string` | `""` | Destination folder (root if empty) |
| `triggerMode` | `'tap' \| 'push'` | `'tap'` | Tap-to-record or push-to-talk |
| `whisperApiKey` | `string` | `""` | OpenAI API key (empty = use Web Speech) |
| `whisperLanguage` | `string` | `""` | BCP-47 language code for Whisper (empty = auto-detect) |
| `noteTemplate` | `string` | `""` | Optional template; `{{transcript}}` placeholder |

---

## 4. Architecture

Single file: `src/blocks/VoiceDictationBlock.ts`. No external helper modules.

### Transcription backends

**Web Speech path** (default, when `whisperApiKey` is empty):
- Uses native `SpeechRecognition` API (available in Obsidian's Electron/Chromium)
- `interimResults: false`, `continuous: false`
- Result available in `onresult` event — immediate, no network required
- `onend` fires → note saved → state transitions to `saved`

**Whisper path** (when `whisperApiKey` is set):
- `MediaRecorder` captures microphone audio as WebM/Opus blob
- On stop: `fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', body: FormData })` with `model: 'whisper-1'`
- Response JSON `.text` field → note saved → state transitions to `saved`

### Note creation

```typescript
const timestamp = moment().format('YYYY-MM-DD HH-mm-ss');
const path = cfg.folder ? `${cfg.folder}/${timestamp}.md` : `${timestamp}.md`;
// ensure folder exists
if (cfg.folder && !app.vault.getAbstractFileByPath(cfg.folder)) {
  await app.vault.createFolder(cfg.folder);
}
const content = cfg.noteTemplate
  ? cfg.noteTemplate.replace('{{transcript}}', transcript)
  : transcript;
await app.vault.create(path, content);
```

---

## 5. UI States

State is driven by `el.dataset.voiceState` on the root element. CSS handles all visibility — no manual `display` toggling in TypeScript.

| State | Trigger | UI |
|-------|---------|-----|
| `idle` | Initial / after `saved` | Mic button centered, status "Tap to record" |
| `recording` | User starts recording | Mic button red + pulse ring + elapsed timer |
| `transcribing` | Stop recording (Whisper only) | Spinner, status "Transcribing…" |
| `saved` | Note created | Checkmark + "Saved" flash (1.5s), then → `idle` |

Web Speech API skips `transcribing` entirely.

### State transitions

```
idle ──[start]──▶ recording ──[stop]──▶ transcribing ──▶ saved ──▶ idle
                                   └─────────────────────────────▶ (Web Speech: direct)
```

---

## 6. DOM Structure

Rendered once in `render(el)`. State changes only update `el.dataset.voiceState` and text content.

```
div.voice-block  [data-voice-state]
  (header via renderHeader)
  div.voice-body
    div.voice-status          ← "Tap to record" / "Recording…" / "Transcribing…"
    div.voice-mic-zone
      button.voice-mic
        span.voice-mic-icon   ← setIcon('microphone') or setIcon('square')
      div.voice-timer         ← elapsed time "0:12" (recording only)
    div.voice-transcript-zone ← unused (auto-save mode, kept for future)
    div.voice-saved-flash
      span (check icon)
      span.voice-saved-label  ← "Saved"
```

---

## 7. Trigger Modes

**Tap-to-record** (`triggerMode: 'tap'`):
- `click` event on mic button
- First click → start recording
- Second click → stop recording
- `aria-label`: "Start recording" / "Stop recording"

**Push-to-talk** (`triggerMode: 'push'`):
- `pointerdown` → start recording
- `pointerup` / `pointerleave` → stop recording
- `aria-label`: "Hold to record voice note"

Mode is read from config at render time. No runtime switching.

---

## 8. Error Handling

| Error | Behavior |
|-------|----------|
| Microphone permission denied | `new Notice('Microphone access denied')`, stay `idle` |
| `SpeechRecognition` not available | `new Notice('Speech recognition not supported on this platform')`, hide mic button |
| Whisper API error (non-200) | `new Notice('Transcription failed: ' + errorMessage)`, return to `idle` |
| Empty transcript | No note created, silent return to `idle` |
| Destination folder missing | Auto-created via `app.vault.createFolder()` before `vault.create()` |

---

## 9. Block Settings Modal

Defined as a `Modal` subclass within `VoiceDictationBlock.ts`, opened via `openSettings(onSave)`.

Settings:
1. **Destination folder** — `FolderSuggestModal` pattern (same as FolderLinksBlock)
2. **Trigger mode** — dropdown: "Tap to record" / "Push to talk"
3. **Whisper API key** — text input, `type="password"`, description: "Leave empty to use built-in speech recognition"
4. **Whisper language** — text input, placeholder "auto", description: "BCP-47 code e.g. en, it, fr"
5. **Note template** — textarea, placeholder `{{transcript}}`, description: "Optional. Use {{transcript}} for the transcribed text"

---

## 10. Cleanup

All resources registered via Obsidian Component lifecycle:

```typescript
this.register(() => {
  recognition?.stop();
  mediaRecorder?.stream.getTracks().forEach(t => t.stop());
});
```

Timer uses `this.registerInterval()`. No raw `setInterval`.

---

## 11. Registration

**`src/types.ts`** — add `'voice-dictation'` to `BLOCK_TYPES`.

**`src/main.ts`** — `registerBlocks()`:
```typescript
BlockRegistry.register({
  type: 'voice-dictation',
  displayName: 'Voice Notes',
  defaultConfig: { folder: '', triggerMode: 'tap', whisperApiKey: '', whisperLanguage: '', noteTemplate: '' },
  defaultSize: { w: 2, h: 3 },
  create: (app, instance, plugin) => new VoiceDictationBlock(app, instance, plugin),
});
```

**`src/EditToolbar.ts`** — add to `BLOCK_META`:
```typescript
{ type: 'voice-dictation', icon: 'microphone', description: 'Record voice notes saved automatically to a folder' }
```

**`src/GridLayout.ts`** — add `'voice-dictation'` to `shouldAutoHeight()`.

---

## 12. Default Block Size

```
defaultSize: { w: 2, h: 3 }
```

Minimum viable: `w:1, h:2`. Container queries handle responsive adaptation (48px mic at narrow widths, 64px at normal widths).

---

## 13. CSS

All styles in `styles.css` under `/* ── Voice Dictation Block ── */` section. Key classes: `.voice-block`, `.voice-body`, `.voice-status`, `.voice-mic-zone`, `.voice-mic`, `.voice-mic-icon`, `.voice-timer`, `.voice-saved-flash`, `.voice-saved-label`. State visibility driven exclusively by `[data-voice-state]` attribute selector.

Pulse ring animation on `recording` state via `::after` pseudo-element. No JS animation loops.

---

## 14. Out of Scope

- Transcript preview / edit before save
- Appending to existing notes
- Keyword/tag injection into note frontmatter
- Real-time streaming transcript display
- Local Whisper (on-device model)
