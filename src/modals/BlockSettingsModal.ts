import { App, ColorComponent, Modal, Setting } from 'obsidian';
import { BlockInstance } from '../types';
import { BlockRegistry } from '../BlockRegistry';
import { BaseBlock, TITLE_SIZE_RE } from '../blocks/BaseBlock';
import { applyBlockStyling, HEX_COLOR_RE } from '../utils/blockStyling';
import { createEmojiPicker } from '../utils/emojiPicker';
import { BLOCK_META } from '../blockMeta';

/**
 * Tabbed settings modal shared by every block. Holds the generic `_`-prefixed card styling
 * controls (Header · Body · Card) plus a Content tab that delegates to the block's own
 * `openSettings` for type-specific options.
 */

type BlockSettingsTab = 'header' | 'body' | 'card' | 'content';

const BLOCK_SETTINGS_TABS: { id: BlockSettingsTab; label: string }[] = [
  { id: 'header',  label: 'Header' },
  { id: 'body',    label: 'Body' },
  { id: 'card',    label: 'Card' },
  { id: 'content', label: 'Content' },
];

export const ACCENT_PRESETS = [
  '#c0392b', '#e67e22', '#f1c40f', '#ffef3a', '#27ae60', '#16a085',
  '#2980b9', '#8e44ad', '#e84393', '#6c5ce7', '#636e72',
];

export class BlockSettingsModal extends Modal {
  private draft: Record<string, unknown> = {};
  private accentDirty = false;
  private gradDirty = false;
  private activeTab: BlockSettingsTab = 'header';
  private tabBodyEl: HTMLElement | null = null;
  private tabButtons: Map<BlockSettingsTab, HTMLElement> = new Map();
  private defaultTitle = '';
  private refreshPreview: () => void = () => {};

  constructor(
    app: App,
    private instance: BlockInstance,
    private block: BaseBlock,
    private onSave: (config: Record<string, unknown>) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('hp-block-settings-modal');

    this.draft = structuredClone(this.instance.config);
    const factory = BlockRegistry.get(this.instance.type);
    this.defaultTitle = factory?.displayName ?? this.instance.type;

    this.accentDirty = !!(typeof this.draft._accentColor === 'string' && this.draft._accentColor);
    const hasStart = typeof this.draft._gradientStart === 'string' && HEX_COLOR_RE.test(this.draft._gradientStart);
    const hasEnd = typeof this.draft._gradientEnd === 'string' && HEX_COLOR_RE.test(this.draft._gradientEnd);
    this.gradDirty = hasStart && hasEnd;

    new Setting(contentEl).setName(`Block settings — ${this.defaultTitle}`).setHeading();

    // ── Live preview (always on top) ───────────────────────────────────────
    const previewWrap = contentEl.createDiv({ cls: 'hp-settings-preview-wrap' });
    const previewCard = previewWrap.createDiv({ cls: 'settings-preview-card homepage-block-wrapper' });
    const previewHeaderZone = previewCard.createDiv({ cls: 'block-header-zone' });
    const previewHeader = previewHeaderZone.createDiv({ cls: 'block-header' });
    const previewEmoji = previewHeader.createSpan({ cls: 'block-header-emoji' });
    const previewTitle = previewHeader.createSpan();
    const previewDivider = previewCard.createDiv({ cls: 'block-header-divider' });
    const previewBody = previewCard.createDiv({ cls: 'settings-preview-body' });
    previewBody.createSpan({ cls: 'settings-preview-body-text', text: 'Block content area' });

    this.refreshPreview = () => {
      const d = this.draft;
      const label = (typeof d._titleLabel === 'string' && d._titleLabel) || this.defaultTitle;
      const emoji = typeof d._titleEmoji === 'string' ? d._titleEmoji : '';
      previewEmoji.setText(emoji);
      previewEmoji.toggleClass('hp-hidden', !emoji);
      previewTitle.setText(label);
      previewHeader.className = 'block-header';
      const sz = typeof d._titleSize === 'string' && TITLE_SIZE_RE.test(d._titleSize) ? d._titleSize : '';
      if (sz) previewHeader.addClass(`block-header-${sz}`);
      previewHeaderZone.toggleClass('hp-hidden', d._hideTitle === true);
      previewDivider.toggleClass('hp-hidden', d._showDivider !== true);
      applyBlockStyling(previewCard, d);
    };
    this.refreshPreview();

    // ── Tab bar ────────────────────────────────────────────────────────────
    const tabBar = contentEl.createDiv({ cls: 'hp-settings-tabbar' });
    tabBar.setAttribute('role', 'tablist');
    this.tabButtons.clear();
    for (const t of BLOCK_SETTINGS_TABS) {
      const btn = tabBar.createDiv({ cls: 'hp-settings-tab' });
      btn.setAttribute('role', 'tab');
      btn.tabIndex = 0;
      btn.createSpan({ cls: 'hp-settings-tab-label', text: t.label });
      const activate = () => this.switchTab(t.id);
      btn.addEventListener('click', activate);
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
      this.tabButtons.set(t.id, btn);
    }

    // ── Tab body (content swaps on tab change) ─────────────────────────────
    this.tabBodyEl = contentEl.createDiv({ cls: 'hp-settings-tabbody' });

    // ── Save / Cancel ──────────────────────────────────────────────────────
    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Save').setCta().onClick(() => this.commit()),
      )
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => this.close()),
      );

    this.switchTab('header');
  }

  private switchTab(id: BlockSettingsTab): void {
    this.activeTab = id;
    for (const [tabId, btn] of this.tabButtons) {
      btn.toggleClass('is-active', tabId === id);
      btn.setAttribute('aria-selected', String(tabId === id));
    }
    if (!this.tabBodyEl) return;
    this.tabBodyEl.empty();
    switch (id) {
      case 'header':  this.renderHeaderTab(this.tabBodyEl);  break;
      case 'body':    this.renderBodyTab(this.tabBodyEl);    break;
      case 'card':    this.renderCardTab(this.tabBodyEl);    break;
      case 'content': this.renderContentTab(this.tabBodyEl); break;
    }
  }

  private renderHeaderTab(body: HTMLElement): void {
    new Setting(body)
      .setName('Title label')
      .setDesc('Leave blank for the default.')
      .addText(t =>
        t.setValue(typeof this.draft._titleLabel === 'string' ? this.draft._titleLabel : '')
         .setPlaceholder('Default title')
         .onChange(v => { this.draft._titleLabel = v; this.refreshPreview(); }),
      );

    createEmojiPicker({
      container: body,
      label: 'Title emoji',
      value: typeof this.draft._titleEmoji === 'string' ? this.draft._titleEmoji : '',
      placeholder: '＋',
      onSelect: (emoji) => { this.draft._titleEmoji = emoji; this.refreshPreview(); },
      onClear: () => { this.draft._titleEmoji = ''; this.refreshPreview(); },
    });

    new Setting(body)
      .setName('Hide title')
      .addToggle(t =>
        t.setValue(this.draft._hideTitle === true)
         .onChange(v => { this.draft._hideTitle = v; this.refreshPreview(); }),
      );

    new Setting(body)
      .setName('Title size')
      .addDropdown(d =>
        d.addOption('', 'Default')
         .addOption('h1', 'H1').addOption('h2', 'H2').addOption('h3', 'H3')
         .addOption('h4', 'H4').addOption('h5', 'H5').addOption('h6', 'H6')
         .setValue(typeof this.draft._titleSize === 'string' ? this.draft._titleSize : '')
         .onChange(v => { this.draft._titleSize = TITLE_SIZE_RE.test(v) ? v : ''; this.refreshPreview(); }),
      );

    new Setting(body)
      .setName('Show divider after title')
      .setDesc('Show a thin line between the title and content.')
      .addToggle(t =>
        t.setValue(this.draft._showDivider === true)
         .onChange(v => { this.draft._showDivider = v; this.refreshPreview(); }),
      );

    new Setting(body)
      .setName('Title gap')
      .setDesc('Gap between title and content in pixels (0 = default).')
      .addSlider(s =>
        s.setLimits(0, 48, 2)
         .setValue(typeof this.draft._titleGap === 'number' ? this.draft._titleGap : 0)
         .setDynamicTooltip()
         .onChange(v => { this.draft._titleGap = v; this.refreshPreview(); }),
      );

    new Setting(body)
      .setName('Hide header bar')
      .setDesc('Remove the colored header accent while keeping the title text.')
      .addToggle(t =>
        t.setValue(this.draft._hideHeaderAccent === true)
         .onChange(v => { this.draft._hideHeaderAccent = v; this.refreshPreview(); }),
      );
  }

  private renderBodyTab(body: HTMLElement): void {
    new Setting(body)
      .setName('Padding')
      .setDesc('Inner padding in pixels (0 = default). Negative values allowed.')
      .addSlider(s =>
        s.setLimits(-48, 48, 4)
         .setValue(typeof this.draft._cardPadding === 'number' ? this.draft._cardPadding : 0)
         .setDynamicTooltip()
         .onChange(v => { this.draft._cardPadding = v; this.refreshPreview(); }),
      );

    new Setting(body)
      .setName('Hide background')
      .setDesc('Remove the body background so the block blends into the page.')
      .addToggle(t =>
        t.setValue(this.draft._hideBackground === true)
         .onChange(v => { this.draft._hideBackground = v; this.refreshPreview(); }),
      );

    new Setting(body)
      .setName('Background opacity')
      .setDesc('Body background transparency (100 = fully opaque).')
      .addSlider(s =>
        s.setLimits(0, 100, 5)
         .setValue(typeof this.draft._bgOpacity === 'number' ? this.draft._bgOpacity : 100)
         .setDynamicTooltip()
         .onChange(v => { this.draft._bgOpacity = v; this.refreshPreview(); }),
      );

    new Setting(body)
      .setName('Backdrop blur')
      .setDesc('Blur behind the body (only visible when opacity < 100).')
      .addSlider(s =>
        s.setLimits(0, 20, 1)
         .setValue(typeof this.draft._backdropBlur === 'number' ? this.draft._backdropBlur : 0)
         .setDynamicTooltip()
         .onChange(v => { this.draft._backdropBlur = v; this.refreshPreview(); }),
      );

    body.createDiv({ cls: 'hp-settings-subhead', text: 'Background gradient' });
    body.createEl('p', {
      cls: 'hp-settings-subhead-desc',
      text: 'Overrides the solid background when both colors are set.',
    });

    let gradStartRef: ColorComponent | null = null;
    let gradEndRef: ColorComponent | null = null;

    new Setting(body).setName('Start color').addColorPicker(cp => {
      gradStartRef = cp;
      const seed = typeof this.draft._gradientStart === 'string' && this.draft._gradientStart
        ? this.draft._gradientStart : '#667eea';
      cp.setValue(seed).onChange(v => {
        this.draft._gradientStart = v;
        this.gradDirty = true;
        this.refreshPreview();
      });
    });

    new Setting(body).setName('End color').addColorPicker(cp => {
      gradEndRef = cp;
      const seed = typeof this.draft._gradientEnd === 'string' && this.draft._gradientEnd
        ? this.draft._gradientEnd : '#764ba2';
      cp.setValue(seed).onChange(v => {
        this.draft._gradientEnd = v;
        this.gradDirty = true;
        this.refreshPreview();
      });
    });

    new Setting(body)
      .setName('Angle')
      .addSlider(s =>
        s.setLimits(0, 360, 15)
         .setValue(typeof this.draft._gradientAngle === 'number' ? this.draft._gradientAngle : 135)
         .setDynamicTooltip()
         .onChange(v => { this.draft._gradientAngle = v; this.refreshPreview(); }),
      );

    new Setting(body)
      .addButton(btn =>
        btn.setButtonText('Clear gradient').onClick(() => {
          this.draft._gradientStart = '';
          this.draft._gradientEnd = '';
          this.gradDirty = false;
          gradStartRef?.setValue('#667eea');
          gradEndRef?.setValue('#764ba2');
          this.refreshPreview();
        }),
      );
  }

  private renderCardTab(body: HTMLElement): void {
    let cpRef: ColorComponent | null = null;
    const currentColor = typeof this.draft._accentColor === 'string' ? this.draft._accentColor : '';

    const accentRow = new Setting(body)
      .setName('Accent color')
      .setDesc('Tints header, body, and border.');

    accentRow.addColorPicker(cp => {
      cpRef = cp;
      cp.setValue(currentColor || '#888888')
        .onChange(v => { this.draft._accentColor = v; this.accentDirty = true; this.refreshPreview(); });
    });
    accentRow.addExtraButton(btn =>
      btn.setIcon('x').setTooltip('Clear accent color').onClick(() => {
        this.draft._accentColor = '';
        this.accentDirty = false;
        cpRef?.setValue('#888888');
        this.refreshPreview();
      }),
    );

    const swatchRow = body.createDiv({ cls: 'accent-preset-row' });
    for (const hex of ACCENT_PRESETS) {
      const swatch = swatchRow.createDiv({ cls: 'accent-preset-swatch' });
      swatch.style.setProperty('--hp-swatch-bg', hex);
      swatch.setAttribute('aria-label', hex);
      swatch.addEventListener('click', () => {
        this.draft._accentColor = hex;
        this.accentDirty = true;
        cpRef?.setValue(hex);
        this.refreshPreview();
      });
    }

    new Setting(body)
      .setName('Accent intensity')
      .setDesc('Strength of the accent tint (5–100%).')
      .addSlider(s => {
        s.setLimits(5, 100, 5)
         .setValue(typeof this.draft._accentIntensity === 'number' ? this.draft._accentIntensity : 15)
         .setDynamicTooltip()
         .onChange(v => { this.draft._accentIntensity = v; this.refreshPreview(); });
        s.sliderEl.addEventListener('input', () => {
          this.draft._accentIntensity = s.getValue();
          this.refreshPreview();
        });
      });

    body.createDiv({ cls: 'hp-settings-subhead', text: 'Border' });

    new Setting(body)
      .setName('Hide border')
      .setDesc('Remove the border and hover highlight.')
      .addToggle(t =>
        t.setValue(this.draft._hideBorder === true)
         .onChange(v => { this.draft._hideBorder = v; this.refreshPreview(); }),
      );

    new Setting(body)
      .setName('Width')
      .setDesc('Border thickness in pixels (0 = default).')
      .addSlider(s =>
        s.setLimits(0, 4, 1)
         .setValue(typeof this.draft._borderWidth === 'number' ? this.draft._borderWidth : 0)
         .setDynamicTooltip()
         .onChange(v => { this.draft._borderWidth = v; this.refreshPreview(); }),
      );

    new Setting(body)
      .setName('Style')
      .addDropdown(d =>
        d.addOption('', 'Default')
         .addOption('solid', 'Solid')
         .addOption('dashed', 'Dashed')
         .addOption('dotted', 'Dotted')
         .setValue(typeof this.draft._borderStyle === 'string' ? this.draft._borderStyle : '')
         .onChange(v => { this.draft._borderStyle = v; this.refreshPreview(); }),
      );

    new Setting(body)
      .setName('Radius')
      .setDesc('Corner rounding in pixels (0 = theme default).')
      .addSlider(s =>
        s.setLimits(0, 24, 2)
         .setValue(typeof this.draft._borderRadius === 'number' ? this.draft._borderRadius : 0)
         .setDynamicTooltip()
         .onChange(v => { this.draft._borderRadius = v; this.refreshPreview(); }),
      );

    body.createDiv({ cls: 'hp-settings-subhead', text: 'Shadow' });

    new Setting(body)
      .setName('Elevation')
      .setDesc('Card shadow depth.')
      .addDropdown(d =>
        d.addOption('0', 'None')
         .addOption('1', 'Subtle')
         .addOption('2', 'Medium')
         .addOption('3', 'Elevated')
         .setValue(String(typeof this.draft._elevation === 'number' ? this.draft._elevation : 0))
         .onChange(v => { this.draft._elevation = Number(v); this.refreshPreview(); }),
      );
  }

  private renderContentTab(body: HTMLElement): void {
    const meta = BLOCK_META[this.instance.type];
    const card = body.createDiv({ cls: 'hp-settings-content-cta' });
    const iconEl = card.createDiv({ cls: 'hp-settings-content-icon' });
    iconEl.setText(meta?.icon ?? '⚙');
    const textWrap = card.createDiv({ cls: 'hp-settings-content-text' });
    textWrap.createDiv({ cls: 'hp-settings-content-title', text: this.defaultTitle });
    textWrap.createDiv({
      cls: 'hp-settings-content-desc',
      text: meta?.desc ?? 'Configure the content and behavior of this block.',
    });

    new Setting(body)
      .addButton(btn =>
        btn.setButtonText('Edit content settings →').setCta().onClick(() => {
          this.block.openSettings((blockConfig) => {
            // Preserve shared _-prefixed keys from the current draft
            const shared = Object.fromEntries(
              Object.entries(this.draft).filter(([k]) => k.startsWith('_')),
            );
            this.draft = { ...blockConfig, ...shared };
            this.refreshPreview();
          });
        }),
      );
  }

  private commit(): void {
    if (!this.accentDirty) this.draft._accentColor = '';
    if (!this.gradDirty) { this.draft._gradientStart = ''; this.draft._gradientEnd = ''; }
    this.onSave(this.draft);
    this.close();
  }

  onClose(): void { this.contentEl.empty(); }
}
