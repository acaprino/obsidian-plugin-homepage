import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Modal } from 'obsidian';
import type { App, WorkspaceLeaf } from 'obsidian';
import { HomepageSettingTab } from '../../src/settings/HomepageSettingTab';
import { HomepageView } from '../../src/HomepageView';
import { getDefaultLayout } from '../../src/validation';
import type { IHomepagePlugin, LayoutConfig } from '../../src/types';

/** An open homepage view, opened by HomepageView.onOpen as the workspace does (M125). */
function openHomepage(plugin: IHomepagePlugin, app: App): HomepageView {
  const view = new HomepageView({} as WorkspaceLeaf, plugin);
  (view as unknown as { app: App }).app = app;
  document.body.appendChild(view.contentEl);
  void view.onOpen();
  return view;
}

function renderTab(layout: LayoutConfig = getDefaultLayout()): { tab: HomepageSettingTab; view: HomepageView; plugin: IHomepagePlugin } {
  const plugin = {
    layout,
    saveLayout: async (l: LayoutConfig) => { plugin.layout = l; },
    register: () => {},
    isMobileActive: () => false,
    activeBlocks: () => plugin.layout.blocks,
    activeColumns: () => plugin.layout.columns,
    activeLayoutPriority: () => 'row',
  } as unknown as IHomepagePlugin;
  const app = { workspace: { getLeavesOfType: () => [{ view }] } } as unknown as App;
  const view = openHomepage(plugin, app);
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
    expect(view.contentEl.hasClass('homepage-hover-highlight')).toBe(true); // on by default

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

describe('HomepageSettingTab actions that replace a layout (M7)', () => {
  /** Captures the confirmation a click opens, rendered as the host would. */
  function captureModal(): () => Modal | null {
    let opened: Modal | null = null;
    vi.spyOn(Modal.prototype, 'open').mockImplementation(function (this: Modal) { opened = this; this.onOpen(); });
    return () => opened;
  }
  function clickButton(root: HTMLElement, text: string): void {
    ([...root.querySelectorAll('button')].find(b => b.textContent === text) as HTMLButtonElement).click();
  }

  it('asks before Reset replaces the desktop layout, and resets only on confirm', async () => {
    const modal = captureModal();
    const { tab, plugin, view } = renderTab();
    vi.spyOn(view, 'reload').mockResolvedValue();
    plugin.layout = { ...plugin.layout, columns: 5, blocks: [] };

    clickButton(tab.containerEl, 'Reset layout');
    await Promise.resolve();
    expect(plugin.layout.blocks).toEqual([]);
    expect(modal()?.contentEl.textContent).toMatch(/desktop layout/);

    clickButton(modal()!.contentEl, 'Reset');
    await vi.waitFor(() => expect(plugin.layout.blocks.length).toBeGreaterThan(0));
    vi.restoreAllMocks();
  });

  it('asks before Copy to mobile replaces the mobile layout', async () => {
    const modal = captureModal();
    const { tab, plugin, view } = renderTab();
    vi.spyOn(view, 'reload').mockResolvedValue();
    plugin.layout = { ...plugin.layout, responsiveMode: 'separate', mobileBlocks: [] };
    tab.display();

    clickButton(tab.containerEl, 'Copy to mobile');
    await Promise.resolve();
    expect(plugin.layout.mobileBlocks).toEqual([]);
    expect(modal()?.contentEl.textContent).toMatch(/mobile layout/);

    clickButton(modal()!.contentEl, 'Copy');
    await vi.waitFor(() => expect(plugin.layout.mobileBlocks.length).toBeGreaterThan(0));
    vi.restoreAllMocks();
  });

  it('gives the display settings their own heading, so Reset is not listed under Mobile layout', () => {
    const { tab, plugin } = renderTab();
    plugin.layout = { ...plugin.layout, responsiveMode: 'separate' };
    tab.display();
    const names = [...tab.containerEl.querySelectorAll('.setting-item-name')].map(n => n.textContent);

    expect(names.indexOf('Display')).toBeGreaterThan(names.indexOf('Mobile layout'));
    expect(names.indexOf('Display')).toBeLessThan(names.indexOf('Reset to default layout'));
  });
});

describe('HomepageSettingTab export (M123)', () => {
  it('copies a layout with no API key and no custom CSS, on either platform', async () => {
    const layout = {
      ...getDefaultLayout(),
      blocks: [{ id: 'v', type: 'voice-dictation' as const, x: 0, y: 0, w: 2, h: 3, config: { apiKey: 'sk-secret', folder: 'Voice' } }],
      mobileBlocks: [{ id: 'b', type: 'button-grid' as const, x: 0, y: 0, w: 1, h: 3, config: { customCss: '--hp-btn-bg: red', apiKey: 'sk-mobile' } }],
    };
    const { tab } = renderTab(layout);
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { copied = t; } } });

    ([...tab.containerEl.querySelectorAll('button')].find(b => b.textContent === 'Copy to clipboard') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(copied).not.toBe(''));

    expect(copied).not.toContain('sk-secret');
    expect(copied).not.toContain('sk-mobile');
    expect(copied).not.toContain('customCss');
    expect(JSON.parse(copied).blocks[0].config.folder).toBe('Voice');
  });
});

describe('HomepageSettingTab Copy to mobile and a newer version (M58, after review)', () => {
  function captureModal(): () => Modal | null {
    let opened: Modal | null = null;
    vi.spyOn(Modal.prototype, 'open').mockImplementation(function (this: Modal) { opened = this; this.onOpen(); });
    return () => opened;
  }
  function clickButton(root: HTMLElement, text: string): void {
    ([...root.querySelectorAll('button')].find(b => b.textContent === text) as HTMLButtonElement).click();
  }

  it('replaces the mobile blocks a newer version kept, as it says', async () => {
    const modal = captureModal();
    const future = { id: 'f', type: 'weather', x: 0, y: 0, w: 1, h: 1, config: {} };
    const { tab, plugin, view } = renderTab();
    vi.spyOn(view, 'reload').mockResolvedValue();
    plugin.layout = { ...plugin.layout, responsiveMode: 'separate', preserved: { blocks: [future], mobileBlocks: [future], fields: {} } };
    tab.display();

    clickButton(tab.containerEl, 'Copy to mobile');
    await Promise.resolve();
    clickButton(modal()!.contentEl, 'Copy');
    await vi.waitFor(() => expect(plugin.layout.mobileBlocks.length).toBeGreaterThan(0));

    expect(plugin.layout.preserved?.mobileBlocks).toEqual([]);
    expect(plugin.layout.preserved?.blocks).toEqual([future]);
    vi.restoreAllMocks();
  });
});
