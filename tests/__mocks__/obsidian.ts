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

export class Component {
  private _children: Component[] = [];
  private _cleanups: (() => void)[] = [];
  load(): void {}
  unload(): void {
    for (const c of this._cleanups) c();
    this._cleanups.length = 0;
    for (const c of this._children) c.unload();
    this._children.length = 0;
  }
  register(cb: () => void): void { this._cleanups.push(cb); }
  registerEvent(_ref: unknown): void {}
  registerInterval(id: number): number { return id; }
  addChild<T extends Component>(child: T): T { this._children.push(child); return child; }
}

export class Modal extends Component {
  contentEl = document.createElement('div');
  containerEl = document.createElement('div');
  open(): void {}
  close(): void {}
  onOpen?(): void;
  onClose?(): void;
}

export class Plugin extends Component {
  app: unknown = {};
  manifest: unknown = {};
}

export class PluginSettingTab extends Component {
  containerEl = document.createElement('div');
  display(): void {}
  hide(): void {}
}

export class ItemView extends Component {
  contentEl = document.createElement('div');
  containerEl = document.createElement('div');
}

export class Setting {
  constructor(_containerEl: HTMLElement) {}
  setName(_n: string): this { return this; }
  setDesc(_d: string): this { return this; }
  setHeading(): this { return this; }
  addText(_cb: unknown): this { return this; }
  addTextArea(_cb: unknown): this { return this; }
  addToggle(_cb: unknown): this { return this; }
  addDropdown(_cb: unknown): this { return this; }
  addSlider(_cb: unknown): this { return this; }
  addButton(_cb: unknown): this { return this; }
  addExtraButton(_cb: unknown): this { return this; }
  addColorPicker(_cb: unknown): this { return this; }
}

export class SuggestModal<T> extends Modal {
  constructor(_app: unknown) { super(); }
  getSuggestions(_query: string): T[] { return []; }
  renderSuggestion(_item: T, _el: HTMLElement): void {}
  onChooseSuggestion(_item: T, _evt: Event): void {}
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
  render: async (_app: unknown, _md: string, _el: HTMLElement, _path: string, _component: Component): Promise<void> => {},
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
