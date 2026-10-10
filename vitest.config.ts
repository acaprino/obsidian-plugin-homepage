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
    // No page loads for iframes, scripts or stylesheets: video embeds fetched
    // YouTube and Vimeo during the run.
    environmentOptions: {
      happyDOM: {
        settings: {
          disableIframePageLoading: true,
          disableJavaScriptFileLoading: true,
          disableCSSFileLoading: true,
        },
      },
    },
    include: ['tests/**/*.test.ts'],
    // IndexedDB (fake-indexeddb) and the Obsidian DOM helpers for every test file.
    setupFiles: ['tests/setup.ts'],
  },
});
