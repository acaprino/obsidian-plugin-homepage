import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { App, WorkspaceLeaf } from 'obsidian';
import { HomepageSettingTab } from '../../src/settings/HomepageSettingTab';
import { HomepageView } from '../../src/HomepageView';
import { getDefaultLayout } from '../../src/validation';
import type { IHomepagePlugin, LayoutConfig } from '../../src/types';

/** An open homepage view as HomepageView.onOpen leaves it: its content element carries .homepage-view. */
function openHomepage(plugin: IHomepagePlugin): HomepageView {
  const view = new HomepageView({} as WorkspaceLeaf, plugin);
  view.contentEl.addClass('homepage-view');
  return view;
}

function renderTab(): { tab: HomepageSettingTab; view: HomepageView; plugin: IHomepagePlugin } {
  const plugin = {
    layout: getDefaultLayout(),
    saveLayout: async (l: LayoutConfig) => { plugin.layout = l; },
    register: () => {},
  } as unknown as IHomepagePlugin;
  const view = openHomepage(plugin);
  const app = { workspace: { getLeavesOfType: () => [{ view }] } } as unknown as App;
  const tab = new HomepageSettingTab(app, plugin as never);
  tab.display();
  return { tab, view, plugin };
}

function toggleNamed(root: HTMLElement, name: string): HTMLElement {
  const item = [...root.querySelectorAll('.setting-item')]
    .find(el => el.querySelector('.setting-item-name')?.textContent === name);
  if (!item) throw new Error(`no setting named "${name}"`);
  return item.querySelector('.checkbox-container') as HTMLElement;
}

beforeEach(() => { document.body.empty(); });

describe('HomepageSettingTab display toggles', () => {
  it('hides the scrollbar of an open homepage as soon as the setting is turned off (RF-R20)', () => {
    const { tab, view } = renderTab();

    toggleNamed(tab.containerEl, 'Show scrollbar').click();

    expect(view.contentEl.hasClass('homepage-no-scrollbar')).toBe(true);
  });

  it('applies hover highlight to an open homepage as soon as the setting is turned off', () => {
    const { tab, view } = renderTab();
    view.contentEl.addClass('homepage-hover-highlight'); // on by default

    toggleNamed(tab.containerEl, 'Hover highlight').click();

    expect(view.contentEl.hasClass('homepage-hover-highlight')).toBe(false);
  });
});

function selectNamed(root: HTMLElement, name: string, value: string): void {
  const item = [...root.querySelectorAll('.setting-item')]
    .find(el => el.querySelector('.setting-item-name')?.textContent === name);
  if (!item) throw new Error(`no setting named "${name}"`);
  const select = item.querySelector('select') as HTMLSelectElement;
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

describe('HomepageSettingTab layout settings', () => {
  it('redraws an open homepage when the column count changes (N8)', async () => {
    const { tab, view, plugin } = renderTab();
    const reload = vi.spyOn(view, 'reload').mockResolvedValue();

    selectNamed(tab.containerEl, 'Default columns', '4');

    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    expect(plugin.layout.columns).toBe(4);
  });

  it('ends an edit session before the responsive mode changes, so it is saved where it was made (M6)', async () => {
    const { tab, view, plugin } = renderTab();
    const order: string[] = [];
    vi.spyOn(view, 'finishEditing').mockImplementation(() => { order.push(`finish:${plugin.layout.responsiveMode}`); });
    vi.spyOn(view, 'reload').mockImplementation(async () => { order.push(`reload:${plugin.layout.responsiveMode}`); });

    selectNamed(tab.containerEl, 'Responsive mode', 'separate');

    await vi.waitFor(() => expect(order).toContain('reload:separate'));
    expect(order[0]).toBe('finish:unified');
  });
});

describe('HomepageSettingTab import errors (R6)', () => {
  function importButton(root: HTMLElement): HTMLButtonElement {
    return [...root.querySelectorAll('button')].find(b => b.textContent === 'Import from clipboard') as HTMLButtonElement;
  }
  function useClipboard(readText: () => Promise<string>): void {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText, writeText: async () => {} } });
  }

  it.each([
    ['text that is not JSON', () => Promise.resolve('not json'), 'Invalid JSON'],
    ['JSON that is not a layout', () => Promise.resolve('[1, 2]'), 'Not a layout'],
    ['a clipboard that cannot be read', () => Promise.reject(new Error('denied')), 'Clipboard unavailable'],
  ])('names the problem for %s', async (_what, readText, label) => {
    useClipboard(readText);
    const { tab } = renderTab();
    const btn = importButton(tab.containerEl);

    btn.click();

    await vi.waitFor(() => expect(btn.textContent).toBe(label));
  });
});
