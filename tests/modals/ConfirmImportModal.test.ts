import { describe, it, expect, beforeEach } from 'vitest';
import type { App } from 'obsidian';
import { ConfirmImportModal } from '../../src/modals/ConfirmImportModal';

function open(active: ConstructorParameters<typeof ConfirmImportModal>[2]) {
  const choices: string[] = [];
  const modal = new ConfirmImportModal({} as App, '2 block(s): static-text', active, (c) => { choices.push(c); });
  modal.onOpen();
  const buttons = () => [...modal.contentEl.querySelectorAll('button')].map(b => b.textContent);
  const click = (label: string) => ([...modal.contentEl.querySelectorAll('button')].find(b => b.textContent === label) as HTMLButtonElement).click();
  return { modal, choices, buttons, click };
}

beforeEach(() => { document.body.empty(); });

describe('ConfirmImportModal', () => {
  it('offers a plain import when nothing active is imported', () => {
    const { buttons } = open([]);
    expect(buttons()).toEqual(['Import', 'Cancel']);
  });

  it('lists the active content and lets the user import without it (M11, M12)', () => {
    const { modal, buttons, click, choices } = open([{ blockType: 'static-text', title: 'Text', key: 'content', excerpt: '<iframe>' }]);

    expect(modal.contentEl.textContent).toContain('<iframe>');
    expect(buttons()).toEqual(['Import all', 'Import without content', 'Cancel']);
    click('Import without content');
    expect(choices).toEqual(['without-content']);
  });
});
