import { describe, it, expect } from 'vitest';
import { isDangerousUrl } from '../../src/utils/urls';

describe('isDangerousUrl', () => {
  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)', // scheme is case-insensitive
    'data:text/html,<script>1</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://example.com/uuid',
  ])('flags %s as dangerous', (url) => {
    expect(isDangerousUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com',
    'http://example.com/path?q=1',
    'mailto:hi@example.com',
    'obsidian://open?vault=x',
  ])('allows the safe/benign absolute URL %s', (url) => {
    expect(isDangerousUrl(url)).toBe(false);
  });

  it.each([
    'folder/note',
    'note.md',
    '#heading',
    '',
    '   ',
  ])('treats the vault path / relative link %j as not dangerous', (path) => {
    expect(isDangerousUrl(path)).toBe(false);
  });

  it('does not throw on non-string input', () => {
    expect(isDangerousUrl(undefined as unknown as string)).toBe(false);
  });
});
