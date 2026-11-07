import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('styles.css', () => {
  it('bundles the CSS of the installed gridstack, which main.js is built from', () => {
    // Line 2 is a pasted copy of gridstack/dist/gridstack.min.css (line 1 is its comment).
    // The lockfile moves the JS on its own: after a gridstack upgrade, paste the new file.
    const lines = readFileSync(resolve(__dirname, '../styles.css'), 'utf8').split('\n').map(l => l.replace(/\r$/, ''));
    const installed = readFileSync(resolve(__dirname, '../node_modules/gridstack/dist/gridstack.min.css'), 'utf8').trimEnd();

    expect(lines[0]).toMatch(/GridStack Core CSS/);
    expect(lines[1]).toBe(installed);
  });
});
