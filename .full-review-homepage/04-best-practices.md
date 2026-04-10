# Phase 4: Best Practices & Standards

## Framework & Language Findings

Full details in `04a-best-practices.md`.

### Positive
- Zero `tsc` errors, zero `as any`, zero `@ts-ignore/@ts-expect-error` -- fully strict-compliant
- Zero ESLint violations with `eslint-plugin-obsidianmd` recommended rules
- All blocks correctly use `Component` lifecycle (`registerInterval`, `registerEvent`, `register`)
- No deprecated Obsidian APIs detected
- esbuild config well-optimized (correct externals, tree shaking, debug stripping)
- Only 1 runtime dependency (`gridstack`) -- minimal attack surface

### Medium (1)
- Two `window.open()` calls in `VideoEmbedBlock.ts` (lines 175, 403) missing `noopener,noreferrer` -- must fix before community plugin submission

### Low (1)
- No `lint` script in package.json despite eslint being configured

---

## CI/CD & DevOps Findings

### High (1)
- No CI/CD pipeline at all -- no GitHub Actions, no automated checks on push/PR

### Medium (2)
- No automated type-checking gate (manual `npx tsc --noEmit`)
- No release automation (manual version bump + build)

---

## Dead Code Findings

Full details in `04c-dead-code.md`.

### Medium (1)
- `clearTagCache()` in `src/utils/tags.ts` -- exported function never called anywhere

### Low (3)
- `.block-empty-hint-action` CSS class styled but never referenced in TS
- `.toolbar-col-auto-hint` CSS class styled but never referenced in TS
- `EmojiPickerOptions` interface exported but only used internally

**Overall: Very clean codebase** -- all 16 block types fully registered, all dependencies used, no unused imports, no unreachable code paths.
