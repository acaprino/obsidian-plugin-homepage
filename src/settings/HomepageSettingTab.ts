import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { VIEW_TYPE, HomepageView } from '../HomepageView';
import { IHomepagePlugin, LayoutConfig } from '../types';
import { getDefaultLayout, isOpenMode, isResponsiveMode, validateLayout } from '../validation';
import { buildResetLayout, fitBlocksToColumns } from '../utils/layoutReset';
import { ConfirmImportModal } from '../modals/ConfirmImportModal';
import { ConfirmActionModal } from '../modals/ConfirmActionModal';
import { findActiveContent, sanitizeImportedLayout, withoutActiveContent } from '../utils/importSanitizer';
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

  /**
   * End every open edit session as Done does. A setting that moves where a
   * session writes (responsive mode, column count) or replaces the layout must
   * not run under one: Done or Discard would then write the session's blocks
   * into the other platform's array (M6).
   */
  private finishEditSessions(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof HomepageView) leaf.view.finishEditing();
    }
  }

  /** Save a setting that shapes the grid and redraw every open homepage with it (N8). */
  private async applyLayoutChange(patch: Partial<LayoutConfig>): Promise<void> {
    this.finishEditSessions();
    await this.plugin.saveLayout({ ...this.plugin.layout, ...patch });
    await this.reloadOpenHomepages();
  }

  /** Briefly change a button's label, then restore it. Timeout is auto-cleaned on plugin unload. */
  private flashButton(btn: { setButtonText(text: string): unknown }, label: string, original: string, ms = 2000): void {
    btn.setButtonText(label);
    const t = window.setTimeout(() => { btn.setButtonText(original); }, ms);
    this.plugin.register(() => window.clearTimeout(t));
  }

  // ── Section renderers ──────────────────────────────────────────────────────

  private renderStartupSection(root: HTMLElement): void {
    const separate = this.plugin.layout.separateStartup;

    new Setting(root)
      .setName('Separate startup for mobile')
      .setDesc('Use different startup settings on mobile devices — for example, open the homepage on startup only on desktop. Independent of the layout responsive mode below.')
      .addToggle(toggle =>
        toggle
          .setValue(separate)
          .onChange((value) => {
            const base = this.plugin.layout;
            // Enabling: if the stored mobile overrides still mirror the desktop
            // settings (never diverged), snapshot desktop -> mobile so mobile
            // starts from an identical baseline. If the user already diverged
            // them (configured them, then disabled the toggle), keep their
            // values — re-enabling must not clobber a config they built.
            // Disabling leaves the stored mobile values untouched (ignored).
            const mobileMirrorsDesktop =
              base.mobileOpenOnStartup === base.openOnStartup &&
              base.mobileOpenMode === base.openMode &&
              base.mobileManualOpenMode === base.manualOpenMode &&
              base.mobileOpenWhenEmpty === base.openWhenEmpty &&
              base.mobilePin === base.pin;
            let next: LayoutConfig;
            if (!value) {
              next = { ...base, separateStartup: false };
            } else if (mobileMirrorsDesktop) {
              next = {
                ...base,
                separateStartup: true,
                mobileOpenOnStartup: base.openOnStartup,
                mobileOpenMode: base.openMode,
                mobileManualOpenMode: base.manualOpenMode,
                mobileOpenWhenEmpty: base.openWhenEmpty,
                mobilePin: base.pin,
              };
            } else {
              next = { ...base, separateStartup: true };
            }
            void this.plugin.saveLayout(next).then(() => this.display());
          }),
      );

    if (separate) new Setting(root).setName('Desktop startup').setHeading();
    this.renderStartupControls(root, false);

    if (separate) {
      new Setting(root).setName('Mobile startup').setHeading();
      this.renderStartupControls(root, true);
    }
  }

  /**
   * Render the five startup controls bound to either the desktop fields or the
   * `mobile*` overrides. `mobile=false` reads/writes `openOnStartup`, `openMode`,
   * …; `mobile=true` reads/writes `mobileOpenOnStartup`, `mobileOpenMode`, … so
   * the same UI serves both the unified case and each half of the split.
   */
  private renderStartupControls(root: HTMLElement, mobile: boolean): void {
    const L = this.plugin.layout;
    const openOnStartup = mobile ? L.mobileOpenOnStartup : L.openOnStartup;
    const openMode = mobile ? L.mobileOpenMode : L.openMode;
    const openWhenEmpty = mobile ? L.mobileOpenWhenEmpty : L.openWhenEmpty;
    const manualOpenMode = mobile ? L.mobileManualOpenMode : L.manualOpenMode;
    const pin = mobile ? L.mobilePin : L.pin;

    new Setting(root)
      .setName('Open on startup')
      .setDesc('Open the homepage when Obsidian starts.')
      .addToggle(toggle =>
        toggle
          .setValue(openOnStartup)
          .onChange((value) => {
            const patch = mobile ? { mobileOpenOnStartup: value } : { openOnStartup: value };
            void this.plugin.saveLayout({ ...this.plugin.layout, ...patch }).then(() => this.display());
          }),
      );

    if (openOnStartup) {
      new Setting(root)
        .setName('Startup open mode')
        .setDesc('What to do with existing tabs on startup.')
        .addDropdown(drop => {
          for (const [value, label] of Object.entries(OPEN_MODE_LABELS)) {
            drop.addOption(value, label);
          }
          drop
            .setValue(openMode)
            .onChange((value) => {
              if (!isOpenMode(value)) return;
              const patch = mobile ? { mobileOpenMode: value } : { openMode: value };
              void this.plugin.saveLayout({ ...this.plugin.layout, ...patch });
            });
        });
    }

    new Setting(root)
      .setName('Open when empty')
      .setDesc('Open the homepage when all tabs are closed.')
      .addToggle(toggle =>
        toggle
          .setValue(openWhenEmpty)
          .onChange((value) => {
            const patch = mobile ? { mobileOpenWhenEmpty: value } : { openWhenEmpty: value };
            void this.plugin.saveLayout({ ...this.plugin.layout, ...patch });
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
          .setValue(manualOpenMode)
          .onChange((value) => {
            if (!isOpenMode(value)) return;
            const patch = mobile ? { mobileManualOpenMode: value } : { manualOpenMode: value };
            void this.plugin.saveLayout({ ...this.plugin.layout, ...patch });
          });
      });

    new Setting(root)
      .setName('Pin homepage tab')
      .setDesc('Prevent the homepage tab from being closed.')
      .addToggle(toggle =>
        toggle
          .setValue(pin)
          .onChange((value) => {
            const patch = mobile ? { mobilePin: value } : { pin: value };
            void this.plugin.saveLayout({ ...this.plugin.layout, ...patch });
            // Apply the resolved pin state for THIS platform to open homepage
            // leaves immediately. saveLayout updates plugin.layout synchronously,
            // so activePin() already reflects the change. Editing the inactive
            // platform's control is a harmless re-apply of the unchanged value.
            for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
              leaf.setPinned(this.plugin.activePin());
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
            void this.applyLayoutChange({ responsiveMode: value }).then(() => this.display());
          }),
      );

    if (this.plugin.layout.responsiveMode === 'separate') {
      new Setting(root).setName('Desktop layout').setHeading();
    }

    new Setting(root)
      .setName('Default columns')
      .setDesc('Number of grid columns.')
      .addDropdown(drop => {
        for (const n of [2, 3, 4, 5]) drop.addOption(String(n), `${n} columns`);
        drop
          .setValue(String(this.plugin.layout.columns))
          .onChange((value) => {
            void this.applyLayoutChange({ columns: Number(value) });
          });
      });

    if (this.plugin.layout.responsiveMode === 'separate') {
      this.renderMobileLayoutControls(root);
    }
  }

  private renderMobileLayoutControls(root: HTMLElement): void {
    new Setting(root).setName('Mobile layout').setHeading();

    new Setting(root)
      .setName('Mobile columns')
      .setDesc('Number of grid columns on mobile.')
      .addDropdown(drop => {
        for (const n of [1, 2, 3]) drop.addOption(String(n), `${n} ${n === 1 ? 'column' : 'columns'}`);
        drop
          .setValue(String(this.plugin.layout.mobileColumns))
          .onChange((value) => {
            void this.applyLayoutChange({ mobileColumns: Number(value) });
          });
      });

    new Setting(root)
      .setName('Copy desktop layout to mobile')
      .setDesc('Overwrite the mobile layout with a copy of the desktop layout, fitted to mobile columns.')
      .addButton(btn =>
        btn.setButtonText('Copy to mobile').onClick(() => new ConfirmActionModal(this.app, {
          title: 'Replace the mobile layout?',
          message: 'This replaces the mobile layout, with all its blocks and their content, with a copy of the desktop layout. This can’t be undone.',
          confirm: 'Copy',
        }, async () => {
          this.finishEditSessions();
          // Drop any apiKey: the desktop device-key ciphertext can't be
          // decrypted on another device anyway, and carrying the in-memory
          // plaintext here would leak it into the synced mobile layout (and,
          // under a transient WebCrypto failure, persist it as plaintext at
          // rest). The user re-enters the key on mobile.
          const copied = fitBlocksToColumns(this.plugin.layout.blocks, this.plugin.layout.mobileColumns, newId)
            .map(b => ('apiKey' in b.config ? { ...b, config: { ...b.config, apiKey: '' } } : b));
          await this.plugin.saveLayout({ ...this.plugin.layout, mobileBlocks: copied });
          await this.reloadOpenHomepages();
          this.flashButton(btn, 'Copied!', 'Copy to mobile');
        }).open()),
      );

    const mobileBlockCount = this.plugin.layout.mobileBlocks.length;
    new Setting(root)
      .setName('Mobile blocks')
      .setDesc(mobileBlockCount + ' block(s) configured for mobile. Edit them on a mobile device, or copy from desktop above.');
  }

  private renderDisplaySection(root: HTMLElement): void {
    // Its own heading: in Separate mode these rows used to sit under 'Mobile layout' (M7).
    new Setting(root).setName('Display').setHeading();

    new Setting(root)
      .setName('Show scrollbar')
      .setDesc('Show the scrollbar on the homepage. You can still scroll when hidden.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.layout.showScrollbar !== false)
          .onChange((value) => {
            void this.plugin.saveLayout({ ...this.plugin.layout, showScrollbar: value });
            // The rule matches .homepage-view.homepage-no-scrollbar, so the class
            // goes on the view's content element, as HomepageView.onOpen puts it.
            for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
              if (leaf.view instanceof HomepageView) {
                leaf.view.contentEl.toggleClass('homepage-no-scrollbar', !value);
              }
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
            await this.applyLayoutChange({ compactLayout: value });
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
        btn.setButtonText('Reset layout').setWarning().onClick(() => new ConfirmActionModal(this.app, {
          title: 'Reset the layout?',
          message: `This replaces the ${this.plugin.isMobileActive() ? 'mobile' : 'desktop'} layout, with all its blocks and their content, with the default one. Other settings stay. This can’t be undone.`,
          confirm: 'Reset',
        }, async () => {
          this.finishEditSessions();
          // Reset ONLY the active platform's layout half (utils/layoutReset.ts):
          // a phone in Separate mode resets its mobile half, every other device
          // the desktop half; everything else survives.
          const next = buildResetLayout(
            this.plugin.layout,
            getDefaultLayout(),
            this.plugin.isMobileActive(),
          );
          await this.plugin.saveLayout(next);
          await this.reloadOpenHomepages();
        }).open()),
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
            // Without data from a newer version: an import drops it anyway (M58).
            const { preserved: _newer, ...exportLayout } = structuredClone(this.plugin.layout);
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
          // Each step names its own failure: one catch around everything said
          // "Invalid JSON" for a clipboard that could not be read as well (R6).
          let text: string;
          try {
            text = await navigator.clipboard.readText();
          } catch {
            this.flashButton(btn, 'Clipboard unavailable', 'Import from clipboard');
            return;
          }
          let parsed: unknown;
          try {
            parsed = JSON.parse(text) as unknown;
          } catch {
            this.flashButton(btn, 'Invalid JSON', 'Import from clipboard');
            return;
          }
          // Well-formed JSON that isn't a layout object (a bare string, array
          // or number) would otherwise validate to full defaults and silently
          // overwrite the user's layout on confirm. Abort instead.
          let corrupt = false;
          const validated = validateLayout(parsed, () => { corrupt = true; });
          if (corrupt) {
            this.flashButton(btn, 'Not a layout', 'Import from clipboard');
            return;
          }
          // Scrub apiKey + unknown config fields from the imported layout.
          // Imported layouts must never carry credentials, and a hand-crafted
          // payload with extra keys would be trusted by the block-specific cast.
          const { layout: safe, strippedCount } = sanitizeImportedLayout(validated);
          const blockTypes = safe.blocks.map(b => b.type);
          // Import replaces the whole layout, including any block that holds a
          // saved (encrypted) API key. Warn so the user isn't surprised that
          // importing silently drops a stored credential.
          const hadKey = [...this.plugin.layout.blocks, ...this.plugin.layout.mobileBlocks]
            .some(b => typeof b.config.apiKey === 'string' && b.config.apiKey.length > 0);
          const summary = `${safe.blocks.length} block(s): ${[...new Set(blockTypes)].join(', ')}`
            + (strippedCount > 0 ? ` · stripped ${strippedCount} unsafe / unknown field(s)` : '')
            + (hadKey ? ' · your saved API key will be removed' : '');
          // Content that is rendered or written into notes is listed, and can be
          // left out of the import (M11, M12).
          new ConfirmImportModal(this.app, summary, findActiveContent(safe), async (choice) => {
            this.finishEditSessions();
            await this.plugin.saveLayout(choice === 'all' ? safe : withoutActiveContent(safe));
            await this.reloadOpenHomepages();
            this.flashButton(btn, 'Imported!', 'Import from clipboard');
          }).open();
        })());
      });
  }
}
