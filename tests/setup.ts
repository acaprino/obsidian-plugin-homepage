// Global test setup. Kept intentionally small — most tests stub what they need inline.
// Happy-dom doesn't ship IndexedDB, which apiKeyCrypto relies on. fake-indexeddb
// attaches a compliant in-memory implementation to globalThis on import.
import 'fake-indexeddb/auto';
// Obsidian augments HTMLElement.prototype (createDiv/createEl/empty/addClass/…)
// at runtime; happy-dom ships only the standard DOM, so render-level tests need
// this shim before any code that builds DOM via the Obsidian helpers runs.
import './obsidian-dom';

export {};
