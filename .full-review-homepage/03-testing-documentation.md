# Phase 3: Testing & Documentation Review

## Test Coverage Findings

Full details in `03a-testing.md`.

**The project has zero automated tests** -- no test framework, no test files, no test scripts, no CI.

### Critical (3)
- No test infrastructure at all (0% coverage)
- HtmlBlock XSS regex sanitization untested with known bypass vectors
- Layout validation/migration functions handle untrusted data with zero coverage

### High (5)
- Tag cache (`getFilesWithTag`) has no tests for TTL, staleness, stale TFile references
- EmbeddedNote rename handler stale config bug undocumented by tests
- EmbeddedNote grow mode missing `data-auto-height-content` untested
- VoiceDictation stream cleanup accumulation untested
- Block styling pure logic (luminance, clamping) has no coverage

### Recommendation
Install Vitest + jsdom. Prioritize layout validation (~25 tests) and HTML sanitization (~15 tests) for highest-risk coverage.

---

## Documentation Findings

Full details in `03b-documentation.md`.

### High (1)
- API key plaintext storage has no user-facing warning in README

### Medium (7)
- README says 15 block types, actual is 16 (voice-dictation missing)
- CLAUDE.md omits 11 shared styling config keys
- Responsive grid system undocumented in CLAUDE.md
- HtmlBlock sanitization layers not documented
- VideoEmbed iframe security model only in inline comments
- VoiceDictation folder path traversal risk undocumented
- No per-block config schema interfaces

### Low (7)
- README open mode descriptions mention nonexistent "sidebar" option
- Auto-height docs unclear on default-on vs opt-in
- Collapse/expand system undocumented
- No development section in README
- Block count inconsistency across files
- No lint script despite eslint config
- No changelog
