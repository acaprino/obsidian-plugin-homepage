import { describe, it, expect, beforeEach } from 'vitest';
import { createEmojiPicker } from '../../src/utils/emojiPicker';

beforeEach(() => { document.body.empty(); });

function picker(label?: string) {
  const container = document.body.createDiv();
  createEmojiPicker({ container, label, value: '', placeholder: '+', onSelect: () => {}, onClear: () => {} });
  return {
    trigger: container.querySelector('.emoji-picker-trigger') as HTMLButtonElement,
    panel: container.querySelector('.emoji-picker-panel') as HTMLElement,
  };
}

describe('createEmojiPicker accessible name (M112)', () => {
  it('names the trigger after its label, or generically', () => {
    expect(picker('Morning emoji').trigger.getAttribute('aria-label')).toBe('Morning emoji');
    expect(picker().trigger.getAttribute('aria-label')).toBe('Choose emoji');
  });
});

describe('createEmojiPicker Escape (M116)', () => {
  it('closes only the panel, returning the focus, and keeps the key from the settings dialog', () => {
    const p = picker('Title emoji');
    let reachedDialog = false;
    document.body.addEventListener('keydown', (e) => { if (e.key === 'Escape') reachedDialog = true; });
    p.trigger.click();
    const search = p.panel.querySelector('input') as HTMLInputElement;

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(p.panel.classList.contains('hp-hidden')).toBe(true);
    expect(reachedDialog).toBe(false);
    expect(document.activeElement).toBe(p.trigger);
  });
});
