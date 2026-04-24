import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { VIEW_TYPE, HomepageView } from '../HomepageView';
import { IHomepagePlugin } from '../types';
import { getDefaultLayout, isOpenMode, isResponsiveMode, validateLayout } from '../validation';
import { ConfirmPresetModal } from '../modals/ConfirmPresetModal';
import { sanitizeImportedLayout } from '../utils/importSanitizer';
import { newId } from '../utils/ids';

/**
 * The plugin surface this tab needs. Declared narrowly (instead of importing the
 * concrete `HomepagePlugin` class) so the settings tab can live outside main.ts
 * without creating a circular import.
 */
type HostPlugin = Plugin & IHomepagePlugin;

/** Open-mode labels — kept as a module constant so every dropdown stays in sync. */
const OPEN_MODE_LABELS: Record<string, string> = {
  'retain': 'Keep existing tabs (new tab)',
  'replace-last': 'Replace active tab',
  'replace-all': 'Close all tabs',
};

export class HomepageSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: HostPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    this.renderStartupSection(containerEl);
    this.renderLayoutSection(containerEl);
    this.renderDisplaySection(containerEl);
    this.renderExportImportSection(containerEl);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Common pattern: after a mutation that changes what's currently rendered on
   * other homepage tabs (column count, compact mode, etc.), reload every open
   * homepage view so they pick up the new settings.
   */
  private async reloadOpenHomepages(): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof HomepageView) {
        await leaf.view.reload();
      }
    }
  }

  /** Briefly change a button's label, then restore it. Timeout is auto-cleaned on plugin unload. */
  private flashButton(btn: { setButtonText(text: string): unknown }, label: string, original: string, ms = 2000): void {
    btn.setButtonText(label);
    const t = window.setTimeout(() => { btn.setButtonText(original); }, ms);
    this.plugin.register(() => window.clearTimeout(t));
  }

  // ── Section renderers ──────────────────────────────────────────────────────

  private renderStartupSection(root: HTMLElement): void {
    new Setting(root)
      .setName('Open on startup')
      .setDesc('Open the homepage when Obsidian starts.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.layout.openOnStartup)
          .onChange((value) => {
            void this.plugin.saveLayout({ ...this.plugin.layout, openOnStartup: value }).then(() => this.display());
          }),
      );

    if (this.plugin.layout.openOnStartup) {
      new Setting(root)
        .setName('Startup open mode')
        .setDesc('What to do with existing tabs on startup.')
        .addDropdown(drop => {
          for (const [value, label] of Object.entries(OPEN_MODE_LABELS)) {
            drop.addOption(value, label);
          }
          drop
            .setValue(this.plugin.layout.openMode)
            .onChange((value) => {
              if (!isOpenMode(value)) return;
              void this.plugin.saveLayout({ ...this.plugin.layout, openMode: value });
            });
        });
    }

    new Setting(root)
      .setName('Open when empty')
      .setDesc('Open the homepage when all tabs are closed.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.layout.openWhenEmpty)
          .onChange((value) => {
            void this.plugin.saveLayout({ ...this.plugin.layout, openWhenEmpty: value });
          }),
      );

    new Setting(root)
      .setName('Manual open mode')
      .setDesc('What to do with existing tabs when you open the homepage manually.')
      .addDropdown(drop => {
        for (const [value, label] of Object.entries(OPEN_MODE_LABELS)) {
          drop.addOption(value, label);
        }
        drop
          .setValue(this.plugin.layout.manualOpenMode)
          .onChange((value) => {
            if (!isOpenMode(value)) return;
            void this.plugin.saveLayout({ ...this.plugin.layout, manualOpenMode: value });
          });
      });

    new Setting(root)
      .setName('Pin homepage tab')
      .setDesc('Prevent the homepage tab from being closed.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.layout.pin)
          .onChange((value) => {
            void this.plugin.saveLayout({ ...this.plugin.layout, pin: value });
            // Apply pin state to any existing homepage leaves immediately
            for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
              leaf.setPinned(value);
            }
          }),
      );
  }

  private renderLayoutSection(root: HTMLElement): void {
    new Setting(root).setName('Layout').setHeading();

    new Setting(root)
      .setName('Responsive mode')
      .setDesc('Unified: one layout for all screen sizes. Separate: different layouts for desktop and mobile.')
      .addDropdown(drop =>
        drop
          .addOption('unified', 'Unified (adaptive)')
          .addOption('separate', 'Separate (desktop + mobile)')
          .setValue(this.plugin.layout.responsiveMode)
          .onChange((value) => {
            if (!isResponsiveMode(value)) return;
            void this.plugin.saveLayout({ ...this.plugin.layout, responsiveMode: value }).then(() => this.display());
          }),
      );

    if (this.plugin.layout.responsiveMode === 'separate') {
      new Setting(root).setName('Desktop layout').setHeading();
    }

    new Setting(root)
      .setName('Default columns')
      .setDesc('Number of grid columns.')
      .addDropdown(drop =>
        drop
          .addOption('2', '2 columns')
          .addOption('3', '3 columns')
          .addOption('4', '4 columns')
          .addOption('5', '5 columns')
          .setValue(String(this.plugin.layout.columns))
          .onChange((value) => {
            void this.plugin.saveLayout({ ...this.plugin.layout, columns: Number(value) });
          }),
      );

    if (this.plugin.layout.responsiveMode === 'separate') {
      this.renderMobileLayoutControls(root);
    }
  }

  private renderMobileLayoutControls(root: HTMLElement): void {
    new Setting(root).setName('Mobile layout').setHeading();

    new Setting(root)
      .setName('Mobile columns')
      .setDesc('Number of grid columns on mobile.')
      .addDropdown(drop =>
        drop
          .addOption('1', '1 column')
          .addOption('2', '2 columns')
          .addOption('3', '3 columns')
          .setValue(String(this.plugin.layout.mobileColumns))
          .onChange((value) => {
            void this.plugin.saveLayout({ ...this.plugin.layout, mobileColumns: Number(value) });
          }),
      );

    new Setting(root)
      .setName('Copy desktop layout to mobile')
      .setDesc('Overwrite the mobile layout with a copy of the desktop layout, fitted to mobile columns.')
      .addButton(btn =>
        btn.setButtonText('Copy to mobile').onClick(() => void (async () => {
          const desktopBlocks = structuredClone(this.plugin.layout.blocks);
          const mobileCols = this.plugin.layout.mobileColumns;
          const clamped = desktopBlocks.map(b => ({
            ...b,
            id: newId(),
            w: Math.min(b.w, mobileCols),
            x: Math.min(b.x, Math.max(0, mobileCols - Math.min(b.w, mobileCols))),
          }));
          await this.plugin.saveLayout({ ...this.plugin.layout, mobileBlocks: clamped });
          await this.reloadOpenHomepages();
          this.flashButton(btn, 'Copied!', 'Copy to mobile');
        })()),
      );

    const mobileBlockCount = this.plugin.layout.mobileBlocks.length;
    new Setting(root)
      .setName('Mobile blocks')
      .setDesc(mobileBlockCount + ' block(s) configured for mobile. Edit them on a mobile device, or copy from desktop above.');
  }

  private renderDisplaySection(root: HTMLElement): void {
    new Setting(root)
      .setName('Show scrollbar')
      .setDesc('Show the scrollbar on the homepage. You can still scroll when hidden.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.layout.showScrollbar !== false)
          .onChange((value) => {
            void this.plugin.saveLayout({ ...this.plugin.layout, showScrollbar: value });
            for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
              leaf.view.containerEl.toggleClass('homepage-no-scrollbar', !value);
            }
          }),
      );

    new Setting(root)
      .setName('Compact layout')
      .setDesc('Remove vertical gaps between blocks. Turn off to allow free placement with gaps.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.layout.compactLayout)
          .onChange(async (value) => {
            await this.plugin.saveLayout({ ...this.plugin.layout, compactLayout: value });
            await this.reloadOpenHomepages();
          }),
      );

    new Setting(root)
      .setName('Hover highlight')
      .setDesc('Subtly lift blocks on mouseover and reveal the collapse toggle.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.layout.hoverHighlight)
          .onChange((value) => {
            void this.plugin.saveLayout({ ...this.plugin.layout, hoverHighlight: value });
            for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
              if (leaf.view instanceof HomepageView) {
                leaf.view.contentEl.toggleClass('homepage-hover-highlight', value);
              }
            }
          }),
      );

    new Setting(root)
      .setName('Reset to default layout')
      .setDesc('Restore all blocks to the default layout. This can’t be undone.')
      .addButton(btn =>
        btn.setButtonText('Reset layout').setWarning().onClick(() => void (async () => {
          await this.plugin.saveLayout(getDefaultLayout());
          await this.reloadOpenHomepages();
        })()),
      );
  }

  private renderExportImportSection(root: HTMLElement): void {
    new Setting(root).setName('Export / import').setHeading();

    new Setting(root)
      .setName('Export layout')
      .setDesc('Copy the layout to your clipboard as JSON.')
      .addButton(btn => {
        btn.setButtonText('Copy to clipboard').onClick(() => void (async () => {
          if (!navigator.clipboard?.writeText) {
            this.flashButton(btn, 'Clipboard unavailable', 'Copy to clipboard');
            return;
          }
          try {
            const exportLayout = structuredClone(this.plugin.layout);
            for (const block of exportLayout.blocks) {
              delete block.config.apiKey;
              delete block.config.customCss;
            }
            for (const block of exportLayout.mobileBlocks) {
              delete block.config.apiKey;
              delete block.config.customCss;
            }
            const json = JSON.stringify(exportLayout, null, 2);
            await navigator.clipboard.writeText(json);
            this.flashButton(btn, 'Copied!', 'Copy to clipboard');
          } catch {
            this.flashButton(btn, 'Copy failed', 'Copy to clipboard');
          }
        })());
      });

    new Setting(root)
      .setName('Import layout')
      .setDesc('Paste an exported layout JSON to restore it.')
      .addButton(btn => {
        btn.setButtonText('Import from clipboard').onClick(() => void (async () => {
          if (!navigator.clipboard?.readText) {
            this.flashButton(btn, 'Clipboard unavailable', 'Import from clipboard');
            return;
          }
          try {
            const text = await navigator.clipboard.readText();
            const parsed = JSON.parse(text) as unknown;
            const validated = validateLayout(parsed);
            // Scrub apiKey + unknown config fields from the imported layout.
            // Imported layouts must never carry credentials, and a hand-crafted
            // payload with extra keys would be trusted by the block-specific cast.
            const { layout: safe, strippedCount } = sanitizeImportedLayout(validated);
            const blockTypes = safe.blocks.map(b => b.type);
            const summary = `${safe.blocks.length} block(s): ${[...new Set(blockTypes)].join(', ')}`
              + (strippedCount > 0 ? ` · stripped ${strippedCount} unsafe / unknown field(s)` : '');
            new ConfirmPresetModal(this.app, `Import (${summary})`, async () => {
              await this.plugin.saveLayout(safe);
              await this.reloadOpenHomepages();
              this.flashButton(btn, 'Imported!', 'Import from clipboard');
            }).open();
          } catch {
            this.flashButton(btn, 'Invalid JSON', 'Import from clipboard');
          }
        })());
      });
  }
}
