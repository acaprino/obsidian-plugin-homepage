/**
 * Polyfill for the subset of Obsidian's HTMLElement DOM-extension API that the
 * plugin's render paths rely on (createEl/createDiv/createSpan/empty/setText/
 * addClass/removeClass/toggleClass/hasClass/setAttr/detach). Obsidian augments
 * HTMLElement.prototype at runtime; happy-dom ships only the standard DOM, so
 * render-level tests need this shim. Mirrors Obsidian's documented behaviour.
 *
 * Imported by tests/setup.ts so every test file gets it.
 */

interface DomElInfo {
  cls?: string | string[];
  text?: string;
  attr?: Record<string, string | number | boolean | null>;
  type?: string;
  value?: string;
  placeholder?: string;
  href?: string;
  title?: string;
}

function applyInfo(el: HTMLElement, info?: DomElInfo | string): void {
  if (info == null) return;
  if (typeof info === 'string') { el.className = info; return; }
  if (info.cls != null) el.className = Array.isArray(info.cls) ? info.cls.join(' ') : info.cls;
  if (info.text != null) el.textContent = String(info.text);
  if (info.attr) {
    for (const [k, v] of Object.entries(info.attr)) {
      if (v != null && v !== false) el.setAttribute(k, String(v));
    }
  }
  if (info.type != null) el.setAttribute('type', info.type);
  if (info.value != null) (el as HTMLInputElement).value = info.value;
  if (info.placeholder != null) el.setAttribute('placeholder', info.placeholder);
  if (info.href != null) el.setAttribute('href', info.href);
  if (info.title != null) el.setAttribute('title', info.title);
}

function install(): void {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  if (proto.__obsidianDomInstalled) return;
  proto.__obsidianDomInstalled = true;

  proto.createEl = function (this: HTMLElement, tag: string, info?: DomElInfo | string, cb?: (el: HTMLElement) => void): HTMLElement {
    const el = document.createElement(tag);
    applyInfo(el, info);
    this.appendChild(el);
    cb?.(el);
    return el;
  };
  proto.createDiv = function (this: HTMLElement, info?: DomElInfo | string, cb?: (el: HTMLElement) => void): HTMLElement {
    return (this as unknown as { createEl: (t: string, i?: DomElInfo | string, c?: (e: HTMLElement) => void) => HTMLElement }).createEl('div', info, cb);
  };
  proto.createSpan = function (this: HTMLElement, info?: DomElInfo | string, cb?: (el: HTMLElement) => void): HTMLElement {
    return (this as unknown as { createEl: (t: string, i?: DomElInfo | string, c?: (e: HTMLElement) => void) => HTMLElement }).createEl('span', info, cb);
  };
  proto.empty = function (this: HTMLElement): void {
    while (this.firstChild) this.removeChild(this.firstChild);
  };
  proto.setText = function (this: HTMLElement, text: string | DocumentFragment): void {
    if (typeof text === 'string') { this.textContent = text; }
    else { this.textContent = ''; this.appendChild(text); }
  };
  proto.addClass = function (this: HTMLElement, ...classes: string[]): void {
    this.classList.add(...classes.filter(Boolean));
  };
  proto.removeClass = function (this: HTMLElement, ...classes: string[]): void {
    this.classList.remove(...classes.filter(Boolean));
  };
  proto.toggleClass = function (this: HTMLElement, classes: string | string[], value: boolean): void {
    const list = Array.isArray(classes) ? classes : [classes];
    for (const c of list) this.classList.toggle(c, value);
  };
  proto.hasClass = function (this: HTMLElement, cls: string): boolean {
    return this.classList.contains(cls);
  };
  proto.setAttr = function (this: HTMLElement, name: string, value: string | number | boolean | null): void {
    if (value == null || value === false) this.removeAttribute(name);
    else this.setAttribute(name, String(value));
  };
  proto.detach = function (this: HTMLElement): void {
    this.remove();
  };

  // Obsidian exposes `doc`/`win` on every Node — the node's owner document and
  // window, falling back to the globals. Used for popout-window-safe DOM access.
  Object.defineProperty(Node.prototype, 'doc', {
    configurable: true,
    get(this: Node) { return this.ownerDocument ?? document; },
  });
  Object.defineProperty(Node.prototype, 'win', {
    configurable: true,
    get(this: Node) { return (this.ownerDocument ?? document).defaultView ?? window; },
  });
}

install();

export {};
