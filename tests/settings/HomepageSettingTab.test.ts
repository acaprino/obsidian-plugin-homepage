import { describe, it, expect, beforeEach } from 'vitest';
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

function renderTab(): { tab: HomepageSettingTab; view: HomepageView } {
  const plugin = {
    layout: getDefaultLayout(),
    saveLayout: async (l: LayoutConfig) => { plugin.layout = l; },
    register: () => {},
  } as unknown as IHomepagePlugin;
  const view = openHomepage(plugin);
  const app = { workspace: { getLeavesOfType: () => [{ view }] } } as unknown as App;
  const tab = new HomepageSettingTab(app, plugin as never);
  tab.display();
  return { tab, view };
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
