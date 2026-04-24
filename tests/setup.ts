// Global test setup. Kept intentionally small — most tests stub what they need inline.
// Happy-dom doesn't ship IndexedDB, which apiKeyCrypto relies on. fake-indexeddb
// attaches a compliant in-memory implementation to globalThis on import.
import 'fake-indexeddb/auto';

export {};
