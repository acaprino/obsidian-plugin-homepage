/**
 * Minimal 'obsidian' mock covering the API surface our tests touch.
 * The real Obsidian runtime is externalized by esbuild — this file stands in so
 * pure-logic modules that import from 'obsidian' can run under vitest.
 *
 * Add exports as test coverage grows; keep stubs intentionally narrow so a test
 * that accidentally relies on a real Obsidian behavior fails loudly.
 */

/** Subset of `moment` that our codebase actually uses. Wraps native Date. */
export function moment(): MomentLike {
  return new MomentLike(new Date());
}

class MomentLike {
  constructor(private d: Date) {}
  startOf(unit: 'day'): MomentLike {
    const copy = new Date(this.d);
    if (unit === 'day') {
      copy.setHours(0, 0, 0, 0);
    }
    return new MomentLike(copy);
  }
  valueOf(): number { return this.d.getTime(); }
  dayOfYear(): number {
    const start = new Date(this.d.getFullYear(), 0, 0);
    const diff = this.d.getTime() - start.getTime();
    return Math.floor(diff / 86_400_000);
  }
  format(fmt: string): string {
    // Minimal formatter — only supports 'YYYY-MM-DD HH-mm-ss'.
    const pad = (n: number) => String(n).padStart(2, '0');
    return fmt
      .replace('YYYY', String(this.d.getFullYear()))
      .replace('MM', pad(this.d.getMonth() + 1))
      .replace('DD', pad(this.d.getDate()))
      .replace('HH', pad(this.d.getHours()))
      .replace('mm', pad(this.d.getMinutes()))
      .replace('ss', pad(this.d.getSeconds()));
  }
}

export const Platform = {
  isMobile: false,
  isDesktop: true,
  isPhone: false,
};

export function normalizePath(path: string): string {
  // Simple approximation: collapse multiple slashes, strip leading/trailing
  // slashes. The real Obsidian function does more.
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
}

export function sanitizeHTMLToDom(html: string): DocumentFragment {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return tpl.content;
}

// ── Stub classes that satisfy `instanceof` / inheritance checks ────────────

/**
 * Mirrors Obsidian's Component (1.13.7): load() runs onload() once; unload()
 * does nothing unless loaded, then unloads the children, runs the registered
 * cleanups in reverse order, and calls onunload() last.
 */
export class Component {
  private _loaded = false;
  private _children: Component[] = [];
  private _cleanups: (() => void)[] = [];
  load(): void {
    if (this._loaded) return;
    this._loaded = true;
    this.onload();
    for (const c of this._children.slice()) c.load();
  }
  onload(): void {}
  unload(): void {
    if (!this._loaded) return;
    this._loaded = false;
    while (this._children.length > 0) this._children.pop()?.unload();
    while (this._cleanups.length > 0) this._cleanups.pop()?.();
    this.onunload();
  }
  onunload(): void {}
  register(cb: () => void): void { this._cleanups.push(cb); }
  registerEvent(_ref: unknown): void {}
  registerInterval(id: number): number { return id; }
  addChild<T extends Component>(child: T): T {
    this._children.push(child);
    if (this._loaded) child.load();
    return child;
  }
}

export class Modal extends Component {
  app: unknown;
  contentEl = document.createElement('div');
  containerEl = document.createElement('div');
  modalEl = document.createElement('div');
  constructor(app?: unknown) { super(); this.app = app; }
  open(): void {}
  /**
   * Mirrors Obsidian's Modal.close() (1.13.7): onClose runs synchronously,
   * except on phones, where it waits for the close animation.
   */
  close(): void {
    if (Platform.isPhone) void Promise.resolve().then(() => this.onClose());
    else this.onClose();
  }
  onOpen(): void {}
  onClose(): void {}
}

export class Plugin extends Component {
  app: unknown = {};
  manifest: unknown = {};
}

export class PluginSettingTab extends Component {
  app: unknown;
  containerEl = document.createElement('div');
  constructor(app?: unknown, _plugin?: unknown) { super(); this.app = app; }
  display(): void {}
  hide(): void {}
}

export class ItemView extends Component {
  contentEl = document.createElement('div');
  containerEl = document.createElement('div');
}

/** Mirrors Obsidian's TextComponent: an input whose `input` events feed onChange. */
export class TextComponent {
  inputEl: HTMLInputElement;
  constructor(containerEl: HTMLElement) {
    this.inputEl = containerEl.createEl('input', { type: 'text' });
  }
  setPlaceholder(p: string): this { this.inputEl.placeholder = p; return this; }
  setValue(v: string): this { this.inputEl.value = v; return this; }
  getValue(): string { return this.inputEl.value; }
  onChange(cb: (v: string) => unknown): this {
    this.inputEl.addEventListener('input', () => { cb(this.getValue()); });
    return this;
  }
}

/**
 * Mirrors Obsidian's ToggleComponent (1.13.7): a click flips the value, and
 * setValue fires the change callback whenever the value actually changes.
 */
export class ToggleComponent {
  toggleEl: HTMLElement;
  private on = false;
  private changeCallback: ((v: boolean) => unknown) | null = null;
  constructor(containerEl: HTMLElement) {
    this.toggleEl = containerEl.createEl('label', { cls: 'checkbox-container' });
    this.toggleEl.addEventListener('click', () => { this.setValue(!this.on); });
  }
  getValue(): boolean { return this.on; }
  setValue(v: boolean): this {
    if (this.on !== v) {
      this.on = v;
      this.toggleEl.toggleClass('is-enabled', v);
      this.changeCallback?.(v);
    }
    return this;
  }
  onChange(cb: (v: boolean) => unknown): this { this.changeCallback = cb; return this; }
}

/** Mirrors Obsidian's DropdownComponent: a select whose `change` events feed onChange. */
export class DropdownComponent {
  selectEl: HTMLSelectElement;
  constructor(containerEl: HTMLElement) {
    this.selectEl = containerEl.createEl('select', { cls: 'dropdown' });
  }
  addOption(value: string, display: string): this { this.selectEl.createEl('option', { value, text: display }); return this; }
  setValue(v: string): this { this.selectEl.value = v; return this; }
  getValue(): string { return this.selectEl.value; }
  onChange(cb: (v: string) => unknown): this {
    this.selectEl.addEventListener('change', () => { cb(this.getValue()); });
    return this;
  }
}

export class Setting {
  settingEl: HTMLElement;
  nameEl: HTMLElement;
  controlEl: HTMLElement;
  constructor(containerEl: HTMLElement) {
    this.settingEl = containerEl.createDiv({ cls: 'setting-item' });
    this.nameEl = this.settingEl.createDiv({ cls: 'setting-item-name' });
    this.controlEl = this.settingEl.createDiv({ cls: 'setting-item-control' });
  }
  setName(n: string): this { this.nameEl.setText(n); return this; }
  setDesc(_d: string): this { return this; }
  setHeading(): this { return this; }
  addText(cb: (t: TextComponent) => unknown): this { cb(new TextComponent(this.controlEl)); return this; }
  addTextArea(_cb: unknown): this { return this; }
  addToggle(cb: (t: ToggleComponent) => unknown): this { cb(new ToggleComponent(this.controlEl)); return this; }
  addDropdown(cb: (d: DropdownComponent) => unknown): this { cb(new DropdownComponent(this.controlEl)); return this; }
  addSlider(_cb: unknown): this { return this; }
  addButton(_cb: unknown): this { return this; }
  addExtraButton(_cb: unknown): this { return this; }
  addColorPicker(_cb: unknown): this { return this; }
}

export class SuggestModal<T> extends Modal {
  constructor(app: unknown) { super(app); }
  setPlaceholder(_placeholder: string): void {}
  getSuggestions(_query: string): T[] { return []; }
  renderSuggestion(_item: T, _el: HTMLElement): void {}
  onChooseSuggestion(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
  /** Mirrors Obsidian's SuggestModal.selectSuggestion (1.13.7): close first, then report the pick. */
  selectSuggestion(value: T, evt: MouseEvent | KeyboardEvent): void {
    this.close();
    this.onChooseSuggestion(value, evt);
  }
}

export class AbstractInputSuggest<T> {
  constructor(_app: unknown, _el: HTMLInputElement) {}
  getSuggestions(_query: string): T[] { return []; }
  renderSuggestion(_item: T, _el: HTMLElement): void {}
  selectSuggestion(_item: T): void {}
  setValue(_v: string): void {}
  close(): void {}
}

export class TAbstractFile { path = ''; }
export class TFile extends TAbstractFile { stat = { mtime: 0, ctime: 0, size: 0 }; basename = ''; extension = ''; }
export class TFolder extends TAbstractFile { children: TAbstractFile[] = []; }

export class Notice {
  constructor(_msg: string, _timeout?: number) {}
}

export const MarkdownRenderer = {
  /**
   * Renders the source as plain text, except `[[target]]` / `[[target|alias]]`,
   * which become the anchor the real renderer emits: `a.internal-link` with
   * `data-href` and `href`, plus the `target="_blank"` its sanitizer adds to
   * every anchor. Like the real static render, it attaches no click handling.
   */
  render: async (_app: unknown, md: string, el: HTMLElement, _path: string, _component: Component): Promise<void> => {
    const p = el.createEl('p');
    let last = 0;
    for (const m of md.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
      p.append(md.slice(last, m.index));
      p.createEl('a', {
        cls: 'internal-link',
        text: m[2] ?? m[1],
        attr: { 'data-href': m[1], href: m[1], target: '_blank', rel: 'noopener nofollow' },
      });
      last = (m.index ?? 0) + m[0].length;
    }
    p.append(md.slice(last));
  },
};

export const Keymap = {
  /** As documented in obsidian.d.ts: Ctrl/Cmd or a middle click -> 'tab', +Alt -> 'split', +Alt+Shift -> 'window'. */
  isModEvent(evt?: MouseEvent | KeyboardEvent | null): 'tab' | 'split' | 'window' | boolean {
    if (!evt) return false;
    const mod = evt.ctrlKey || evt.metaKey;
    if (mod && evt.altKey && evt.shiftKey) return 'window';
    if (mod && evt.altKey) return 'split';
    if (mod || (evt instanceof MouseEvent && evt.button === 1)) return 'tab';
    return false;
  },
};

export function setIcon(_el: HTMLElement, _name: string): void {}

export async function requestUrl(_opts: unknown): Promise<{ status: number; text: string; json: unknown }> {
  return { status: 200, text: '', json: {} };
}

export class ColorComponent {
  setValue(_v: string): this { return this; }
  onChange(_cb: (v: string) => void): this { return this; }
}

export class WorkspaceLeaf {}
