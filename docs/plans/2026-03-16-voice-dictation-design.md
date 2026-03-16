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
| `folder` | `string` | `""` | Destination folder (root if empty). Nested paths supported (e.g. `a/b/c`). |
| `triggerMode` | `'tap' \| 'push'` | `'tap'` | Tap-to-record or push-to-talk |
| `whisperApiKey` | `string` | `""` | OpenAI API key (empty = use Web Speech) |
| `whisperLanguage` | `string` | `""` | ISO-639-1 language code (e.g. `en`, `it`, `fr`). Empty = Whisper auto-detect. |
| `noteTemplate` | `string` | `""` | Optional template; all occurrences of `{{transcript}}` replaced. |

**`defaultConfig`** (as passed to `BlockRegistry.register`):
```typescript
{ folder: '', triggerMode: 'tap', whisperApiKey: '', whisperLanguage: '', noteTemplate: '' }
```

Note: `whisperLanguage` accepts ISO-639-1 codes only, not full BCP-47 tags (the OpenAI Whisper API silently ignores tags like `en-US`). The settings modal description reads: "ISO-639-1 code e.g. en, it, fr".

---

## 4. Architecture

Single file: `src/blocks/VoiceDictationBlock.ts`. No external helper modules.

### Transcription backends

**Web Speech path** (default, when `whisperApiKey` is empty):
- Uses native `SpeechRecognition` API (available in Obsidian's Electron/Chromium)
- `interimResults: false`, `continuous: false`
- On `onresult`: extract transcript text
- On `onend`: if transcript is non-empty → save note → state `saved`; if empty → state `idle` (silent)
- On `onerror`: state → `idle`; if `event.error === 'not-allowed'` → `new Notice('Microphone access denied')`; otherwise `new Notice('Speech recognition error: ' + event.error)`. Note: in Chromium, `onend` fires after `onerror` — the `onerror` handler sets a flag so the subsequent `onend` is ignored.

**Whisper path** (when `whisperApiKey` is set):
- `MediaRecorder` captures microphone audio as WebM/Opus blob
- On stop: guard `if (blob.size === 0)` → `new Notice('No audio captured')`, return `idle`
- Send: `fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', body: FormData, signal: abortController.signal })` with `model: 'whisper-1'`
- Response JSON `.text` field → save note → state `saved`
- Non-200 response: `new Notice('Transcription failed: ' + errorText)`, state → `idle`
- `AbortController` instance stored as class field (`private fetchAbortCtrl`); aborted in cleanup (see Section 10)

### Note creation

```typescript
const timestamp = moment().format('YYYY-MM-DD HH-mm-ss');
const notePath = cfg.folder ? `${cfg.folder}/${timestamp}.md` : `${timestamp}.md`;

// Recursive folder creation: walk each segment and create if missing
if (cfg.folder) {
  const segments = cfg.folder.split('/').filter(Boolean);
  let accumulated = '';
  for (const seg of segments) {
    accumulated = accumulated ? `${accumulated}/${seg}` : seg;
    if (!app.vault.getAbstractFileByPath(accumulated)) {
      await app.vault.createFolder(accumulated);
    }
  }
}

const content = cfg.noteTemplate
  ? cfg.noteTemplate.replaceAll('{{transcript}}', transcript)
  : transcript;
await app.vault.create(notePath, content);
```

---

## 5. UI States

State is driven by `el.dataset.voiceState` on the root element. CSS handles all visibility — no manual `display` toggling in TypeScript.

| State | Trigger | UI |
|-------|---------|-----|
| `idle` | Initial / after `saved` / after error | Mic button centered, status "Tap to record" |
| `recording` | User starts recording | Mic button red + pulse ring + elapsed timer |
| `transcribing` | Stop recording (Whisper only) | Spinner, status "Transcribing…" |
| `saved` | Note created | Checkmark + "Saved" flash (1.5 s), then → `idle` |

Web Speech API skips `transcribing` entirely.

### State transitions

```
idle ──[start]──▶ recording ──[stop]──▶ transcribing ──▶ saved ──▶ idle
                     │                        │
                     └──[error]──▶ idle       └──[error]──▶ idle
                                   └─────────────────────────────▶ (Web Speech: direct)
```

### Edit mode

The mic button is **disabled and non-interactive** in edit mode. GridLayout's edit mode renders symbolic placeholders; the block should check `el.closest('.grid-stack-item')?.classList.contains('is-editing')` or rely on the standard edit mode DOM indicator to disable pointer events on `.voice-mic` during layout editing.

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
    div.voice-saved-flash
      span (check icon)
      span.voice-saved-label  ← "Saved"
```

Note: `div.voice-transcript-zone` is omitted — auto-save mode has no preview UI.

---

## 7. Trigger Modes

**Tap-to-record** (`triggerMode: 'tap'`):
- `click` event on mic button
- First click → start recording
- Second click → stop recording
- `aria-label`: "Start recording" / "Stop recording"

**Push-to-talk** (`triggerMode: 'push'`):
- `pointerdown` → start recording
- `pointerup` + `pointercancel` → stop recording
- `pointerleave` is NOT used (does not fire reliably on mobile touch)
- `aria-label`: "Hold to record voice note"

Mode is read from config at render time. No runtime switching.

---

## 8. Error Handling

| Error | Behavior |
|-------|----------|
| Mic permission denied (`SpeechRecognition` `not-allowed`) | `new Notice('Microphone access denied')`, state → `idle` |
| `SpeechRecognition` unavailable | `new Notice('Speech recognition not supported on this platform')`, mic button hidden |
| `SpeechRecognition` other error | `new Notice('Speech recognition error: ' + event.error)`, state → `idle` |
| Zero-byte audio blob (Whisper) | `new Notice('No audio captured')`, state → `idle`; fetch is NOT sent |
| Whisper API non-200 | `new Notice('Transcription failed: ' + errorText)`, state → `idle` |
| Whisper fetch aborted (cleanup) | Silently ignored — block is unloading |
| Empty transcript string | No note created, silent return to `idle` |
| Destination folder missing | Auto-created recursively before `vault.create()` |

---

## 9. Block Settings Modal

Defined as a `Modal` subclass within `VoiceDictationBlock.ts`, opened via `openSettings(onSave)`.

Settings:
1. **Destination folder** — `FolderSuggestModal` pattern (same as FolderLinksBlock)
2. **Trigger mode** — dropdown: "Tap to record" / "Push to talk"
3. **Whisper API key** — text input, `type="password"`, description: "Leave empty to use built-in speech recognition"
4. **Whisper language** — text input, placeholder "auto", description: "ISO-639-1 code e.g. en, it, fr. Leave empty for auto-detect."
5. **Note template** — textarea, placeholder `{{transcript}}`, description: "Optional. Use {{transcript}} for the transcribed text. All occurrences are replaced."

---

## 10. Cleanup

All resources registered via Obsidian Component lifecycle. **Order matters**: `MediaRecorder` must be stopped before its stream tracks are stopped to prevent a rogue `onstop` → fetch after unload.

```typescript
this.register(() => {
  // 1. Abort any in-flight Whisper fetch
  this.fetchAbortCtrl?.abort();
  // 2. Stop MediaRecorder before stopping tracks (prevents rogue onstop/dataavailable)
  if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
    this.mediaRecorder.ondataavailable = null;
    this.mediaRecorder.onstop = null;
    this.mediaRecorder.stop();
  }
  // 3. Stop mic stream tracks
  this.mediaRecorder?.stream.getTracks().forEach(t => t.stop());
  // 4. Abort Web Speech
  this.recognition?.abort();
});
```

**Saved flash timer**: the 1.5 s delay after saving uses `this.register()` with a handle:
```typescript
const id = window.setTimeout(() => { this.setState('idle'); }, 1500);
this.register(() => window.clearTimeout(id));
```
No raw unregistered `setTimeout`.

**Elapsed timer**: `this.registerInterval(callback, 1000)`. No raw `setInterval`.

---

## 11. Registration

Steps must be performed in this order (TypeScript enforces exhaustiveness on `BLOCK_META`):

1. **`src/types.ts`** — add `'voice-dictation'` to `BLOCK_TYPES` array *(must be first)*
2. **`src/main.ts`** — add to `registerBlocks()`:
```typescript
BlockRegistry.register({
  type: 'voice-dictation',
  displayName: 'Voice Notes',
  defaultConfig: { folder: '', triggerMode: 'tap', whisperApiKey: '', whisperLanguage: '', noteTemplate: '' },
  defaultSize: { w: 2, h: 3 },
  create: (app, instance, plugin) => new VoiceDictationBlock(app, instance, plugin),
});
```
3. **`src/EditToolbar.ts`** — add to `BLOCK_META` *(after step 1 or compile error)*:
```typescript
{ type: 'voice-dictation', icon: 'microphone', description: 'Record voice notes saved automatically to a folder' }
```

Note: `shouldAutoHeight()` in `GridLayout.ts` is **not** needed — the block has no variable-height content. Fixed mic + status UI always fits the grid cell.

---

## 12. Default Block Size

```
defaultSize: { w: 2, h: 3 }
```

Minimum viable: `w:1, h:2` — advisory only (no `minW`/`minH` enforcement in the current `BlockFactory` interface). Container queries handle responsive adaptation (48 px mic at narrow widths, 64 px at normal widths).

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
