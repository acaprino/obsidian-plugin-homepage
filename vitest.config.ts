import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      // Obsidian is externalized by esbuild — in tests we swap in a hand-written
      // mock that implements just the API surface the plugin uses.
      obsidian: path.resolve(__dirname, 'tests/__mocks__/obsidian.ts'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    // Deterministic time for anything that reads `moment()` / `Date.now()`.
    setupFiles: ['tests/setup.ts'],
  },
});
