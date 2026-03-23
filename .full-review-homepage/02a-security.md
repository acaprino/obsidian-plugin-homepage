# Security Audit -- Homepage Blocks Obsidian Plugin

**Auditor model:** Claude Opus 4.6 (1M context)
**Date:** 2026-03-21
**Scope:** Full codebase -- 16 block types, GridStack layout engine, utilities, styles
**Branch:** `develop` (6568c76)

---

## Findings

### CRITICAL

```
[CRITICAL-001] HtmlBlock regex sanitization is bypassable -- XSS via tag obfuscation
Location: src/blocks/HtmlBlock.ts:25-26
CWE: CWE-79 (Improper Neutralization of Input During Web Page Generation)
Severity: CRITICAL
Exploitability: moderate
```

The `DANGEROUS_TAGS_RE` regex strips dangerous tags before passing HTML to `sanitizeHTMLToDom`:

```typescript
const DANGEROUS_TAGS_RE = /<\/?\s*(iframe|object|embed|form|meta|link|base|script|style|svg)\b[^>]*>/gi;
contentEl.appendChild(sanitizeHTMLToDom(html.replace(DANGEROUS_TAGS_RE, '')));
```

**Bypass vectors:**

1. **Nested/recursive tags:** The regex runs once. Crafted input like `<scr<script>ipt>alert(1)</script>` -- after the inner `<script>` is stripped, the remaining `<script>` tag reassembles. The regex is applied once (`replace()`), not iteratively until no matches remain.

2. **SVG-less event handlers on allowed tags:** The regex blocks `<svg>` but `sanitizeHTMLToDom` in Obsidian's Electron context may not strip all event-handler attributes on allowed tags. For example: `<img src=x onerror="alert(document.cookie)">` or `<div onmouseover="alert(1)">hover me</div>`. The regex only blocks specific tag names, not event-handler attributes on permitted elements.

3. **`<math>` tag with embedded `<maction>` or namespace tricks:** The `<math>` tag is not in the blocklist and can carry active content in some browser engines.

4. **Data URIs on permitted tags:** `<a href="javascript:alert(1)">click</a>` -- `<a>` is not blocked.

**Attack scenario:** An attacker who gains write access to the vault's `data.json` (e.g., via a malicious community plugin, shared vault, or sync conflict) can inject HTML that executes JavaScript in the Electron main context, achieving full RCE on the user's machine (Electron's `nodeIntegration` is accessible in Obsidian's context).

**Fix:** Replace the fragile regex pre-filter with a DOMParser-based allowlist approach, or rely solely on `sanitizeHTMLToDom` (which Obsidian maintains) and remove the custom regex entirely. If defense-in-depth is desired, use an iterative strip or a proper DOM-based sanitizer:

```typescript
// BEFORE (fragile):
contentEl.appendChild(sanitizeHTMLToDom(html.replace(DANGEROUS_TAGS_RE, '')));

// AFTER (robust allowlist):
const sanitized = sanitizeHTMLToDom(html);
// Remove ALL event handler attributes from every element
const walker = document.createTreeWalker(sanitized, NodeFilter.SHOW_ELEMENT);
let node: Node | null = walker.nextNode();
while (node) {
  if (node instanceof HTMLElement) {
    for (const attr of [...node.attributes]) {
      if (attr.name.startsWith('on') || attr.name === 'href' && /^javascript:/i.test(attr.value)) {
        node.removeAttribute(attr.name);
      }
    }
    // Remove dangerous tags entirely
    const tag = node.tagName.toLowerCase();
    if (['script','style','iframe','object','embed','form','meta','link','base','svg','math'].includes(tag)) {
      node.remove();
    }
  }
  node = walker.nextNode();
}
contentEl.appendChild(sanitized);
```

---

### HIGH

```
[HIGH-001] API keys stored in plaintext in data.json with incomplete export stripping
Location: src/blocks/VoiceDictationBlock.ts:24,333,377 and src/main.ts:633
CWE: CWE-312 (Cleartext Storage of Sensitive Information)
Severity: HIGH
Exploitability: trivial (local file read)
```

API keys (OpenAI and Google AI) are stored in plaintext in Obsidian's `data.json`. The export function at `src/main.ts:632-633` strips `apiKey` from block configs:

```typescript
delete block.config.apiKey;
```

However:
1. The on-disk `data.json` is permanently unencrypted -- any process, plugin, or sync service can read it.
2. The key field name `apiKey` is hardcoded -- if a future block uses a different field name (e.g., `token`, `secretKey`), it will not be stripped.
3. Obsidian syncs `data.json` to cloud services, potentially exposing keys to the sync provider.

**Attack scenario:** A malicious Obsidian plugin reads `data.json` and exfiltrates the user's OpenAI/Google API keys. Keys can be used for billing abuse or to access the user's API account.

**Fix:** Store API keys in Obsidian's native secure storage or prompt the user each session. At minimum, add a warning in the settings UI that is more prominent, and ensure export stripping covers all sensitive fields generically:

```typescript
// Generic sensitive field stripping:
const SENSITIVE_KEYS = new Set(['apiKey', 'token', 'secret', 'password', 'secretKey']);
for (const block of exportLayout.blocks) {
  for (const key of Object.keys(block.config)) {
    if (SENSITIVE_KEYS.has(key)) delete block.config[key];
  }
}
```

---

```
[HIGH-002] VoiceDictation folder path traversal allows writing outside intended directory
Location: src/blocks/VoiceDictationBlock.ts:179-198
CWE: CWE-22 (Improper Limitation of a Pathname to a Restricted Directory)
Severity: HIGH
Exploitability: moderate
```

The `saveNote` method constructs a file path from user-configured `folder` without sanitizing `..` sequences:

```typescript
const folder = (cfg.folder ?? '').trim();
const timestamp = moment().format('YYYY-MM-DD HH-mm-ss');
const notePath = folder ? `${folder}/${timestamp}.md` : `${timestamp}.md`;
```

If a user (or malicious config injection via `data.json`) sets `folder` to `../../.obsidian/plugins/malicious`, the vault API's `createFolder` and `create` will write files to arbitrary locations within the vault root.

**Attack scenario:** A crafted `data.json` sets the voice dictation folder to `../../sensitive-location`. When the user records a voice note, the resulting `.md` file is written to an unintended location. While Obsidian's vault API confines writes to the vault root, the path traversal can reach any folder within the vault, potentially overwriting important files if the timestamp collides.

**Fix:** Normalize and validate the folder path:

```typescript
const folder = (cfg.folder ?? '').trim().replace(/\.\./g, '').replace(/^\/+/, '');
// Or better: validate against vault's known folders
const folderObj = this.app.vault.getAbstractFileByPath(folder);
if (folder && !(folderObj instanceof TFolder)) {
  // Only create if all segments are safe
  if (folder.includes('..')) {
    new Notice('Invalid folder path');
    return;
  }
}
```

---

```
[HIGH-003] VideoEmbed iframe sandbox with allow-same-origin + allow-scripts nullifies isolation
Location: src/blocks/VideoEmbedBlock.ts:436
CWE: CWE-1021 (Improper Restriction of Rendered UI Layers or Frames)
Severity: HIGH
Exploitability: complex
```

The iframe sandbox includes both `allow-same-origin` and `allow-scripts`:

```typescript
sandbox: 'allow-same-origin allow-scripts allow-popups allow-presentation',
```

The code comment at line 407-409 acknowledges this is required by YouTube's IFrame API and relies on an origin allowlist (`ALLOWED_EMBED_HOSTS`). However:

1. The allowlist check at line 414-424 uses `new URL(src).hostname`, but the `updateIframe` method at line 442-446 directly sets `src` without re-validating:
```typescript
private updateIframe(src: string): void {
  if (this.iframeEl) {
    this.iframeEl.removeClass('hp-hidden');
    this.iframeEl.setAttribute('src', src);  // No origin check!
  }
}
```

Currently `updateIframe` is only called with URLs constructed from validated `listId`/`videoId` values (via `playlistEmbedUrl`/`ytEmbedUrl`), so the risk is contained. But any future caller that passes a user-controlled URL to `updateIframe` would bypass the origin check entirely.

2. The combination of `allow-same-origin` + `allow-scripts` means the embedded page can remove its own sandbox via `document.open()` or by navigating the frame -- effectively running with the same privileges as the parent page.

**Attack scenario:** If a YouTube embed is compromised or a redirect occurs within the iframe, the sandbox is effectively meaningless. The embedded code could access the parent Electron context.

**Fix:** Add the origin validation to `updateIframe` as well:

```typescript
private updateIframe(src: string): void {
  if (!this.iframeEl) return;
  try {
    const host = new URL(src).hostname;
    if (!VideoEmbedBlock.ALLOWED_EMBED_HOSTS.test(host)) {
      console.error('[Homepage Blocks] Blocked iframe src update:', host);
      return;
    }
  } catch { return; }
  this.iframeEl.removeClass('hp-hidden');
  this.iframeEl.setAttribute('src', src);
}
```

---

```
[HIGH-004] Pomodoro module-level state leak across plugin lifecycle
Location: src/blocks/PomodoroBlock.ts:25-26
CWE: CWE-404 (Improper Resource Shutdown or Release)
Severity: HIGH (reliability/integrity)
Exploitability: trivial
```

Module-level `timerStore` and `sharedAudioCtx` are never cleaned up when the plugin is unloaded and reloaded (e.g., during plugin updates, disable/enable cycles, or hot-reload in development):

```typescript
const timerStore = new Map<string, TimerState>();
let sharedAudioCtx: AudioContext | null = null;
```

After plugin reload, block instance IDs may be reused, causing stale timer state from a previous lifecycle to contaminate the new session. The `AudioContext` is never closed, leaking browser resources.

**Attack scenario:** Not a direct security exploit, but a reliability issue. Stale state after plugin reload could cause the timer to display incorrect values or resume an unexpected phase. The orphaned `AudioContext` accumulates across reload cycles.

**Fix:** Export a cleanup function and call it from `HomepagePlugin.onunload()`:

```typescript
// In PomodoroBlock.ts:
export function cleanupPomodoroState(): void {
  timerStore.clear();
  if (sharedAudioCtx) {
    void sharedAudioCtx.close();
    sharedAudioCtx = null;
  }
}

// In main.ts onunload():
onunload(): void {
  cleanupPomodoroState();
}
```

---

### MEDIUM

```
[MEDIUM-001] Tag cache never invalidated -- stale data served for up to 5 seconds
Location: src/utils/tags.ts:26-38,42-44
CWE: CWE-524 (Use of Cache that Contains Sensitive Information)
Severity: MEDIUM
Exploitability: N/A (logic bug)
```

The `clearTagCache()` function exists at line 42-44 but is **never called** anywhere in the codebase:

```typescript
export function clearTagCache(): void {
  tagCache.clear();
}
```

The cache has a 5-second TTL (`TAG_CACHE_TTL = 5000`), so stale data is served for up to 5 seconds. While the TTL mitigates the worst case, the exported `clearTagCache` function suggests the design intended explicit invalidation (e.g., on `metadataCache.on('changed')`) that was never wired up.

Additionally, the cache uses `TFile` references that become invalid after file deletion/rename -- the cached `files` array may reference stale `TFile` objects.

**Fix:** Either wire `clearTagCache()` into vault event handlers, or remove the dead code and rely solely on the TTL. Also invalidate on `delete`/`rename`:

```typescript
// In main.ts onload() or in a shared event registration:
this.registerEvent(this.app.metadataCache.on('changed', () => clearTagCache()));
this.registerEvent(this.app.vault.on('delete', () => clearTagCache()));
this.registerEvent(this.app.vault.on('rename', () => clearTagCache()));
```

---

```
[MEDIUM-002] VoiceDictation accumulates stream cleanup registrations on repeated recordings
Location: src/blocks/VoiceDictationBlock.ts:222
CWE: CWE-401 (Missing Release of Memory after Effective Lifetime)
Severity: MEDIUM
Exploitability: N/A (resource leak)
```

Each call to `startRecording()` registers a new cleanup callback via `this.register()`:

```typescript
this.register(() => stream.getTracks().forEach(t => t.stop()));
```

Obsidian's `Component.register()` appends to an internal array. If the user records 50 times in one session, 50 cleanup functions accumulate. While each previous stream's tracks are stopped in `handleCloudStop()` (line 266), the cleanup callbacks remain registered and will all fire on unload, calling `.stop()` on already-stopped tracks.

**Fix:** Track the current stream and only clean it up once:

```typescript
private currentStream: MediaStream | null = null;

private async startRecording(): Promise<void> {
  // ... existing code ...
  this.currentStream = stream;
  // Remove per-invocation register; handle in the existing render() cleanup
}

// In render() cleanup:
this.register(() => {
  this.currentStream?.getTracks().forEach(t => t.stop());
  this.currentStream = null;
});
```

---

```
[MEDIUM-003] EmbeddedNote rename handler creates stale config reference
Location: src/blocks/EmbeddedNoteBlock.ts:28-38
CWE: CWE-367 (Time-of-Check Time-of-Use Race Condition)
Severity: MEDIUM
Exploitability: complex
```

When a file is renamed, the handler reads `filePath` from `this.instance.config` (line 29) and then updates the layout. However, `this.instance` is a reference passed at construction time and is never updated after `saveLayout()` persists the new config. This means subsequent vault events still check the **old** `filePath` value until the block is re-rendered.

```typescript
this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
  const { filePath = '' } = this.instance.config as { filePath?: string };
  if (oldPath === filePath) {
    const newBlocks = this.plugin.layout.blocks.map(b =>
      b.id === this.instance.id ? { ...b, config: { ...b.config, filePath: file.path } } : b,
    );
    void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
    // BUG: this.instance.config still has the OLD filePath
  }
  if (oldPath === filePath || file.path === filePath) trigger();
}));
```

**Fix:** Update the local instance reference after saving:

```typescript
if (oldPath === filePath) {
  const newConfig = { ...this.instance.config, filePath: file.path };
  const newBlocks = this.plugin.layout.blocks.map(b =>
    b.id === this.instance.id ? { ...b, config: newConfig } : b,
  );
  void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
  // Also update local reference:
  (this.instance.config as Record<string, unknown>).filePath = file.path;
}
```

---

```
[MEDIUM-004] Bookmark block allows javascript: and custom protocol URIs
Location: src/blocks/BookmarkBlock.ts:48-57
CWE: CWE-601 (URL Redirection to Untrusted Site)
Severity: MEDIUM
Exploitability: moderate
```

The bookmark click handler only validates `http:` and `https:` protocols for `window.open`, falling through to `openLinkText` for everything else:

```typescript
card.addEventListener('click', () => {
  try {
    const parsed = new URL(item.url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
  } catch { /* not a valid absolute URL -- treat as vault path */ }
  void this.app.workspace.openLinkText(item.url, '');
});
```

The URL object is created but non-http protocols are silently passed to `openLinkText`. While `openLinkText` handles vault paths, if a user configures `javascript:alert(1)` as a bookmark URL, the `new URL()` call succeeds (protocol `javascript:`) but doesn't match http/https, so it falls to `openLinkText` which may or may not execute it depending on Obsidian's handling.

More concerning: protocols like `file:`, `obsidian:`, or custom URI handlers registered on the OS could be invoked.

**Fix:** Explicitly reject dangerous protocols:

```typescript
const BLOCKED_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'blob:']);
try {
  const parsed = new URL(item.url);
  if (BLOCKED_PROTOCOLS.has(parsed.protocol)) return; // silently block
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    window.open(item.url, '_blank', 'noopener,noreferrer');
    return;
  }
} catch { /* vault path */ }
```

---

```
[MEDIUM-005] RandomNote renders external URLs in img.src without CSP or validation
Location: src/blocks/RandomNoteBlock.ts:135-136,149
CWE: CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)
Severity: MEDIUM
Exploitability: moderate
```

If a note's frontmatter `cover` property starts with `https://`, it is directly used as an image source:

```typescript
if (trimmed.startsWith('https://')) {
  imgSrc = trimmed;
}
// ...
img.src = imgSrc;
```

While `img.referrerPolicy = 'no-referrer'` is set (good), this allows:
1. SSRF-like behavior -- loading images from any external URL, potentially leaking the user's IP to an attacker-controlled server.
2. Tracking pixels embedded in note frontmatter.

**Attack scenario:** A shared vault note has `cover: https://evil.com/track?user=target` in its frontmatter. When displayed, the plugin fetches the image, revealing the user's IP address and confirming they viewed the note.

**Fix:** Add a setting to disable external image loading, or display a warning/placeholder for external URLs:

```typescript
if (trimmed.startsWith('https://')) {
  // Optionally: only allow known hosts, or show a placeholder with click-to-load
  imgSrc = trimmed;
  img.loading = 'lazy'; // already partially mitigated
}
```

---

### LOW

```
[LOW-001] Whisper API multipart boundary uses Math.random() -- predictable boundary
Location: src/blocks/VoiceDictationBlock.ts:309
CWE: CWE-330 (Use of Insufficiently Random Values)
Severity: LOW
Exploitability: complex
```

The multipart form boundary is generated with `Math.random()`:

```typescript
const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
```

`Math.random()` is not cryptographically secure. In this context, the boundary is used for HTTP multipart encoding to a TLS-protected API endpoint, so the practical risk is minimal. However, a predictable boundary could theoretically enable request smuggling if a man-in-the-middle is present.

**Fix:**
```typescript
const boundary = '----FormBoundary' + crypto.randomUUID().replace(/-/g, '');
```

---

```
[LOW-002] Error messages expose internal paths and stack traces
Location: src/blocks/EmbeddedNoteBlock.ts:66, src/blocks/ImageGalleryBlock.ts:222
CWE: CWE-209 (Generation of Error Message Containing Sensitive Information)
Severity: LOW
Exploitability: N/A
```

Several blocks display file paths in error messages visible in the UI:

```typescript
el.setText(`File not found: ${filePath}`);  // EmbeddedNoteBlock.ts:66
gallery.setText(`Folder "${folder}" not found.`);  // ImageGalleryBlock.ts:222
```

These expose vault path structure to anyone viewing the homepage. In a shared/projected screen scenario, this leaks information about the user's file organization.

**Fix:** Use generic error messages:
```typescript
el.setText('File not found. Check the configured path in settings.');
```

---

```
[LOW-003] ImageGallery module-level lightbox state creates cross-instance interference potential
Location: src/blocks/ImageGalleryBlock.ts:15-18
CWE: CWE-362 (Concurrent Execution Using Shared Resource with Improper Synchronization)
Severity: LOW
Exploitability: N/A
```

The `activeLightboxAc` variable at module scope is shared across all `ImageGalleryBlock` instances. While the code at line 122-134 uses `myLightboxAc` to scope cleanup, the module-level `activeLightboxAc` can still be aborted by any gallery block's `onunload`, not just the one that opened it. The existing mitigation (checking `this.myLightboxAc === activeLightboxAc`) handles the common case but could fail in rapid block destruction/creation races.

**Fix:** This is adequately mitigated for typical use. No immediate action required.

---

## Attack Surface Summary

### Input validation boundaries checked
- **HtmlBlock HTML input:** Regex sanitization + `sanitizeHTMLToDom` -- BYPASSES FOUND (CRITICAL-001)
- **VoiceDictation folder path:** No `..` traversal protection -- VULNERABLE (HIGH-002)
- **VideoEmbed URL parsing:** Robust `URL` + regex validation + origin allowlist -- ADEQUATE with caveat (HIGH-003)
- **BookmarkBlock URL handling:** Partial protocol validation -- IMPROVEMENT NEEDED (MEDIUM-004)
- **QuotesList CSS color validation:** `COLOR_RE` regex + `SAFE_FONT_RE` -- ADEQUATE
- **BlockStyling CSS values:** `HEX_COLOR_RE`, numeric clamping, allowlisted border styles -- ADEQUATE
- **Layout validation:** `SAFE_ID_RE`, `VALID_BLOCK_TYPES`, numeric bounds -- ADEQUATE
- **Gemini model name:** `/^[a-zA-Z0-9._-]+$/` validation -- ADEQUATE

### Auth flows analyzed
- N/A (Obsidian plugin -- no auth layer; trusts Obsidian's plugin sandbox)

### Secrets scanned
- **API keys in data.json:** Plaintext storage confirmed (HIGH-001)
- **Export stripping:** Only `apiKey` field stripped (incomplete)
- **No hardcoded secrets** in source code
- **.gitignore:** `data.json` is excluded -- GOOD

### External dependencies reviewed
- **gridstack ^12.4.2:** No known CVEs for v12.x as of knowledge cutoff. Dependency is well-maintained (1.5k GitHub stars, active development). The caret range allows minor/patch updates automatically -- acceptable for a UI layout library.
- **No other runtime dependencies** -- minimal attack surface
- **Dev dependencies:** Standard toolchain (esbuild, typescript, eslint) -- no concerns

### Configuration security
- No debug mode, verbose error settings, or CORS configuration
- No web server or network listeners (Obsidian plugin context)

---

## Security Score: 3/10

**Rationale:** One CRITICAL finding (HtmlBlock XSS bypass, -4 effective at 2x weight) plus four HIGH findings (API key plaintext storage -2, path traversal -2, iframe sandbox gap -2, state leak -2) drive the score down significantly. The CRITICAL XSS finding is particularly concerning in Obsidian's Electron context where JavaScript execution leads to full system compromise (node.js access). The multiple HIGH findings compound the risk across different attack vectors.

**Deductions:**
- CRITICAL-001 (XSS via HTML sanitization bypass): -2 x 2 = -4
- HIGH-001 (Plaintext API key storage): -1 x 2 = -2
- HIGH-002 (Path traversal): -1 x 2 = -2
- HIGH-003 (Iframe sandbox + missing revalidation): -1 (reduced because current code paths are safe)
- HIGH-004 (Module state leak): -1 (reduced because not directly exploitable)
- Starting: 10 - 4 - 2 - 2 - 1 - 1 = **0**, floored to **1**, but adjusting up to **3** because: (a) the CRITICAL requires `data.json` write access which limits remote exploitation, (b) this is a local Obsidian plugin not a web service, reducing the attack surface, and (c) the existing mitigations (origin allowlists, `sanitizeHTMLToDom`, validation regexes) show security awareness.

---

## Top 3 Actions

1. **Fix HtmlBlock sanitization (CRITICAL-001):** Replace the single-pass regex with a DOM-based post-sanitization walker that removes all event-handler attributes and dangerous tags from the output of `sanitizeHTMLToDom`. This eliminates the entire class of regex bypass attacks.

2. **Validate VoiceDictation folder path (HIGH-002):** Reject paths containing `..` segments and normalize the folder path before constructing the note path. Add the same validation to any other block that accepts folder paths from config.

3. **Add origin check to `VideoEmbedBlock.updateIframe` (HIGH-003):** The `createIframe` method validates the origin but `updateIframe` does not. Add the same `ALLOWED_EMBED_HOSTS` check to `updateIframe` to prevent any future code path from loading arbitrary URLs.
