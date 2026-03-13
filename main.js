"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => HomepagePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian20 = require("obsidian");

// src/HomepageView.ts
var import_obsidian3 = require("obsidian");

// src/GridLayout.ts
var import_obsidian = require("obsidian");

// node_modules/gridstack/dist/utils.js
var Utils = class _Utils {
  /**
   * Convert a potential selector into an actual list of HTML elements.
   * Supports CSS selectors, element references, and special ID handling.
   *
   * @param els selector string, HTMLElement, or array of elements
   * @param root optional root element to search within (defaults to document, useful for shadow DOM)
   * @returns array of HTML elements matching the selector
   *
   * @example
   * const elements = Utils.getElements('.grid-item');
   * const byId = Utils.getElements('#myWidget');
   * const fromShadow = Utils.getElements('.item', shadowRoot);
   */
  static getElements(els, root = document) {
    if (typeof els === "string") {
      const doc = "getElementById" in root ? root : void 0;
      if (doc && !isNaN(+els[0])) {
        const el = doc.getElementById(els);
        return el ? [el] : [];
      }
      let list = root.querySelectorAll(els);
      if (!list.length && els[0] !== "." && els[0] !== "#") {
        list = root.querySelectorAll("." + els);
        if (!list.length)
          list = root.querySelectorAll("#" + els);
        if (!list.length) {
          const el = root.querySelector(`[gs-id="${els}"]`);
          return el ? [el] : [];
        }
      }
      return Array.from(list);
    }
    return [els];
  }
  /**
   * Convert a potential selector into a single HTML element.
   * Similar to getElements() but returns only the first match.
   *
   * @param els selector string or HTMLElement
   * @param root optional root element to search within (defaults to document)
   * @returns the first HTML element matching the selector, or null if not found
   *
   * @example
   * const element = Utils.getElement('#myWidget');
   * const first = Utils.getElement('.grid-item');
   */
  static getElement(els, root = document) {
    if (typeof els === "string") {
      const doc = "getElementById" in root ? root : void 0;
      if (!els.length)
        return null;
      if (doc && els[0] === "#") {
        return doc.getElementById(els.substring(1));
      }
      if (els[0] === "#" || els[0] === "." || els[0] === "[") {
        return root.querySelector(els);
      }
      if (doc && !isNaN(+els[0])) {
        return doc.getElementById(els);
      }
      let el = root.querySelector(els);
      if (doc && !el) {
        el = doc.getElementById(els);
      }
      if (!el) {
        el = root.querySelector("." + els);
      }
      return el;
    }
    return els;
  }
  /**
   * Check if a widget should be lazy loaded based on node or grid settings.
   *
   * @param n the grid node to check
   * @returns true if the item should be lazy loaded
   *
   * @example
   * if (Utils.lazyLoad(node)) {
   *   // Set up intersection observer for lazy loading
   * }
   */
  static lazyLoad(n) {
    return n.lazyLoad || n.grid?.opts?.lazyLoad && n.lazyLoad !== false;
  }
  /**
   * Create a div element with the specified CSS classes.
   *
   * @param classes array of CSS class names to add
   * @param parent optional parent element to append the div to
   * @returns the created div element
   *
   * @example
   * const div = Utils.createDiv(['grid-item', 'draggable']);
   * const nested = Utils.createDiv(['content'], parentDiv);
   */
  static createDiv(classes, parent) {
    const el = document.createElement("div");
    classes.forEach((c) => {
      if (c)
        el.classList.add(c);
    });
    parent?.appendChild(el);
    return el;
  }
  /**
   * Check if a widget should resize to fit its content.
   *
   * @param n the grid node to check (can be undefined)
   * @param strict if true, only returns true for explicit sizeToContent:true (not numbers)
   * @returns true if the widget should resize to content
   *
   * @example
   * if (Utils.shouldSizeToContent(node)) {
   *   // Trigger content-based resizing
   * }
   */
  static shouldSizeToContent(n, strict = false) {
    return n?.grid && (strict ? n.sizeToContent === true || n.grid.opts.sizeToContent === true && n.sizeToContent === void 0 : !!n.sizeToContent || n.grid.opts.sizeToContent && n.sizeToContent !== false);
  }
  /**
   * Check if two grid positions overlap/intersect.
   *
   * @param a first position with x, y, w, h properties
   * @param b second position with x, y, w, h properties
   * @returns true if the positions overlap
   *
   * @example
   * const overlaps = Utils.isIntercepted(
   *   {x: 0, y: 0, w: 2, h: 1},
   *   {x: 1, y: 0, w: 2, h: 1}
   * ); // true - they overlap
   */
  static isIntercepted(a, b) {
    return !(a.y >= b.y + b.h || a.y + a.h <= b.y || a.x + a.w <= b.x || a.x >= b.x + b.w);
  }
  /**
   * Check if two grid positions are touching (edges or corners).
   *
   * @param a first position
   * @param b second position
   * @returns true if the positions are touching
   *
   * @example
   * const touching = Utils.isTouching(
   *   {x: 0, y: 0, w: 2, h: 1},
   *   {x: 2, y: 0, w: 1, h: 1}
   * ); // true - they share an edge
   */
  static isTouching(a, b) {
    return _Utils.isIntercepted(a, { x: b.x - 0.5, y: b.y - 0.5, w: b.w + 1, h: b.h + 1 });
  }
  /**
   * Calculate the overlapping area between two grid positions.
   *
   * @param a first position
   * @param b second position
   * @returns the area of overlap (0 if no overlap)
   *
   * @example
   * const overlap = Utils.areaIntercept(
   *   {x: 0, y: 0, w: 3, h: 2},
   *   {x: 1, y: 0, w: 3, h: 2}
   * ); // returns 4 (2x2 overlap)
   */
  static areaIntercept(a, b) {
    const x0 = a.x > b.x ? a.x : b.x;
    const x1 = a.x + a.w < b.x + b.w ? a.x + a.w : b.x + b.w;
    if (x1 <= x0)
      return 0;
    const y0 = a.y > b.y ? a.y : b.y;
    const y1 = a.y + a.h < b.y + b.h ? a.y + a.h : b.y + b.h;
    if (y1 <= y0)
      return 0;
    return (x1 - x0) * (y1 - y0);
  }
  /**
   * Calculate the total area of a grid position.
   *
   * @param a position with width and height
   * @returns the total area (width * height)
   *
   * @example
   * const area = Utils.area({x: 0, y: 0, w: 3, h: 2}); // returns 6
   */
  static area(a) {
    return a.w * a.h;
  }
  /**
   * Sort an array of grid nodes by position (y first, then x).
   *
   * @param nodes array of nodes to sort
   * @param dir sort direction: 1 for ascending (top-left first), -1 for descending
   * @returns the sorted array (modifies original)
   *
   * @example
   * const sorted = Utils.sort(nodes); // Sort top-left to bottom-right
   * const reverse = Utils.sort(nodes, -1); // Sort bottom-right to top-left
   */
  static sort(nodes, dir = 1) {
    const und = 1e4;
    return nodes.sort((a, b) => {
      const diffY = dir * ((a.y ?? und) - (b.y ?? und));
      if (diffY === 0)
        return dir * ((a.x ?? und) - (b.x ?? und));
      return diffY;
    });
  }
  /**
   * Find a grid node by its ID.
   *
   * @param nodes array of nodes to search
   * @param id the ID to search for
   * @returns the node with matching ID, or undefined if not found
   *
   * @example
   * const node = Utils.find(nodes, 'widget-1');
   * if (node) console.log('Found node at:', node.x, node.y);
   */
  static find(nodes, id) {
    return id ? nodes.find((n) => n.id === id) : void 0;
  }
  /**
   * Convert various value types to boolean.
   * Handles strings like 'false', 'no', '0' as false.
   *
   * @param v value to convert
   * @returns boolean representation
   *
   * @example
   * Utils.toBool('true');  // true
   * Utils.toBool('false'); // false
   * Utils.toBool('no');    // false
   * Utils.toBool('1');     // true
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static toBool(v) {
    if (typeof v === "boolean") {
      return v;
    }
    if (typeof v === "string") {
      v = v.toLowerCase();
      return !(v === "" || v === "no" || v === "false" || v === "0");
    }
    return Boolean(v);
  }
  /**
   * Convert a string value to a number, handling null and empty strings.
   *
   * @param value string or null value to convert
   * @returns number value, or undefined for null/empty strings
   *
   * @example
   * Utils.toNumber('42');  // 42
   * Utils.toNumber('');    // undefined
   * Utils.toNumber(null);  // undefined
   */
  static toNumber(value) {
    return value === null || value.length === 0 ? void 0 : Number(value);
  }
  /**
   * Parse a height value with units into numeric value and unit string.
   * Supports px, em, rem, vh, vw, %, cm, mm units.
   *
   * @param val height value as number or string with units
   * @returns object with h (height) and unit properties
   *
   * @example
   * Utils.parseHeight('100px');  // {h: 100, unit: 'px'}
   * Utils.parseHeight('2rem');   // {h: 2, unit: 'rem'}
   * Utils.parseHeight(50);       // {h: 50, unit: 'px'}
   */
  static parseHeight(val) {
    let h;
    let unit = "px";
    if (typeof val === "string") {
      if (val === "auto" || val === "")
        h = 0;
      else {
        const match = val.match(/^(-[0-9]+\.[0-9]+|[0-9]*\.[0-9]+|-[0-9]+|[0-9]+)(px|em|rem|vh|vw|%|cm|mm)?$/);
        if (!match) {
          throw new Error(`Invalid height val = ${val}`);
        }
        unit = match[2] || "px";
        h = parseFloat(match[1]);
      }
    } else {
      h = val;
    }
    return { h, unit };
  }
  /**
   * Copy unset fields from source objects to target object (shallow merge with defaults).
   * Similar to Object.assign but only sets undefined/null fields.
   *
   * @param target the object to copy defaults into
   * @param sources one or more source objects to copy defaults from
   * @returns the modified target object
   *
   * @example
   * const config = { width: 100 };
   * Utils.defaults(config, { width: 200, height: 50 });
   * // config is now { width: 100, height: 50 }
   */
  // eslint-disable-next-line
  static defaults(target, ...sources) {
    sources.forEach((source) => {
      for (const key in source) {
        if (!source.hasOwnProperty(key))
          return;
        if (target[key] === null || target[key] === void 0) {
          target[key] = source[key];
        } else if (typeof source[key] === "object" && typeof target[key] === "object") {
          _Utils.defaults(target[key], source[key]);
        }
      }
    });
    return target;
  }
  /**
   * Compare two objects for equality (shallow comparison).
   * Checks if objects have the same fields and values at one level deep.
   *
   * @param a first object to compare
   * @param b second object to compare
   * @returns true if objects have the same values
   *
   * @example
   * Utils.same({x: 1, y: 2}, {x: 1, y: 2}); // true
   * Utils.same({x: 1}, {x: 1, y: 2}); // false
   */
  static same(a, b) {
    if (typeof a !== "object")
      return a == b;
    if (typeof a !== typeof b)
      return false;
    if (Object.keys(a).length !== Object.keys(b).length)
      return false;
    for (const key in a) {
      if (a[key] !== b[key])
        return false;
    }
    return true;
  }
  /**
   * Copy position and size properties from one widget to another.
   * Copies x, y, w, h and optionally min/max constraints.
   *
   * @param a target widget to copy to
   * @param b source widget to copy from
   * @param doMinMax if true, also copy min/max width/height constraints
   * @returns the target widget (a)
   *
   * @example
   * Utils.copyPos(widget1, widget2); // Copy position/size
   * Utils.copyPos(widget1, widget2, true); // Also copy constraints
   */
  static copyPos(a, b, doMinMax = false) {
    if (b.x !== void 0)
      a.x = b.x;
    if (b.y !== void 0)
      a.y = b.y;
    if (b.w !== void 0)
      a.w = b.w;
    if (b.h !== void 0)
      a.h = b.h;
    if (doMinMax) {
      if (b.minW)
        a.minW = b.minW;
      if (b.minH)
        a.minH = b.minH;
      if (b.maxW)
        a.maxW = b.maxW;
      if (b.maxH)
        a.maxH = b.maxH;
    }
    return a;
  }
  /** true if a and b has same size & position */
  static samePos(a, b) {
    return a && b && a.x === b.x && a.y === b.y && (a.w || 1) === (b.w || 1) && (a.h || 1) === (b.h || 1);
  }
  /** given a node, makes sure it's min/max are valid */
  static sanitizeMinMax(node) {
    if (!node.minW) {
      delete node.minW;
    }
    if (!node.minH) {
      delete node.minH;
    }
    if (!node.maxW) {
      delete node.maxW;
    }
    if (!node.maxH) {
      delete node.maxH;
    }
  }
  /** removes field from the first object if same as the second objects (like diffing) and internal '_' for saving */
  static removeInternalAndSame(a, b) {
    if (typeof a !== "object" || typeof b !== "object")
      return;
    if (Array.isArray(a) || Array.isArray(b))
      return;
    for (let key in a) {
      const aVal = a[key];
      const bVal = b[key];
      if (key[0] === "_" || aVal === bVal) {
        delete a[key];
      } else if (aVal && typeof aVal === "object" && bVal !== void 0) {
        _Utils.removeInternalAndSame(aVal, bVal);
        if (!Object.keys(aVal).length) {
          delete a[key];
        }
      }
    }
  }
  /** removes internal fields '_' and default values for saving */
  static removeInternalForSave(n, removeEl = true) {
    for (let key in n) {
      if (key[0] === "_" || n[key] === null || n[key] === void 0)
        delete n[key];
    }
    delete n.grid;
    if (removeEl)
      delete n.el;
    if (!n.autoPosition)
      delete n.autoPosition;
    if (!n.noResize)
      delete n.noResize;
    if (!n.noMove)
      delete n.noMove;
    if (!n.locked)
      delete n.locked;
    if (n.w === 1 || n.w === n.minW)
      delete n.w;
    if (n.h === 1 || n.h === n.minH)
      delete n.h;
  }
  /** return the closest parent (or itself) matching the given class */
  // static closestUpByClass(el: HTMLElement, name: string): HTMLElement {
  //   while (el) {
  //     if (el.classList.contains(name)) return el;
  //     el = el.parentElement
  //   }
  //   return null;
  // }
  /** delay calling the given function for given delay, preventing new calls from happening while waiting */
  static throttle(func, delay) {
    let isWaiting = false;
    return (...args) => {
      if (!isWaiting) {
        isWaiting = true;
        setTimeout(() => {
          func(...args);
          isWaiting = false;
        }, delay);
      }
    };
  }
  static removePositioningStyles(el) {
    const style = el.style;
    if (style.position) {
      style.removeProperty("position");
    }
    if (style.left) {
      style.removeProperty("left");
    }
    if (style.top) {
      style.removeProperty("top");
    }
    if (style.width) {
      style.removeProperty("width");
    }
    if (style.height) {
      style.removeProperty("height");
    }
  }
  /** @internal returns the passed element if scrollable, else the closest parent that will, up to the entire document scrolling element */
  static getScrollElement(el) {
    if (!el)
      return document.scrollingElement || document.documentElement;
    const style = getComputedStyle(el);
    const overflowRegex = /(auto|scroll)/;
    if (overflowRegex.test(style.overflow + style.overflowY)) {
      return el;
    } else {
      return _Utils.getScrollElement(el.parentElement);
    }
  }
  /** @internal */
  static updateScrollPosition(el, position, distance) {
    const scrollEl = _Utils.getScrollElement(el);
    if (!scrollEl)
      return;
    const elRect = el.getBoundingClientRect();
    const scrollRect = scrollEl.getBoundingClientRect();
    const innerHeightOrClientHeight = window.innerHeight || document.documentElement.clientHeight;
    const offsetDiffDown = elRect.bottom - Math.min(scrollRect.bottom, innerHeightOrClientHeight);
    const offsetDiffUp = elRect.top - Math.max(scrollRect.top, 0);
    const prevScroll = scrollEl.scrollTop;
    if (offsetDiffUp < 0 && distance < 0) {
      if (el.offsetHeight > scrollRect.height) {
        scrollEl.scrollTop += distance;
      } else {
        scrollEl.scrollTop += Math.abs(offsetDiffUp) > Math.abs(distance) ? distance : offsetDiffUp;
      }
    } else if (offsetDiffDown > 0 && distance > 0) {
      if (el.offsetHeight > scrollRect.height) {
        scrollEl.scrollTop += distance;
      } else {
        scrollEl.scrollTop += offsetDiffDown > distance ? distance : offsetDiffDown;
      }
    }
    position.top += scrollEl.scrollTop - prevScroll;
  }
  /**
   * @internal Function used to scroll the page.
   *
   * @param event `MouseEvent` that triggers the resize
   * @param el `HTMLElement` that's being resized
   * @param distance Distance from the V edges to start scrolling
   */
  static updateScrollResize(event, el, distance) {
    const scrollEl = _Utils.getScrollElement(el);
    const height = scrollEl.clientHeight;
    const offsetTop = scrollEl === _Utils.getScrollElement() ? 0 : scrollEl.getBoundingClientRect().top;
    const pointerPosY = event.clientY - offsetTop;
    const top = pointerPosY < distance;
    const bottom = pointerPosY > height - distance;
    if (top) {
      scrollEl.scrollBy({ behavior: "smooth", top: pointerPosY - distance });
    } else if (bottom) {
      scrollEl.scrollBy({ behavior: "smooth", top: distance - (height - pointerPosY) });
    }
  }
  /** single level clone, returning a new object with same top fields. This will share sub objects and arrays */
  static clone(obj) {
    if (obj === null || obj === void 0 || typeof obj !== "object") {
      return obj;
    }
    if (obj instanceof Array) {
      return [...obj];
    }
    return { ...obj };
  }
  /**
   * Recursive clone version that returns a full copy, checking for nested objects and arrays ONLY.
   * Note: this will use as-is any key starting with double __ (and not copy inside) some lib have circular dependencies.
   */
  static cloneDeep(obj) {
    const skipFields = ["parentGrid", "el", "grid", "subGrid", "engine"];
    const ret = _Utils.clone(obj);
    for (const key in ret) {
      if (ret.hasOwnProperty(key) && typeof ret[key] === "object" && key.substring(0, 2) !== "__" && !skipFields.find((k) => k === key)) {
        ret[key] = _Utils.cloneDeep(obj[key]);
      }
    }
    return ret;
  }
  /** deep clone the given HTML node, removing teh unique id field */
  static cloneNode(el) {
    const node = el.cloneNode(true);
    node.removeAttribute("id");
    return node;
  }
  static appendTo(el, parent) {
    let parentNode;
    if (typeof parent === "string") {
      parentNode = _Utils.getElement(parent);
    } else {
      parentNode = parent;
    }
    if (parentNode) {
      parentNode.appendChild(el);
    }
  }
  // public static setPositionRelative(el: HTMLElement): void {
  //   if (!(/^(?:r|a|f)/).test(getComputedStyle(el).position)) {
  //     el.style.position = "relative";
  //   }
  // }
  static addElStyles(el, styles) {
    if (styles instanceof Object) {
      for (const s in styles) {
        if (styles.hasOwnProperty(s)) {
          if (Array.isArray(styles[s])) {
            styles[s].forEach((val) => {
              el.style[s] = val;
            });
          } else {
            el.style[s] = styles[s];
          }
        }
      }
    }
  }
  static initEvent(e, info) {
    const evt = { type: info.type };
    const obj = {
      button: 0,
      which: 0,
      buttons: 1,
      bubbles: true,
      cancelable: true,
      target: info.target ? info.target : e.target
    };
    ["altKey", "ctrlKey", "metaKey", "shiftKey"].forEach((p) => evt[p] = e[p]);
    ["pageX", "pageY", "clientX", "clientY", "screenX", "screenY"].forEach((p) => evt[p] = e[p]);
    return { ...evt, ...obj };
  }
  /** copies the MouseEvent (or convert Touch) properties and sends it as another event to the given target */
  static simulateMouseEvent(e, simulatedType, target) {
    const me = e;
    const simulatedEvent = new MouseEvent(simulatedType, {
      bubbles: true,
      composed: true,
      cancelable: true,
      view: window,
      detail: 1,
      screenX: e.screenX,
      screenY: e.screenY,
      clientX: e.clientX,
      clientY: e.clientY,
      ctrlKey: me.ctrlKey ?? false,
      altKey: me.altKey ?? false,
      shiftKey: me.shiftKey ?? false,
      metaKey: me.metaKey ?? false,
      button: 0,
      relatedTarget: e.target
    });
    (target || e.target).dispatchEvent(simulatedEvent);
  }
  /**
   * defines an element that is used to get the offset and scale from grid transforms
   * returns the scale and offsets from said element
  */
  static getValuesFromTransformedElement(parent) {
    const transformReference = document.createElement("div");
    _Utils.addElStyles(transformReference, {
      opacity: "0",
      position: "fixed",
      top: "0px",
      left: "0px",
      width: "1px",
      height: "1px",
      zIndex: "-999999"
    });
    parent.appendChild(transformReference);
    const transformValues = transformReference.getBoundingClientRect();
    parent.removeChild(transformReference);
    transformReference.remove();
    return {
      xScale: 1 / transformValues.width,
      yScale: 1 / transformValues.height,
      xOffset: transformValues.left,
      yOffset: transformValues.top
    };
  }
  /** swap the given object 2 field values */
  static swap(o, a, b) {
    if (!o)
      return;
    const tmp = o[a];
    o[a] = o[b];
    o[b] = tmp;
  }
  /** returns true if event is inside the given element rectangle */
  // Note: Safari Mac has null event.relatedTarget which causes #1684 so check if DragEvent is inside the coordinates instead
  //    Utils.el.contains(event.relatedTarget as HTMLElement)
  // public static inside(e: MouseEvent, el: HTMLElement): boolean {
  //   // srcElement, toElement, target: all set to placeholder when leaving simple grid, so we can't use that (Chrome)
  //   const target: HTMLElement = e.relatedTarget || (e as any).fromElement;
  //   if (!target) {
  //     const { bottom, left, right, top } = el.getBoundingClientRect();
  //     return (e.x < right && e.x > left && e.y < bottom && e.y > top);
  //   }
  //   return el.contains(target);
  // }
  /** true if the item can be rotated (checking for prop, not space available) */
  static canBeRotated(n) {
    return !(!n || n.w === n.h || n.locked || n.noResize || n.grid?.opts.disableResize || n.minW && n.minW === n.maxW || n.minH && n.minH === n.maxH);
  }
};

// node_modules/gridstack/dist/gridstack-engine.js
var GridStackEngine = class _GridStackEngine {
  constructor(opts = {}) {
    this.addedNodes = [];
    this.removedNodes = [];
    this.defaultColumn = 12;
    this.column = opts.column || this.defaultColumn;
    if (this.column > this.defaultColumn)
      this.defaultColumn = this.column;
    this.maxRow = opts.maxRow;
    this._float = opts.float;
    this.nodes = opts.nodes || [];
    this.onChange = opts.onChange;
  }
  /**
   * Enable/disable batch mode for multiple operations to optimize performance.
   * When enabled, layout updates are deferred until batch mode is disabled.
   *
   * @param flag true to enable batch mode, false to disable and apply changes
   * @param doPack if true (default), pack/compact nodes when disabling batch mode
   * @returns the engine instance for chaining
   *
   * @example
   * // Start batch mode for multiple operations
   * engine.batchUpdate(true);
   * engine.addNode(node1);
   * engine.addNode(node2);
   * engine.batchUpdate(false); // Apply all changes at once
   */
  batchUpdate(flag = true, doPack = true) {
    if (!!this.batchMode === flag)
      return this;
    this.batchMode = flag;
    if (flag) {
      this._prevFloat = this._float;
      this._float = true;
      this.cleanNodes();
      this.saveInitial();
    } else {
      this._float = this._prevFloat;
      delete this._prevFloat;
      if (doPack)
        this._packNodes();
      this._notify();
    }
    return this;
  }
  // use entire row for hitting area (will use bottom reverse sorted first) if we not actively moving DOWN and didn't already skip
  _useEntireRowArea(node, nn) {
    return (!this.float || this.batchMode && !this._prevFloat) && !this._hasLocked && (!node._moving || node._skipDown || nn.y <= node.y);
  }
  /** @internal fix collision on given 'node', going to given new location 'nn', with optional 'collide' node already found.
   * return true if we moved. */
  _fixCollisions(node, nn = node, collide, opt = {}) {
    this.sortNodes(-1);
    collide = collide || this.collide(node, nn);
    if (!collide)
      return false;
    if (node._moving && !opt.nested && !this.float) {
      if (this.swap(node, collide))
        return true;
    }
    let area = nn;
    if (!this._loading && this._useEntireRowArea(node, nn)) {
      area = { x: 0, w: this.column, y: nn.y, h: nn.h };
      collide = this.collide(node, area, opt.skip);
    }
    let didMove = false;
    const newOpt = { nested: true, pack: false };
    let counter = 0;
    while (collide = collide || this.collide(node, area, opt.skip)) {
      if (counter++ > this.nodes.length * 2) {
        throw new Error("Infinite collide check");
      }
      let moved;
      if (collide.locked || this._loading || node._moving && !node._skipDown && nn.y > node.y && !this.float && // can take space we had, or before where we're going
      (!this.collide(collide, { ...collide, y: node.y }, node) || !this.collide(collide, { ...collide, y: nn.y - collide.h }, node))) {
        node._skipDown = node._skipDown || nn.y > node.y;
        const newNN = { ...nn, y: collide.y + collide.h, ...newOpt };
        moved = this._loading && Utils.samePos(node, newNN) ? true : this.moveNode(node, newNN);
        if ((collide.locked || this._loading) && moved) {
          Utils.copyPos(nn, node);
        } else if (!collide.locked && moved && opt.pack) {
          this._packNodes();
          nn.y = collide.y + collide.h;
          Utils.copyPos(node, nn);
        }
        didMove = didMove || moved;
      } else {
        moved = this.moveNode(collide, { ...collide, y: nn.y + nn.h, skip: node, ...newOpt });
      }
      if (!moved)
        return didMove;
      collide = void 0;
    }
    return didMove;
  }
  /**
   * Return the first node that intercepts/collides with the given node or area.
   * Used for collision detection during drag and drop operations.
   *
   * @param skip the node to skip in collision detection (usually the node being moved)
   * @param area the area to check for collisions (defaults to skip node's area)
   * @param skip2 optional second node to skip in collision detection
   * @returns the first colliding node, or undefined if no collision
   *
   * @example
   * const colliding = engine.collide(draggedNode, {x: 2, y: 1, w: 2, h: 1});
   * if (colliding) {
   *   console.log('Would collide with:', colliding.id);
   * }
   */
  collide(skip, area = skip, skip2) {
    const skipId = skip._id;
    const skip2Id = skip2?._id;
    return this.nodes.find((n) => n._id !== skipId && n._id !== skip2Id && Utils.isIntercepted(n, area));
  }
  /**
   * Return all nodes that intercept/collide with the given node or area.
   * Similar to collide() but returns all colliding nodes instead of just the first.
   *
   * @param skip the node to skip in collision detection
   * @param area the area to check for collisions (defaults to skip node's area)
   * @param skip2 optional second node to skip in collision detection
   * @returns array of all colliding nodes
   *
   * @example
   * const allCollisions = engine.collideAll(draggedNode);
   * console.log('Colliding with', allCollisions.length, 'nodes');
   */
  collideAll(skip, area = skip, skip2) {
    const skipId = skip._id;
    const skip2Id = skip2?._id;
    return this.nodes.filter((n) => n._id !== skipId && n._id !== skip2Id && Utils.isIntercepted(n, area));
  }
  /** does a pixel coverage collision based on where we started, returning the node that has the most coverage that is >50% mid line */
  directionCollideCoverage(node, o, collides) {
    if (!o.rect || !node._rect)
      return;
    const r0 = node._rect;
    const r = { ...o.rect };
    if (r.y > r0.y) {
      r.h += r.y - r0.y;
      r.y = r0.y;
    } else {
      r.h += r0.y - r.y;
    }
    if (r.x > r0.x) {
      r.w += r.x - r0.x;
      r.x = r0.x;
    } else {
      r.w += r0.x - r.x;
    }
    let collide;
    let overMax = 0.5;
    for (let n of collides) {
      if (n.locked || !n._rect) {
        break;
      }
      const r2 = n._rect;
      let yOver = Number.MAX_VALUE, xOver = Number.MAX_VALUE;
      if (r0.y < r2.y) {
        yOver = (r.y + r.h - r2.y) / r2.h;
      } else if (r0.y + r0.h > r2.y + r2.h) {
        yOver = (r2.y + r2.h - r.y) / r2.h;
      }
      if (r0.x < r2.x) {
        xOver = (r.x + r.w - r2.x) / r2.w;
      } else if (r0.x + r0.w > r2.x + r2.w) {
        xOver = (r2.x + r2.w - r.x) / r2.w;
      }
      const over = Math.min(xOver, yOver);
      if (over > overMax) {
        overMax = over;
        collide = n;
      }
    }
    o.collide = collide;
    return collide;
  }
  /** does a pixel coverage returning the node that has the most coverage by area */
  /*
  protected collideCoverage(r: GridStackPosition, collides: GridStackNode[]): {collide: GridStackNode, over: number} {
    const collide: GridStackNode;
    const overMax = 0;
    collides.forEach(n => {
      if (n.locked || !n._rect) return;
      const over = Utils.areaIntercept(r, n._rect);
      if (over > overMax) {
        overMax = over;
        collide = n;
      }
    });
    return {collide, over: overMax};
  }
  */
  /**
   * Cache the pixel rectangles for all nodes used for collision detection during drag operations.
   * This optimization converts grid coordinates to pixel coordinates for faster collision detection.
   *
   * @param w width of a single grid cell in pixels
   * @param h height of a single grid cell in pixels
   * @param top top margin/padding in pixels
   * @param right right margin/padding in pixels
   * @param bottom bottom margin/padding in pixels
   * @param left left margin/padding in pixels
   * @returns the engine instance for chaining
   *
   * @internal This is typically called by GridStack during resize events
   */
  cacheRects(w, h, top, right, bottom, left) {
    this.nodes.forEach((n) => n._rect = {
      y: n.y * h + top,
      x: n.x * w + left,
      w: n.w * w - left - right,
      h: n.h * h - top - bottom
    });
    return this;
  }
  /**
   * Attempt to swap the positions of two nodes if they meet swapping criteria.
   * Nodes can swap if they are the same size or in the same column/row, not locked, and touching.
   *
   * @param a first node to swap
   * @param b second node to swap
   * @returns true if swap was successful, false if not possible, undefined if not applicable
   *
   * @example
   * const swapped = engine.swap(nodeA, nodeB);
   * if (swapped) {
   *   console.log('Nodes swapped successfully');
   * }
   */
  swap(a, b) {
    if (!b || b.locked || !a || a.locked)
      return false;
    function _doSwap() {
      const x = b.x, y = b.y;
      b.x = a.x;
      b.y = a.y;
      if (a.h != b.h) {
        a.x = x;
        a.y = b.y + b.h;
      } else if (a.w != b.w) {
        a.x = b.x + b.w;
        a.y = y;
      } else {
        a.x = x;
        a.y = y;
      }
      a._dirty = b._dirty = true;
      return true;
    }
    let touching;
    if (a.w === b.w && a.h === b.h && (a.x === b.x || a.y === b.y) && (touching = Utils.isTouching(a, b)))
      return _doSwap();
    if (touching === false)
      return;
    if (a.w === b.w && a.x === b.x && (touching || (touching = Utils.isTouching(a, b)))) {
      if (b.y < a.y) {
        const t = a;
        a = b;
        b = t;
      }
      return _doSwap();
    }
    if (touching === false)
      return;
    if (a.h === b.h && a.y === b.y && (touching || (touching = Utils.isTouching(a, b)))) {
      if (b.x < a.x) {
        const t = a;
        a = b;
        b = t;
      }
      return _doSwap();
    }
    return false;
  }
  /**
   * Check if the specified rectangular area is empty (no nodes occupy any part of it).
   *
   * @param x the x coordinate (column) of the area to check
   * @param y the y coordinate (row) of the area to check
   * @param w the width in columns of the area to check
   * @param h the height in rows of the area to check
   * @returns true if the area is completely empty, false if any node overlaps
   *
   * @example
   * if (engine.isAreaEmpty(2, 1, 3, 2)) {
   *   console.log('Area is available for placement');
   * }
   */
  isAreaEmpty(x, y, w, h) {
    const nn = { x: x || 0, y: y || 0, w: w || 1, h: h || 1 };
    return !this.collide(nn);
  }
  /**
   * Re-layout grid items to reclaim any empty space.
   * This optimizes the grid layout by moving items to fill gaps.
   *
   * @param layout layout algorithm to use:
   *   - 'compact' (default): find truly empty spaces, may reorder items
   *   - 'list': keep the sort order exactly the same, move items up sequentially
   * @param doSort if true (default), sort nodes by position before compacting
   * @returns the engine instance for chaining
   *
   * @example
   * // Compact to fill empty spaces
   * engine.compact();
   *
   * // Compact preserving item order
   * engine.compact('list');
   */
  compact(layout = "compact", doSort = true) {
    if (this.nodes.length === 0)
      return this;
    if (doSort)
      this.sortNodes();
    const wasBatch = this.batchMode;
    if (!wasBatch)
      this.batchUpdate();
    const wasColumnResize = this._inColumnResize;
    if (!wasColumnResize)
      this._inColumnResize = true;
    const copyNodes = this.nodes;
    this.nodes = [];
    copyNodes.forEach((n, index, list) => {
      let after;
      if (!n.locked) {
        n.autoPosition = true;
        if (layout === "list" && index)
          after = list[index - 1];
      }
      this.addNode(n, false, after);
    });
    if (!wasColumnResize)
      delete this._inColumnResize;
    if (!wasBatch)
      this.batchUpdate(false);
    return this;
  }
  /**
   * Enable/disable floating widgets (default: `false`).
   * When floating is enabled, widgets can move up to fill empty spaces.
   * See [example](http://gridstackjs.com/demo/float.html)
   *
   * @param val true to enable floating, false to disable
   *
   * @example
   * engine.float = true;  // Enable floating
   * engine.float = false; // Disable floating (default)
   */
  set float(val) {
    if (this._float === val)
      return;
    this._float = val || false;
    if (!val) {
      this._packNodes()._notify();
    }
  }
  /**
   * Get the current floating mode setting.
   *
   * @returns true if floating is enabled, false otherwise
   *
   * @example
   * const isFloating = engine.float;
   * console.log('Floating enabled:', isFloating);
   */
  get float() {
    return this._float || false;
  }
  /**
   * Sort the nodes array from first to last, or reverse.
   * This is called during collision/placement operations to enforce a specific order.
   *
   * @param dir sort direction: 1 for ascending (first to last), -1 for descending (last to first)
   * @returns the engine instance for chaining
   *
   * @example
   * engine.sortNodes();    // Sort ascending (default)
   * engine.sortNodes(-1);  // Sort descending
   */
  sortNodes(dir = 1) {
    this.nodes = Utils.sort(this.nodes, dir);
    return this;
  }
  /** @internal called to top gravity pack the items back OR revert back to original Y positions when floating */
  _packNodes() {
    if (this.batchMode) {
      return this;
    }
    this.sortNodes();
    if (this.float) {
      this.nodes.forEach((n) => {
        if (n._updating || n._orig === void 0 || n.y === n._orig.y)
          return;
        let newY = n.y;
        while (newY > n._orig.y) {
          --newY;
          const collide = this.collide(n, { x: n.x, y: newY, w: n.w, h: n.h });
          if (!collide) {
            n._dirty = true;
            n.y = newY;
          }
        }
      });
    } else {
      this.nodes.forEach((n, i) => {
        if (n.locked)
          return;
        while (n.y > 0) {
          const newY = i === 0 ? 0 : n.y - 1;
          const canBeMoved = i === 0 || !this.collide(n, { x: n.x, y: newY, w: n.w, h: n.h });
          if (!canBeMoved)
            break;
          n._dirty = n.y !== newY;
          n.y = newY;
        }
      });
    }
    return this;
  }
  /**
   * Prepare and validate a node's coordinates and values for the current grid.
   * This ensures the node has valid position, size, and properties before being added to the grid.
   *
   * @param node the node to prepare and validate
   * @param resizing if true, resize the node down if it's out of bounds; if false, move it to fit
   * @returns the prepared node with valid coordinates
   *
   * @example
   * const node = { w: 3, h: 2, content: 'Hello' };
   * const prepared = engine.prepareNode(node);
   * console.log('Node prepared at:', prepared.x, prepared.y);
   */
  prepareNode(node, resizing) {
    node._id = node._id ?? _GridStackEngine._idSeq++;
    const id = node.id;
    if (id) {
      let count = 1;
      while (this.nodes.find((n) => n.id === node.id && n !== node)) {
        node.id = id + "_" + count++;
      }
    }
    if (node.x === void 0 || node.y === void 0 || node.x === null || node.y === null) {
      node.autoPosition = true;
    }
    const defaults = { x: 0, y: 0, w: 1, h: 1 };
    Utils.defaults(node, defaults);
    if (!node.autoPosition) {
      delete node.autoPosition;
    }
    if (!node.noResize) {
      delete node.noResize;
    }
    if (!node.noMove) {
      delete node.noMove;
    }
    Utils.sanitizeMinMax(node);
    if (typeof node.x == "string") {
      node.x = Number(node.x);
    }
    if (typeof node.y == "string") {
      node.y = Number(node.y);
    }
    if (typeof node.w == "string") {
      node.w = Number(node.w);
    }
    if (typeof node.h == "string") {
      node.h = Number(node.h);
    }
    if (isNaN(node.x)) {
      node.x = defaults.x;
      node.autoPosition = true;
    }
    if (isNaN(node.y)) {
      node.y = defaults.y;
      node.autoPosition = true;
    }
    if (isNaN(node.w)) {
      node.w = defaults.w;
    }
    if (isNaN(node.h)) {
      node.h = defaults.h;
    }
    this.nodeBoundFix(node, resizing);
    return node;
  }
  /**
   * Part 2 of preparing a node to fit inside the grid - validates and fixes coordinates and dimensions.
   * This ensures the node fits within grid boundaries and respects min/max constraints.
   *
   * @param node the node to validate and fix
   * @param resizing if true, resize the node to fit; if false, move the node to fit
   * @returns the engine instance for chaining
   *
   * @example
   * // Fix a node that might be out of bounds
   * engine.nodeBoundFix(node, true); // Resize to fit
   * engine.nodeBoundFix(node, false); // Move to fit
   */
  nodeBoundFix(node, resizing) {
    const before = node._orig || Utils.copyPos({}, node);
    if (node.maxW) {
      node.w = Math.min(node.w || 1, node.maxW);
    }
    if (node.maxH) {
      node.h = Math.min(node.h || 1, node.maxH);
    }
    if (node.minW) {
      node.w = Math.max(node.w || 1, node.minW);
    }
    if (node.minH) {
      node.h = Math.max(node.h || 1, node.minH);
    }
    const saveOrig = (node.x || 0) + (node.w || 1) > this.column;
    if (saveOrig && this.column < this.defaultColumn && !this._inColumnResize && !this.skipCacheUpdate && node._id != null && this.findCacheLayout(node, this.defaultColumn) === -1) {
      const copy = { ...node };
      if (copy.autoPosition || copy.x === void 0) {
        delete copy.x;
        delete copy.y;
      } else
        copy.x = Math.min(this.defaultColumn - 1, copy.x);
      copy.w = Math.min(this.defaultColumn, copy.w || 1);
      this.cacheOneLayout(copy, this.defaultColumn);
    }
    if (node.w > this.column) {
      node.w = this.column;
    } else if (node.w < 1) {
      node.w = 1;
    }
    if (this.maxRow && node.h > this.maxRow) {
      node.h = this.maxRow;
    } else if (node.h < 1) {
      node.h = 1;
    }
    if (node.x < 0) {
      node.x = 0;
    }
    if (node.y < 0) {
      node.y = 0;
    }
    if (node.x + node.w > this.column) {
      if (resizing) {
        node.w = this.column - node.x;
      } else {
        node.x = this.column - node.w;
      }
    }
    if (this.maxRow && node.y + node.h > this.maxRow) {
      if (resizing) {
        node.h = this.maxRow - node.y;
      } else {
        node.y = this.maxRow - node.h;
      }
    }
    if (!Utils.samePos(node, before)) {
      node._dirty = true;
    }
    return this;
  }
  /**
   * Returns a list of nodes that have been modified from their original values.
   * This is used to track which nodes need DOM updates.
   *
   * @param verify if true, performs additional verification by comparing current vs original positions
   * @returns array of nodes that have been modified
   *
   * @example
   * const changed = engine.getDirtyNodes();
   * console.log('Modified nodes:', changed.length);
   *
   * // Get verified dirty nodes
   * const verified = engine.getDirtyNodes(true);
   */
  getDirtyNodes(verify) {
    if (verify) {
      return this.nodes.filter((n) => n._dirty && !Utils.samePos(n, n._orig));
    }
    return this.nodes.filter((n) => n._dirty);
  }
  /** @internal call this to call onChange callback with dirty nodes so DOM can be updated */
  _notify(removedNodes) {
    if (this.batchMode || !this.onChange)
      return this;
    const dirtyNodes = (removedNodes || []).concat(this.getDirtyNodes());
    this.onChange(dirtyNodes);
    return this;
  }
  /**
   * Clean all dirty and last tried information from nodes.
   * This resets the dirty state tracking for all nodes.
   *
   * @returns the engine instance for chaining
   *
   * @internal
   */
  cleanNodes() {
    if (this.batchMode)
      return this;
    this.nodes.forEach((n) => {
      delete n._dirty;
      delete n._lastTried;
    });
    return this;
  }
  /**
   * Save the initial position/size of all nodes to track real dirty state.
   * This creates a snapshot of current positions that can be restored later.
   *
   * Note: Should be called right after change events and before move/resize operations.
   *
   * @returns the engine instance for chaining
   *
   * @internal
   */
  saveInitial() {
    this.nodes.forEach((n) => {
      n._orig = Utils.copyPos({}, n);
      delete n._dirty;
    });
    this._hasLocked = this.nodes.some((n) => n.locked);
    return this;
  }
  /**
   * Restore all nodes back to their initial values.
   * This is typically called when canceling an operation (e.g., Esc key during drag).
   *
   * @returns the engine instance for chaining
   *
   * @internal
   */
  restoreInitial() {
    this.nodes.forEach((n) => {
      if (!n._orig || Utils.samePos(n, n._orig))
        return;
      Utils.copyPos(n, n._orig);
      n._dirty = true;
    });
    this._notify();
    return this;
  }
  /**
   * Find the first available empty spot for the given node dimensions.
   * Updates the node's x,y attributes with the found position.
   *
   * @param node the node to find a position for (w,h must be set)
   * @param nodeList optional list of nodes to check against (defaults to engine nodes)
   * @param column optional column count (defaults to engine column count)
   * @param after optional node to start search after (maintains order)
   * @returns true if an empty position was found and node was updated
   *
   * @example
   * const node = { w: 2, h: 1 };
   * if (engine.findEmptyPosition(node)) {
   *   console.log('Found position at:', node.x, node.y);
   * }
   */
  findEmptyPosition(node, nodeList = this.nodes, column = this.column, after) {
    const start = after ? after.y * column + (after.x + after.w) : 0;
    let found = false;
    for (let i = start; !found; ++i) {
      const x = i % column;
      const y = Math.floor(i / column);
      if (x + node.w > column) {
        continue;
      }
      const box = { x, y, w: node.w, h: node.h };
      if (!nodeList.find((n) => Utils.isIntercepted(box, n))) {
        if (node.x !== x || node.y !== y)
          node._dirty = true;
        node.x = x;
        node.y = y;
        delete node.autoPosition;
        found = true;
      }
    }
    return found;
  }
  /**
   * Add the given node to the grid, handling collision detection and re-packing.
   * This is the main method for adding new widgets to the engine.
   *
   * @param node the node to add to the grid
   * @param triggerAddEvent if true, adds node to addedNodes list for event triggering
   * @param after optional node to place this node after (for ordering)
   * @returns the added node (or existing node if duplicate)
   *
   * @example
   * const node = { x: 0, y: 0, w: 2, h: 1, content: 'Hello' };
   * const added = engine.addNode(node, true);
   */
  addNode(node, triggerAddEvent = false, after) {
    const dup = this.nodes.find((n) => n._id === node._id);
    if (dup)
      return dup;
    this._inColumnResize ? this.nodeBoundFix(node) : this.prepareNode(node);
    delete node._temporaryRemoved;
    delete node._removeDOM;
    let skipCollision;
    if (node.autoPosition && this.findEmptyPosition(node, this.nodes, this.column, after)) {
      delete node.autoPosition;
      skipCollision = true;
    }
    this.nodes.push(node);
    if (triggerAddEvent) {
      this.addedNodes.push(node);
    }
    if (!skipCollision)
      this._fixCollisions(node);
    if (!this.batchMode) {
      this._packNodes()._notify();
    }
    return node;
  }
  /**
   * Remove the given node from the grid.
   *
   * @param node the node to remove
   * @param removeDOM if true (default), marks node for DOM removal
   * @param triggerEvent if true, adds node to removedNodes list for event triggering
   * @returns the engine instance for chaining
   *
   * @example
   * engine.removeNode(node, true, true);
   */
  removeNode(node, removeDOM = true, triggerEvent = false) {
    if (!this.nodes.find((n) => n._id === node._id)) {
      return this;
    }
    if (triggerEvent) {
      this.removedNodes.push(node);
    }
    if (removeDOM)
      node._removeDOM = true;
    this.nodes = this.nodes.filter((n) => n._id !== node._id);
    if (!node._isAboutToRemove)
      this._packNodes();
    this._notify([node]);
    return this;
  }
  /**
   * Remove all nodes from the grid.
   *
   * @param removeDOM if true (default), marks all nodes for DOM removal
   * @param triggerEvent if true (default), triggers removal events
   * @returns the engine instance for chaining
   *
   * @example
   * engine.removeAll(); // Remove all nodes
   */
  removeAll(removeDOM = true, triggerEvent = true) {
    delete this._layouts;
    if (!this.nodes.length)
      return this;
    removeDOM && this.nodes.forEach((n) => n._removeDOM = true);
    const removedNodes = this.nodes;
    this.removedNodes = triggerEvent ? removedNodes : [];
    this.nodes = [];
    return this._notify(removedNodes);
  }
  /**
   * Check if a node can be moved to a new position, considering layout constraints.
   * This is a safer version of moveNode() that validates the move first.
   *
   * For complex cases (like maxRow constraints), it simulates the move in a clone first,
   * then applies the changes only if they meet all specifications.
   *
   * @param node the node to move
   * @param o move options including target position
   * @returns true if the node was successfully moved
   *
   * @example
   * const canMove = engine.moveNodeCheck(node, { x: 2, y: 1 });
   * if (canMove) {
   *   console.log('Node moved successfully');
   * }
   */
  moveNodeCheck(node, o) {
    if (!this.changedPosConstrain(node, o))
      return false;
    o.pack = true;
    if (!this.maxRow) {
      return this.moveNode(node, o);
    }
    let clonedNode;
    const clone = new _GridStackEngine({
      column: this.column,
      float: this.float,
      nodes: this.nodes.map((n) => {
        if (n._id === node._id) {
          clonedNode = { ...n };
          return clonedNode;
        }
        return { ...n };
      })
    });
    if (!clonedNode)
      return false;
    const canMove = clone.moveNode(clonedNode, o) && clone.getRow() <= Math.max(this.getRow(), this.maxRow);
    if (!canMove && !o.resizing && o.collide) {
      const collide = o.collide.el.gridstackNode;
      if (this.swap(node, collide)) {
        this._notify();
        return true;
      }
    }
    if (!canMove)
      return false;
    clone.nodes.filter((n) => n._dirty).forEach((c) => {
      const n = this.nodes.find((a) => a._id === c._id);
      if (!n)
        return;
      Utils.copyPos(n, c);
      n._dirty = true;
    });
    this._notify();
    return true;
  }
  /** return true if can fit in grid height constrain only (always true if no maxRow) */
  willItFit(node) {
    delete node._willFitPos;
    if (!this.maxRow)
      return true;
    const clone = new _GridStackEngine({
      column: this.column,
      float: this.float,
      nodes: this.nodes.map((n2) => {
        return { ...n2 };
      })
    });
    const n = { ...node };
    this.cleanupNode(n);
    delete n.el;
    delete n._id;
    delete n.content;
    delete n.grid;
    clone.addNode(n);
    if (clone.getRow() <= this.maxRow) {
      node._willFitPos = Utils.copyPos({}, n);
      return true;
    }
    return false;
  }
  /** true if x,y or w,h are different after clamping to min/max */
  changedPosConstrain(node, p) {
    p.w = p.w || node.w;
    p.h = p.h || node.h;
    if (node.x !== p.x || node.y !== p.y)
      return true;
    if (node.maxW) {
      p.w = Math.min(p.w, node.maxW);
    }
    if (node.maxH) {
      p.h = Math.min(p.h, node.maxH);
    }
    if (node.minW) {
      p.w = Math.max(p.w, node.minW);
    }
    if (node.minH) {
      p.h = Math.max(p.h, node.minH);
    }
    return node.w !== p.w || node.h !== p.h;
  }
  /** return true if the passed in node was actually moved (checks for no-op and locked) */
  moveNode(node, o) {
    if (!node || /*node.locked ||*/
    !o)
      return false;
    let wasUndefinedPack;
    if (o.pack === void 0 && !this.batchMode) {
      wasUndefinedPack = o.pack = true;
    }
    if (typeof o.x !== "number") {
      o.x = node.x;
    }
    if (typeof o.y !== "number") {
      o.y = node.y;
    }
    if (typeof o.w !== "number") {
      o.w = node.w;
    }
    if (typeof o.h !== "number") {
      o.h = node.h;
    }
    const resizing = node.w !== o.w || node.h !== o.h;
    const nn = Utils.copyPos({}, node, true);
    Utils.copyPos(nn, o);
    this.nodeBoundFix(nn, resizing);
    Utils.copyPos(o, nn);
    if (!o.forceCollide && Utils.samePos(node, o))
      return false;
    const prevPos = Utils.copyPos({}, node);
    const collides = this.collideAll(node, nn, o.skip);
    let needToMove = true;
    if (collides.length) {
      const activeDrag = node._moving && !o.nested;
      let collide = activeDrag ? this.directionCollideCoverage(node, o, collides) : collides[0];
      if (activeDrag && collide && node.grid?.opts?.subGridDynamic && !node.grid._isTemp) {
        const over = Utils.areaIntercept(o.rect, collide._rect);
        const a1 = Utils.area(o.rect);
        const a2 = Utils.area(collide._rect);
        const perc = over / (a1 < a2 ? a1 : a2);
        if (perc > 0.8) {
          collide.grid.makeSubGrid(collide.el, void 0, node);
          collide = void 0;
        }
      }
      if (collide) {
        needToMove = !this._fixCollisions(node, nn, collide, o);
      } else {
        needToMove = false;
        if (wasUndefinedPack)
          delete o.pack;
      }
    }
    if (needToMove && !Utils.samePos(node, nn)) {
      node._dirty = true;
      Utils.copyPos(node, nn);
    }
    if (o.pack) {
      this._packNodes()._notify();
    }
    return !Utils.samePos(node, prevPos);
  }
  getRow() {
    return this.nodes.reduce((row, n) => Math.max(row, n.y + n.h), 0);
  }
  beginUpdate(node) {
    if (!node._updating) {
      node._updating = true;
      delete node._skipDown;
      if (!this.batchMode)
        this.saveInitial();
    }
    return this;
  }
  endUpdate() {
    const n = this.nodes.find((n2) => n2._updating);
    if (n) {
      delete n._updating;
      delete n._skipDown;
    }
    return this;
  }
  /** saves a copy of the largest column layout (eg 12 even when rendering 1 column) so we don't loose orig layout, unless explicity column
   * count to use is given. returning a list of widgets for serialization
   * @param saveElement if true (default), the element will be saved to GridStackWidget.el field, else it will be removed.
   * @param saveCB callback for each node -> widget, so application can insert additional data to be saved into the widget data structure.
   * @param column if provided, the grid will be saved for the given column count (IFF we have matching internal saved layout, or current layout).
   * Note: nested grids will ALWAYS save the container w to match overall layouts (parent + child) to be consistent.
  */
  save(saveElement = true, saveCB, column) {
    const len = this._layouts?.length || 0;
    let layout;
    if (len) {
      if (column) {
        if (column !== this.column)
          layout = this._layouts[column];
      } else if (this.column !== len - 1) {
        layout = this._layouts[len - 1];
      }
    }
    const list = [];
    this.sortNodes();
    this.nodes.forEach((n) => {
      const wl = layout?.find((l) => l._id === n._id);
      const w = { ...n, ...wl || {} };
      Utils.removeInternalForSave(w, !saveElement);
      if (saveCB)
        saveCB(n, w);
      list.push(w);
    });
    return list;
  }
  /** @internal called whenever a node is added or moved - updates the cached layouts */
  layoutsNodesChange(nodes) {
    if (!this._layouts || this._inColumnResize)
      return this;
    this._layouts.forEach((layout, column) => {
      if (!layout || column === this.column)
        return this;
      if (column < this.column) {
        this._layouts[column] = void 0;
      } else {
        const ratio = column / this.column;
        nodes.forEach((node) => {
          if (!node._orig)
            return;
          const n = layout.find((l) => l._id === node._id);
          if (!n)
            return;
          if (n.y >= 0 && node.y !== node._orig.y) {
            n.y += node.y - node._orig.y;
            if (n.y < 0)
              n.y = 0;
          }
          if (node.x !== node._orig.x) {
            n.x = Math.round(node.x * ratio);
            if (n.x < 0)
              n.x = 0;
          }
          if (node.w !== node._orig.w) {
            n.w = Math.round(node.w * ratio);
            if (n.w < 1)
              n.w = 1;
          }
        });
      }
    });
    return this;
  }
  /**
   * @internal Called to scale the widget width & position up/down based on the column change.
   * Note we store previous layouts (especially original ones) to make it possible to go
   * from say 12 -> 1 -> 12 and get back to where we were.
   *
   * @param prevColumn previous number of columns
   * @param column  new column number
   * @param layout specify the type of re-layout that will happen (position, size, etc...).
   * Note: items will never be outside of the current column boundaries. default (moveScale). Ignored for 1 column
   */
  columnChanged(prevColumn, column, layout = "moveScale") {
    if (!this.nodes.length || !column || prevColumn === column)
      return this;
    const doCompact = layout === "compact" || layout === "list";
    if (doCompact) {
      this.sortNodes(1);
    }
    if (column < prevColumn)
      this.cacheLayout(this.nodes, prevColumn);
    this.batchUpdate();
    let newNodes = [];
    let nodes = doCompact ? this.nodes : Utils.sort(this.nodes, -1);
    if (column > prevColumn && this._layouts) {
      const cacheNodes = this._layouts[column] || [];
      const lastIndex = this._layouts.length - 1;
      if (!cacheNodes.length && prevColumn !== lastIndex && this._layouts[lastIndex]?.length) {
        prevColumn = lastIndex;
        this._layouts[lastIndex].forEach((cacheNode) => {
          const n = nodes.find((n2) => n2._id === cacheNode._id);
          if (n) {
            if (!doCompact && !cacheNode.autoPosition) {
              n.x = cacheNode.x ?? n.x;
              n.y = cacheNode.y ?? n.y;
            }
            n.w = cacheNode.w ?? n.w;
            if (cacheNode.x == void 0 || cacheNode.y === void 0)
              n.autoPosition = true;
          }
        });
      }
      cacheNodes.forEach((cacheNode) => {
        const j = nodes.findIndex((n) => n._id === cacheNode._id);
        if (j !== -1) {
          const n = nodes[j];
          if (doCompact) {
            n.w = cacheNode.w;
            return;
          }
          if (cacheNode.autoPosition || isNaN(cacheNode.x) || isNaN(cacheNode.y)) {
            this.findEmptyPosition(cacheNode, newNodes);
          }
          if (!cacheNode.autoPosition) {
            n.x = cacheNode.x ?? n.x;
            n.y = cacheNode.y ?? n.y;
            n.w = cacheNode.w ?? n.w;
            newNodes.push(n);
          }
          nodes.splice(j, 1);
        }
      });
    }
    if (doCompact) {
      this.compact(layout, false);
    } else {
      if (nodes.length) {
        if (typeof layout === "function") {
          layout(column, prevColumn, newNodes, nodes);
        } else {
          const ratio = doCompact || layout === "none" ? 1 : column / prevColumn;
          const move = layout === "move" || layout === "moveScale";
          const scale = layout === "scale" || layout === "moveScale";
          nodes.forEach((node) => {
            node.x = column === 1 ? 0 : move ? Math.round(node.x * ratio) : Math.min(node.x, column - 1);
            node.w = column === 1 || prevColumn === 1 ? 1 : scale ? Math.round(node.w * ratio) || 1 : Math.min(node.w, column);
            newNodes.push(node);
          });
          nodes = [];
        }
      }
      newNodes = Utils.sort(newNodes, -1);
      this._inColumnResize = true;
      this.nodes = [];
      newNodes.forEach((node) => {
        this.addNode(node, false);
        delete node._orig;
      });
    }
    this.nodes.forEach((n) => delete n._orig);
    this.batchUpdate(false, !doCompact);
    delete this._inColumnResize;
    return this;
  }
  /**
   * call to cache the given layout internally to the given location so we can restore back when column changes size
   * @param nodes list of nodes
   * @param column corresponding column index to save it under
   * @param clear if true, will force other caches to be removed (default false)
   */
  cacheLayout(nodes, column, clear = false) {
    const copy = [];
    nodes.forEach((n, i) => {
      if (n._id === void 0) {
        const existing = n.id ? this.nodes.find((n2) => n2.id === n.id) : void 0;
        n._id = existing?._id ?? _GridStackEngine._idSeq++;
      }
      copy[i] = { x: n.x, y: n.y, w: n.w, _id: n._id };
    });
    this._layouts = clear ? [] : this._layouts || [];
    this._layouts[column] = copy;
    return this;
  }
  /**
   * call to cache the given node layout internally to the given location so we can restore back when column changes size
   * @param node single node to cache
   * @param column corresponding column index to save it under
   */
  cacheOneLayout(n, column) {
    n._id = n._id ?? _GridStackEngine._idSeq++;
    const l = { x: n.x, y: n.y, w: n.w, _id: n._id };
    if (n.autoPosition || n.x === void 0) {
      delete l.x;
      delete l.y;
      if (n.autoPosition)
        l.autoPosition = true;
    }
    this._layouts = this._layouts || [];
    this._layouts[column] = this._layouts[column] || [];
    const index = this.findCacheLayout(n, column);
    if (index === -1)
      this._layouts[column].push(l);
    else
      this._layouts[column][index] = l;
    return this;
  }
  findCacheLayout(n, column) {
    return this._layouts?.[column]?.findIndex((l) => l._id === n._id) ?? -1;
  }
  removeNodeFromLayoutCache(n) {
    if (!this._layouts) {
      return;
    }
    for (let i = 0; i < this._layouts.length; i++) {
      const index = this.findCacheLayout(n, i);
      if (index !== -1) {
        this._layouts[i].splice(index, 1);
      }
    }
  }
  /** called to remove all internal values but the _id */
  cleanupNode(node) {
    for (const prop in node) {
      if (prop[0] === "_" && prop !== "_id")
        delete node[prop];
    }
    return this;
  }
};
GridStackEngine._idSeq = 0;

// node_modules/gridstack/dist/types.js
var gridDefaults = {
  alwaysShowResizeHandle: "mobile",
  animate: true,
  auto: true,
  cellHeight: "auto",
  cellHeightThrottle: 100,
  cellHeightUnit: "px",
  column: 12,
  draggable: { handle: ".grid-stack-item-content", appendTo: "body", scroll: true },
  handle: ".grid-stack-item-content",
  itemClass: "grid-stack-item",
  margin: 10,
  marginUnit: "px",
  maxRow: 0,
  minRow: 0,
  placeholderClass: "grid-stack-placeholder",
  placeholderText: "",
  removableOptions: { accept: "grid-stack-item", decline: "grid-stack-non-removable" },
  resizable: { handles: "se" },
  rtl: "auto"
  // **** same as not being set ****
  // disableDrag: false,
  // disableResize: false,
  // float: false,
  // handleClass: null,
  // removable: false,
  // staticGrid: false,
  //removable
};

// node_modules/gridstack/dist/dd-manager.js
var DDManager = class {
};

// node_modules/gridstack/dist/dd-touch.js
var isTouch = typeof window !== "undefined" && typeof document !== "undefined" && ("ontouchstart" in document || "ontouchstart" in window || window.DocumentTouch && document instanceof window.DocumentTouch || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0);
var DDTouch = class {
};
function simulateMouseEvent(e, simulatedType) {
  if (e.touches.length > 1)
    return;
  if (e.cancelable)
    e.preventDefault();
  Utils.simulateMouseEvent(e.changedTouches[0], simulatedType);
}
function simulatePointerMouseEvent(e, simulatedType) {
  if (e.cancelable)
    e.preventDefault();
  Utils.simulateMouseEvent(e, simulatedType);
}
function touchstart(e) {
  if (DDTouch.touchHandled)
    return;
  DDTouch.touchHandled = true;
  simulateMouseEvent(e, "mousedown");
}
function touchmove(e) {
  if (!DDTouch.touchHandled)
    return;
  simulateMouseEvent(e, "mousemove");
}
function touchend(e) {
  if (!DDTouch.touchHandled)
    return;
  if (DDTouch.pointerLeaveTimeout) {
    window.clearTimeout(DDTouch.pointerLeaveTimeout);
    delete DDTouch.pointerLeaveTimeout;
  }
  const wasDragging = !!DDManager.dragElement;
  simulateMouseEvent(e, "mouseup");
  if (!wasDragging) {
    simulateMouseEvent(e, "click");
  }
  DDTouch.touchHandled = false;
}
function pointerdown(e) {
  if (e.pointerType === "mouse")
    return;
  e.target.releasePointerCapture(e.pointerId);
}
function pointerenter(e) {
  if (!DDManager.dragElement) {
    return;
  }
  if (e.pointerType === "mouse")
    return;
  simulatePointerMouseEvent(e, "mouseenter");
}
function pointerleave(e) {
  if (!DDManager.dragElement) {
    return;
  }
  if (e.pointerType === "mouse")
    return;
  DDTouch.pointerLeaveTimeout = window.setTimeout(() => {
    delete DDTouch.pointerLeaveTimeout;
    simulatePointerMouseEvent(e, "mouseleave");
  }, 10);
}

// node_modules/gridstack/dist/dd-resizable-handle.js
var DDResizableHandle = class _DDResizableHandle {
  constructor(host, dir, option) {
    this.host = host;
    this.dir = dir;
    this.option = option;
    this.moving = false;
    this._mouseDown = this._mouseDown.bind(this);
    this._mouseMove = this._mouseMove.bind(this);
    this._mouseUp = this._mouseUp.bind(this);
    this._keyEvent = this._keyEvent.bind(this);
    this._init();
  }
  /** @internal */
  _init() {
    if (this.option.element) {
      try {
        this.el = this.option.element instanceof HTMLElement ? this.option.element : this.host.querySelector(this.option.element);
      } catch (error) {
        this.option.element = void 0;
        console.error("Query for resizeable handle failed, falling back", error);
      }
    }
    if (!this.el) {
      this.el = document.createElement("div");
      this.host.appendChild(this.el);
    }
    this.el.classList.add("ui-resizable-handle");
    this.el.classList.add(`${_DDResizableHandle.prefix}${this.dir}`);
    this.el.style.zIndex = "100";
    this.el.style.userSelect = "none";
    this.el.addEventListener("mousedown", this._mouseDown);
    if (isTouch) {
      this.el.addEventListener("touchstart", touchstart);
      this.el.addEventListener("pointerdown", pointerdown);
    }
    return this;
  }
  /** call this when resize handle needs to be removed and cleaned up */
  destroy() {
    if (this.moving)
      this._mouseUp(this.mouseDownEvent);
    this.el.removeEventListener("mousedown", this._mouseDown);
    if (isTouch) {
      this.el.removeEventListener("touchstart", touchstart);
      this.el.removeEventListener("pointerdown", pointerdown);
    }
    if (!this.option.element) {
      this.host.removeChild(this.el);
    }
    delete this.el;
    delete this.host;
    return this;
  }
  /** @internal called on mouse down on us: capture move on the entire document (mouse might not stay on us) until we release the mouse */
  _mouseDown(e) {
    this.mouseDownEvent = e;
    document.addEventListener("mousemove", this._mouseMove, { capture: true, passive: true });
    document.addEventListener("mouseup", this._mouseUp, true);
    if (isTouch) {
      this.el.addEventListener("touchmove", touchmove);
      this.el.addEventListener("touchend", touchend);
    }
    e.stopPropagation();
    e.preventDefault();
  }
  /** @internal */
  _mouseMove(e) {
    const s = this.mouseDownEvent;
    if (this.moving) {
      this._triggerEvent("move", e);
    } else if (Math.abs(e.x - s.x) + Math.abs(e.y - s.y) > 2) {
      this.moving = true;
      this._triggerEvent("start", this.mouseDownEvent);
      this._triggerEvent("move", e);
      document.addEventListener("keydown", this._keyEvent);
    }
    e.stopPropagation();
  }
  /** @internal */
  _mouseUp(e) {
    if (this.moving) {
      this._triggerEvent("stop", e);
      document.removeEventListener("keydown", this._keyEvent);
    }
    document.removeEventListener("mousemove", this._mouseMove, true);
    document.removeEventListener("mouseup", this._mouseUp, true);
    if (isTouch) {
      this.el.removeEventListener("touchmove", touchmove);
      this.el.removeEventListener("touchend", touchend);
    }
    delete this.moving;
    delete this.mouseDownEvent;
    e.stopPropagation();
    e.preventDefault();
  }
  /** @internal call when keys are being pressed - use Esc to cancel */
  _keyEvent(e) {
    if (e.key === "Escape") {
      this.host.gridstackNode?.grid?.engine.restoreInitial();
      this._mouseUp(this.mouseDownEvent);
    }
  }
  /** @internal */
  _triggerEvent(name, event) {
    if (this.option[name])
      this.option[name](event);
    return this;
  }
};
DDResizableHandle.prefix = "ui-resizable-";

// node_modules/gridstack/dist/dd-base-impl.js
var DDBaseImplement = class {
  constructor() {
    this._eventRegister = {};
  }
  /**
   * Returns the current disabled state.
   * Note: Use enable()/disable() methods to change state as other operations need to happen.
   */
  get disabled() {
    return this._disabled;
  }
  /**
   * Register an event callback for the specified event.
   *
   * @param event - Event name to listen for
   * @param callback - Function to call when event occurs
   */
  on(event, callback) {
    this._eventRegister[event] = callback;
  }
  /**
   * Unregister an event callback for the specified event.
   *
   * @param event - Event name to stop listening for
   */
  off(event) {
    delete this._eventRegister[event];
  }
  /**
   * Enable this drag & drop implementation.
   * Subclasses should override to perform additional setup.
   */
  enable() {
    this._disabled = false;
  }
  /**
   * Disable this drag & drop implementation.
   * Subclasses should override to perform additional cleanup.
   */
  disable() {
    this._disabled = true;
  }
  /**
   * Destroy this drag & drop implementation and clean up resources.
   * Removes all event handlers and clears internal state.
   */
  destroy() {
    delete this._eventRegister;
  }
  /**
   * Trigger a registered event callback if one exists and the implementation is enabled.
   *
   * @param eventName - Name of the event to trigger
   * @param event - DOM event object to pass to the callback
   * @returns Result from the callback function, if any
   */
  triggerEvent(eventName, event) {
    if (!this.disabled && this._eventRegister && this._eventRegister[eventName])
      return this._eventRegister[eventName](event);
  }
};

// node_modules/gridstack/dist/dd-resizable.js
var DDResizable = class _DDResizable extends DDBaseImplement {
  // have to be public else complains for HTMLElementExtendOpt ?
  constructor(el, option = {}) {
    super();
    this.el = el;
    this.option = option;
    this.rectScale = { x: 1, y: 1 };
    this._ui = () => {
      const containmentEl = this.el.parentElement;
      const containmentRect = containmentEl.getBoundingClientRect();
      const newRect = {
        width: this.originalRect.width,
        height: this.originalRect.height + this.scrolled,
        left: this.originalRect.left,
        top: this.originalRect.top - this.scrolled
      };
      const rect = this.temporalRect || newRect;
      return {
        position: {
          left: (rect.left - containmentRect.left) * this.rectScale.x,
          top: (rect.top - containmentRect.top) * this.rectScale.y
        },
        size: {
          width: rect.width * this.rectScale.x,
          height: rect.height * this.rectScale.y
        }
        /* Gridstack ONLY needs position set above... keep around in case.
        element: [this.el], // The object representing the element to be resized
        helper: [], // TODO: not support yet - The object representing the helper that's being resized
        originalElement: [this.el],// we don't wrap here, so simplify as this.el //The object representing the original element before it is wrapped
        originalPosition: { // The position represented as { left, top } before the resizable is resized
          left: this.originalRect.left - containmentRect.left,
          top: this.originalRect.top - containmentRect.top
        },
        originalSize: { // The size represented as { width, height } before the resizable is resized
          width: this.originalRect.width,
          height: this.originalRect.height
        }
        */
      };
    };
    this._mouseOver = this._mouseOver.bind(this);
    this._mouseOut = this._mouseOut.bind(this);
    this.enable();
    this._setupAutoHide(this.option.autoHide);
    this._setupHandlers();
  }
  on(event, callback) {
    super.on(event, callback);
  }
  off(event) {
    super.off(event);
  }
  enable() {
    super.enable();
    this.el.classList.remove("ui-resizable-disabled");
    this._setupAutoHide(this.option.autoHide);
  }
  disable() {
    super.disable();
    this.el.classList.add("ui-resizable-disabled");
    this._setupAutoHide(false);
  }
  destroy() {
    this._removeHandlers();
    this._setupAutoHide(false);
    delete this.el;
    super.destroy();
  }
  updateOption(opts) {
    const updateHandles = opts.handles && opts.handles !== this.option.handles;
    const updateAutoHide = opts.autoHide && opts.autoHide !== this.option.autoHide;
    Object.keys(opts).forEach((key) => this.option[key] = opts[key]);
    if (updateHandles) {
      this._removeHandlers();
      this._setupHandlers();
    }
    if (updateAutoHide) {
      this._setupAutoHide(this.option.autoHide);
    }
    return this;
  }
  /** @internal turns auto hide on/off */
  _setupAutoHide(auto) {
    if (auto) {
      this.el.classList.add("ui-resizable-autohide");
      this.el.addEventListener("mouseover", this._mouseOver);
      this.el.addEventListener("mouseout", this._mouseOut);
    } else {
      this.el.classList.remove("ui-resizable-autohide");
      this.el.removeEventListener("mouseover", this._mouseOver);
      this.el.removeEventListener("mouseout", this._mouseOut);
      if (DDManager.overResizeElement === this) {
        delete DDManager.overResizeElement;
      }
    }
    return this;
  }
  /** @internal */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _mouseOver(e) {
    if (DDManager.overResizeElement || DDManager.dragElement)
      return;
    DDManager.overResizeElement = this;
    this.el.classList.remove("ui-resizable-autohide");
  }
  /** @internal */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _mouseOut(e) {
    if (DDManager.overResizeElement !== this)
      return;
    delete DDManager.overResizeElement;
    this.el.classList.add("ui-resizable-autohide");
  }
  /** @internal */
  _setupHandlers() {
    this.handlers = this.option.handles.split(",").map((dir) => dir.trim()).map((dir) => new DDResizableHandle(this.el, dir, {
      element: this.option.element,
      start: (event) => this._resizeStart(event),
      stop: (event) => this._resizeStop(event),
      move: (event) => this._resizing(event, dir)
    }));
    return this;
  }
  /** @internal */
  _resizeStart(event) {
    this.sizeToContent = Utils.shouldSizeToContent(this.el.gridstackNode, true);
    this.originalRect = this.el.getBoundingClientRect();
    this.scrollEl = Utils.getScrollElement(this.el);
    this.scrollY = this.scrollEl.scrollTop;
    this.scrolled = 0;
    this.startEvent = event;
    this._setupHelper();
    this._applyChange();
    const ev = Utils.initEvent(event, { type: "resizestart", target: this.el });
    if (this.option.start) {
      this.option.start(ev, this._ui());
    }
    this.el.classList.add("ui-resizable-resizing");
    this.triggerEvent("resizestart", ev);
    return this;
  }
  /** @internal */
  _resizing(event, dir) {
    this.scrolled = this.scrollEl.scrollTop - this.scrollY;
    this.temporalRect = this._getChange(event, dir);
    this._applyChange();
    const ev = Utils.initEvent(event, { type: "resize", target: this.el });
    if (this.option.resize) {
      this.option.resize(ev, this._ui());
    }
    this.triggerEvent("resize", ev);
    return this;
  }
  /** @internal */
  _resizeStop(event) {
    const ev = Utils.initEvent(event, { type: "resizestop", target: this.el });
    this._cleanHelper();
    if (this.option.stop) {
      this.option.stop(ev);
    }
    this.el.classList.remove("ui-resizable-resizing");
    this.triggerEvent("resizestop", ev);
    delete this.startEvent;
    delete this.originalRect;
    delete this.temporalRect;
    delete this.scrollY;
    delete this.scrolled;
    return this;
  }
  /** @internal */
  _setupHelper() {
    this.elOriginStyleVal = _DDResizable._originStyleProp.map((prop) => this.el.style[prop]);
    this.parentOriginStylePosition = this.el.parentElement.style.position;
    const parent = this.el.parentElement;
    const dragTransform = Utils.getValuesFromTransformedElement(parent);
    this.rectScale = {
      x: dragTransform.xScale,
      y: dragTransform.yScale
    };
    if (getComputedStyle(this.el.parentElement).position.match(/static/)) {
      this.el.parentElement.style.position = "relative";
    }
    this.el.style.position = "absolute";
    this.el.style.opacity = "0.8";
    return this;
  }
  /** @internal */
  _cleanHelper() {
    _DDResizable._originStyleProp.forEach((prop, i) => {
      this.el.style[prop] = this.elOriginStyleVal[i] || null;
    });
    this.el.parentElement.style.position = this.parentOriginStylePosition || null;
    return this;
  }
  /** @internal */
  _getChange(event, dir) {
    const oEvent = this.startEvent;
    const newRect = {
      width: this.originalRect.width,
      height: this.originalRect.height + this.scrolled,
      left: this.originalRect.left,
      top: this.originalRect.top - this.scrolled
    };
    const offsetX = event.clientX - oEvent.clientX;
    const offsetY = this.sizeToContent ? 0 : event.clientY - oEvent.clientY;
    let moveLeft;
    let moveUp;
    if (dir.indexOf("e") > -1) {
      newRect.width += offsetX;
    } else if (dir.indexOf("w") > -1) {
      newRect.width -= offsetX;
      newRect.left += offsetX;
      moveLeft = true;
    }
    if (dir.indexOf("s") > -1) {
      newRect.height += offsetY;
    } else if (dir.indexOf("n") > -1) {
      newRect.height -= offsetY;
      newRect.top += offsetY;
      moveUp = true;
    }
    const constrain = this._constrainSize(newRect.width, newRect.height, moveLeft, moveUp);
    if (Math.round(newRect.width) !== Math.round(constrain.width)) {
      if (dir.indexOf("w") > -1) {
        newRect.left += newRect.width - constrain.width;
      }
      newRect.width = constrain.width;
    }
    if (Math.round(newRect.height) !== Math.round(constrain.height)) {
      if (dir.indexOf("n") > -1) {
        newRect.top += newRect.height - constrain.height;
      }
      newRect.height = constrain.height;
    }
    return newRect;
  }
  /** @internal constrain the size to the set min/max values */
  _constrainSize(oWidth, oHeight, moveLeft, moveUp) {
    const o = this.option;
    const maxWidth = (moveLeft ? o.maxWidthMoveLeft : o.maxWidth) || Number.MAX_SAFE_INTEGER;
    const minWidth = o.minWidth / this.rectScale.x || oWidth;
    const maxHeight = (moveUp ? o.maxHeightMoveUp : o.maxHeight) || Number.MAX_SAFE_INTEGER;
    const minHeight = o.minHeight / this.rectScale.y || oHeight;
    const width = Math.min(maxWidth, Math.max(minWidth, oWidth));
    const height = Math.min(maxHeight, Math.max(minHeight, oHeight));
    return { width, height };
  }
  /** @internal */
  _applyChange() {
    let containmentRect = { left: 0, top: 0, width: 0, height: 0 };
    if (this.el.style.position === "absolute") {
      const containmentEl = this.el.parentElement;
      const { left, top } = containmentEl.getBoundingClientRect();
      containmentRect = { left, top, width: 0, height: 0 };
    }
    if (!this.temporalRect)
      return this;
    Object.keys(this.temporalRect).forEach((key) => {
      const value = this.temporalRect[key];
      const scaleReciprocal = key === "width" || key === "left" ? this.rectScale.x : key === "height" || key === "top" ? this.rectScale.y : 1;
      this.el.style[key] = (value - containmentRect[key]) * scaleReciprocal + "px";
    });
    return this;
  }
  /** @internal */
  _removeHandlers() {
    this.handlers.forEach((handle) => handle.destroy());
    delete this.handlers;
    return this;
  }
};
DDResizable._originStyleProp = ["width", "height", "position", "left", "top", "opacity", "zIndex"];

// node_modules/gridstack/dist/dd-draggable.js
var skipMouseDown = 'input,textarea,button,select,option,[contenteditable="true"],.ui-resizable-handle';
var DDDraggable = class _DDDraggable extends DDBaseImplement {
  constructor(el, option = {}) {
    super();
    this.el = el;
    this.option = option;
    this.dragTransform = {
      xScale: 1,
      yScale: 1,
      xOffset: 0,
      yOffset: 0
    };
    const handleName = option?.handle?.substring(1);
    const n = el.gridstackNode;
    this.dragEls = !handleName || el.classList.contains(handleName) ? [el] : n?.subGrid ? [el.querySelector(option.handle) || el] : Array.from(el.querySelectorAll(option.handle));
    if (this.dragEls.length === 0) {
      this.dragEls = [el];
    }
    this._mouseDown = this._mouseDown.bind(this);
    this._mouseMove = this._mouseMove.bind(this);
    this._mouseUp = this._mouseUp.bind(this);
    this._keyEvent = this._keyEvent.bind(this);
    this.enable();
  }
  on(event, callback) {
    super.on(event, callback);
  }
  off(event) {
    super.off(event);
  }
  enable() {
    if (this.disabled === false)
      return;
    super.enable();
    this.dragEls.forEach((dragEl) => {
      dragEl.addEventListener("mousedown", this._mouseDown);
      if (isTouch) {
        dragEl.addEventListener("touchstart", touchstart);
        dragEl.addEventListener("pointerdown", pointerdown);
      }
    });
    this.el.classList.remove("ui-draggable-disabled");
  }
  disable(forDestroy = false) {
    if (this.disabled === true)
      return;
    super.disable();
    this.dragEls.forEach((dragEl) => {
      dragEl.removeEventListener("mousedown", this._mouseDown);
      if (isTouch) {
        dragEl.removeEventListener("touchstart", touchstart);
        dragEl.removeEventListener("pointerdown", pointerdown);
      }
    });
    if (!forDestroy)
      this.el.classList.add("ui-draggable-disabled");
  }
  destroy() {
    if (this.dragTimeout)
      window.clearTimeout(this.dragTimeout);
    delete this.dragTimeout;
    if (this.mouseDownEvent)
      this._mouseUp(this.mouseDownEvent);
    this.disable(true);
    delete this.el;
    delete this.helper;
    delete this.option;
    super.destroy();
  }
  updateOption(opts) {
    Object.keys(opts).forEach((key) => this.option[key] = opts[key]);
    return this;
  }
  /** @internal call when mouse goes down before a dragstart happens */
  _mouseDown(e) {
    if (DDTouch.touchHandled && e.isTrusted)
      DDTouch.touchHandled = false;
    if (DDManager.mouseHandled)
      return;
    if (e.button !== 0)
      return true;
    if (!this.dragEls.find((el) => el === e.target) && e.target.closest(skipMouseDown))
      return true;
    if (this.option.cancel) {
      if (e.target.closest(this.option.cancel))
        return true;
    }
    this.mouseDownEvent = e;
    delete this.dragging;
    delete DDManager.dragElement;
    delete DDManager.dropElement;
    document.addEventListener("mousemove", this._mouseMove, { capture: true, passive: true });
    document.addEventListener("mouseup", this._mouseUp, true);
    if (isTouch) {
      e.currentTarget.addEventListener("touchmove", touchmove);
      e.currentTarget.addEventListener("touchend", touchend);
    }
    e.preventDefault();
    if (document.activeElement)
      document.activeElement.blur();
    DDManager.mouseHandled = true;
    return true;
  }
  /** @internal method to call actual drag event */
  _callDrag(e) {
    if (!this.dragging)
      return;
    const ev = Utils.initEvent(e, { target: this.el, type: "drag" });
    if (this.option.drag) {
      this.option.drag(ev, this.ui());
    }
    this.triggerEvent("drag", ev);
  }
  /** @internal called when the main page (after successful mousedown) receives a move event to drag the item around the screen */
  _mouseMove(e) {
    const s = this.mouseDownEvent;
    this.lastDrag = e;
    if (this.dragging) {
      this._dragFollow(e);
      if (DDManager.pauseDrag) {
        const pause = Number.isInteger(DDManager.pauseDrag) ? DDManager.pauseDrag : 100;
        if (this.dragTimeout)
          window.clearTimeout(this.dragTimeout);
        this.dragTimeout = window.setTimeout(() => this._callDrag(e), pause);
      } else {
        this._callDrag(e);
      }
    } else if (Math.abs(e.x - s.x) + Math.abs(e.y - s.y) > 3) {
      this.dragging = true;
      DDManager.dragElement = this;
      const grid = this.el.gridstackNode?.grid;
      if (grid) {
        DDManager.dropElement = grid.el.ddElement.ddDroppable;
      } else {
        delete DDManager.dropElement;
      }
      this.helper = this._createHelper();
      this._setupHelperContainmentStyle();
      this.dragTransform = Utils.getValuesFromTransformedElement(this.helperContainment);
      this.dragOffset = this._getDragOffset(e, this.el, this.helperContainment);
      this._setupHelperStyle(e);
      const ev = Utils.initEvent(e, { target: this.el, type: "dragstart" });
      if (this.option.start) {
        this.option.start(ev, this.ui());
      }
      this.triggerEvent("dragstart", ev);
      document.addEventListener("keydown", this._keyEvent);
    }
    return true;
  }
  /** @internal call when the mouse gets released to drop the item at current location */
  _mouseUp(e) {
    document.removeEventListener("mousemove", this._mouseMove, true);
    document.removeEventListener("mouseup", this._mouseUp, true);
    if (isTouch && e.currentTarget) {
      e.currentTarget.removeEventListener("touchmove", touchmove, true);
      e.currentTarget.removeEventListener("touchend", touchend, true);
    }
    if (this.dragging) {
      delete this.dragging;
      delete this.el.gridstackNode?._origRotate;
      document.removeEventListener("keydown", this._keyEvent);
      if (DDManager.dropElement?.el === this.el.parentElement) {
        delete DDManager.dropElement;
      }
      this.helperContainment.style.position = this.parentOriginStylePosition || null;
      if (this.helper !== this.el)
        this.helper.remove();
      this._removeHelperStyle();
      const ev = Utils.initEvent(e, { target: this.el, type: "dragstop" });
      if (this.option.stop) {
        this.option.stop(ev);
      }
      this.triggerEvent("dragstop", ev);
      if (DDManager.dropElement) {
        DDManager.dropElement.drop(e);
      }
    }
    delete this.helper;
    delete this.mouseDownEvent;
    delete DDManager.dragElement;
    delete DDManager.dropElement;
    delete DDManager.mouseHandled;
    e.preventDefault();
  }
  /** @internal call when keys are being pressed - use Esc to cancel, R to rotate */
  _keyEvent(e) {
    const n = this.el.gridstackNode;
    const grid = n?.grid || DDManager.dropElement?.el?.gridstack;
    if (e.key === "Escape") {
      if (n && n._origRotate) {
        n._orig = n._origRotate;
        delete n._origRotate;
      }
      grid?.cancelDrag();
      this._mouseUp(this.mouseDownEvent);
    } else if (n && grid && (e.key === "r" || e.key === "R")) {
      if (!Utils.canBeRotated(n))
        return;
      n._origRotate = n._origRotate || { ...n._orig };
      delete n._moving;
      grid.setAnimation(false).rotate(n.el, { top: -this.dragOffset.offsetTop, left: -this.dragOffset.offsetLeft }).setAnimation();
      n._moving = true;
      this.dragOffset = this._getDragOffset(this.lastDrag, n.el, this.helperContainment);
      this.helper.style.width = this.dragOffset.width + "px";
      this.helper.style.height = this.dragOffset.height + "px";
      Utils.swap(n._orig, "w", "h");
      delete n._rect;
      this._mouseMove(this.lastDrag);
    }
  }
  /** @internal create a clone copy (or user defined method) of the original drag item if set */
  _createHelper() {
    let helper = this.el;
    if (typeof this.option.helper === "function") {
      helper = this.option.helper(this.el);
    } else if (this.option.helper === "clone") {
      helper = Utils.cloneNode(this.el);
    }
    if (!helper.parentElement) {
      Utils.appendTo(helper, this.option.appendTo === "parent" ? this.el.parentElement : this.option.appendTo);
    }
    this.dragElementOriginStyle = _DDDraggable.originStyleProp.map((prop) => this.el.style[prop]);
    return helper;
  }
  /** @internal set the fix position of the dragged item */
  _setupHelperStyle(e) {
    this.helper.classList.add("ui-draggable-dragging");
    this.el.gridstackNode?.grid?.el.classList.add("grid-stack-dragging");
    const style = this.helper.style;
    style.pointerEvents = "none";
    style.width = this.dragOffset.width + "px";
    style.height = this.dragOffset.height + "px";
    style.willChange = "left, top";
    style.position = "fixed";
    this._dragFollow(e);
    style.transition = "none";
    setTimeout(() => {
      if (this.helper) {
        style.transition = null;
      }
    }, 0);
    return this;
  }
  /** @internal restore back the original style before dragging */
  _removeHelperStyle() {
    this.helper.classList.remove("ui-draggable-dragging");
    this.el.gridstackNode?.grid?.el.classList.remove("grid-stack-dragging");
    const node = this.helper?.gridstackNode;
    if (!node?._isAboutToRemove && this.dragElementOriginStyle) {
      const helper = this.helper;
      const transition = this.dragElementOriginStyle["transition"] || null;
      helper.style.transition = this.dragElementOriginStyle["transition"] = "none";
      _DDDraggable.originStyleProp.forEach((prop) => helper.style[prop] = this.dragElementOriginStyle[prop] || null);
      setTimeout(() => helper.style.transition = transition, 50);
    }
    delete this.dragElementOriginStyle;
    return this;
  }
  /** @internal updates the top/left position to follow the mouse */
  _dragFollow(e) {
    const containmentRect = { left: 0, top: 0 };
    const style = this.helper.style;
    const offset = this.dragOffset;
    style.left = (e.clientX + offset.offsetLeft - containmentRect.left) * this.dragTransform.xScale + "px";
    style.top = (e.clientY + offset.offsetTop - containmentRect.top) * this.dragTransform.yScale + "px";
  }
  /** @internal */
  _setupHelperContainmentStyle() {
    this.helperContainment = this.helper.parentElement;
    if (this.helper.style.position !== "fixed") {
      this.parentOriginStylePosition = this.helperContainment.style.position;
      if (getComputedStyle(this.helperContainment).position.match(/static/)) {
        this.helperContainment.style.position = "relative";
      }
    }
    return this;
  }
  /** @internal */
  _getDragOffset(event, el, parent) {
    let xformOffsetX = 0;
    let xformOffsetY = 0;
    if (parent) {
      xformOffsetX = this.dragTransform.xOffset;
      xformOffsetY = this.dragTransform.yOffset;
    }
    const targetOffset = el.getBoundingClientRect();
    return {
      left: targetOffset.left,
      top: targetOffset.top,
      offsetLeft: -event.clientX + targetOffset.left - xformOffsetX,
      offsetTop: -event.clientY + targetOffset.top - xformOffsetY,
      width: targetOffset.width * this.dragTransform.xScale,
      height: targetOffset.height * this.dragTransform.yScale
    };
  }
  /** @internal TODO: set to public as called by DDDroppable! */
  ui() {
    const containmentEl = this.el.parentElement;
    const containmentRect = containmentEl.getBoundingClientRect();
    const offset = this.helper.getBoundingClientRect();
    return {
      position: {
        top: (offset.top - containmentRect.top) * this.dragTransform.yScale,
        left: (offset.left - containmentRect.left) * this.dragTransform.xScale
      }
      /* not used by GridStack for now...
      helper: [this.helper], //The object arr representing the helper that's being dragged.
      offset: { top: offset.top, left: offset.left } // Current offset position of the helper as { top, left } object.
      */
    };
  }
};
DDDraggable.originStyleProp = ["width", "height", "transform", "transform-origin", "transition", "pointerEvents", "position", "left", "top", "minWidth", "willChange"];

// node_modules/gridstack/dist/dd-droppable.js
var DDDroppable = class extends DDBaseImplement {
  constructor(el, option = {}) {
    super();
    this.el = el;
    this.option = option;
    this._mouseEnter = this._mouseEnter.bind(this);
    this._mouseLeave = this._mouseLeave.bind(this);
    this.enable();
    this._setupAccept();
  }
  on(event, callback) {
    super.on(event, callback);
  }
  off(event) {
    super.off(event);
  }
  enable() {
    if (this.disabled === false)
      return;
    super.enable();
    this.el.classList.add("ui-droppable");
    this.el.classList.remove("ui-droppable-disabled");
    this.el.addEventListener("mouseenter", this._mouseEnter);
    this.el.addEventListener("mouseleave", this._mouseLeave);
    if (isTouch) {
      this.el.addEventListener("pointerenter", pointerenter);
      this.el.addEventListener("pointerleave", pointerleave);
    }
  }
  disable(forDestroy = false) {
    if (this.disabled === true)
      return;
    super.disable();
    this.el.classList.remove("ui-droppable");
    if (!forDestroy)
      this.el.classList.add("ui-droppable-disabled");
    this.el.removeEventListener("mouseenter", this._mouseEnter);
    this.el.removeEventListener("mouseleave", this._mouseLeave);
    if (isTouch) {
      this.el.removeEventListener("pointerenter", pointerenter);
      this.el.removeEventListener("pointerleave", pointerleave);
    }
  }
  destroy() {
    this.disable(true);
    this.el.classList.remove("ui-droppable");
    this.el.classList.remove("ui-droppable-disabled");
    super.destroy();
  }
  updateOption(opts) {
    Object.keys(opts).forEach((key) => this.option[key] = opts[key]);
    this._setupAccept();
    return this;
  }
  /** @internal called when the cursor enters our area - prepare for a possible drop and track leaving */
  _mouseEnter(e) {
    if (!DDManager.dragElement)
      return;
    if (DDTouch.touchHandled && e.isTrusted)
      return;
    if (!this._canDrop(DDManager.dragElement.el))
      return;
    e.preventDefault();
    e.stopPropagation();
    if (DDManager.dropElement && DDManager.dropElement !== this) {
      DDManager.dropElement._mouseLeave(e, true);
    }
    DDManager.dropElement = this;
    const ev = Utils.initEvent(e, { target: this.el, type: "dropover" });
    if (this.option.over) {
      this.option.over(ev, this._ui(DDManager.dragElement));
    }
    this.triggerEvent("dropover", ev);
    this.el.classList.add("ui-droppable-over");
  }
  /** @internal called when the item is leaving our area, stop tracking if we had moving item */
  _mouseLeave(e, calledByEnter = false) {
    if (!DDManager.dragElement || DDManager.dropElement !== this)
      return;
    e.preventDefault();
    e.stopPropagation();
    const ev = Utils.initEvent(e, { target: this.el, type: "dropout" });
    if (this.option.out) {
      this.option.out(ev, this._ui(DDManager.dragElement));
    }
    this.triggerEvent("dropout", ev);
    if (DDManager.dropElement === this) {
      delete DDManager.dropElement;
      if (!calledByEnter) {
        let parentDrop;
        let parent = this.el.parentElement;
        while (!parentDrop && parent) {
          parentDrop = parent.ddElement?.ddDroppable;
          parent = parent.parentElement;
        }
        if (parentDrop) {
          parentDrop._mouseEnter(e);
        }
      }
    }
  }
  /** item is being dropped on us - called by the drag mouseup handler - this calls the client drop event */
  drop(e) {
    e.preventDefault();
    const ev = Utils.initEvent(e, { target: this.el, type: "drop" });
    if (this.option.drop) {
      this.option.drop(ev, this._ui(DDManager.dragElement));
    }
    this.triggerEvent("drop", ev);
  }
  /** @internal true if element matches the string/method accept option */
  _canDrop(el) {
    return el && (!this.accept || this.accept(el));
  }
  /** @internal */
  _setupAccept() {
    if (!this.option.accept)
      return this;
    if (typeof this.option.accept === "string") {
      this.accept = (el) => el.classList.contains(this.option.accept) || el.matches(this.option.accept);
    } else {
      this.accept = this.option.accept;
    }
    return this;
  }
  /** @internal */
  _ui(drag) {
    return {
      draggable: drag.el,
      ...drag.ui()
    };
  }
};

// node_modules/gridstack/dist/dd-element.js
var DDElement = class _DDElement {
  static init(el) {
    if (!el.ddElement) {
      el.ddElement = new _DDElement(el);
    }
    return el.ddElement;
  }
  constructor(el) {
    this.el = el;
  }
  on(eventName, callback) {
    if (this.ddDraggable && ["drag", "dragstart", "dragstop"].indexOf(eventName) > -1) {
      this.ddDraggable.on(eventName, callback);
    } else if (this.ddDroppable && ["drop", "dropover", "dropout"].indexOf(eventName) > -1) {
      this.ddDroppable.on(eventName, callback);
    } else if (this.ddResizable && ["resizestart", "resize", "resizestop"].indexOf(eventName) > -1) {
      this.ddResizable.on(eventName, callback);
    }
    return this;
  }
  off(eventName) {
    if (this.ddDraggable && ["drag", "dragstart", "dragstop"].indexOf(eventName) > -1) {
      this.ddDraggable.off(eventName);
    } else if (this.ddDroppable && ["drop", "dropover", "dropout"].indexOf(eventName) > -1) {
      this.ddDroppable.off(eventName);
    } else if (this.ddResizable && ["resizestart", "resize", "resizestop"].indexOf(eventName) > -1) {
      this.ddResizable.off(eventName);
    }
    return this;
  }
  setupDraggable(opts) {
    if (!this.ddDraggable) {
      this.ddDraggable = new DDDraggable(this.el, opts);
    } else {
      this.ddDraggable.updateOption(opts);
    }
    return this;
  }
  cleanDraggable() {
    if (this.ddDraggable) {
      this.ddDraggable.destroy();
      delete this.ddDraggable;
    }
    return this;
  }
  setupResizable(opts) {
    if (!this.ddResizable) {
      this.ddResizable = new DDResizable(this.el, opts);
    } else {
      this.ddResizable.updateOption(opts);
    }
    return this;
  }
  cleanResizable() {
    if (this.ddResizable) {
      this.ddResizable.destroy();
      delete this.ddResizable;
    }
    return this;
  }
  setupDroppable(opts) {
    if (!this.ddDroppable) {
      this.ddDroppable = new DDDroppable(this.el, opts);
    } else {
      this.ddDroppable.updateOption(opts);
    }
    return this;
  }
  cleanDroppable() {
    if (this.ddDroppable) {
      this.ddDroppable.destroy();
      delete this.ddDroppable;
    }
    return this;
  }
};

// node_modules/gridstack/dist/dd-gridstack.js
var DDGridStack = class {
  /**
   * Enable/disable/configure resizing for grid elements.
   *
   * @param el - Grid item element(s) to configure
   * @param opts - Resize options or command ('enable', 'disable', 'destroy', 'option', or config object)
   * @param key - Option key when using 'option' command
   * @param value - Option value when using 'option' command
   * @returns this instance for chaining
   *
   * @example
   * dd.resizable(element, 'enable');  // Enable resizing
   * dd.resizable(element, 'option', 'minWidth', 100);  // Set minimum width
   */
  resizable(el, opts, key, value) {
    this._getDDElements(el, opts).forEach((dEl) => {
      if (opts === "disable" || opts === "enable") {
        dEl.ddResizable && dEl.ddResizable[opts]();
      } else if (opts === "destroy") {
        dEl.ddResizable && dEl.cleanResizable();
      } else if (opts === "option") {
        dEl.setupResizable({ [key]: value });
      } else {
        const n = dEl.el.gridstackNode;
        const grid = n.grid;
        let handles = dEl.el.getAttribute("gs-resize-handles") || grid.opts.resizable.handles || "e,s,se";
        if (handles === "all")
          handles = "n,e,s,w,se,sw,ne,nw";
        const autoHide = !grid.opts.alwaysShowResizeHandle;
        dEl.setupResizable({
          ...grid.opts.resizable,
          ...{ handles, autoHide },
          ...{
            start: opts.start,
            stop: opts.stop,
            resize: opts.resize
          }
        });
      }
    });
    return this;
  }
  /**
   * Enable/disable/configure dragging for grid elements.
   *
   * @param el - Grid item element(s) to configure
   * @param opts - Drag options or command ('enable', 'disable', 'destroy', 'option', or config object)
   * @param key - Option key when using 'option' command
   * @param value - Option value when using 'option' command
   * @returns this instance for chaining
   *
   * @example
   * dd.draggable(element, 'enable');  // Enable dragging
   * dd.draggable(element, {handle: '.drag-handle'});  // Configure drag handle
   */
  draggable(el, opts, key, value) {
    this._getDDElements(el, opts).forEach((dEl) => {
      if (opts === "disable" || opts === "enable") {
        dEl.ddDraggable && dEl.ddDraggable[opts]();
      } else if (opts === "destroy") {
        dEl.ddDraggable && dEl.cleanDraggable();
      } else if (opts === "option") {
        dEl.setupDraggable({ [key]: value });
      } else {
        const grid = dEl.el.gridstackNode.grid;
        dEl.setupDraggable({
          ...grid.opts.draggable,
          ...{
            // containment: (grid.parentGridNode && grid.opts.dragOut === false) ? grid.el.parentElement : (grid.opts.draggable.containment || null),
            start: opts.start,
            stop: opts.stop,
            drag: opts.drag
          }
        });
      }
    });
    return this;
  }
  dragIn(el, opts) {
    this._getDDElements(el).forEach((dEl) => dEl.setupDraggable(opts));
    return this;
  }
  droppable(el, opts, key, value) {
    if (typeof opts.accept === "function" && !opts._accept) {
      opts._accept = opts.accept;
      opts.accept = (el2) => opts._accept(el2);
    }
    this._getDDElements(el, opts).forEach((dEl) => {
      if (opts === "disable" || opts === "enable") {
        dEl.ddDroppable && dEl.ddDroppable[opts]();
      } else if (opts === "destroy") {
        dEl.ddDroppable && dEl.cleanDroppable();
      } else if (opts === "option") {
        dEl.setupDroppable({ [key]: value });
      } else {
        dEl.setupDroppable(opts);
      }
    });
    return this;
  }
  /** true if element is droppable */
  isDroppable(el) {
    return !!(el?.ddElement?.ddDroppable && !el.ddElement.ddDroppable.disabled);
  }
  /** true if element is draggable */
  isDraggable(el) {
    return !!(el?.ddElement?.ddDraggable && !el.ddElement.ddDraggable.disabled);
  }
  /** true if element is draggable */
  isResizable(el) {
    return !!(el?.ddElement?.ddResizable && !el.ddElement.ddResizable.disabled);
  }
  on(el, name, callback) {
    this._getDDElements(el).forEach((dEl) => dEl.on(name, (event) => {
      callback(event, DDManager.dragElement ? DDManager.dragElement.el : event.target, DDManager.dragElement ? DDManager.dragElement.helper : null);
    }));
    return this;
  }
  off(el, name) {
    this._getDDElements(el).forEach((dEl) => dEl.off(name));
    return this;
  }
  /** @internal returns a list of DD elements, creating them on the fly by default unless option is to destroy or disable */
  _getDDElements(els, opts) {
    const create = els.gridstack || opts !== "destroy" && opts !== "disable";
    const hosts = Utils.getElements(els);
    if (!hosts.length)
      return [];
    const list = hosts.map((e) => e.ddElement || (create ? DDElement.init(e) : null)).filter((d) => d);
    return list;
  }
};

// node_modules/gridstack/dist/gridstack.js
var dd = new DDGridStack();
var GridStack = class _GridStack {
  /**
   * initializing the HTML element, or selector string, into a grid will return the grid. Calling it again will
   * simply return the existing instance (ignore any passed options). There is also an initAll() version that support
   * multiple grids initialization at once. Or you can use addGrid() to create the entire grid from JSON.
   * @param options grid options (optional)
   * @param elOrString element or CSS selector (first one used) to convert to a grid (default to '.grid-stack' class selector)
   *
   * @example
   * const grid = GridStack.init();
   *
   * Note: the HTMLElement (of type GridHTMLElement) will store a `gridstack: GridStack` value that can be retrieve later
   * const grid = document.querySelector('.grid-stack').gridstack;
   */
  static init(options = {}, elOrString = ".grid-stack") {
    if (typeof document === "undefined")
      return null;
    const el = _GridStack.getGridElement(elOrString);
    if (!el) {
      if (typeof elOrString === "string") {
        console.error('GridStack.initAll() no grid was found with selector "' + elOrString + '" - element missing or wrong selector ?\nNote: ".grid-stack" is required for proper CSS styling and drag/drop, and is the default selector.');
      } else {
        console.error("GridStack.init() no grid element was passed.");
      }
      return null;
    }
    if (!el.gridstack) {
      el.gridstack = new _GridStack(el, Utils.cloneDeep(options));
    }
    return el.gridstack;
  }
  /**
   * Will initialize a list of elements (given a selector) and return an array of grids.
   * @param options grid options (optional)
   * @param selector elements selector to convert to grids (default to '.grid-stack' class selector)
   *
   * @example
   * const grids = GridStack.initAll();
   * grids.forEach(...)
   */
  static initAll(options = {}, selector = ".grid-stack") {
    const grids = [];
    if (typeof document === "undefined")
      return grids;
    _GridStack.getGridElements(selector).forEach((el) => {
      if (!el.gridstack) {
        el.gridstack = new _GridStack(el, Utils.cloneDeep(options));
      }
      grids.push(el.gridstack);
    });
    if (grids.length === 0) {
      console.error('GridStack.initAll() no grid was found with selector "' + selector + '" - element missing or wrong selector ?\nNote: ".grid-stack" is required for proper CSS styling and drag/drop, and is the default selector.');
    }
    return grids;
  }
  /**
   * call to create a grid with the given options, including loading any children from JSON structure. This will call GridStack.init(), then
   * grid.load() on any passed children (recursively). Great alternative to calling init() if you want entire grid to come from
   * JSON serialized data, including options.
   * @param parent HTML element parent to the grid
   * @param opt grids options used to initialize the grid, and list of children
   */
  static addGrid(parent, opt = {}) {
    if (!parent)
      return null;
    let el = parent;
    if (el.gridstack) {
      const grid2 = el.gridstack;
      if (opt)
        grid2.opts = { ...grid2.opts, ...opt };
      if (opt.children !== void 0)
        grid2.load(opt.children);
      return grid2;
    }
    const parentIsGrid = parent.classList.contains("grid-stack");
    if (!parentIsGrid || _GridStack.addRemoveCB) {
      if (_GridStack.addRemoveCB) {
        el = _GridStack.addRemoveCB(parent, opt, true, true);
      } else {
        el = Utils.createDiv(["grid-stack", opt.class], parent);
      }
    }
    const grid = _GridStack.init(opt, el);
    return grid;
  }
  /** call this method to register your engine instead of the default one.
   * See instead `GridStackOptions.engineClass` if you only need to
   * replace just one instance.
   */
  static registerEngine(engineClass) {
    _GridStack.engineClass = engineClass;
  }
  /**
   * @internal create placeholder DIV as needed
   * @returns the placeholder element for indicating drop zones during drag operations
   */
  get placeholder() {
    if (!this._placeholder) {
      this._placeholder = Utils.createDiv([this.opts.placeholderClass, gridDefaults.itemClass, this.opts.itemClass]);
      const placeholderChild = Utils.createDiv(["placeholder-content"], this._placeholder);
      if (this.opts.placeholderText) {
        placeholderChild.textContent = this.opts.placeholderText;
      }
    }
    return this._placeholder;
  }
  /**
   * Construct a grid item from the given element and options
   * @param el the HTML element tied to this grid after it's been initialized
   * @param opts grid options - public for classes to access, but use methods to modify!
   */
  constructor(el, opts = {}) {
    this.el = el;
    this.opts = opts;
    this.animationDelay = 300 + 10;
    this._gsEventHandler = {};
    this._extraDragRow = 0;
    this.dragTransform = { xScale: 1, yScale: 1, xOffset: 0, yOffset: 0 };
    el.gridstack = this;
    this.opts = opts = opts || {};
    if (!el.classList.contains("grid-stack")) {
      this.el.classList.add("grid-stack");
    }
    if (opts.row) {
      opts.minRow = opts.maxRow = opts.row;
      delete opts.row;
    }
    const rowAttr = Utils.toNumber(el.getAttribute("gs-row"));
    if (opts.column === "auto") {
      delete opts.column;
    }
    if (opts.alwaysShowResizeHandle !== void 0) {
      opts._alwaysShowResizeHandle = opts.alwaysShowResizeHandle;
    }
    const resp = opts.columnOpts;
    if (resp) {
      const bk = resp.breakpoints;
      if (!resp.columnWidth && !bk?.length) {
        delete opts.columnOpts;
      } else {
        resp.columnMax = resp.columnMax || 12;
        if (bk?.length > 1)
          bk.sort((a, b) => (b.w || 0) - (a.w || 0));
      }
    }
    const defaults = {
      ...Utils.cloneDeep(gridDefaults),
      column: Utils.toNumber(el.getAttribute("gs-column")) || gridDefaults.column,
      minRow: rowAttr ? rowAttr : Utils.toNumber(el.getAttribute("gs-min-row")) || gridDefaults.minRow,
      maxRow: rowAttr ? rowAttr : Utils.toNumber(el.getAttribute("gs-max-row")) || gridDefaults.maxRow,
      staticGrid: Utils.toBool(el.getAttribute("gs-static")) || gridDefaults.staticGrid,
      sizeToContent: Utils.toBool(el.getAttribute("gs-size-to-content")) || void 0,
      draggable: {
        handle: (opts.handleClass ? "." + opts.handleClass : opts.handle ? opts.handle : "") || gridDefaults.draggable.handle
      },
      removableOptions: {
        accept: opts.itemClass || gridDefaults.removableOptions.accept,
        decline: gridDefaults.removableOptions.decline
      }
    };
    if (el.getAttribute("gs-animate")) {
      defaults.animate = Utils.toBool(el.getAttribute("gs-animate"));
    }
    opts = Utils.defaults(opts, defaults);
    this._initMargin();
    this.checkDynamicColumn();
    this._updateColumnVar(opts);
    if (opts.rtl === "auto") {
      opts.rtl = el.style.direction === "rtl";
    }
    if (opts.rtl) {
      this.el.classList.add("grid-stack-rtl");
    }
    const parentGridItem = this.el.closest("." + gridDefaults.itemClass);
    const parentNode = parentGridItem?.gridstackNode;
    if (parentNode) {
      parentNode.subGrid = this;
      this.parentGridNode = parentNode;
      this.el.classList.add("grid-stack-nested");
      parentNode.el.classList.add("grid-stack-sub-grid");
    }
    this._isAutoCellHeight = opts.cellHeight === "auto";
    if (this._isAutoCellHeight || opts.cellHeight === "initial") {
      this.cellHeight(void 0);
    } else {
      if (typeof opts.cellHeight == "number" && opts.cellHeightUnit && opts.cellHeightUnit !== gridDefaults.cellHeightUnit) {
        opts.cellHeight = opts.cellHeight + opts.cellHeightUnit;
        delete opts.cellHeightUnit;
      }
      const val = opts.cellHeight;
      delete opts.cellHeight;
      this.cellHeight(val);
    }
    if (opts.alwaysShowResizeHandle === "mobile") {
      opts.alwaysShowResizeHandle = isTouch;
    }
    this._setStaticClass();
    const engineClass = opts.engineClass || _GridStack.engineClass || GridStackEngine;
    this.engine = new engineClass({
      column: this.getColumn(),
      float: opts.float,
      maxRow: opts.maxRow,
      onChange: (cbNodes) => {
        cbNodes.forEach((n) => {
          const el2 = n.el;
          if (!el2)
            return;
          if (n._removeDOM) {
            if (el2)
              el2.remove();
            delete n._removeDOM;
          } else {
            this._writePosAttr(el2, n);
          }
        });
        this._updateContainerHeight();
      }
    });
    if (opts.auto) {
      this.batchUpdate();
      this.engine._loading = true;
      this.getGridItems().forEach((el2) => this._prepareElement(el2));
      delete this.engine._loading;
      this.batchUpdate(false);
    }
    if (opts.children) {
      const children = opts.children;
      delete opts.children;
      if (children.length)
        this.load(children);
    }
    this.setAnimation();
    if (opts.subGridDynamic && !DDManager.pauseDrag)
      DDManager.pauseDrag = true;
    if (opts.draggable?.pause !== void 0)
      DDManager.pauseDrag = opts.draggable.pause;
    this._setupRemoveDrop();
    this._setupAcceptWidget();
    this._updateResizeEvent();
  }
  _updateColumnVar(opts = this.opts) {
    this.el.classList.add("gs-" + opts.column);
    if (typeof opts.column === "number")
      this.el.style.setProperty("--gs-column-width", `${100 / opts.column}%`);
  }
  /**
   * add a new widget and returns it.
   *
   * Widget will be always placed even if result height is more than actual grid height.
   * You need to use `willItFit()` before calling addWidget for additional check.
   * See also `makeWidget(el)` for DOM element.
   *
   * @example
   * const grid = GridStack.init();
   * grid.addWidget({w: 3, content: 'hello'});
   *
   * @param w GridStackWidget definition. used MakeWidget(el) if you have dom element instead.
   */
  addWidget(w) {
    if (!w)
      return;
    if (typeof w === "string") {
      console.error("V11: GridStack.addWidget() does not support string anymore. see #2736");
      return;
    }
    if (w.ELEMENT_NODE) {
      console.error("V11: GridStack.addWidget() does not support HTMLElement anymore. use makeWidget()");
      return this.makeWidget(w);
    }
    let el;
    let node = w;
    node.grid = this;
    if (node.el) {
      el = node.el;
    } else if (_GridStack.addRemoveCB) {
      el = _GridStack.addRemoveCB(this.el, w, true, false);
    } else {
      el = this.createWidgetDivs(node);
    }
    if (!el)
      return;
    node = el.gridstackNode;
    if (node && el.parentElement === this.el && this.engine.nodes.find((n) => n._id === node._id))
      return el;
    const domAttr = this._readAttr(el);
    Utils.defaults(w, domAttr);
    this.engine.prepareNode(w);
    this.el.appendChild(el);
    this.makeWidget(el, w);
    return el;
  }
  /**
   * Create the default grid item divs and content (possibly lazy loaded) by using GridStack.renderCB().
   *
   * @param n GridStackNode definition containing widget configuration
   * @returns the created HTML element with proper grid item structure
   *
   * @example
   * const element = grid.createWidgetDivs({ w: 2, h: 1, content: 'Hello World' });
   */
  createWidgetDivs(n) {
    const el = Utils.createDiv(["grid-stack-item", this.opts.itemClass]);
    const cont = Utils.createDiv(["grid-stack-item-content"], el);
    if (Utils.lazyLoad(n)) {
      if (!n.visibleObservable) {
        n.visibleObservable = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) {
            n.visibleObservable?.disconnect();
            delete n.visibleObservable;
            _GridStack.renderCB(cont, n);
            n.grid?.prepareDragDrop(n.el);
          }
        });
        window.setTimeout(() => n.visibleObservable?.observe(el));
      }
    } else
      _GridStack.renderCB(cont, n);
    return el;
  }
  /**
   * Convert an existing gridItem element into a sub-grid with the given (optional) options, else inherit them
   * from the parent's subGrid options.
   * @param el gridItem element to convert
   * @param ops (optional) sub-grid options, else default to node, then parent settings, else defaults
   * @param nodeToAdd (optional) node to add to the newly created sub grid (used when dragging over existing regular item)
   * @param saveContent if true (default) the html inside .grid-stack-content will be saved to child widget
   * @returns newly created grid
   */
  makeSubGrid(el, ops, nodeToAdd, saveContent = true) {
    let node = el.gridstackNode;
    if (!node) {
      node = this.makeWidget(el).gridstackNode;
    }
    if (node.subGrid?.el)
      return node.subGrid;
    let subGridTemplate;
    let grid = this;
    while (grid && !subGridTemplate) {
      subGridTemplate = grid.opts?.subGridOpts;
      grid = grid.parentGridNode?.grid;
    }
    ops = Utils.cloneDeep({
      // by default sub-grid inherit from us | parent, other than id, children, etc...
      ...this.opts,
      id: void 0,
      children: void 0,
      column: "auto",
      columnOpts: void 0,
      layout: "list",
      subGridOpts: void 0,
      ...subGridTemplate || {},
      ...ops || node.subGridOpts || {}
    });
    node.subGridOpts = ops;
    let autoColumn;
    if (ops.column === "auto") {
      autoColumn = true;
      ops.column = Math.max(node.w || 1, nodeToAdd?.w || 1);
      delete ops.columnOpts;
    }
    let content = node.el.querySelector(".grid-stack-item-content");
    let newItem;
    let newItemOpt;
    if (saveContent) {
      this._removeDD(node.el);
      newItemOpt = { ...node, x: 0, y: 0 };
      Utils.removeInternalForSave(newItemOpt);
      delete newItemOpt.subGridOpts;
      if (node.content) {
        newItemOpt.content = node.content;
        delete node.content;
      }
      if (_GridStack.addRemoveCB) {
        newItem = _GridStack.addRemoveCB(this.el, newItemOpt, true, false);
      } else {
        newItem = Utils.createDiv(["grid-stack-item"]);
        newItem.appendChild(content);
        content = Utils.createDiv(["grid-stack-item-content"], node.el);
      }
      this.prepareDragDrop(node.el);
    }
    if (nodeToAdd) {
      const w = autoColumn ? ops.column : node.w;
      const h = node.h + nodeToAdd.h;
      const style = node.el.style;
      style.transition = "none";
      this.update(node.el, { w, h });
      setTimeout(() => style.transition = null);
    }
    const subGrid = node.subGrid = _GridStack.addGrid(content, ops);
    if (nodeToAdd?._moving)
      subGrid._isTemp = true;
    if (autoColumn)
      subGrid._autoColumn = true;
    if (saveContent) {
      subGrid.makeWidget(newItem, newItemOpt);
    }
    if (nodeToAdd) {
      if (nodeToAdd._moving) {
        window.setTimeout(() => Utils.simulateMouseEvent(nodeToAdd._event, "mouseenter", subGrid.el), 0);
      } else {
        subGrid.makeWidget(node.el, node);
      }
    }
    this.resizeToContentCheck(false, node);
    return subGrid;
  }
  /**
   * called when an item was converted into a nested grid to accommodate a dragged over item, but then item leaves - return back
   * to the original grid-item. Also called to remove empty sub-grids when last item is dragged out (since re-creating is simple)
   */
  removeAsSubGrid(nodeThatRemoved) {
    const pGrid = this.parentGridNode?.grid;
    if (!pGrid)
      return;
    pGrid.batchUpdate();
    pGrid.removeWidget(this.parentGridNode.el, true, true);
    this.engine.nodes.forEach((n) => {
      n.x += this.parentGridNode.x;
      n.y += this.parentGridNode.y;
      pGrid.makeWidget(n.el, n);
    });
    pGrid.batchUpdate(false);
    if (this.parentGridNode)
      delete this.parentGridNode.subGrid;
    delete this.parentGridNode;
    if (nodeThatRemoved) {
      window.setTimeout(() => Utils.simulateMouseEvent(nodeThatRemoved._event, "mouseenter", pGrid.el), 0);
    }
  }
  /**
   * saves the current layout returning a list of widgets for serialization which might include any nested grids.
   * @param saveContent if true (default) the latest html inside .grid-stack-content will be saved to GridStackWidget.content field, else it will
   * be removed.
   * @param saveGridOpt if true (default false), save the grid options itself, so you can call the new GridStack.addGrid()
   * to recreate everything from scratch. GridStackOptions.children would then contain the widget list instead.
   * @param saveCB callback for each node -> widget, so application can insert additional data to be saved into the widget data structure.
   * @param column if provided, the grid will be saved for the given column size (IFF we have matching internal saved layout, or current layout).
   * Otherwise it will use the largest possible layout (say 12 even if rendering at 1 column) so we can restore to all layouts.
   * NOTE: if you want to save to currently display layout, pass this.getColumn() as column.
   * NOTE2: nested grids will ALWAYS save to the container size to be in sync with parent.
   * @returns list of widgets or full grid option, including .children list of widgets
   */
  save(saveContent = true, saveGridOpt = false, saveCB = _GridStack.saveCB, column) {
    const list = this.engine.save(saveContent, saveCB, column);
    list.forEach((n) => {
      if (saveContent && n.el && !n.subGrid && !saveCB) {
        const itemContent = n.el.querySelector(".grid-stack-item-content");
        n.content = itemContent?.innerHTML;
        if (!n.content)
          delete n.content;
      } else {
        if (!saveContent && !saveCB) {
          delete n.content;
        }
        if (n.subGrid?.el) {
          const column2 = n.w || n.subGrid.getColumn();
          const listOrOpt = n.subGrid.save(saveContent, saveGridOpt, saveCB, column2);
          n.subGridOpts = saveGridOpt ? listOrOpt : { children: listOrOpt };
          delete n.subGrid;
        }
      }
      delete n.el;
    });
    if (saveGridOpt) {
      const o = Utils.cloneDeep(this.opts);
      if (o.marginBottom === o.marginTop && o.marginRight === o.marginLeft && o.marginTop === o.marginRight) {
        o.margin = o.marginTop;
        delete o.marginTop;
        delete o.marginRight;
        delete o.marginBottom;
        delete o.marginLeft;
      }
      if (o.rtl === (this.el.style.direction === "rtl")) {
        o.rtl = "auto";
      }
      if (this._isAutoCellHeight) {
        o.cellHeight = "auto";
      }
      if (this._autoColumn) {
        o.column = "auto";
      }
      const origShow = o._alwaysShowResizeHandle;
      delete o._alwaysShowResizeHandle;
      if (origShow !== void 0) {
        o.alwaysShowResizeHandle = origShow;
      } else {
        delete o.alwaysShowResizeHandle;
      }
      Utils.removeInternalAndSame(o, gridDefaults);
      o.children = list;
      return o;
    }
    return list;
  }
  /**
   * Load widgets from a list. This will call update() on each (matching by id) or add/remove widgets that are not there.
   * Used to restore a grid layout for a saved layout list (see `save()`).
   *
   * @param items list of widgets definition to update/create
   * @param addRemove boolean (default true) or callback method can be passed to control if and how missing widgets can be added/removed, giving
   * the user control of insertion.
   * @returns the grid instance for chaining
   *
   * @example
   * // Basic usage with saved layout
   * const savedLayout = grid.save(); // Save current layout
   * // ... later restore it
   * grid.load(savedLayout);
   *
   * // Load with custom add/remove callback
   * grid.load(layout, (items, grid, add) => {
   *   if (add) {
   *     // Custom logic for adding new widgets
   *     items.forEach(item => {
   *       const el = document.createElement('div');
   *       el.innerHTML = item.content || '';
   *       grid.addWidget(el, item);
   *     });
   *   } else {
   *     // Custom logic for removing widgets
   *     items.forEach(item => grid.removeWidget(item.el));
   *   }
   * });
   *
   * // Load without adding/removing missing widgets
   * grid.load(layout, false);
   *
   * @see {@link http://gridstackjs.com/demo/serialization.html} for complete example
   */
  load(items, addRemove = _GridStack.addRemoveCB || true) {
    items = Utils.cloneDeep(items);
    const column = this.getColumn();
    items.forEach((n) => {
      n.w = n.w || n.minW || 1;
      n.h = n.h || n.minH || 1;
    });
    items = Utils.sort(items);
    this.engine.skipCacheUpdate = this._ignoreLayoutsNodeChange = true;
    let maxColumn = 0;
    items.forEach((n) => {
      maxColumn = Math.max(maxColumn, (n.x || 0) + n.w);
    });
    if (maxColumn > this.engine.defaultColumn)
      this.engine.defaultColumn = maxColumn;
    if (maxColumn > column) {
      if (this.engine.nodes.length === 0 && this.responseLayout) {
        this.engine.nodes = items;
        this.engine.columnChanged(maxColumn, column, this.responseLayout);
        items = this.engine.nodes;
        this.engine.nodes = [];
        delete this.responseLayout;
      } else
        this.engine.cacheLayout(items, maxColumn, true);
    }
    const prevCB = _GridStack.addRemoveCB;
    if (typeof addRemove === "function")
      _GridStack.addRemoveCB = addRemove;
    const removed = [];
    this.batchUpdate();
    const blank = !this.engine.nodes.length;
    const noAnim = blank && this.opts.animate;
    if (noAnim)
      this.setAnimation(false);
    if (!blank && addRemove) {
      const copyNodes = [...this.engine.nodes];
      copyNodes.forEach((n) => {
        if (!n.id)
          return;
        const item = Utils.find(items, n.id);
        if (!item) {
          if (_GridStack.addRemoveCB)
            _GridStack.addRemoveCB(this.el, n, false, false);
          removed.push(n);
          this.removeWidget(n.el, true, false);
        }
      });
    }
    this.engine._loading = true;
    const updateNodes = [];
    this.engine.nodes = this.engine.nodes.filter((n) => {
      if (Utils.find(items, n.id)) {
        updateNodes.push(n);
        return false;
      }
      return true;
    });
    items.forEach((w) => {
      const item = Utils.find(updateNodes, w.id);
      if (item) {
        if (Utils.shouldSizeToContent(item))
          w.h = item.h;
        this.engine.nodeBoundFix(w);
        if (w.autoPosition || w.x === void 0 || w.y === void 0) {
          w.w = w.w || item.w;
          w.h = w.h || item.h;
          this.engine.findEmptyPosition(w);
        }
        this.engine.nodes.push(item);
        if (Utils.samePos(item, w) && this.engine.nodes.length > 1) {
          this.moveNode(item, { ...w, forceCollide: true });
          Utils.copyPos(w, item);
        }
        this.update(item.el, w);
        if (w.subGridOpts?.children) {
          const sub = item.el.querySelector(".grid-stack");
          if (sub && sub.gridstack) {
            sub.gridstack.load(w.subGridOpts.children);
          }
        }
      } else if (addRemove) {
        this.addWidget(w);
      }
    });
    delete this.engine._loading;
    this.engine.removedNodes = removed;
    this.batchUpdate(false);
    delete this._ignoreLayoutsNodeChange;
    delete this.engine.skipCacheUpdate;
    prevCB ? _GridStack.addRemoveCB = prevCB : delete _GridStack.addRemoveCB;
    if (noAnim)
      this.setAnimation(true, true);
    return this;
  }
  /**
   * use before calling a bunch of `addWidget()` to prevent un-necessary relayouts in between (more efficient)
   * and get a single event callback. You will see no changes until `batchUpdate(false)` is called.
   */
  batchUpdate(flag = true) {
    this.engine.batchUpdate(flag);
    if (!flag) {
      this._updateContainerHeight();
      this._triggerRemoveEvent();
      this._triggerAddEvent();
      this._triggerChangeEvent();
    }
    return this;
  }
  /**
   * Gets the current cell height in pixels. This takes into account the unit type and converts to pixels if necessary.
   *
   * @param forcePixel if true, forces conversion to pixels even when cellHeight is specified in other units
   * @returns the cell height in pixels
   *
   * @example
   * const height = grid.getCellHeight();
   * console.log('Cell height:', height, 'px');
   *
   * // Force pixel conversion
   * const pixelHeight = grid.getCellHeight(true);
   */
  getCellHeight(forcePixel = false) {
    if (this.opts.cellHeight && this.opts.cellHeight !== "auto" && (!forcePixel || !this.opts.cellHeightUnit || this.opts.cellHeightUnit === "px")) {
      return this.opts.cellHeight;
    }
    if (this.opts.cellHeightUnit === "rem") {
      return this.opts.cellHeight * parseFloat(getComputedStyle(document.documentElement).fontSize);
    }
    if (this.opts.cellHeightUnit === "em") {
      return this.opts.cellHeight * parseFloat(getComputedStyle(this.el).fontSize);
    }
    if (this.opts.cellHeightUnit === "cm") {
      return this.opts.cellHeight * (96 / 2.54);
    }
    if (this.opts.cellHeightUnit === "mm") {
      return this.opts.cellHeight * (96 / 2.54) / 10;
    }
    const el = this.el.querySelector("." + this.opts.itemClass);
    if (el) {
      const h = Utils.toNumber(el.getAttribute("gs-h")) || 1;
      return Math.round(el.offsetHeight / h);
    }
    const rows = parseInt(this.el.getAttribute("gs-current-row"));
    return rows ? Math.round(this.el.getBoundingClientRect().height / rows) : this.opts.cellHeight;
  }
  /**
   * Update current cell height - see `GridStackOptions.cellHeight` for format by updating eh Browser CSS variable.
   *
   * @param val the cell height. Options:
   *   - `undefined`: cells content will be made square (match width minus margin)
   *   - `0`: the CSS will be generated by the application instead
   *   - number: height in pixels
   *   - string: height with units (e.g., '70px', '5rem', '2em')
   * @returns the grid instance for chaining
   *
   * @example
   * grid.cellHeight(100);     // 100px height
   * grid.cellHeight('70px');  // explicit pixel height
   * grid.cellHeight('5rem');  // relative to root font size
   * grid.cellHeight(grid.cellWidth() * 1.2); // aspect ratio
   * grid.cellHeight('auto');  // auto-size based on content
   */
  cellHeight(val) {
    if (val !== void 0) {
      if (this._isAutoCellHeight !== (val === "auto")) {
        this._isAutoCellHeight = val === "auto";
        this._updateResizeEvent();
      }
    }
    if (val === "initial" || val === "auto") {
      val = void 0;
    }
    if (val === void 0) {
      const marginDiff = -this.opts.marginRight - this.opts.marginLeft + this.opts.marginTop + this.opts.marginBottom;
      val = this.cellWidth() + marginDiff;
    }
    const data = Utils.parseHeight(val);
    if (this.opts.cellHeightUnit === data.unit && this.opts.cellHeight === data.h) {
      return this;
    }
    this.opts.cellHeightUnit = data.unit;
    this.opts.cellHeight = data.h;
    this.el.style.setProperty("--gs-cell-height", `${this.opts.cellHeight}${this.opts.cellHeightUnit}`);
    this._updateContainerHeight();
    this.resizeToContentCheck();
    return this;
  }
  /** Gets current cell width. */
  /**
   * Gets the current cell width in pixels. This is calculated based on the grid container width divided by the number of columns.
   *
   * @returns the cell width in pixels
   *
   * @example
   * const width = grid.cellWidth();
   * console.log('Cell width:', width, 'px');
   *
   * // Use cell width to calculate widget dimensions
   * const widgetWidth = width * 3; // For a 3-column wide widget
   */
  cellWidth() {
    return this._widthOrContainer() / this.getColumn();
  }
  /** return our expected width (or parent) , and optionally of window for dynamic column check */
  _widthOrContainer(forBreakpoint = false) {
    return forBreakpoint && this.opts.columnOpts?.breakpointForWindow ? window.innerWidth : this.el.clientWidth || this.el.parentElement.clientWidth || window.innerWidth;
  }
  /** checks for dynamic column count for our current size, returning true if changed */
  checkDynamicColumn() {
    const resp = this.opts.columnOpts;
    if (!resp || !resp.columnWidth && !resp.breakpoints?.length)
      return false;
    const column = this.getColumn();
    let newColumn = column;
    const w = this._widthOrContainer(true);
    if (resp.columnWidth) {
      newColumn = Math.min(Math.round(w / resp.columnWidth) || 1, resp.columnMax);
    } else {
      newColumn = resp.columnMax;
      let i = 0;
      while (i < resp.breakpoints.length && w <= resp.breakpoints[i].w) {
        newColumn = resp.breakpoints[i++].c || column;
      }
    }
    if (newColumn !== column) {
      const bk = resp.breakpoints?.find((b) => b.c === newColumn);
      this.column(newColumn, bk?.layout || resp.layout);
      return true;
    }
    return false;
  }
  /**
   * Re-layout grid items to reclaim any empty space. This is useful after removing widgets
   * or when you want to optimize the layout.
   *
   * @param layout layout type. Options:
   *   - 'compact' (default): might re-order items to fill any empty space
   *   - 'list': keep the widget left->right order the same, even if that means leaving an empty slot if things don't fit
   * @param doSort re-sort items first based on x,y position. Set to false to do your own sorting ahead (default: true)
   * @returns the grid instance for chaining
   *
   * @example
   * // Compact layout after removing widgets
   * grid.removeWidget('.widget-to-remove');
   * grid.compact();
   *
   * // Use list layout (preserve order)
   * grid.compact('list');
   *
   * // Compact without sorting first
   * grid.compact('compact', false);
   */
  compact(layout = "compact", doSort = true) {
    this.engine.compact(layout, doSort);
    this._triggerChangeEvent();
    return this;
  }
  /**
   * Set the number of columns in the grid. Will update existing widgets to conform to new number of columns,
   * as well as cache the original layout so you can revert back to previous positions without loss.
   *
   * Requires `gridstack-extra.css` or `gridstack-extra.min.css` for [2-11] columns,
   * else you will need to generate correct CSS.
   * See: https://github.com/gridstack/gridstack.js#change-grid-columns
   *
   * @param column Integer > 0 (default 12)
   * @param layout specify the type of re-layout that will happen. Options:
   *   - 'moveScale' (default): scale widget positions and sizes
   *   - 'move': keep widget sizes, only move positions
   *   - 'scale': keep widget positions, only scale sizes
   *   - 'none': don't change widget positions or sizes
   *   Note: items will never be outside of the current column boundaries.
   *   Ignored for `column=1` as we always want to vertically stack.
   * @returns the grid instance for chaining
   *
   * @example
   * // Change to 6 columns with default scaling
   * grid.column(6);
   *
   * // Change to 4 columns, only move positions
   * grid.column(4, 'move');
   *
   * // Single column layout (vertical stack)
   * grid.column(1);
   */
  column(column, layout = "moveScale") {
    if (!column || column < 1 || this.opts.column === column)
      return this;
    const oldColumn = this.getColumn();
    this.opts.column = column;
    if (!this.engine) {
      this.responseLayout = layout;
      return this;
    }
    this.engine.column = column;
    this.el.classList.remove("gs-" + oldColumn);
    this._updateColumnVar();
    this.engine.columnChanged(oldColumn, column, layout);
    if (this._isAutoCellHeight)
      this.cellHeight();
    this.resizeToContentCheck(true);
    this._ignoreLayoutsNodeChange = true;
    this._triggerChangeEvent();
    delete this._ignoreLayoutsNodeChange;
    return this;
  }
  /**
   * Get the number of columns in the grid (default 12).
   *
   * @returns the current number of columns in the grid
   *
   * @example
   * const columnCount = grid.getColumn(); // returns 12 by default
   */
  getColumn() {
    return this.opts.column;
  }
  /**
   * Returns an array of grid HTML elements (no placeholder) - used to iterate through our children in DOM order.
   * This method excludes placeholder elements and returns only actual grid items.
   *
   * @returns array of GridItemHTMLElement instances representing all grid items
   *
   * @example
   * const items = grid.getGridItems();
   * items.forEach(item => {
   *   console.log('Item ID:', item.gridstackNode.id);
   * });
   */
  getGridItems() {
    return Array.from(this.el.children).filter((el) => el.matches("." + this.opts.itemClass) && !el.matches("." + this.opts.placeholderClass));
  }
  /**
   * Returns true if change callbacks should be ignored due to column change, sizeToContent, loading, etc.
   * This is useful for callers who want to implement dirty flag functionality.
   *
   * @returns true if change callbacks are currently being ignored
   *
   * @example
   * if (!grid.isIgnoreChangeCB()) {
   *   // Process the change event
   *   console.log('Grid layout changed');
   * }
   */
  isIgnoreChangeCB() {
    return this._ignoreLayoutsNodeChange;
  }
  /**
   * Destroys a grid instance. DO NOT CALL any methods or access any vars after this as it will free up members.
   * @param removeDOM if `false` grid and items HTML elements will not be removed from the DOM (Optional. Default `true`).
   */
  destroy(removeDOM = true) {
    if (!this.el)
      return;
    this.offAll();
    this._updateResizeEvent(true);
    this.setStatic(true, false);
    this.setAnimation(false);
    if (!removeDOM) {
      this.removeAll(removeDOM);
      this.el.removeAttribute("gs-current-row");
    } else {
      this.el.parentNode.removeChild(this.el);
    }
    if (this.parentGridNode)
      delete this.parentGridNode.subGrid;
    delete this.parentGridNode;
    delete this.opts;
    delete this._placeholder?.gridstackNode;
    delete this._placeholder;
    delete this.engine;
    delete this.el.gridstack;
    delete this.el;
    return this;
  }
  /**
   * Enable/disable floating widgets (default: `false`). When enabled, widgets can float up to fill empty spaces.
   * See [example](http://gridstackjs.com/demo/float.html)
   *
   * @param val true to enable floating, false to disable
   * @returns the grid instance for chaining
   *
   * @example
   * grid.float(true);  // Enable floating
   * grid.float(false); // Disable floating (default)
   */
  float(val) {
    if (this.opts.float !== val) {
      this.opts.float = this.engine.float = val;
      this._triggerChangeEvent();
    }
    return this;
  }
  /**
   * Get the current float mode setting.
   *
   * @returns true if floating is enabled, false otherwise
   *
   * @example
   * const isFloating = grid.getFloat();
   * console.log('Floating enabled:', isFloating);
   */
  getFloat() {
    return this.engine.float;
  }
  /**
   * Get the position of the cell under a pixel on screen.
   * @param position the position of the pixel to resolve in
   * absolute coordinates, as an object with top and left properties
   * @param useDocRelative if true, value will be based on document position vs parent position (Optional. Default false).
   * Useful when grid is within `position: relative` element
   *
   * Returns an object with properties `x` and `y` i.e. the column and row in the grid.
   */
  getCellFromPixel(position, useDocRelative = false) {
    const box = this.el.getBoundingClientRect();
    let containerPos;
    if (useDocRelative) {
      containerPos = { top: box.top + document.documentElement.scrollTop, left: box.left };
    } else {
      containerPos = { top: this.el.offsetTop, left: this.el.offsetLeft };
    }
    const relativeLeft = position.left - containerPos.left;
    const relativeTop = position.top - containerPos.top;
    const columnWidth = box.width / this.getColumn();
    const rowHeight = box.height / parseInt(this.el.getAttribute("gs-current-row"));
    return { x: Math.floor(relativeLeft / columnWidth), y: Math.floor(relativeTop / rowHeight) };
  }
  /**
   * Returns the current number of rows, which will be at least `minRow` if set.
   * The row count is based on the highest positioned widget in the grid.
   *
   * @returns the current number of rows in the grid
   *
   * @example
   * const rowCount = grid.getRow();
   * console.log('Grid has', rowCount, 'rows');
   */
  getRow() {
    return Math.max(this.engine.getRow(), this.opts.minRow || 0);
  }
  /**
   * Checks if the specified rectangular area is empty (no widgets occupy any part of it).
   *
   * @param x the x coordinate (column) of the area to check
   * @param y the y coordinate (row) of the area to check
   * @param w the width in columns of the area to check
   * @param h the height in rows of the area to check
   * @returns true if the area is completely empty, false if any widget overlaps
   *
   * @example
   * // Check if a 2x2 area at position (1,1) is empty
   * if (grid.isAreaEmpty(1, 1, 2, 2)) {
   *   console.log('Area is available for placement');
   * }
   */
  isAreaEmpty(x, y, w, h) {
    return this.engine.isAreaEmpty(x, y, w, h);
  }
  /**
   * If you add elements to your grid by hand (or have some framework creating DOM), you have to tell gridstack afterwards to make them widgets.
   * If you want gridstack to add the elements for you, use `addWidget()` instead.
   * Makes the given element a widget and returns it.
   *
   * @param els widget or single selector to convert.
   * @param options widget definition to use instead of reading attributes or using default sizing values
   * @returns the converted GridItemHTMLElement
   *
   * @example
   * const grid = GridStack.init();
   *
   * // Create HTML content manually, possibly looking like:
   * // <div id="item-1" gs-x="0" gs-y="0" gs-w="3" gs-h="2"></div>
   * grid.el.innerHTML = '<div id="item-1" gs-w="3"></div><div id="item-2"></div>';
   *
   * // Convert existing elements to widgets
   * grid.makeWidget('#item-1'); // Uses gs-* attributes from DOM
   * grid.makeWidget('#item-2', {w: 2, h: 1, content: 'Hello World'});
   *
   * // Or pass DOM element directly
   * const element = document.getElementById('item-3');
   * grid.makeWidget(element, {x: 0, y: 1, w: 4, h: 2});
   */
  makeWidget(els, options) {
    const el = _GridStack.getElement(els);
    if (!el || el.gridstackNode)
      return el;
    if (!el.parentElement)
      this.el.appendChild(el);
    this._prepareElement(el, true, options);
    const node = el.gridstackNode;
    this._updateContainerHeight();
    if (node.subGridOpts) {
      this.makeSubGrid(el, node.subGridOpts, void 0, false);
    }
    let resetIgnoreLayoutsNodeChange;
    if (this.opts.column === 1 && !this._ignoreLayoutsNodeChange) {
      resetIgnoreLayoutsNodeChange = this._ignoreLayoutsNodeChange = true;
    }
    this._triggerAddEvent();
    this._triggerChangeEvent();
    if (resetIgnoreLayoutsNodeChange)
      delete this._ignoreLayoutsNodeChange;
    return el;
  }
  on(name, callback) {
    if (name.indexOf(" ") !== -1) {
      const names = name.split(" ");
      names.forEach((name2) => this.on(name2, callback));
      return this;
    }
    if (name === "change" || name === "added" || name === "removed" || name === "enable" || name === "disable") {
      const noData = name === "enable" || name === "disable";
      if (noData) {
        this._gsEventHandler[name] = (event) => callback(event);
      } else {
        this._gsEventHandler[name] = (event) => {
          if (event.detail)
            callback(event, event.detail);
        };
      }
      this.el.addEventListener(name, this._gsEventHandler[name]);
    } else if (name === "drag" || name === "dragstart" || name === "dragstop" || name === "resizestart" || name === "resize" || name === "resizestop" || name === "dropped" || name === "resizecontent") {
      this._gsEventHandler[name] = callback;
    } else {
      console.error("GridStack.on(" + name + ") event not supported");
    }
    return this;
  }
  /**
   * unsubscribe from the 'on' event GridStackEvent
   * @param name of the event (see possible values) or list of names space separated
   */
  off(name) {
    if (name.indexOf(" ") !== -1) {
      const names = name.split(" ");
      names.forEach((name2) => this.off(name2));
      return this;
    }
    if (name === "change" || name === "added" || name === "removed" || name === "enable" || name === "disable") {
      if (this._gsEventHandler[name]) {
        this.el.removeEventListener(name, this._gsEventHandler[name]);
      }
    }
    delete this._gsEventHandler[name];
    return this;
  }
  /**
   * Remove all event handlers from the grid. This is useful for cleanup when destroying a grid.
   *
   * @returns the grid instance for chaining
   *
   * @example
   * grid.offAll(); // Remove all event listeners
   */
  offAll() {
    Object.keys(this._gsEventHandler).forEach((key) => this.off(key));
    return this;
  }
  /**
   * Removes widget from the grid.
   * @param el  widget or selector to modify
   * @param removeDOM if `false` DOM element won't be removed from the tree (Default? true).
   * @param triggerEvent if `false` (quiet mode) element will not be added to removed list and no 'removed' callbacks will be called (Default? true).
   */
  removeWidget(els, removeDOM = true, triggerEvent = true) {
    if (!els) {
      console.error("Error: GridStack.removeWidget(undefined) called");
      return this;
    }
    _GridStack.getElements(els).forEach((el) => {
      if (el.parentElement && el.parentElement !== this.el)
        return;
      let node = el.gridstackNode;
      if (!node) {
        node = this.engine.nodes.find((n) => el === n.el);
      }
      if (!node)
        return;
      if (removeDOM && _GridStack.addRemoveCB) {
        _GridStack.addRemoveCB(this.el, node, false, false);
      }
      delete el.gridstackNode;
      this._removeDD(el);
      this.engine.removeNode(node, removeDOM, triggerEvent);
      if (removeDOM && el.parentElement) {
        el.remove();
      }
    });
    if (triggerEvent) {
      this._triggerRemoveEvent();
      this._triggerChangeEvent();
    }
    return this;
  }
  /**
   * Removes all widgets from the grid.
   * @param removeDOM if `false` DOM elements won't be removed from the tree (Default? `true`).
   * @param triggerEvent if `false` (quiet mode) element will not be added to removed list and no 'removed' callbacks will be called (Default? true).
   */
  removeAll(removeDOM = true, triggerEvent = true) {
    this.engine.nodes.forEach((n) => {
      if (removeDOM && _GridStack.addRemoveCB) {
        _GridStack.addRemoveCB(this.el, n, false, false);
      }
      delete n.el.gridstackNode;
      if (!this.opts.staticGrid)
        this._removeDD(n.el);
    });
    this.engine.removeAll(removeDOM, triggerEvent);
    if (triggerEvent)
      this._triggerRemoveEvent();
    return this;
  }
  /**
   * Toggle the grid animation state.  Toggles the `grid-stack-animate` class.
   * @param doAnimate if true the grid will animate.
   * @param delay if true setting will be set on next event loop.
   */
  setAnimation(doAnimate = this.opts.animate, delay) {
    if (delay) {
      setTimeout(() => {
        if (this.opts)
          this.setAnimation(doAnimate);
      });
    } else if (doAnimate) {
      this.el.classList.add("grid-stack-animate");
    } else {
      this.el.classList.remove("grid-stack-animate");
    }
    this.opts.animate = doAnimate;
    return this;
  }
  /** @internal */
  hasAnimationCSS() {
    return this.el.classList.contains("grid-stack-animate");
  }
  /**
   * Toggle the grid static state, which permanently removes/add Drag&Drop support, unlike disable()/enable() that just turns it off/on.
   * Also toggle the grid-stack-static class.
   * @param val if true the grid become static.
   * @param updateClass true (default) if css class gets updated
   * @param recurse true (default) if sub-grids also get updated
   */
  setStatic(val, updateClass = true, recurse = true) {
    if (!!this.opts.staticGrid === val)
      return this;
    val ? this.opts.staticGrid = true : delete this.opts.staticGrid;
    this._setupRemoveDrop();
    this._setupAcceptWidget();
    this.engine.nodes.forEach((n) => {
      this.prepareDragDrop(n.el);
      if (n.subGrid && recurse)
        n.subGrid.setStatic(val, updateClass, recurse);
    });
    if (updateClass) {
      this._setStaticClass();
    }
    return this;
  }
  /**
   * Updates the passed in options on the grid (similar to update(widget) for for the grid options).
   * @param options PARTIAL grid options to update - only items specified will be updated.
   * NOTE: not all options updating are currently supported (lot of code, unlikely to change)
   */
  updateOptions(o) {
    const opts = this.opts;
    if (o === opts)
      return this;
    if (o.acceptWidgets !== void 0) {
      opts.acceptWidgets = o.acceptWidgets;
      this._setupAcceptWidget();
    }
    if (o.animate !== void 0)
      this.setAnimation(o.animate);
    if (o.cellHeight)
      this.cellHeight(o.cellHeight);
    if (o.class !== void 0 && o.class !== opts.class) {
      if (opts.class)
        this.el.classList.remove(opts.class);
      if (o.class)
        this.el.classList.add(o.class);
    }
    if (o.columnOpts) {
      this.opts.columnOpts = o.columnOpts;
      this.checkDynamicColumn();
    } else if (o.columnOpts === null && this.opts.columnOpts) {
      delete this.opts.columnOpts;
      this._updateResizeEvent();
    } else if (typeof o.column === "number")
      this.column(o.column);
    if (o.margin !== void 0)
      this.margin(o.margin);
    if (o.staticGrid !== void 0)
      this.setStatic(o.staticGrid);
    if (o.disableDrag !== void 0 && !o.staticGrid)
      this.enableMove(!o.disableDrag);
    if (o.disableResize !== void 0 && !o.staticGrid)
      this.enableResize(!o.disableResize);
    if (o.float !== void 0)
      this.float(o.float);
    if (o.row !== void 0) {
      opts.minRow = opts.maxRow = opts.row = o.row;
      this._updateContainerHeight();
    } else {
      if (o.minRow !== void 0) {
        opts.minRow = o.minRow;
        this._updateContainerHeight();
      }
      if (o.maxRow !== void 0)
        opts.maxRow = o.maxRow;
    }
    if (o.lazyLoad !== void 0)
      opts.lazyLoad = o.lazyLoad;
    if (o.children?.length)
      this.load(o.children);
    return this;
  }
  /**
   * Updates widget position/size and other info. This is used to change widget properties after creation.
   * Can update position, size, content, and other widget properties.
   *
   * Note: If you need to call this on all nodes, use load() instead which will update what changed.
   * Setting the same x,y for multiple items will be indeterministic and likely unwanted.
   *
   * @param els widget element(s) or selector to modify
   * @param opt new widget options (x,y,w,h, etc.). Only those set will be updated.
   * @returns the grid instance for chaining
   *
   * @example
   * // Update widget size and position
   * grid.update('.my-widget', { x: 2, y: 1, w: 3, h: 2 });
   *
   * // Update widget content
   * grid.update(widget, { content: '<p>New content</p>' });
   *
   * // Update multiple properties
   * grid.update('#my-widget', {
   *   w: 4,
   *   h: 3,
   *   noResize: true,
   *   locked: true
   * });
   */
  update(els, opt) {
    _GridStack.getElements(els).forEach((el) => {
      const n = el?.gridstackNode;
      if (!n)
        return;
      const w = { ...Utils.copyPos({}, n), ...Utils.cloneDeep(opt) };
      this.engine.nodeBoundFix(w);
      delete w.autoPosition;
      const keys = ["x", "y", "w", "h"];
      let m;
      if (keys.some((k) => w[k] !== void 0 && w[k] !== n[k])) {
        m = {};
        keys.forEach((k) => {
          m[k] = w[k] !== void 0 ? w[k] : n[k];
          delete w[k];
        });
      }
      if (!m && (w.minW || w.minH || w.maxW || w.maxH)) {
        m = {};
      }
      if (w.content !== void 0) {
        const itemContent = el.querySelector(".grid-stack-item-content");
        if (itemContent && itemContent.textContent !== w.content) {
          n.content = w.content;
          _GridStack.renderCB(itemContent, w);
          if (n.subGrid?.el) {
            itemContent.appendChild(n.subGrid.el);
            n.subGrid._updateContainerHeight();
          }
        }
        delete w.content;
      }
      let changed = false;
      let ddChanged = false;
      for (const key in w) {
        if (key[0] !== "_" && n[key] !== w[key]) {
          n[key] = w[key];
          changed = true;
          ddChanged = ddChanged || !this.opts.staticGrid && (key === "noResize" || key === "noMove" || key === "locked");
        }
      }
      Utils.sanitizeMinMax(n);
      if (m) {
        const widthChanged = m.w !== void 0 && m.w !== n.w;
        this.moveNode(n, m);
        if (widthChanged && n.subGrid) {
          n.subGrid.onResize(this.hasAnimationCSS() ? n.w : void 0);
        } else {
          this.resizeToContentCheck(widthChanged, n);
        }
        delete n._orig;
      }
      if (m || changed) {
        this._writeAttr(el, n);
      }
      if (ddChanged) {
        this.prepareDragDrop(n.el);
      }
      if (_GridStack.updateCB)
        _GridStack.updateCB(n);
    });
    return this;
  }
  moveNode(n, m) {
    const wasUpdating = n._updating;
    if (!wasUpdating)
      this.engine.cleanNodes().beginUpdate(n);
    this.engine.moveNode(n, m);
    this._updateContainerHeight();
    if (!wasUpdating) {
      this._triggerChangeEvent();
      this.engine.endUpdate();
    }
  }
  /**
   * Updates widget height to match the content height to avoid vertical scrollbars or dead space.
   * This automatically adjusts the widget height based on its content size.
   *
   * Note: This assumes only 1 child under resizeToContentParent='.grid-stack-item-content'
   * (sized to gridItem minus padding) that represents the entire content size.
   *
   * @param el the grid item element to resize
   *
   * @example
   * // Resize a widget to fit its content
   * const widget = document.querySelector('.grid-stack-item');
   * grid.resizeToContent(widget);
   *
   * // This is commonly used with dynamic content:
   * widget.querySelector('.content').innerHTML = 'New longer content...';
   * grid.resizeToContent(widget);
   */
  resizeToContent(el) {
    if (!el)
      return;
    el.classList.remove("size-to-content-max");
    if (!el.clientHeight)
      return;
    const n = el.gridstackNode;
    if (!n)
      return;
    const grid = n.grid;
    if (!grid || el.parentElement !== grid.el)
      return;
    const cell = grid.getCellHeight(true);
    if (!cell)
      return;
    let height = n.h ? n.h * cell : el.clientHeight;
    let item;
    if (n.resizeToContentParent)
      item = el.querySelector(n.resizeToContentParent);
    if (!item)
      item = el.querySelector(_GridStack.resizeToContentParent);
    if (!item)
      return;
    const padding = el.clientHeight - item.clientHeight;
    const itemH = n.h ? n.h * cell - padding : item.clientHeight;
    let wantedH;
    if (n.subGrid) {
      wantedH = n.subGrid.getRow() * n.subGrid.getCellHeight(true);
      const subRec = n.subGrid.el.getBoundingClientRect();
      const parentRec = el.getBoundingClientRect();
      wantedH += subRec.top - parentRec.top;
    } else if (n.subGridOpts?.children?.length) {
      return;
    } else {
      const child = item.firstElementChild;
      if (!child) {
        console.error(`Error: GridStack.resizeToContent() widget id:${n.id} '${_GridStack.resizeToContentParent}'.firstElementChild is null, make sure to have a div like container. Skipping sizing.`);
        return;
      }
      wantedH = child.getBoundingClientRect().height || itemH;
    }
    if (itemH === wantedH)
      return;
    height += wantedH - itemH;
    let h = Math.ceil(height / cell);
    const softMax = Number.isInteger(n.sizeToContent) ? n.sizeToContent : 0;
    if (softMax && h > softMax) {
      h = softMax;
      el.classList.add("size-to-content-max");
    }
    if (n.minH && h < n.minH)
      h = n.minH;
    else if (n.maxH && h > n.maxH)
      h = n.maxH;
    if (h !== n.h) {
      grid._ignoreLayoutsNodeChange = true;
      grid.moveNode(n, { h });
      delete grid._ignoreLayoutsNodeChange;
    }
  }
  /** call the user resize (so they can do extra work) else our build in version */
  resizeToContentCBCheck(el) {
    if (_GridStack.resizeToContentCB)
      _GridStack.resizeToContentCB(el);
    else
      this.resizeToContent(el);
  }
  /**
   * Rotate widgets by swapping their width and height. This is typically called when the user presses 'r' during dragging.
   * The rotation swaps the w/h dimensions and adjusts min/max constraints accordingly.
   *
   * @param els widget element(s) or selector to rotate
   * @param relative optional pixel coordinate relative to upper/left corner to rotate around (keeps that cell under cursor)
   * @returns the grid instance for chaining
   *
   * @example
   * // Rotate a specific widget
   * grid.rotate('.my-widget');
   *
   * // Rotate with relative positioning during drag
   * grid.rotate(widget, { left: 50, top: 30 });
   */
  rotate(els, relative) {
    _GridStack.getElements(els).forEach((el) => {
      const n = el.gridstackNode;
      if (!Utils.canBeRotated(n))
        return;
      const rot = { w: n.h, h: n.w, minH: n.minW, minW: n.minH, maxH: n.maxW, maxW: n.maxH };
      if (relative) {
        const pivotX = relative.left > 0 ? Math.floor(relative.left / this.cellWidth()) : 0;
        const pivotY = relative.top > 0 ? Math.floor(relative.top / this.opts.cellHeight) : 0;
        rot.x = n.x + pivotX - (n.h - (pivotY + 1));
        rot.y = n.y + pivotY - pivotX;
      }
      Object.keys(rot).forEach((k) => {
        if (rot[k] === void 0)
          delete rot[k];
      });
      const _orig = n._orig;
      this.update(el, rot);
      n._orig = _orig;
    });
    return this;
  }
  /**
   * Updates the margins which will set all 4 sides at once - see `GridStackOptions.margin` for format options.
   * Supports CSS string format of 1, 2, or 4 values or a single number.
   *
   * @param value margin value - can be:
   *   - Single number: `10` (applies to all sides)
   *   - Two values: `'10px 20px'` (top/bottom, left/right)
   *   - Four values: `'10px 20px 5px 15px'` (top, right, bottom, left)
   * @returns the grid instance for chaining
   *
   * @example
   * grid.margin(10);           // 10px all sides
   * grid.margin('10px 20px');  // 10px top/bottom, 20px left/right
   * grid.margin('5px 10px 15px 20px'); // Different for each side
   */
  margin(value) {
    const isMultiValue = typeof value === "string" && value.split(" ").length > 1;
    if (!isMultiValue) {
      const data = Utils.parseHeight(value);
      if (this.opts.marginUnit === data.unit && this.opts.margin === data.h)
        return;
    }
    this.opts.margin = value;
    this.opts.marginTop = this.opts.marginBottom = this.opts.marginLeft = this.opts.marginRight = void 0;
    this._initMargin();
    return this;
  }
  /**
   * Returns the current margin value as a number (undefined if the 4 sides don't match).
   * This only returns a number if all sides have the same margin value.
   *
   * @returns the margin value in pixels, or undefined if sides have different values
   *
   * @example
   * const margin = grid.getMargin();
   * if (margin !== undefined) {
   *   console.log('Uniform margin:', margin, 'px');
   * } else {
   *   console.log('Margins are different on different sides');
   * }
   */
  getMargin() {
    return this.opts.margin;
  }
  /**
   * Returns true if the height of the grid will be less than the vertical
   * constraint. Always returns true if grid doesn't have height constraint.
   * @param node contains x,y,w,h,auto-position options
   *
   * @example
   * if (grid.willItFit(newWidget)) {
   *   grid.addWidget(newWidget);
   * } else {
   *   alert('Not enough free space to place the widget');
   * }
   */
  willItFit(node) {
    return this.engine.willItFit(node);
  }
  /** @internal */
  _triggerChangeEvent() {
    if (this.engine.batchMode)
      return this;
    const elements = this.engine.getDirtyNodes(true);
    if (elements && elements.length) {
      if (!this._ignoreLayoutsNodeChange) {
        this.engine.layoutsNodesChange(elements);
      }
      this._triggerEvent("change", elements);
    }
    this.engine.saveInitial();
    return this;
  }
  /** @internal */
  _triggerAddEvent() {
    if (this.engine.batchMode)
      return this;
    if (this.engine.addedNodes?.length) {
      if (!this._ignoreLayoutsNodeChange) {
        this.engine.layoutsNodesChange(this.engine.addedNodes);
      }
      this.engine.addedNodes.forEach((n) => {
        delete n._dirty;
      });
      const addedNodes = [...this.engine.addedNodes];
      this.engine.addedNodes = [];
      this._triggerEvent("added", addedNodes);
    }
    return this;
  }
  /** @internal */
  _triggerRemoveEvent() {
    if (this.engine.batchMode)
      return this;
    if (this.engine.removedNodes?.length) {
      const removedNodes = [...this.engine.removedNodes];
      this.engine.removedNodes = [];
      this._triggerEvent("removed", removedNodes);
    }
    return this;
  }
  /** @internal */
  _triggerEvent(type, data) {
    const event = data ? new CustomEvent(type, { bubbles: false, detail: data }) : new Event(type);
    let grid = this;
    while (grid.parentGridNode)
      grid = grid.parentGridNode.grid;
    grid.el.dispatchEvent(event);
    return this;
  }
  /** @internal */
  _updateContainerHeight() {
    if (!this.engine || this.engine.batchMode)
      return this;
    const parent = this.parentGridNode;
    let row = this.getRow() + this._extraDragRow;
    const cellHeight = this.opts.cellHeight;
    const unit = this.opts.cellHeightUnit;
    if (!cellHeight)
      return this;
    if (!parent && !this.opts.minRow) {
      const cssMinHeight = Utils.parseHeight(getComputedStyle(this.el)["minHeight"]);
      if (cssMinHeight.h > 0 && cssMinHeight.unit === unit) {
        const minRow = Math.floor(cssMinHeight.h / cellHeight);
        if (row < minRow) {
          row = minRow;
        }
      }
    }
    this.el.setAttribute("gs-current-row", String(row));
    this.el.style.removeProperty("min-height");
    this.el.style.removeProperty("height");
    if (row) {
      this.el.style[parent ? "minHeight" : "height"] = row * cellHeight + unit;
    }
    if (parent && Utils.shouldSizeToContent(parent)) {
      parent.grid.resizeToContentCBCheck(parent.el);
    }
    return this;
  }
  /** @internal */
  _prepareElement(el, triggerAddEvent = false, node) {
    node = node || this._readAttr(el);
    el.gridstackNode = node;
    node.el = el;
    node.grid = this;
    node = this.engine.addNode(node, triggerAddEvent);
    this._writeAttr(el, node);
    el.classList.add(gridDefaults.itemClass, this.opts.itemClass);
    const sizeToContent = Utils.shouldSizeToContent(node);
    sizeToContent ? el.classList.add("size-to-content") : el.classList.remove("size-to-content");
    if (sizeToContent)
      this.resizeToContentCheck(false, node);
    if (!Utils.lazyLoad(node))
      this.prepareDragDrop(node.el);
    return this;
  }
  /** @internal write position CSS vars and x,y,w,h attributes (not used for CSS but by users) back to element */
  _writePosAttr(el, n) {
    if (!n._moving && !n._resizing || this._placeholder === el) {
      el.style.top = n.y ? n.y === 1 ? `var(--gs-cell-height)` : `calc(${n.y} * var(--gs-cell-height))` : null;
      el.style.left = n.x ? n.x === 1 ? `var(--gs-column-width)` : `calc(${n.x} * var(--gs-column-width))` : null;
      el.style.width = n.w > 1 ? `calc(${n.w} * var(--gs-column-width))` : null;
      el.style.height = n.h > 1 ? `calc(${n.h} * var(--gs-cell-height))` : null;
    }
    el.setAttribute("gs-x", String(n.x));
    el.setAttribute("gs-y", String(n.y));
    n.w > 1 ? el.setAttribute("gs-w", String(n.w)) : el.removeAttribute("gs-w");
    n.h > 1 ? el.setAttribute("gs-h", String(n.h)) : el.removeAttribute("gs-h");
    return this;
  }
  /** @internal call to write any default attributes back to element */
  _writeAttr(el, node) {
    if (!node)
      return this;
    this._writePosAttr(el, node);
    const attrs = {
      // autoPosition: 'gs-auto-position', // no need to write out as already in node and doesn't affect CSS
      noResize: "gs-no-resize",
      noMove: "gs-no-move",
      locked: "gs-locked",
      id: "gs-id",
      sizeToContent: "gs-size-to-content"
    };
    for (const key in attrs) {
      if (node[key]) {
        el.setAttribute(attrs[key], String(node[key]));
      } else {
        el.removeAttribute(attrs[key]);
      }
    }
    return this;
  }
  /** @internal call to read any default attributes from element */
  _readAttr(el, clearDefaultAttr = true) {
    const n = {};
    n.x = Utils.toNumber(el.getAttribute("gs-x"));
    n.y = Utils.toNumber(el.getAttribute("gs-y"));
    n.w = Utils.toNumber(el.getAttribute("gs-w"));
    n.h = Utils.toNumber(el.getAttribute("gs-h"));
    n.autoPosition = Utils.toBool(el.getAttribute("gs-auto-position"));
    n.noResize = Utils.toBool(el.getAttribute("gs-no-resize"));
    n.noMove = Utils.toBool(el.getAttribute("gs-no-move"));
    n.locked = Utils.toBool(el.getAttribute("gs-locked"));
    const attr = el.getAttribute("gs-size-to-content");
    if (attr) {
      if (attr === "true" || attr === "false")
        n.sizeToContent = Utils.toBool(attr);
      else
        n.sizeToContent = parseInt(attr, 10);
    }
    n.id = el.getAttribute("gs-id");
    n.maxW = Utils.toNumber(el.getAttribute("gs-max-w"));
    n.minW = Utils.toNumber(el.getAttribute("gs-min-w"));
    n.maxH = Utils.toNumber(el.getAttribute("gs-max-h"));
    n.minH = Utils.toNumber(el.getAttribute("gs-min-h"));
    if (clearDefaultAttr) {
      if (n.w === 1)
        el.removeAttribute("gs-w");
      if (n.h === 1)
        el.removeAttribute("gs-h");
      if (n.maxW)
        el.removeAttribute("gs-max-w");
      if (n.minW)
        el.removeAttribute("gs-min-w");
      if (n.maxH)
        el.removeAttribute("gs-max-h");
      if (n.minH)
        el.removeAttribute("gs-min-h");
    }
    for (const key in n) {
      if (!n.hasOwnProperty(key))
        return;
      if (!n[key] && n[key] !== 0 && key !== "sizeToContent") {
        delete n[key];
      }
    }
    return n;
  }
  /** @internal */
  _setStaticClass() {
    const classes = ["grid-stack-static"];
    if (this.opts.staticGrid) {
      this.el.classList.add(...classes);
      this.el.setAttribute("gs-static", "true");
    } else {
      this.el.classList.remove(...classes);
      this.el.removeAttribute("gs-static");
    }
    return this;
  }
  /**
   * called when we are being resized - check if the one Column Mode needs to be turned on/off
   * and remember the prev columns we used, or get our count from parent, as well as check for cellHeight==='auto' (square)
   * or `sizeToContent` gridItem options.
   */
  onResize(clientWidth = this.el?.clientWidth) {
    if (!clientWidth)
      return;
    if (this.prevWidth === clientWidth)
      return;
    this.prevWidth = clientWidth;
    this.batchUpdate();
    let columnChanged = false;
    if (this._autoColumn && this.parentGridNode) {
      if (this.opts.column !== this.parentGridNode.w) {
        this.column(this.parentGridNode.w, this.opts.layout || "list");
        columnChanged = true;
      }
    } else {
      columnChanged = this.checkDynamicColumn();
    }
    if (this._isAutoCellHeight)
      this.cellHeight();
    this.engine.nodes.forEach((n) => {
      if (n.subGrid)
        n.subGrid.onResize();
    });
    if (!this._skipInitialResize)
      this.resizeToContentCheck(columnChanged);
    delete this._skipInitialResize;
    this.batchUpdate(false);
    return this;
  }
  /** resizes content for given node (or all) if shouldSizeToContent() is true */
  resizeToContentCheck(delay = false, n = void 0) {
    if (!this.engine)
      return;
    if (delay && this.hasAnimationCSS())
      return setTimeout(() => this.resizeToContentCheck(false, n), this.animationDelay);
    if (n) {
      if (Utils.shouldSizeToContent(n))
        this.resizeToContentCBCheck(n.el);
    } else if (this.engine.nodes.some((n2) => Utils.shouldSizeToContent(n2))) {
      const nodes = [...this.engine.nodes];
      this.batchUpdate();
      nodes.forEach((n2) => {
        if (Utils.shouldSizeToContent(n2))
          this.resizeToContentCBCheck(n2.el);
      });
      this._ignoreLayoutsNodeChange = true;
      this.batchUpdate(false);
      this._ignoreLayoutsNodeChange = false;
    }
    if (this._gsEventHandler["resizecontent"])
      this._gsEventHandler["resizecontent"](null, n ? [n] : this.engine.nodes);
  }
  /** add or remove the grid element size event handler */
  _updateResizeEvent(forceRemove = false) {
    const trackSize = !this.parentGridNode && (this._isAutoCellHeight || this.opts.sizeToContent || this.opts.columnOpts || this.engine.nodes.find((n) => n.sizeToContent));
    if (!forceRemove && trackSize && !this.resizeObserver) {
      this._sizeThrottle = Utils.throttle(() => this.onResize(), this.opts.cellHeightThrottle);
      this.resizeObserver = new ResizeObserver(() => this._sizeThrottle());
      this.resizeObserver.observe(this.el);
      this._skipInitialResize = true;
    } else if ((forceRemove || !trackSize) && this.resizeObserver) {
      this.resizeObserver.disconnect();
      delete this.resizeObserver;
      delete this._sizeThrottle;
    }
    return this;
  }
  /** @internal convert a potential selector into actual element */
  static getElement(els = ".grid-stack-item") {
    return Utils.getElement(els);
  }
  /** @internal */
  static getElements(els = ".grid-stack-item") {
    return Utils.getElements(els);
  }
  /** @internal */
  static getGridElement(els) {
    return _GridStack.getElement(els);
  }
  /** @internal */
  static getGridElements(els) {
    return Utils.getElements(els);
  }
  /** @internal initialize margin top/bottom/left/right and units */
  _initMargin() {
    let data;
    let margin = 0;
    let margins = [];
    if (typeof this.opts.margin === "string") {
      margins = this.opts.margin.split(" ");
    }
    if (margins.length === 2) {
      this.opts.marginTop = this.opts.marginBottom = margins[0];
      this.opts.marginLeft = this.opts.marginRight = margins[1];
    } else if (margins.length === 4) {
      this.opts.marginTop = margins[0];
      this.opts.marginRight = margins[1];
      this.opts.marginBottom = margins[2];
      this.opts.marginLeft = margins[3];
    } else {
      data = Utils.parseHeight(this.opts.margin);
      this.opts.marginUnit = data.unit;
      margin = this.opts.margin = data.h;
    }
    const keys = ["marginTop", "marginRight", "marginBottom", "marginLeft"];
    keys.forEach((k) => {
      if (this.opts[k] === void 0) {
        this.opts[k] = margin;
      } else {
        data = Utils.parseHeight(this.opts[k]);
        this.opts[k] = data.h;
        delete this.opts.margin;
      }
    });
    this.opts.marginUnit = data.unit;
    if (this.opts.marginTop === this.opts.marginBottom && this.opts.marginLeft === this.opts.marginRight && this.opts.marginTop === this.opts.marginRight) {
      this.opts.margin = this.opts.marginTop;
    }
    const style = this.el.style;
    style.setProperty("--gs-item-margin-top", `${this.opts.marginTop}${this.opts.marginUnit}`);
    style.setProperty("--gs-item-margin-bottom", `${this.opts.marginBottom}${this.opts.marginUnit}`);
    style.setProperty("--gs-item-margin-right", `${this.opts.marginRight}${this.opts.marginUnit}`);
    style.setProperty("--gs-item-margin-left", `${this.opts.marginLeft}${this.opts.marginUnit}`);
    return this;
  }
  /* ===========================================================================================
   * drag&drop methods that used to be stubbed out and implemented in dd-gridstack.ts
   * but caused loading issues in prod - see https://github.com/gridstack/gridstack.js/issues/2039
   * ===========================================================================================
   */
  /**
   * Get the global drag & drop implementation instance.
   * This provides access to the underlying drag & drop functionality.
   *
   * @returns the DDGridStack instance used for drag & drop operations
   *
   * @example
   * const dd = GridStack.getDD();
   * // Access drag & drop functionality
   */
  static getDD() {
    return dd;
  }
  /**
   * call to setup dragging in from the outside (say toolbar), by specifying the class selection and options.
   * Called during GridStack.init() as options, but can also be called directly (last param are used) in case the toolbar
   * is dynamically create and needs to be set later.
   * @param dragIn string selector (ex: '.sidebar-item') or list of dom elements
   * @param dragInOptions options - see DDDragOpt. (default: {handle: '.grid-stack-item-content', appendTo: 'body'}
   * @param widgets GridStackWidget def to assign to each element which defines what to create on drop
   * @param root optional root which defaults to document (for shadow dom pass the parent HTMLDocument)
   */
  static setupDragIn(dragIn, dragInOptions, widgets, root = document) {
    if (dragInOptions?.pause !== void 0) {
      DDManager.pauseDrag = dragInOptions.pause;
    }
    dragInOptions = { appendTo: "body", helper: "clone", ...dragInOptions || {} };
    const els = typeof dragIn === "string" ? Utils.getElements(dragIn, root) : dragIn;
    els.forEach((el, i) => {
      if (!dd.isDraggable(el))
        dd.dragIn(el, dragInOptions);
      if (widgets?.[i])
        el.gridstackNode = widgets[i];
    });
  }
  /**
   * Enables/Disables dragging by the user for specific grid elements.
   * For all items and future items, use enableMove() instead. No-op for static grids.
   *
   * Note: If you want to prevent an item from moving due to being pushed around by another
   * during collision, use the 'locked' property instead.
   *
   * @param els widget element(s) or selector to modify
   * @param val if true widget will be draggable, assuming the parent grid isn't noMove or static
   * @returns the grid instance for chaining
   *
   * @example
   * // Make specific widgets draggable
   * grid.movable('.my-widget', true);
   *
   * // Disable dragging for specific widgets
   * grid.movable('#fixed-widget', false);
   */
  movable(els, val) {
    if (this.opts.staticGrid)
      return this;
    _GridStack.getElements(els).forEach((el) => {
      const n = el.gridstackNode;
      if (!n)
        return;
      val ? delete n.noMove : n.noMove = true;
      this.prepareDragDrop(n.el);
    });
    return this;
  }
  /**
   * Enables/Disables user resizing for specific grid elements.
   * For all items and future items, use enableResize() instead. No-op for static grids.
   *
   * @param els widget element(s) or selector to modify
   * @param val if true widget will be resizable, assuming the parent grid isn't noResize or static
   * @returns the grid instance for chaining
   *
   * @example
   * // Make specific widgets resizable
   * grid.resizable('.my-widget', true);
   *
   * // Disable resizing for specific widgets
   * grid.resizable('#fixed-size-widget', false);
   */
  resizable(els, val) {
    if (this.opts.staticGrid)
      return this;
    _GridStack.getElements(els).forEach((el) => {
      const n = el.gridstackNode;
      if (!n)
        return;
      val ? delete n.noResize : n.noResize = true;
      this.prepareDragDrop(n.el);
    });
    return this;
  }
  /**
   * Temporarily disables widgets moving/resizing.
   * If you want a more permanent way (which freezes up resources) use `setStatic(true)` instead.
   *
   * Note: This is a no-op for static grids.
   *
   * This is a shortcut for:
   * ```typescript
   * grid.enableMove(false);
   * grid.enableResize(false);
   * ```
   *
   * @param recurse if true (default), sub-grids also get updated
   * @returns the grid instance for chaining
   *
   * @example
   * // Disable all interactions
   * grid.disable();
   *
   * // Disable only this grid, not sub-grids
   * grid.disable(false);
   */
  disable(recurse = true) {
    if (this.opts.staticGrid)
      return;
    this.enableMove(false, recurse);
    this.enableResize(false, recurse);
    this._triggerEvent("disable");
    return this;
  }
  /**
   * Re-enables widgets moving/resizing - see disable().
   * Note: This is a no-op for static grids.
   *
   * This is a shortcut for:
   * ```typescript
   * grid.enableMove(true);
   * grid.enableResize(true);
   * ```
   *
   * @param recurse if true (default), sub-grids also get updated
   * @returns the grid instance for chaining
   *
   * @example
   * // Re-enable all interactions
   * grid.enable();
   *
   * // Enable only this grid, not sub-grids
   * grid.enable(false);
   */
  enable(recurse = true) {
    if (this.opts.staticGrid)
      return;
    this.enableMove(true, recurse);
    this.enableResize(true, recurse);
    this._triggerEvent("enable");
    return this;
  }
  /**
   * Enables/disables widget moving for all widgets. No-op for static grids.
   * Note: locally defined items (with noMove property) still override this setting.
   *
   * @param doEnable if true widgets will be movable, if false moving is disabled
   * @param recurse if true (default), sub-grids also get updated
   * @returns the grid instance for chaining
   *
   * @example
   * // Enable moving for all widgets
   * grid.enableMove(true);
   *
   * // Disable moving for all widgets
   * grid.enableMove(false);
   *
   * // Enable only this grid, not sub-grids
   * grid.enableMove(true, false);
   */
  enableMove(doEnable, recurse = true) {
    if (this.opts.staticGrid)
      return this;
    doEnable ? delete this.opts.disableDrag : this.opts.disableDrag = true;
    this.engine.nodes.forEach((n) => {
      this.prepareDragDrop(n.el);
      if (n.subGrid && recurse)
        n.subGrid.enableMove(doEnable, recurse);
    });
    return this;
  }
  /**
   * Enables/disables widget resizing for all widgets. No-op for static grids.
   * Note: locally defined items (with noResize property) still override this setting.
   *
   * @param doEnable if true widgets will be resizable, if false resizing is disabled
   * @param recurse if true (default), sub-grids also get updated
   * @returns the grid instance for chaining
   *
   * @example
   * // Enable resizing for all widgets
   * grid.enableResize(true);
   *
   * // Disable resizing for all widgets
   * grid.enableResize(false);
   *
   * // Enable only this grid, not sub-grids
   * grid.enableResize(true, false);
   */
  enableResize(doEnable, recurse = true) {
    if (this.opts.staticGrid)
      return this;
    doEnable ? delete this.opts.disableResize : this.opts.disableResize = true;
    this.engine.nodes.forEach((n) => {
      this.prepareDragDrop(n.el);
      if (n.subGrid && recurse)
        n.subGrid.enableResize(doEnable, recurse);
    });
    return this;
  }
  /** @internal call when drag (and drop) needs to be cancelled (Esc key) */
  cancelDrag() {
    const n = this._placeholder?.gridstackNode;
    if (!n)
      return;
    if (n._isExternal) {
      n._isAboutToRemove = true;
      this.engine.removeNode(n);
    } else if (n._isAboutToRemove) {
      _GridStack._itemRemoving(n.el, false);
    }
    this.engine.restoreInitial();
  }
  /** @internal removes any drag&drop present (called during destroy) */
  _removeDD(el) {
    dd.draggable(el, "destroy").resizable(el, "destroy");
    if (el.gridstackNode) {
      delete el.gridstackNode._initDD;
    }
    delete el.ddElement;
    return this;
  }
  /** @internal called to add drag over to support widgets being added externally */
  _setupAcceptWidget() {
    if (this.opts.staticGrid || !this.opts.acceptWidgets && !this.opts.removable) {
      dd.droppable(this.el, "destroy");
      return this;
    }
    let cellHeight, cellWidth;
    const onDrag = (event, el, helper) => {
      helper = helper || el;
      const node = helper.gridstackNode;
      if (!node)
        return;
      if (!node.grid?.el) {
        helper.style.transform = `scale(${1 / this.dragTransform.xScale},${1 / this.dragTransform.yScale})`;
        const helperRect = helper.getBoundingClientRect();
        helper.style.left = helperRect.x + (this.dragTransform.xScale - 1) * (event.clientX - helperRect.x) / this.dragTransform.xScale + "px";
        helper.style.top = helperRect.y + (this.dragTransform.yScale - 1) * (event.clientY - helperRect.y) / this.dragTransform.yScale + "px";
        helper.style.transformOrigin = `0px 0px`;
      }
      let { top, left } = helper.getBoundingClientRect();
      const rect = this.el.getBoundingClientRect();
      left -= rect.left;
      top -= rect.top;
      const ui = {
        position: {
          top: top * this.dragTransform.xScale,
          left: left * this.dragTransform.yScale
        }
      };
      if (node._temporaryRemoved) {
        node.x = Math.max(0, Math.round(left / cellWidth));
        node.y = Math.max(0, Math.round(top / cellHeight));
        delete node.autoPosition;
        this.engine.nodeBoundFix(node);
        if (!this.engine.willItFit(node)) {
          node.autoPosition = true;
          if (!this.engine.willItFit(node)) {
            dd.off(el, "drag");
            return;
          }
          if (node._willFitPos) {
            Utils.copyPos(node, node._willFitPos);
            delete node._willFitPos;
          }
        }
        this._onStartMoving(helper, event, ui, node, cellWidth, cellHeight);
      } else {
        this._dragOrResize(helper, event, ui, node, cellWidth, cellHeight);
      }
    };
    dd.droppable(this.el, {
      accept: (el) => {
        const node = el.gridstackNode || this._readAttr(el, false);
        if (node?.grid === this)
          return true;
        if (!this.opts.acceptWidgets)
          return false;
        let canAccept = true;
        if (typeof this.opts.acceptWidgets === "function") {
          canAccept = this.opts.acceptWidgets(el);
        } else {
          const selector = this.opts.acceptWidgets === true ? ".grid-stack-item" : this.opts.acceptWidgets;
          canAccept = el.matches(selector);
        }
        if (canAccept && node && this.opts.maxRow) {
          const n = { w: node.w, h: node.h, minW: node.minW, minH: node.minH };
          canAccept = this.engine.willItFit(n);
        }
        return canAccept;
      }
    }).on(this.el, "dropover", (event, el, helper) => {
      let node = helper?.gridstackNode || el.gridstackNode;
      if (node?.grid === this && !node._temporaryRemoved) {
        return false;
      }
      if (node?._sidebarOrig) {
        node.w = node._sidebarOrig.w;
        node.h = node._sidebarOrig.h;
      }
      if (node?.grid && node.grid !== this && !node._temporaryRemoved) {
        const otherGrid = node.grid;
        otherGrid._leave(el, helper);
      }
      helper = helper || el;
      cellWidth = this.cellWidth();
      cellHeight = this.getCellHeight(true);
      if (!node) {
        const attr = helper.getAttribute("data-gs-widget") || helper.getAttribute("gridstacknode");
        if (attr) {
          try {
            node = JSON.parse(attr);
          } catch (error) {
            console.error("Gridstack dropover: Bad JSON format: ", attr);
          }
          helper.removeAttribute("data-gs-widget");
          helper.removeAttribute("gridstacknode");
        }
        if (!node)
          node = this._readAttr(helper);
        node._sidebarOrig = { w: node.w, h: node.h };
      }
      if (!node.grid) {
        if (!node.el)
          node = { ...node };
        node._isExternal = true;
        helper.gridstackNode = node;
      }
      const w = node.w || Math.round(helper.offsetWidth / cellWidth) || 1;
      const h = node.h || Math.round(helper.offsetHeight / cellHeight) || 1;
      if (node.grid && node.grid !== this) {
        if (!el._gridstackNodeOrig)
          el._gridstackNodeOrig = node;
        el.gridstackNode = node = { ...node, w, h, grid: this };
        delete node.x;
        delete node.y;
        this.engine.cleanupNode(node).nodeBoundFix(node);
        node._initDD = node._isExternal = // DOM needs to be re-parented on a drop
        node._temporaryRemoved = true;
      } else {
        node.w = w;
        node.h = h;
        node._temporaryRemoved = true;
      }
      _GridStack._itemRemoving(node.el, false);
      dd.on(el, "drag", onDrag);
      onDrag(event, el, helper);
      return false;
    }).on(this.el, "dropout", (event, el, helper) => {
      const node = helper?.gridstackNode || el.gridstackNode;
      if (!node)
        return false;
      if (!node.grid || node.grid === this) {
        this._leave(el, helper);
        if (this._isTemp) {
          this.removeAsSubGrid(node);
        }
      }
      return false;
    }).on(this.el, "drop", (event, el, helper) => {
      const node = helper?.gridstackNode || el.gridstackNode;
      if (node?.grid === this && !node._isExternal)
        return false;
      const wasAdded = !!this.placeholder.parentElement;
      const wasSidebar = el !== helper;
      this.placeholder.remove();
      delete this.placeholder.gridstackNode;
      if (wasAdded && this.opts.animate) {
        this.setAnimation(false);
        this.setAnimation(true, true);
      }
      const origNode = el._gridstackNodeOrig;
      delete el._gridstackNodeOrig;
      if (wasAdded && origNode?.grid && origNode.grid !== this) {
        const oGrid = origNode.grid;
        oGrid.engine.removeNodeFromLayoutCache(origNode);
        oGrid.engine.removedNodes.push(origNode);
        oGrid._triggerRemoveEvent()._triggerChangeEvent();
        if (oGrid.parentGridNode && !oGrid.engine.nodes.length && oGrid.opts.subGridDynamic) {
          oGrid.removeAsSubGrid();
        }
      }
      if (!node)
        return false;
      if (wasAdded) {
        this.engine.cleanupNode(node);
        node.grid = this;
      }
      delete node.grid?._isTemp;
      dd.off(el, "drag");
      if (helper !== el) {
        helper.remove();
        el = helper;
      } else {
        el.remove();
      }
      this._removeDD(el);
      if (!wasAdded)
        return false;
      const subGrid = node.subGrid?.el?.gridstack;
      Utils.copyPos(node, this._readAttr(this.placeholder));
      Utils.removePositioningStyles(el);
      if (wasSidebar && (node.content || node.subGridOpts || _GridStack.addRemoveCB)) {
        delete node.el;
        el = this.addWidget(node);
      } else {
        this._prepareElement(el, true, node);
        this.el.appendChild(el);
        this.resizeToContentCheck(false, node);
        if (subGrid) {
          subGrid.parentGridNode = node;
        }
        this._updateContainerHeight();
      }
      this.engine.addedNodes.push(node);
      this._triggerAddEvent();
      this._triggerChangeEvent();
      this.engine.endUpdate();
      if (this._gsEventHandler["dropped"]) {
        this._gsEventHandler["dropped"]({ ...event, type: "dropped" }, origNode && origNode.grid ? origNode : void 0, node);
      }
      return false;
    });
    return this;
  }
  /** @internal mark item for removal */
  static _itemRemoving(el, remove) {
    if (!el)
      return;
    const node = el ? el.gridstackNode : void 0;
    if (!node?.grid || el.classList.contains(node.grid.opts.removableOptions.decline))
      return;
    remove ? node._isAboutToRemove = true : delete node._isAboutToRemove;
    remove ? el.classList.add("grid-stack-item-removing") : el.classList.remove("grid-stack-item-removing");
  }
  /** @internal called to setup a trash drop zone if the user specifies it */
  _setupRemoveDrop() {
    if (typeof this.opts.removable !== "string")
      return this;
    const trashEl = document.querySelector(this.opts.removable);
    if (!trashEl)
      return this;
    if (!this.opts.staticGrid && !dd.isDroppable(trashEl)) {
      dd.droppable(trashEl, this.opts.removableOptions).on(trashEl, "dropover", (event, el) => _GridStack._itemRemoving(el, true)).on(trashEl, "dropout", (event, el) => _GridStack._itemRemoving(el, false));
    }
    return this;
  }
  /**
   * prepares the element for drag&drop - this is normally called by makeWidget() unless are are delay loading
   * @param el GridItemHTMLElement of the widget
   * @param [force=false]
   * */
  prepareDragDrop(el, force = false) {
    const node = el?.gridstackNode;
    if (!node)
      return;
    const noMove = node.noMove || this.opts.disableDrag;
    const noResize = node.noResize || this.opts.disableResize;
    const disable = this.opts.staticGrid || noMove && noResize;
    if (force || disable) {
      if (node._initDD) {
        this._removeDD(el);
        delete node._initDD;
      }
      if (disable)
        el.classList.add("ui-draggable-disabled", "ui-resizable-disabled");
      if (!force)
        return this;
    }
    if (!node._initDD) {
      let cellWidth;
      let cellHeight;
      const onStartMoving = (event, ui) => {
        this.triggerEvent(event, event.target);
        cellWidth = this.cellWidth();
        cellHeight = this.getCellHeight(true);
        this._onStartMoving(el, event, ui, node, cellWidth, cellHeight);
      };
      const dragOrResize = (event, ui) => {
        this._dragOrResize(el, event, ui, node, cellWidth, cellHeight);
      };
      const onEndMoving = (event) => {
        this.placeholder.remove();
        delete this.placeholder.gridstackNode;
        delete node._moving;
        delete node._resizing;
        delete node._event;
        delete node._lastTried;
        const widthChanged = node.w !== node._orig.w;
        const target = event.target;
        if (!target.gridstackNode || target.gridstackNode.grid !== this)
          return;
        node.el = target;
        if (node._isAboutToRemove) {
          const grid = el.gridstackNode.grid;
          if (grid._gsEventHandler[event.type]) {
            grid._gsEventHandler[event.type](event, target);
          }
          grid.engine.nodes.push(node);
          grid.removeWidget(el, true, true);
        } else {
          Utils.removePositioningStyles(target);
          if (node._temporaryRemoved) {
            this._writePosAttr(target, node);
            this.engine.addNode(node);
          } else {
            this._writePosAttr(target, node);
          }
          this.triggerEvent(event, target);
        }
        this._extraDragRow = 0;
        this._updateContainerHeight();
        this._triggerChangeEvent();
        this.engine.endUpdate();
        if (event.type === "resizestop") {
          if (Number.isInteger(node.sizeToContent))
            node.sizeToContent = node.h;
          this.resizeToContentCheck(widthChanged, node);
        }
      };
      dd.draggable(el, {
        start: onStartMoving,
        stop: onEndMoving,
        drag: dragOrResize
      }).resizable(el, {
        start: onStartMoving,
        stop: onEndMoving,
        resize: dragOrResize
      });
      node._initDD = true;
    }
    dd.draggable(el, noMove ? "disable" : "enable").resizable(el, noResize ? "disable" : "enable");
    return this;
  }
  /** @internal handles actual drag/resize start */
  _onStartMoving(el, event, ui, node, cellWidth, cellHeight) {
    this.engine.cleanNodes().beginUpdate(node);
    this._writePosAttr(this.placeholder, node);
    this.el.appendChild(this.placeholder);
    this.placeholder.gridstackNode = node;
    if (node.grid?.el) {
      this.dragTransform = Utils.getValuesFromTransformedElement(el);
    } else if (this.placeholder && this.placeholder.closest(".grid-stack")) {
      const gridEl = this.placeholder.closest(".grid-stack");
      this.dragTransform = Utils.getValuesFromTransformedElement(gridEl);
    } else {
      this.dragTransform = {
        xScale: 1,
        xOffset: 0,
        yScale: 1,
        yOffset: 0
      };
    }
    node.el = this.placeholder;
    node._lastUiPosition = ui.position;
    node._prevYPix = ui.position.top;
    node._moving = event.type === "dragstart";
    node._resizing = event.type === "resizestart";
    delete node._lastTried;
    if (event.type === "dropover" && node._temporaryRemoved) {
      this.engine.addNode(node);
      node._moving = true;
    }
    this.engine.cacheRects(cellWidth, cellHeight, this.opts.marginTop, this.opts.marginRight, this.opts.marginBottom, this.opts.marginLeft);
    if (event.type === "resizestart") {
      const colLeft = this.getColumn() - node.x;
      const rowLeft = (this.opts.maxRow || Number.MAX_SAFE_INTEGER) - node.y;
      dd.resizable(el, "option", "minWidth", cellWidth * Math.min(node.minW || 1, colLeft)).resizable(el, "option", "minHeight", cellHeight * Math.min(node.minH || 1, rowLeft)).resizable(el, "option", "maxWidth", cellWidth * Math.min(node.maxW || Number.MAX_SAFE_INTEGER, colLeft)).resizable(el, "option", "maxWidthMoveLeft", cellWidth * Math.min(node.maxW || Number.MAX_SAFE_INTEGER, node.x + node.w)).resizable(el, "option", "maxHeight", cellHeight * Math.min(node.maxH || Number.MAX_SAFE_INTEGER, rowLeft)).resizable(el, "option", "maxHeightMoveUp", cellHeight * Math.min(node.maxH || Number.MAX_SAFE_INTEGER, node.y + node.h));
    }
  }
  /** @internal handles actual drag/resize */
  _dragOrResize(el, event, ui, node, cellWidth, cellHeight) {
    const p = { ...node._orig };
    let resizing;
    let mLeft = this.opts.marginLeft, mRight = this.opts.marginRight, mTop = this.opts.marginTop, mBottom = this.opts.marginBottom;
    const mHeight = Math.round(cellHeight * 0.1), mWidth = Math.round(cellWidth * 0.1);
    mLeft = Math.min(mLeft, mWidth);
    mRight = Math.min(mRight, mWidth);
    mTop = Math.min(mTop, mHeight);
    mBottom = Math.min(mBottom, mHeight);
    if (event.type === "drag") {
      if (node._temporaryRemoved)
        return;
      const distance = ui.position.top - node._prevYPix;
      node._prevYPix = ui.position.top;
      if (this.opts.draggable.scroll !== false) {
        Utils.updateScrollPosition(el, ui.position, distance);
      }
      const left = ui.position.left + (ui.position.left > node._lastUiPosition.left ? -mRight : mLeft);
      const top = ui.position.top + (ui.position.top > node._lastUiPosition.top ? -mBottom : mTop);
      p.x = Math.round(left / cellWidth);
      p.y = Math.round(top / cellHeight);
      const prev = this._extraDragRow;
      if (this.engine.collide(node, p)) {
        const row = this.getRow();
        let extra = Math.max(0, p.y + node.h - row);
        if (this.opts.maxRow && row + extra > this.opts.maxRow) {
          extra = Math.max(0, this.opts.maxRow - row);
        }
        this._extraDragRow = extra;
      } else
        this._extraDragRow = 0;
      if (this._extraDragRow !== prev)
        this._updateContainerHeight();
      if (node.x === p.x && node.y === p.y)
        return;
    } else if (event.type === "resize") {
      if (p.x < 0)
        return;
      Utils.updateScrollResize(event, el, cellHeight);
      p.w = Math.round((ui.size.width - mLeft) / cellWidth);
      p.h = Math.round((ui.size.height - mTop) / cellHeight);
      if (node.w === p.w && node.h === p.h)
        return;
      if (node._lastTried && node._lastTried.w === p.w && node._lastTried.h === p.h)
        return;
      const left = ui.position.left + mLeft;
      const top = ui.position.top + mTop;
      p.x = Math.round(left / cellWidth);
      p.y = Math.round(top / cellHeight);
      resizing = true;
    }
    node._event = event;
    node._lastTried = p;
    const rect = {
      x: ui.position.left + mLeft,
      y: ui.position.top + mTop,
      w: (ui.size ? ui.size.width : node.w * cellWidth) - mLeft - mRight,
      h: (ui.size ? ui.size.height : node.h * cellHeight) - mTop - mBottom
    };
    if (this.engine.moveNodeCheck(node, { ...p, cellWidth, cellHeight, rect, resizing })) {
      node._lastUiPosition = ui.position;
      this.engine.cacheRects(cellWidth, cellHeight, mTop, mRight, mBottom, mLeft);
      delete node._skipDown;
      if (resizing && node.subGrid)
        node.subGrid.onResize();
      this._extraDragRow = 0;
      this._updateContainerHeight();
      const target = event.target;
      if (!node._sidebarOrig) {
        this._writePosAttr(target, node);
      }
      this.triggerEvent(event, target);
    }
  }
  /** call given event callback on our main top-most grid (if we're nested) */
  triggerEvent(event, target) {
    let grid = this;
    while (grid.parentGridNode)
      grid = grid.parentGridNode.grid;
    if (grid._gsEventHandler[event.type]) {
      grid._gsEventHandler[event.type](event, target);
    }
  }
  /** @internal called when item leaving our area by either cursor dropout event
   * or shape is outside our boundaries. remove it from us, and mark temporary if this was
   * our item to start with else restore prev node values from prev grid it came from.
   */
  _leave(el, helper) {
    helper = helper || el;
    const node = helper.gridstackNode;
    if (!node)
      return;
    helper.style.transform = helper.style.transformOrigin = null;
    dd.off(el, "drag");
    if (node._temporaryRemoved)
      return;
    node._temporaryRemoved = true;
    this.engine.removeNode(node);
    node.el = node._isExternal && helper ? helper : el;
    const sidebarOrig = node._sidebarOrig;
    if (node._isExternal)
      this.engine.cleanupNode(node);
    node._sidebarOrig = sidebarOrig;
    if (this.opts.removable === true) {
      _GridStack._itemRemoving(el, true);
    }
    if (el._gridstackNodeOrig) {
      el.gridstackNode = el._gridstackNodeOrig;
      delete el._gridstackNodeOrig;
    } else if (node._isExternal) {
      this.engine.restoreInitial();
    }
  }
};
GridStack.renderCB = (el, w) => {
  if (el && w?.content)
    el.textContent = w.content;
};
GridStack.resizeToContentParent = ".grid-stack-item-content";
GridStack.Utils = Utils;
GridStack.Engine = GridStackEngine;
GridStack.GDRev = "12.4.2";

// src/BlockRegistry.ts
var BlockRegistryClass = class {
  factories = /* @__PURE__ */ new Map();
  register(factory) {
    this.factories.set(factory.type, factory);
  }
  get(type) {
    return this.factories.get(type);
  }
  getAll() {
    return Array.from(this.factories.values());
  }
  clear() {
    this.factories.clear();
  }
};
var BlockRegistry = new BlockRegistryClass();

// src/utils/emojis.ts
var EMOJI_PICKER_SET = [
  // Smileys & emotion
  ["\u{1F600}", "happy smile grin cheerful joy face glad positive mood friendly beam radiant sunny upbeat pleased delighted merry joyful lighthearted bright"],
  ["\u{1F60A}", "smile blush happy warm kind gentle pleased soft sweet content gracious tender heartfelt lovely appreciative humble cozy mellow soothing serene"],
  ["\u{1F602}", "laugh cry funny joy hilarious tears humor lol rofl comedy joke witty giggle hysterical amused cracking dying priceless ridiculous absurd"],
  ["\u{1F972}", "tear smile grateful bittersweet touched moved emotional proud nostalgia sentimental poignant wistful tender heartfelt relieved overwhelmed sincere raw humble deep"],
  ["\u{1F60D}", "heart eyes love adore crush smitten romance infatuated affection desire obsessed gorgeous beautiful attraction swoon stunning captivated mesmerized charmed fond"],
  ["\u{1F929}", "star eyes excited amazed wow awesome thrilled dazzled impressed wonderful starstruck spectacular astonished admire fabulous incredible magnificent blown-away marvelous"],
  ["\u{1F60E}", "cool sunglasses chill confident swagger smooth boss relaxed suave laid-back casual badass stylish composed unfazed nonchalant effortless slick sharp poised"],
  ["\u{1F914}", "thinking hmm wondering ponder curious consider question reflect contemplate uncertain puzzled deliberate evaluate analyze skeptical doubtful mull examine weigh speculate"],
  ["\u{1F605}", "sweat nervous laugh awkward oops relief uncomfortable embarrassed tense uneasy sheepish cringe clumsy mistake blunder flustered self-conscious wince strained"],
  ["\u{1F622}", "cry sad tear upset weep sorrow grief heartbreak melancholy dejected mournful gloomy downcast depressed dismal hurt anguish pain morose lonely"],
  ["\u{1F624}", "angry huff frustrated mad annoyed furious rage irritated steam vent livid pissed irate seething hostile bitter aggravated fuming enraged grumpy"],
  ["\u{1F973}", "party celebrate birthday confetti festive hooray cheers congratulations bash jubilant revelry toast fiesta gala carnival merrymaking rejoice triumph occasion carnival"],
  ["\u{1F634}", "sleep tired zzz rest nap drowsy snore exhausted bedtime dream doze slumber fatigue weary drained knocked-out unconscious peaceful lullaby recharge"],
  ["\u{1F92F}", "mind blown explode shock amazed unbelievable crazy insane astonished stunned flabbergasted gobsmacked revelation epiphany incredible speechless overwhelmed shook bewildered startled"],
  ["\u{1FAE1}", "salute respect honor duty serve acknowledge formal military tribute obey discipline officer rank attention report comply loyal patriotic ceremony allegiance"],
  ["\u{1FAE0}", "melting face relax dissolve hot overwhelmed sinking droopy fading soft warm liquid puddle embarrassed shy uncomfortable bashful heat surrender yield"],
  ["\u{1F607}", "halo angel innocent pure good blessed holy kind sweet divine virtuous righteous saintly wholesome moral gracious sincere noble charitable devout values integrity"],
  ["\u{1F917}", "hug open arms warm embrace friendly welcoming cuddle comfort caring affection squeeze support reassure tender closeness nurture hold shelter soothe"],
  ["\u{1F97A}", "pleading puppy eyes cute beg adorable sad sweet hopeful tender vulnerable earnest innocent desperate longing helpless sympathetic needy wistful pitiful"],
  ["\u{1F60F}", "smirk sly sneaky mischievous cocky flirty knowing cheeky devious suggestive cunning wily crafty scheming playful teasing provocative naughty witty sardonic"],
  // People & gestures
  ["\u{1F44B}", "wave hello bye greet farewell welcome hand gesture hi howdy salute morning evening introduction meet departure arrive friendly acknowledge hail"],
  ["\u{1F44D}", "thumbs up good ok approve agree yes like correct positive nice affirm endorse validate confirm accept support praise recommend solid fine"],
  ["\u{1F44E}", "thumbs down bad dislike disagree disapprove reject no wrong negative fail oppose deny veto decline refuse condemn criticize poor unsatisfactory"],
  ["\u270C", "victory peace sign two win triumph freedom success hand gesture symbol harmony accord truce ceasefire unity solidarity pact alliance double"],
  ["\u{1F91D}", "handshake deal agree partnership cooperation trust alliance meet business contract negotiate collaborate unite pact mutual bond formal settle welcome greet"],
  ["\u{1F64F}", "pray thanks please beg hope grateful faith worship request mercy namaste appreciate blessing reverence devotion plead humble sincere spiritual bow"],
  ["\u{1F4AA}", "muscle strong flex power strength gym workout fitness bicep tough mighty robust endurance athletic vigor stamina resilient capable force iron motivation motivate determination perseverance grit willpower drive hustle"],
  ["\u{1F441}", "eye watch see look observe view gaze stare vision focus monitor witness scan survey inspect peek glimpse perceive detect notice"],
  ["\u{1F9E0}", "brain mind think smart intelligent idea genius memory knowledge wisdom logic reason cognitive mental intellect insight clever strategy analysis process second-brain PKM zettelkasten obsidian note-taking knowledge-management productivity"],
  ["\u2764", "heart love red passion romance care affection warmth valentine devotion adore cherish bond emotion feeling deep intimate tender compassion soul"],
  ["\u{1F9E1}", "orange heart warm autumn friendly creative energy enthusiasm vibrant playful bold spirited dynamic active lively zest courage adventurous generous vivid"],
  ["\u{1F49B}", "yellow heart bright sunshine happiness friendship optimism gold warm cheerful radiant glowing positive uplifting grateful sunny jolly gleeful beaming mellow"],
  ["\u{1F49A}", "green heart nature growth health lucky harmony eco fresh organic renewal vitality balance wellness prosperity earth botanical flourish fertile healing"],
  ["\u{1F499}", "blue heart calm trust loyalty peace sky ocean serene cool steady reliable sincere depth tranquil honest faithful true dependable stable"],
  ["\u{1F49C}", "purple heart royal creative mystic spiritual elegant luxury wisdom magic noble regal dreamy enchanting artistic mysterious imaginative fantasy cosmic divine"],
  ["\u{1F5A4}", "black heart dark emo gothic strength power elegant solid formal edgy mysterious deep intense dramatic bold sleek sharp modern fierce"],
  ["\u{1F90D}", "white heart pure clean innocent simple minimal blank pale clarity transparent pristine fresh light serene peaceful honest plain delicate airy"],
  ["\u{1FA77}", "pink heart cute sweet soft blush feminine gentle tender lovely romantic charming adorable pastel warm delicate graceful youthful dreamy pretty"],
  ["\u{1F440}", "eyes look watch stare peek curious observe glance spy attention gaze scan notice perceive scrutinize inspect survey witness sneak vigilant"],
  ["\u{1FAF6}", "heart hands love care support appreciate cherish grateful adore affection embrace nurture compassion tenderness kindness warmth devotion protect hold treasure"],
  ["\u{1F44F}", "clap applause bravo congratulations well done praise celebrate cheer ovation encore standing recognition honor tribute commend salute kudos respect hail"],
  ["\u{1F91E}", "fingers crossed luck hope wish fortune faith prayer promise desire optimism chance gamble bet superstition blessing favorable outcome trust believe"],
  ["\u270D", "writing hand author compose draft pen pencil scribe letter note journal diary manuscript essay creative literary blog prose story editorial note-taking daily"],
  ["\u{1F9BE}", "mechanical arm prosthetic robot strong bionic power tech future cyborg augmented enhanced titanium steel advanced upgrade superhuman iron grip force"],
  // Nature
  ["\u{1F331}", "seedling sprout grow plant garden green fresh new beginning growth nurture cultivate develop emerge start tender young bud shoot germinate motivation habit progress self-improvement"],
  ["\u{1F33F}", "herb leaf green nature botanical plant garden organic fresh foliage verdant lush tropical fern frond branch stem flora vegetation herbal"],
  ["\u{1F340}", "clover luck lucky fortune shamrock irish four leaf charm green blessing chance auspicious favorable prosperity serendipity fate destiny talisman wish"],
  ["\u{1F338}", "blossom flower pink cherry spring japan sakura bloom petal delicate fragile beauty grace renewal feminine elegant transient fleeting gentle soft"],
  ["\u{1F33A}", "flower hibiscus tropical bloom garden colorful blossom Hawaii red petal exotic warm paradise island vibrant lush gorgeous decorative ornamental vivid"],
  ["\u{1F33B}", "sunflower bright yellow sun summer garden happy cheerful bloom warm golden tall field radiant joyful optimistic sunny vibrant tall rustic"],
  ["\u{1F342}", "autumn fall leaf season brown orange harvest change dry maple deciduous crisp golden rustic nostalgic wind fading transitional November cool"],
  ["\u{1F30A}", "wave ocean water sea surf tide beach coast marine splash current deep blue shore nautical aqua tropical flow crash ripple"],
  ["\u{1F525}", "fire flame hot burn heat lit trending popular blazing passion fierce intense energy wild warm glow ember ignite blaze fury motivation drive determination hustle"],
  ["\u2744", "snowflake cold ice winter frozen frost chill freeze crystal snow unique delicate white pure arctic icy glacial blizzard pristine flurry"],
  ["\u26A1", "lightning bolt energy power electric thunder fast speed charge shock voltage surge zap current intensity storm flash strike dynamic quick"],
  ["\u{1F308}", "rainbow colors spectrum hope promise diversity pride arch weather sky after-rain bridge multicolor vivid bright beautiful magical optimistic harmony dream"],
  ["\u2600", "sun sunny bright day warm light summer morning golden clear radiant dawn daylight sunshine noon tropical glow beaming cheerful heat"],
  ["\u{1F319}", "moon night crescent dark sky evening sleep lunar celestial twilight midnight dream nocturnal dusk starlit calm quiet serene mysterious glow"],
  ["\u2B50", "star favorite rated best top quality night sky shining bright golden award featured highlight bookmark special important premium excellent notable motivation inspiration aspiration goal"],
  ["\u{1F31F}", "glowing star shine brilliant sparkle twinkle radiant celestial bright excellent dazzling luminous stellar magnificent outstanding remarkable superb impressive splendid glistening"],
  ["\u2728", "sparkles shine magic glitter glamour special clean new fresh dazzle enchant fairy dust twinkling glowing radiant premium polished fancy luxury"],
  ["\u{1F3D4}", "mountain peak summit high adventure nature hike climb snow alpine majestic rugged wilderness terrain elevation scenic vast panoramic ridge remote"],
  ["\u{1F30D}", "earth globe world planet geography international travel map continent environment global humanity civilization ecosystem biosphere terra homeland ground soil terrain"],
  ["\u{1F310}", "globe internet web network worldwide connected online digital global browser worldwide domain website cyberspace virtual cloud server protocol communication data"],
  ["\u{1FAB4}", "potted plant house indoor green decor home garden succulent grow ceramic shelf desk room windowsill cozy nurture botanical houseplant living"],
  ["\u{1F332}", "evergreen tree pine forest nature wood christmas conifer green tall spruce fir woodland timber grove shade canopy wilderness wild dense"],
  ["\u{1F344}", "mushroom fungus forest nature wild toadstool organic earthy woodland magic mycelium cap stem spore edible forage ground damp mysterious fairy"],
  ["\u{1F41D}", "bee honey buzz insect pollinate hive sting yellow worker busy queen colony flower nectar wax sweet industrious diligent swarm spring"],
  ["\u{1F98B}", "butterfly insect nature beautiful transform wings colorful metamorphosis garden flutter cocoon caterpillar chrysalis elegant graceful delicate pattern migrate spring change"],
  ["\u{1F43E}", "paw prints animal pet footprint track dog cat walk trail path follow clue trace mark step wild forest ground muddy"],
  ["\u{1F431}", "cat kitten pet feline meow cute furry animal whiskers playful independent curious agile pounce purr cuddly fluffy lazy graceful clever"],
  ["\u{1F436}", "dog puppy pet canine bark loyal cute furry animal friend faithful companion fetch walk leash tail wag obedient loving playful"],
  // Food & objects
  ["\u2615", "coffee tea hot drink cup morning cafe latte espresso brew cappuccino java bean roast aroma cafeteria steam warm cozy mocha"],
  ["\u{1F375}", "tea cup hot drink matcha green herbal warm sip beverage chamomile jasmine oolong steep kettle ceremony calming soothing refreshing zen"],
  ["\u{1F37A}", "beer drink pub bar cheers alcohol lager ale mug cold draft brew hops craft stout pint toast social friday weekend"],
  ["\u{1F34E}", "apple fruit red healthy food snack organic teacher crisp fresh juicy sweet autumn harvest orchard pie cider nutrition diet natural"],
  ["\u{1F34B}", "lemon yellow sour citrus fresh juice zest tart tangy squeeze vitamin acidic bright peel slice garnish refreshing sharp summery clean"],
  ["\u{1F382}", "cake birthday celebration dessert sweet party frosting candle treat slice chocolate vanilla cream layers festive anniversary surprise bake decorate wish"],
  ["\u{1F355}", "pizza food slice italian cheese pepperoni dinner lunch meal party takeout delivery crust topping oven bake supreme margherita sausage bacon"],
  ["\u{1F377}", "wine glass drink red white elegant dinner celebration grape toast vineyard vintage merlot chardonnay sommelier decant pair swirl bouquet cellar"],
  ["\u{1F9C1}", "cupcake sweet dessert treat frosting bake mini cake sprinkles sugar icing butter cream vanilla chocolate flavor decorative pretty snack party"],
  ["\u{1F951}", "avocado healthy green food guacamole fresh organic toast salad superfood nutrition fat creamy ripe pit skin millennial trendy bowl spread"],
  // Activities & sports
  ["\u{1F3AF}", "target bullseye goal aim focus precision objective hit center shoot accuracy direct purpose mission intent strategy plan mark dart exact motivation project-management OKR productivity"],
  ["\u{1F3C6}", "trophy award win champion success prize competition gold medal achieve glory honor excellence triumph recognition accomplishment victorious reward outstanding superior motivation milestone"],
  ["\u{1F947}", "medal gold first winner champion award best victory prize compete podium top achievement record excellence olympic performance elite leading outstanding"],
  ["\u{1F3AE}", "game controller play video console gaming joystick fun arcade entertain pixel level score quest adventure retro online multiplayer stream hobby"],
  ["\u{1F3A8}", "art palette creative paint colors draw design brush canvas studio illustration sketch masterpiece gallery museum expression visual aesthetic craft talent"],
  ["\u{1F3B5}", "music note song melody tune sound rhythm beat listen audio harmony instrument compose lyric chorus verse album record concert band"],
  ["\u{1F3AC}", "clapper film movie cinema director action scene video cut shoot production camera reel premiere screenplay actor studio Hollywood blockbuster edit"],
  ["\u{1F4F7}", "camera photo picture snap capture image shoot lens portrait memory digital photography focus exposure frame album gallery angle composition shot"],
  ["\u{1F381}", "gift present box surprise birthday wrap holiday bow giving package reward treat donation offering favor gesture generous festive occasion token"],
  ["\u{1F3B2}", "dice game random roll chance luck board casino gamble play probability bet wager odds risk fortune unpredictable tabletop strategy number"],
  ["\u{1F9E9}", "puzzle piece solve jigsaw fit connect challenge logic brain together assemble pattern match complete figure-out mystery riddle clue problem think project management planning"],
  ["\u{1F3AD}", "theater masks drama comedy tragedy acting perform stage show play musical opera scene character role audience curtain spotlight expression emotion"],
  ["\u{1F3C3}", "running exercise fitness jog sprint athlete sport race training track marathon cardio endurance speed stride dash pace outdoor health hustle"],
  ["\u{1F9D8}", "yoga meditation calm relax zen mindful stretch balance pose peace breathe serenity harmony wellness chakra flexibility inner tranquil centered holistic"],
  ["\u{1F3B8}", "guitar music rock instrument band play strings chord acoustic electric solo riff strum amplifier concert jam blues country folk melody"],
  ["\u{1F3A4}", "microphone sing voice karaoke record perform speak audio vocal stage broadcast interview podcast announce present host emcee lecture debate speech"],
  ["\u{1F3A7}", "headphones music listen audio sound beats wireless over-ear podcast stereo noise-cancel bass volume immersive studio DJ mix focus zone"],
  // Travel & places
  ["\u{1F680}", "rocket launch space shuttle blast explore mission fast speed orbit astronaut cosmos NASA thrust propulsion countdown takeoff interstellar voyage frontier motivation ambition productivity goal"],
  ["\u2708", "airplane travel fly flight jet trip journey airline departure sky arrival boarding runway pilot altitude cruise vacation abroad international route"],
  ["\u{1F682}", "train travel rail transport commute locomotive station track journey ride railway express schedule platform conductor engine carriage steam bullet subway"],
  ["\u{1F3E0}", "house home building family residence living shelter comfort cozy dwelling roof neighborhood street property estate domestic abode sanctuary warm safe"],
  ["\u{1F3D9}", "city building skyline urban downtown skyscraper metro architecture towers busy modern concrete landscape panorama dense cosmopolitan hub infrastructure commercial scenic"],
  ["\u{1F306}", "city sunset evening skyline dusk twilight urban golden horizon vista panorama silhouette beautiful glow orange scenic view rooftop calm peaceful"],
  ["\u{1F5FC}", "tower landmark tokyo tall structure monument observation antenna tourist famous iconic viewpoint skyline spire beacon height architecture symbol famous historic"],
  ["\u{1F3D6}", "beach vacation holiday sand sun relax coast tropical resort shore umbrella palm waves swim seaside paradise island getaway summer lounge"],
  ["\u26FA", "tent camping outdoor adventure nature camp hike shelter wilderness trek bonfire campfire forest park survival explore backpack gear stargazing trail"],
  // Objects & tools
  ["\u{1F4C1}", "folder directory organize files storage category archive system group contain collection structure project classify manage sort browse navigate hierarchy digital"],
  ["\u{1F4C2}", "open folder browse directory files explore access documents content view expand reveal display inside contents read inspect review navigate show"],
  ["\u{1F4C4}", "document page file text paper sheet blank note report form letter article template draft record manuscript proof printout copy format"],
  ["\u{1F4DD}", "memo write note edit pencil draft compose jot pad paper journal entry log record reminder agenda minutes summary outline plan note-taking productivity PKM obsidian daily"],
  ["\u{1F4CB}", "clipboard copy paste checklist list tasks form survey record data inventory register questionnaire roster tally schedule template assessment evaluation audit project management kanban workflow productivity"],
  ["\u{1F4D3}", "notebook journal diary daily log planner note-taking writing personal reflection thoughts record entry ledger memo pad book cover bound ruled"],
  ["\u{1F4D2}", "ledger notebook yellow note-taking planner log record register journal study workbook pad bound memo daily agenda handbook reference catalog list"],
  ["\u{1F5D2}", "notepad spiral memo notes jot scratch paper quick draft scribble bullet list to-do reminder write pad tear-off log lined daily"],
  ["\u{1F4CC}", "pushpin pin tack mark attach fixed bulletin board location hold sticky notice important remember highlight anchor secure fasten point flag"],
  ["\u{1F4CD}", "location pin map marker place navigate address point destination drop waypoint coordinate GPS venue spot position site area zone district"],
  ["\u{1F516}", "bookmark save mark tag favorite label chapter placeholder remember keep flag reference highlight annotate note index tab quick-access return later"],
  ["\u{1F5C2}", "index dividers tabs organize sort category section file cabinet group partition separate classify arrange order divide folder structure system manage second-brain PKM knowledge-base taxonomy"],
  ["\u{1F4C5}", "calendar date schedule plan event day month year appointment agenda booking diary timeline deadline milestone reminder period term session slot project management planner productivity"],
  ["\u{1F5D3}", "calendar spiral planner monthly schedule organize dates agenda timeline view weekly annual overview layout display wall desk flip page log"],
  ["\u23F0", "alarm clock time wake morning schedule reminder urgent prompt early ring buzzer alert snooze set punctual deadline appointment routine daily"],
  ["\u{1F550}", "clock time hour watch schedule deadline countdown moment period tick minute second duration interval elapsed timing pace tempo rate meter"],
  ["\u23F1", "stopwatch timer speed race countdown track measure performance seconds lap interval benchmark timing record split pace precision accurate athletic test"],
  ["\u{1F4CA}", "chart bar data statistics graph analytics metrics report visual compare dashboard insight trend analysis benchmark KPI measure performance overview summary project management productivity"],
  ["\u{1F4C8}", "chart up growth trend increase rise profit improve progress gain ascend upward boost expand rally surge climb advance momentum positive"],
  ["\u{1F4C9}", "chart down decline fall drop decrease loss reduce crash lower slump downturn plunge shrink sink dip recession regression negative slide"],
  ["\u{1F4A1}", "idea light bulb insight inspiration bright creative solution innovation tip eureka invention brainstorm thought concept suggestion proposal spark clever genius motivation productivity"],
  ["\u{1F50D}", "search magnify zoom find discover look investigate inspect explore detail examine research scan probe review query filter analyze locate trace"],
  ["\u{1F517}", "link chain url connect web hyperlink attach join bond reference anchor association coupling bridge path redirect route endpoint integration share PKM backlink graph relationship note"],
  ["\u{1F4E2}", "loudspeaker announce broadcast megaphone alert proclamation notify shout public news declaration publicity promote marketing campaign event rally spread amplify voice"],
  ["\u{1F514}", "bell notification alert ring alarm remind chime ding attention sound signal update notice ping subscribe follow incoming event trigger wake"],
  ["\u{1F4AC}", "speech bubble chat message talk communicate discuss conversation text dialog comment reply respond thread forum discourse exchange interact social feedback"],
  ["\u{1F4AD}", "thought think bubble idea ponder dream imagine reflect wonder muse daydream consider fantasy vision concept brainstorm mind inner silent deep"],
  ["\u{1F4DA}", "books study library read learn education knowledge stack collection reference textbook academic literature shelf volume encyclopedia resource material course school reading-list second-brain"],
  ["\u{1F4D6}", "open book read learn study page text knowledge literature chapter story novel tale passage essay content information lesson guide manual journal diary reading daily log"],
  ["\u{1F4DC}", "scroll document ancient paper certificate decree parchment history old formal diploma charter proclamation manuscript edict torah scripture archive relic legacy"],
  ["\u2709", "envelope email letter mail postal message inbox correspondence send post stamp seal deliver package address formal invitation announcement card greetings"],
  ["\u{1F4E7}", "email message digital mail compose inbox outbox electronic send receive newsletter subscribe forward reply thread attachment draft spam filter contact"],
  ["\u{1F4E5}", "inbox download receive import collect arrive gather incoming tray message queue pending unread new items deliveries submissions requests notifications feed"],
  ["\u{1F4E4}", "outbox upload send export share publish dispatch deliver release submit broadcast distribute deploy push outgoing transfer transmit post forward ship"],
  ["\u{1F5D1}", "trash delete remove waste garbage bin discard throw dispose recycle junk refuse clean purge erase eliminate dump clear sweep void"],
  ["\u{1F4D0}", "triangle ruler geometry math angle measure draft technical precision shape protractor degree architect blueprint engineer design schematic plan layout grid"],
  ["\u{1F9F2}", "magnet attract pull force iron metal charge stick pole draw repel field north south lodestone flux ferrite neodymium hold grip"],
  ["\u{1F48A}", "pill medicine health pharmacy drug capsule vitamin dose cure treatment prescription supplement tablet remedy healing therapy antibiotic painkiller relief wellness"],
  ["\u{1FA7A}", "stethoscope doctor health medical exam checkup hospital clinical care heart listen diagnosis nurse physician practitioner consultation vital signs blood pressure"],
  ["\u{1FA9E}", "mirror reflection look glass vanity self image surface shine check inspect reverse symmetry double copy gaze appearance face beauty truth"],
  ["\u{1F9F8}", "teddy bear toy cute stuffed plush child soft comfort cuddly huggable sweet innocent play nursery gift cozy warm friend hug"],
  // Tech
  ["\u{1F4BB}", "laptop computer code program work device screen technology notebook portable developer software engineer terminal ide workspace remote digital keyboard typing"],
  ["\u{1F5A5}", "desktop monitor screen display computer workstation setup office technology pc tower dual ultrawide resolution pixel panel gaming workspace professional edit"],
  ["\u{1F4F1}", "phone mobile cell smartphone device app touch call text screen notification swipe tap digital wireless portable camera pocket handheld smart"],
  ["\u2328", "keyboard type input keys computer hardware peripheral qwerty text entry shortcut mechanical switch layout ergonomic wireless backlit keycap coding fast"],
  ["\u{1F5B1}", "mouse cursor click point scroll device hardware peripheral navigate input drag select hover right-click wireless optical trackball sensor desktop aim"],
  ["\u{1F4E1}", "satellite antenna signal dish broadcast communication tower radar network wireless frequency receiver transmit relay orbit space GPS tracking remote data"],
  ["\u{1F50C}", "plug power electric socket connect outlet cable charger cord adapter extension wire prong voltage current supply AC DC unplug jack"],
  ["\u{1F50B}", "battery power charge energy cell electric level full low portable lithium ion rechargeable capacity drain lasting backup reserve indicator percent"],
  ["\u{1F4BE}", "floppy disk save store data backup memory archive retro old vintage legacy magnetic kilobyte classic obsolete nostalgic icon preservation early"],
  ["\u{1F4BF}", "disc cd dvd media music optical storage album data burn rom read write laser digital movie audio blu-ray compile rip"],
  ["\u{1F5A8}", "printer print output paper copy document hardware office machine ink toner laser inkjet scanner fax page duplex wireless cartridge queue"],
  ["\u{1F916}", "robot ai machine android bot automated intelligence tech future artificial neural network algorithm learning digital smart assistant chatbot program virtual"],
  ["\u{1F9EC}", "dna genetics biology helix science genome cell molecular life strand chromosome gene sequence mutation code evolution heredity protein research biotech"],
  ["\u269B", "atom science physics nuclear particle element molecule chemistry quantum small electron proton neutron orbit shell energy mass matter fundamental force"],
  // Symbols & status
  ["\u2705", "check done complete yes approved verified success tick confirm pass validate finished accepted cleared accomplished fulfilled satisfied green correct ready"],
  ["\u274C", "cross error wrong no delete cancel reject fail remove block deny invalid prohibited forbidden stop void negate refuse decline close"],
  ["\u26A0", "warning caution alert danger attention risk hazard notice careful issue safety threat vulnerability problem concern flag critical serious urgent watch"],
  ["\u2753", "question mark ask help inquiry unknown uncertain confused what doubt curious wonder clarify explain why how investigate mystery unclear puzzle"],
  ["\u2757", "exclamation important urgent priority attention notice alert emphasis critical vital crucial essential significant pressing immediate required mandatory key necessary serious"],
  ["\u{1F512}", "lock secure private closed protect restrict safety password encrypted hidden sealed guarded classified confidential shield vault fortress barrier block deny"],
  ["\u{1F513}", "unlock open public accessible free unrestricted available permission released clear exposed revealed transparent unprotected accessible enabled activated authorized granted"],
  ["\u{1F511}", "key password access login unlock secret credential enter permission code master skeleton passkey token authentication authorization gateway decode decrypt admit"],
  ["\u{1F6E1}", "shield protect security defense guard safe armor barrier firewall ward block prevent resist screen cover insurance warranty backup safeguard anti"],
  ["\u2699", "gear settings config option preference control configure cog system parameter customize adjust tweak modify setup menu panel dashboard admin tune"],
  ["\u{1F527}", "wrench tool fix repair adjust maintain tighten utility service spanner mechanic plumber twist socket bolt nut calibrate troubleshoot debug patch"],
  ["\u{1F528}", "hammer build construct create make forge strike nail tool shape smash break frame assemble craft carpentry blacksmith pound hit mold"],
  ["\u2697", "flask chemistry lab experiment science potion mix formula brew beaker distill reaction compound solution chemical test analyze concoct alchemy blend"],
  ["\u{1F52C}", "microscope science research examine study magnify biology analysis close detail zoom cell tissue specimen slide laboratory investigate discover observe peer"],
  ["\u{1F52D}", "telescope space astronomy observe stars galaxy universe sky discover far lens optical view distant planet nebula constellation explore cosmos look"],
  ["\u{1F9EA}", "test tube experiment science lab sample vial chemistry research trial reagent solution liquid analysis control variable hypothesis verify measure study"],
  ["\u{1F48E}", "gem diamond precious jewel crystal brilliant valuable treasure luxury rare sparkle facet carat polished exquisite elite premium gleaming priceless gift values core principles worth"],
  ["\u{1F4B0}", "money bag rich cash wealth dollar fortune profit savings invest finance gold bank fund income revenue earnings budget capital asset"],
  ["\u{1F4B3}", "credit card payment bank buy purchase transaction checkout swipe digital debit visa mastercard billing charge account contactless tap wireless pay"],
  ["\u{1F3F7}", "label tag price mark category classify organize identify sale metadata name badge sticker barcode product item description attribute sort group"],
  ["\u{1F380}", "ribbon bow gift decorate present wrap pretty ornament tie loop satin silk festive holiday elegant trim accessory fashion prize award"],
  ["\u{1F6A9}", "flag red alert warning danger signal problem marker issue trouble indicator concern suspicious questionable dealbreaker boundary limit caution notice risk"],
  ["\u{1F3C1}", "checkered flag finish race end complete final victory lap done goal milestone conclude wrap-up close celebrate achievement culmination terminate last"],
  ["\u{1F536}", "orange diamond shape icon marker bullet accent highlight geometric bold warm indicator badge status category section divider separator visual symbol"],
  ["\u{1F537}", "blue diamond shape icon marker bullet accent highlight geometric cool calm indicator badge status category section divider separator visual symbol"],
  ["\u{1F4A0}", "diamond shape blue dot geometric pattern elegant jewel icon badge ornament decorative crystal sparkle facet precious accent marker indicator logo"],
  ["\u2B06", "arrow up direction rise increase north ascend climb higher above upward elevate lift boost grow promote upgrade advance progress top"],
  ["\u2B07", "arrow down direction fall decrease south descend lower below drop downward sink decline reduce shrink dive plunge collapse scroll bottom"],
  ["\u27A1", "arrow right direction forward next proceed east continue advance move onward progress navigate step ahead further transit shift slide push"],
  ["\u2B05", "arrow left direction back previous west return retreat before reverse rewind undo navigate earlier prior behind backward revisit scroll start"],
  ["\u21A9", "return back reply undo reverse respond previous revert answer redirect bounce comeback restore recover retry restart react acknowledge loop circle"],
  // Misc useful
  ["\u{1F9ED}", "compass navigate direction guide north south east west explore orient bearing heading course waypoint find path route journey travel steer values purpose principles mission vision"],
  ["\u{1F5FA}", "map world navigate travel atlas geography route chart explore guide territory region landscape overview plan roadmap terrain survey layout scheme values purpose direction vision"],
  ["\u{1F4E6}", "box package shipping delivery container cargo parcel product store wrap cardboard seal tape label inventory warehouse logistics supply freight crate"],
  ["\u{1F5C4}", "filing cabinet archive storage organize office records drawers department data repository vault preserve catalog backup collection warehouse inventory shelf keep"],
  ["\u{1F510}", "lock key secure encrypted private protected closed password safe access authentication sealed vault confidential classified restricted guarded fortified cipher hidden"],
  ["\u{1F4CE}", "paperclip attach fasten bind clip connect hold office document organize staple pin secure bundle group collect gather join link keep"],
  ["\u2702", "scissors cut trim snip crop edit clip divide separate shear slice chop prune carve sever split detach craft paper fabric"],
  ["\u{1F58A}", "pen write edit sign note author draft compose ink letter ballpoint fountain marker script signature journal diary autograph scribble draw"],
  ["\u{1F4CF}", "ruler measure length straight edge scale size dimension tool line centimeter inch foot metric millimeter precision guide align draft template"],
  ["\u{1F505}", "dim brightness low light dark screen quiet soft subtle faint gentle muted toned-down ambient subdued reduced weak pale dusky shade"],
  ["\u{1F506}", "bright sun light high intensity luminous vivid radiant glow display brilliant dazzling glaring spotlight maximum vibrant strong clear powerful beam"],
  ["\u267B", "recycle sustainability green reuse reduce environment eco circle renew clean conservation waste recovery compost biodegradable renewable earth-friendly carbon footprint zero"],
  ["\u2714", "checkmark done complete approved correct verified valid pass accept tick confirmed affirmative positive cleared settled resolved finished accomplished satisfactory okay"],
  ["\u2795", "plus add increase more extra positive create append new expand include insert extend supplement boost augment attach grow incorporate join"],
  ["\u2796", "minus remove decrease less subtract reduce negative take delete shrink diminish lower cut trim pare exclude withdraw strip contract drop"],
  ["\u{1F504}", "refresh sync loop reload update cycle rotate repeat restart renew regenerate restore reboot recycle revolve circular continuous ongoing perpetual reset"],
  ["\u23E9", "fast forward skip ahead speed quick advance rapid jump next accelerate hurry rush double-time expedite hasten swift prompt instant leap"],
  ["\u23EA", "rewind back reverse previous return replay undo behind earlier retreat review revisit flashback recall backward retrace restore past history prior"],
  ["\u23F8", "pause stop hold wait break freeze halt rest intermission delay suspend temporary standby timeout hiatus respite cease interrupt defer linger"],
  ["\u25B6", "play start begin resume run launch go forward trigger active initiate engage proceed operate execute commence kickoff open activate enable"],
  ["\u{1F500}", "shuffle random mix scramble reorder rearrange jumble variety change swap chaos unpredictable diverse assorted miscellaneous alternate rotate distribute disperse blend"],
  ["\u2696", "balance scale justice fair equal weigh measure law court judge decide compare evaluate values ethics morals principles equity rights harmony"],
  ["\u267E", "infinity forever endless eternal unlimited boundless perpetual continuous loop beyond limitless timeless always everlasting immeasurable vast cosmic absolute ultimate constant"],
  ["\u{1FA84}", "magic wand spell enchant wizard cast transform miracle power trick illusion sorcery fantasy mystical supernatural charm conjure abracadabra fairy dream"],
  ["\u{1F9D9}", "wizard mage sorcerer witch warlock fantasy spell magic enchant mystical conjure potion robes hat staff supernatural arcane occult mythical legendary person"],
  ["\u{1F6E0}", "tools hammer wrench fix repair build maintain service kit utility workshop garage mechanic engineer construct assemble hardware equipment DIY craft"],
  ["\u{1FAB6}", "feather light write quill bird soft gentle pen airy delicate float breeze wispy plume calligraphy wing nature elegant weightless drift"],
  ["\u{1FAE7}", "bubbles soap float pop clean shiny transparent foam light airy sparkle iridescent wash rinse lather playful delicate fragile sphere drift"]
];

// src/utils/emojiPicker.ts
function createEmojiPicker(opts) {
  const {
    container,
    panelContainer,
    label,
    value,
    placeholder,
    rowClass,
    panelClass,
    onSelect,
    onClear,
    onBeforeOpen
  } = opts;
  let currentValue = value;
  const row = container.createDiv({ cls: rowClass ?? "emoji-picker-row" });
  if (label) {
    row.createSpan({ cls: "setting-item-name", text: label });
  }
  const triggerBtn = row.createEl("button", { cls: "emoji-picker-trigger" });
  const clearBtn = row.createEl("button", { cls: "emoji-picker-clear", text: "\u2715" });
  clearBtn.setAttribute("aria-label", "Clear emoji");
  const updateTrigger = () => {
    triggerBtn.empty();
    triggerBtn.createSpan({ text: currentValue || placeholder });
    triggerBtn.createSpan({ cls: "emoji-picker-chevron", text: "\u25BE" });
    triggerBtn.toggleClass("is-placeholder", !currentValue);
    clearBtn.toggleClass("hp-hidden", !currentValue);
  };
  updateTrigger();
  const panelParent = panelContainer ?? container;
  const panelCls = panelClass ? `emoji-picker-panel ${panelClass}` : "emoji-picker-panel";
  const panel = panelParent.createDiv({ cls: panelCls });
  panel.addClass("hp-hidden");
  const searchInput = panel.createEl("input", {
    cls: "emoji-picker-search",
    attr: { type: "text", placeholder: "Search emojis\u2026" }
  });
  const gridEl = panel.createDiv({ cls: "emoji-picker-grid" });
  const renderGrid = (query) => {
    gridEl.empty();
    const q = query.toLowerCase().trim();
    const filtered = q ? EMOJI_PICKER_SET.filter(([e, kw]) => kw.includes(q) || e === q) : EMOJI_PICKER_SET;
    for (const [emoji] of filtered) {
      const btn = gridEl.createEl("button", { cls: "emoji-btn", text: emoji });
      if (currentValue === emoji) btn.addClass("is-selected");
      btn.addEventListener("click", () => {
        currentValue = emoji;
        updateTrigger();
        onSelect(emoji);
        close();
      });
    }
    if (filtered.length === 0) {
      gridEl.createSpan({ cls: "emoji-picker-empty", text: "No results" });
    }
  };
  let outsideClickAc = null;
  triggerBtn.addEventListener("click", () => {
    if (!panel.hasClass("hp-hidden")) {
      close();
    } else {
      onBeforeOpen?.();
      panel.removeClass("hp-hidden");
      searchInput.value = "";
      renderGrid("");
      searchInput.focus();
      outsideClickAc?.abort();
      outsideClickAc = new AbortController();
      document.addEventListener("mousedown", (e) => {
        const target = e.target;
        if (!panel.contains(target) && !triggerBtn.contains(target) && !clearBtn.contains(target)) {
          close();
        }
      }, { signal: outsideClickAc.signal });
    }
  });
  clearBtn.addEventListener("click", () => {
    currentValue = "";
    updateTrigger();
    onClear();
    close();
  });
  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderGrid(searchInput.value), 100);
  });
  const close = () => {
    panel.addClass("hp-hidden");
    outsideClickAc?.abort();
    outsideClickAc = null;
  };
  const destroy = () => {
    row.remove();
    panel.remove();
  };
  return { close, destroy };
}

// src/utils/blockStyling.ts
var HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
function hexChannelToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function getRelativeLuminance(hex) {
  const r = hexChannelToLinear(parseInt(hex.slice(1, 3), 16));
  const g = hexChannelToLinear(parseInt(hex.slice(3, 5), 16));
  const b = hexChannelToLinear(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
var VALID_BORDER_STYLES = ["solid", "dashed", "dotted"];
function applyBlockStyling(el, config) {
  const accentColor = typeof config._accentColor === "string" && HEX_COLOR_RE.test(config._accentColor) ? config._accentColor : "";
  el.toggleClass("block-accented", !!accentColor);
  el.toggleClass("block-no-header-accent", config._hideHeaderAccent === true);
  if (accentColor) {
    el.style.setProperty("--block-accent", accentColor);
    const intensity = typeof config._accentIntensity === "number" ? Math.max(5, Math.min(100, config._accentIntensity)) : 0;
    if (intensity && intensity !== 15) {
      el.style.setProperty("--block-accent-pct", `${intensity}%`);
    } else {
      el.style.removeProperty("--block-accent-pct");
    }
    const DARK_BASE_LUM = 0.05;
    const BRIGHT_ACCENT_THRESHOLD = 0.18;
    const effectiveIntensity = intensity || 15;
    const ratio = effectiveIntensity / 100;
    const blendedLum = DARK_BASE_LUM * (1 - ratio) + getRelativeLuminance(accentColor) * ratio;
    const needsDarkText = blendedLum >= BRIGHT_ACCENT_THRESHOLD;
    el.toggleClass("block-bright-accent", needsDarkText);
  } else {
    el.style.removeProperty("--block-accent");
    el.style.removeProperty("--block-accent-pct");
    el.toggleClass("block-bright-accent", false);
  }
  el.toggleClass("block-no-border", config._hideBorder === true);
  el.toggleClass("block-no-background", config._hideBackground === true);
  const pad = typeof config._cardPadding === "number" ? Math.max(-48, Math.min(48, config._cardPadding)) : 0;
  if (pad) el.style.setProperty("--hp-card-padding", `${pad}px`);
  else el.style.removeProperty("--hp-card-padding");
  const gap = typeof config._titleGap === "number" ? Math.max(0, Math.min(48, config._titleGap)) : 0;
  if (gap) el.style.setProperty("--hp-title-gap", `${gap}px`);
  else el.style.removeProperty("--hp-title-gap");
  for (let i = 1; i <= 3; i++) el.removeClass(`block-elevation-${i}`);
  const elevation = typeof config._elevation === "number" ? Math.max(0, Math.min(3, config._elevation)) : 0;
  if (elevation) el.addClass(`block-elevation-${elevation}`);
  const borderRadius = typeof config._borderRadius === "number" ? Math.max(0, Math.min(24, config._borderRadius)) : 0;
  if (borderRadius) el.style.setProperty("--hp-border-radius", `${borderRadius}px`);
  else el.style.removeProperty("--hp-border-radius");
  const bgOpacity = typeof config._bgOpacity === "number" ? Math.max(0, Math.min(100, config._bgOpacity)) : 100;
  el.toggleClass("block-custom-opacity", bgOpacity < 100);
  if (bgOpacity < 100) el.style.setProperty("--hp-bg-opacity", `${bgOpacity}%`);
  else el.style.removeProperty("--hp-bg-opacity");
  const backdropBlur = typeof config._backdropBlur === "number" ? Math.max(0, Math.min(20, config._backdropBlur)) : 0;
  if (backdropBlur > 0 && bgOpacity < 100) {
    el.style.setProperty("--hp-backdrop-blur", `blur(${backdropBlur}px)`);
  } else {
    el.style.removeProperty("--hp-backdrop-blur");
  }
  const gradStart = typeof config._gradientStart === "string" && HEX_COLOR_RE.test(config._gradientStart) ? config._gradientStart : "";
  const gradEnd = typeof config._gradientEnd === "string" && HEX_COLOR_RE.test(config._gradientEnd) ? config._gradientEnd : "";
  const gradAngle = typeof config._gradientAngle === "number" ? Math.max(0, Math.min(360, config._gradientAngle)) : 135;
  if (gradStart && gradEnd && config._hideBackground !== true) {
    el.style.setProperty("--hp-bg-gradient", `linear-gradient(${gradAngle}deg, ${gradStart}, ${gradEnd})`);
    el.toggleClass("block-has-gradient", true);
  } else {
    el.style.removeProperty("--hp-bg-gradient");
    el.toggleClass("block-has-gradient", false);
  }
  const borderWidth = typeof config._borderWidth === "number" ? Math.max(0, Math.min(4, config._borderWidth)) : 0;
  if (borderWidth) el.style.setProperty("--hp-border-width", `${borderWidth}px`);
  else el.style.removeProperty("--hp-border-width");
  const borderStyle = typeof config._borderStyle === "string" && VALID_BORDER_STYLES.includes(config._borderStyle) ? config._borderStyle : "";
  if (borderStyle) el.style.setProperty("--hp-border-style", borderStyle);
  else el.style.removeProperty("--hp-border-style");
}

// src/GridLayout.ts
var HEX_COLOR_RE2 = /^#[0-9a-fA-F]{6}$/;
var COMPACT_EDIT_H = 2;
var ACCENT_PRESETS = [
  "#c0392b",
  "#e67e22",
  "#f1c40f",
  "#ffef3a",
  "#27ae60",
  "#16a085",
  "#2980b9",
  "#8e44ad",
  "#e84393",
  "#6c5ce7",
  "#636e72"
];
var GridLayout = class _GridLayout {
  constructor(containerEl, app, plugin, onLayoutChange) {
    this.app = app;
    this.plugin = plugin;
    this.onLayoutChange = onLayoutChange;
    this.gridEl = containerEl.createDiv({ cls: "homepage-grid grid-stack" });
    this.effectiveColumns = plugin.layout.columns;
  }
  gridEl;
  gridStack = null;
  blocks = /* @__PURE__ */ new Map();
  animTimer = null;
  editMode = false;
  columns = 3;
  pendingRafs = /* @__PURE__ */ new Set();
  resizeObserver = null;
  effectiveColumns;
  userColumns = 3;
  isDestroyed = false;
  /** Callback to trigger the Add Block modal from the empty state CTA. */
  onRequestAddBlock = null;
  /** ID of the most recently added block — used for scroll-into-view. */
  lastAddedBlockId = null;
  /** Expose the root grid element so HomepageView can reorder it in the DOM. */
  getElement() {
    return this.gridEl;
  }
  render(blocks, columns, isInitial = false) {
    this.destroyAll();
    this.isDestroyed = false;
    this.gridEl.setAttribute("role", "list");
    this.gridEl.setAttribute("aria-label", "Homepage blocks");
    if (isInitial) {
      this.gridEl.addClass("homepage-grid--animating");
      if (this.animTimer) clearTimeout(this.animTimer);
      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        this.gridEl.removeClass("homepage-grid--animating");
      }, 500);
    }
    if (this.editMode) {
      this.gridEl.addClass("edit-mode");
    } else {
      this.gridEl.removeClass("edit-mode");
    }
    if (blocks.length === 0) {
      this.renderEmptyState();
      return;
    }
    this.initGridStack(blocks, columns, isInitial);
  }
  renderEmptyState() {
    this.gridEl.empty();
    const empty = this.gridEl.createDiv({ cls: "homepage-empty-state" });
    empty.createDiv({ cls: "homepage-empty-icon", text: "\u{1F3E0}" });
    empty.createEl("p", { cls: "homepage-empty-title", text: "Your homepage is empty" });
    empty.createEl("p", {
      cls: "homepage-empty-desc",
      text: this.editMode ? "Click the button below to add your first block." : "Add blocks to build your personal dashboard. Toggle Edit mode in the toolbar to get started."
    });
    if (this.editMode && this.onRequestAddBlock) {
      const cta = empty.createEl("button", { cls: "homepage-empty-cta", text: "Add your first block" });
      cta.addEventListener("click", () => {
        this.onRequestAddBlock?.();
      });
    }
  }
  initGridStack(blocks, columns, isInitial) {
    const items = blocks.map((instance) => ({
      id: instance.id,
      x: instance.x,
      y: instance.y,
      w: Math.min(instance.w, columns),
      h: this.editMode && this.shouldAutoHeight(instance) ? COMPACT_EDIT_H : instance.h
      // Do NOT pass sizeToContent here — GridStack calls resizeToContent() during
      // load() before we've added any DOM content, causing "firstElementChild is null".
      // We call resizeToContent() manually after building each block's DOM below.
    }));
    _GridLayout.packRows(items, columns);
    this.columns = columns;
    this.gridStack = GridStack.init({
      column: columns,
      cellHeight: 80,
      margin: 8,
      float: true,
      animate: true,
      staticGrid: !this.editMode,
      removable: false,
      handleClass: "block-move-handle",
      // Horizontal-only resize in edit mode (vertical managed by sizeToContent / GridStack rows).
      // In view mode, staticGrid disables all interaction so handles are irrelevant.
      resizable: { handles: "e,s,se" }
    }, this.gridEl);
    this.gridStack.load(items);
    for (const [i, instance] of blocks.entries()) {
      const gsEl = this.gridEl.querySelector(`[gs-id="${CSS.escape(instance.id)}"]`);
      if (!(gsEl instanceof HTMLElement)) continue;
      gsEl.setAttribute("role", "listitem");
      if (this.shouldAutoHeight(instance)) {
        gsEl.classList.add("is-auto-height");
      } else {
        gsEl.classList.remove("is-auto-height");
      }
      const gsContent = gsEl.querySelector(".grid-stack-item-content");
      if (!(gsContent instanceof HTMLElement)) continue;
      const animDelayMs = isInitial ? [0, 50, 100, 140, 170, 195, 215, 230][i] ?? 240 : void 0;
      const wrapper = this.buildBlockWrapper(gsContent, instance, animDelayMs);
      const headerZone = wrapper.querySelector(".block-header-zone");
      const contentEl = wrapper.querySelector(".block-content");
      if (!(contentEl instanceof HTMLElement) || !(headerZone instanceof HTMLElement)) continue;
      const factory = BlockRegistry.get(instance.type);
      if (!factory) continue;
      if (this.editMode) {
        this.renderCompactPlaceholder(headerZone, contentEl, factory, instance);
        this.blocks.set(instance.id, { block: null, wrapper });
      } else {
        const block = factory.create(this.app, instance, this.plugin);
        block.setHeaderContainer(headerZone);
        block.load();
        const needsResize = this.shouldAutoHeight(instance);
        if (needsResize) {
          gsEl.addEventListener("request-auto-height", () => {
            this.scheduleResize(gsEl, instance);
          });
        }
        const result = block.render(contentEl);
        if (result instanceof Promise) {
          result.then(() => {
            if (needsResize) this.scheduleResize(gsEl, instance);
          }).catch((e) => {
            console.error(`[Homepage Blocks] Error rendering block ${instance.type}:`, e);
            contentEl.setText("Error rendering block. Check console for details.");
          });
        } else if (needsResize) {
          this.scheduleResize(gsEl, instance);
        }
        this.blocks.set(instance.id, { block, wrapper });
      }
      this.setupCollapseToggle(gsEl, instance, headerZone);
      if (this.editMode) {
        this.attachEditHandles(wrapper, instance);
      }
    }
    this.gridStack.on("dragstop", () => {
      this.syncLayoutFromGrid();
    });
    this.gridStack.on("resizestop", () => {
      this.syncLayoutFromGrid();
    });
    const viewEl = this.gridEl.closest(".homepage-view");
    this.setupResponsiveColumns(viewEl instanceof HTMLElement ? viewEl : null, columns);
    if (this.lastAddedBlockId) {
      const targetId = this.lastAddedBlockId;
      this.lastAddedBlockId = null;
      const el = this.gridEl.querySelector(`[gs-id="${CSS.escape(targetId)}"]`);
      if (el instanceof HTMLElement) {
        el.querySelector(".homepage-block-wrapper")?.addClass("block-just-added");
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }
  /** Build the block wrapper DOM inside a GridStack item content div using Obsidian's DOM API. */
  buildBlockWrapper(container, instance, animDelayMs) {
    const classes = ["homepage-block-wrapper"];
    const effectiveCollapsed = instance.collapsed && instance.config._hideTitle !== true;
    if (effectiveCollapsed) classes.push("block-collapsed");
    const wrapper = container.createDiv({
      cls: classes.join(" "),
      attr: { "data-block-id": instance.id }
    });
    applyBlockStyling(wrapper, instance.config);
    if (animDelayMs !== void 0) {
      wrapper.style.setProperty("--hp-card-anim-delay", `${animDelayMs}ms`);
    }
    const headerZone = wrapper.createDiv({
      cls: "block-header-zone",
      attr: { role: "button", tabindex: "0", "aria-expanded": String(!effectiveCollapsed) }
    });
    headerZone.createSpan({
      cls: "block-collapse-chevron" + (effectiveCollapsed ? " is-collapsed" : ""),
      attr: { "aria-hidden": "true" }
    });
    if (instance.config._showDivider === true) {
      wrapper.createDiv({ cls: "block-header-divider" });
    }
    wrapper.createDiv({ cls: "block-content" });
    return wrapper;
  }
  /** Render a lightweight symbolic placeholder for edit mode (no real block content). */
  renderCompactPlaceholder(headerZone, contentEl, factory, instance) {
    const titleLabel = typeof instance.config._titleLabel === "string" && instance.config._titleLabel ? instance.config._titleLabel : factory.displayName;
    const emoji = typeof instance.config._titleEmoji === "string" ? instance.config._titleEmoji : "";
    const header = headerZone.createDiv({ cls: "block-header" });
    if (emoji) header.createEl("em", { cls: "block-header-emoji", text: emoji });
    header.createSpan({ text: titleLabel });
    const info = contentEl.createDiv({ cls: "block-compact-info" });
    info.createSpan({ cls: "block-compact-type", text: instance.type });
    info.createSpan({ cls: "block-compact-size", text: `${instance.w}\xD7${instance.h}` });
  }
  /**
   * Resize a block's grid row to fit its natural content height.
   *
   * GridStack's built-in resizeToContent() measures .homepage-block-wrapper which has
   * height:100%, so it always returns the current cell height — never growing.
   * Instead we look for a [data-auto-height-content] element placed by the block,
   * which has height:auto and reports its true rendered height via offsetHeight.
   */
  /**
   * Schedule a resizeBlockToContent call.  All requests within the same frame
   * are coalesced into a single batch to prevent cross-block resize cascading
   * (Block A resize → column reflow → Block B width change → Block B resize → …).
   */
  pendingResizes = /* @__PURE__ */ new Map();
  batchRafId = null;
  scheduleResize(gsEl, instance) {
    this.pendingResizes.set(instance.id, { gsEl, instance });
    if (this.batchRafId !== null) return;
    this.batchRafId = requestAnimationFrame(() => {
      this.pendingRafs.delete(this.batchRafId);
      this.batchRafId = null;
      const batch = Array.from(this.pendingResizes.values());
      this.pendingResizes.clear();
      if (!this.gridStack) return;
      const isStatic = !!this.gridStack.opts.staticGrid;
      if (isStatic) this.gridStack.setStatic(false);
      let anyResized = false;
      for (const { gsEl: el, instance: inst } of batch) {
        if (this.resizeBlockToContent(el, inst)) anyResized = true;
      }
      console.log(`[HP repack] anyResized=${anyResized}`);
      if (anyResized) {
        const nodeItems = [];
        for (const gsEl2 of this.gridStack.getGridItems()) {
          const node = gsEl2.gridstackNode;
          if (!node) continue;
          nodeItems.push({ el: gsEl2, x: node.x ?? 0, y: node.y ?? 0, w: node.w ?? 1, h: node.h ?? 1 });
        }
        _GridLayout.packRows(nodeItems, this.effectiveColumns);
        this.gridStack.batchUpdate();
        for (const item of nodeItems) {
          this.gridStack.update(item.el, { y: item.y });
        }
        this.gridStack.batchUpdate(false);
        this.syncLayoutFromGrid();
      }
      if (isStatic) this.gridStack.setStatic(true);
    });
    this.pendingRafs.add(this.batchRafId);
  }
  /** Measure a block's natural content height and update its GridStack row count.
   *  Returns true if the height was changed. */
  resizeBlockToContent(gsEl, instance) {
    if (!this.gridStack || !gsEl.isConnected) return false;
    console.log(`%c[HP_TRACE] resizeBlockToContent called for ${instance.type} (${instance.id})`, "color: #ff00ff; font-size: 14px; font-weight: bold");
    const contentEl = gsEl.querySelector("[data-auto-height-content]");
    const headerZone = gsEl.querySelector(".block-header-zone");
    if (!contentEl || !headerZone) {
      console.log(`%c[HP_TRACE] Early exit for ${instance.type} - missing [data-auto-height-content] or header zone`, "color: #ffaa00");
      return false;
    }
    const blockContent = gsEl.querySelector(".block-content");
    if (blockContent) {
      blockContent.addClass("hp-no-transition");
      blockContent.addClass("hp-auto-rows");
    }
    const contentH = contentEl.offsetHeight;
    const contentRect = contentEl.getBoundingClientRect();
    const contentStyle = window.getComputedStyle(contentEl);
    const lastChild = contentEl.lastElementChild;
    const lastChildBottom = lastChild ? lastChild.getBoundingClientRect().bottom - contentEl.getBoundingClientRect().top : 0;
    console.log(`[HP measure-debug] ${instance.type} offsetH=${contentH} rectH=${contentRect.height.toFixed(0)} scrollH=${contentEl.scrollHeight} cols=${contentStyle.getPropertyValue("columns")} lastChildBot=${lastChildBottom.toFixed(0)} children=${contentEl.children.length}`);
    if (blockContent) {
      blockContent.removeClass("hp-auto-rows");
      void blockContent.offsetHeight;
      blockContent.removeClass("hp-no-transition");
    }
    if (contentH <= 0) return false;
    const wrapper = gsEl.querySelector(".homepage-block-wrapper");
    const wrapperStyle = wrapper ? window.getComputedStyle(wrapper) : null;
    const pad = wrapperStyle ? parseFloat(wrapperStyle.paddingTop) + parseFloat(wrapperStyle.paddingBottom) : 24;
    const gap = wrapperStyle ? parseFloat(wrapperStyle.gap) || 0 : 0;
    const divider = wrapper?.querySelector(".block-header-divider");
    const gapCount = divider ? 2 : 1;
    const margin = typeof this.gridStack.opts.margin === "number" ? this.gridStack.opts.margin : 8;
    const totalH = headerZone.offsetHeight + pad + contentH + gap * gapCount + margin * 2;
    const cell = this.gridStack.getCellHeight();
    const rows = Math.max(1, Math.ceil(totalH / cell));
    const node = gsEl.gridstackNode;
    const currentH = node?.h ?? instance.h;
    console.log(`[HP auto-height] ${instance.type} contentH=${contentH} headerH=${headerZone.offsetHeight} pad=${pad} gap=${gap} totalH=${totalH} cell=${cell} \u2192 rows=${rows} (current=${currentH})`);
    if (rows !== currentH) {
      this.gridStack.update(gsEl, { h: rows });
      return true;
    }
    return false;
  }
  /** Determine if a block should auto-expand beyond its grid cell height. */
  shouldAutoHeight(instance) {
    const hm = instance.config.heightMode;
    const heightMode = typeof hm === "string" ? hm : "";
    if (instance.type === "image-gallery") return heightMode !== "fixed";
    if (instance.type === "quotes-list") return heightMode === "extend";
    if (instance.type === "button-grid") return true;
    if (instance.type === "embedded-note" && heightMode === "grow") return true;
    if (instance.type === "static-text") return heightMode !== "fixed";
    if (instance.type === "random-note") return true;
    return false;
  }
  setupCollapseToggle(gsEl, instance, headerZone) {
    const wrapper = gsEl.querySelector(".homepage-block-wrapper");
    const chevron = headerZone.querySelector(".block-collapse-chevron");
    if (!wrapper || !chevron) return;
    const toggleCollapse = (e) => {
      e.stopPropagation();
      if (this.editMode) return;
      const isNowCollapsed = !wrapper.hasClass("block-collapsed");
      wrapper.toggleClass("block-collapsed", isNowCollapsed);
      chevron.toggleClass("is-collapsed", isNowCollapsed);
      headerZone.setAttribute("aria-expanded", String(!isNowCollapsed));
      const gsNode = gsEl.gridstackNode;
      let newBlocks;
      if (isNowCollapsed) {
        const liveH = gsNode?.h ?? instance.h;
        if (this.gridStack) this.gridStack.update(gsEl, { h: 1 });
        newBlocks = this.plugin.layout.blocks.map(
          (b) => b.id === instance.id ? { ...b, collapsed: true, _expandedH: liveH } : b
        );
      } else {
        const currentBlock = this.plugin.layout.blocks.find((b) => b.id === instance.id);
        const origH = currentBlock?._expandedH ?? instance.h;
        if (this.gridStack) this.gridStack.update(gsEl, { h: origH });
        newBlocks = this.plugin.layout.blocks.map(
          (b) => b.id === instance.id ? { ...b, collapsed: false, h: origH } : b
        );
      }
      void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
    };
    headerZone.addEventListener("click", toggleCollapse);
    headerZone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleCollapse(e);
      }
    });
  }
  attachEditHandles(wrapper, instance) {
    const bar = wrapper.createDiv({ cls: "block-handle-bar" });
    const handle = bar.createDiv({ cls: "block-move-handle" });
    (0, import_obsidian.setIcon)(handle, "grip-vertical");
    handle.setAttribute("aria-label", "Drag to reorder");
    handle.setAttribute("title", "Drag to reorder");
    const moveUpBtn = bar.createEl("button", { cls: "block-move-up-btn" });
    (0, import_obsidian.setIcon)(moveUpBtn, "chevron-up");
    moveUpBtn.setAttribute("aria-label", "Move block up");
    moveUpBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.swapWithNeighbor(instance, "up");
    });
    const moveDownBtn = bar.createEl("button", { cls: "block-move-down-btn" });
    (0, import_obsidian.setIcon)(moveDownBtn, "chevron-down");
    moveDownBtn.setAttribute("aria-label", "Move block down");
    moveDownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.swapWithNeighbor(instance, "down");
    });
    const dupBtn = bar.createEl("button", { cls: "block-duplicate-btn" });
    (0, import_obsidian.setIcon)(dupBtn, "copy");
    dupBtn.setAttribute("aria-label", "Duplicate block");
    dupBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const current = this.plugin.layout.blocks.find((b) => b.id === instance.id);
      if (!current) return;
      const clone = {
        ...structuredClone(current),
        id: crypto.randomUUID(),
        y: current.y + current.h
      };
      const newBlocks = [...this.plugin.layout.blocks, clone];
      this.lastAddedBlockId = clone.id;
      this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
      this.rerender();
    });
    const settingsBtn = bar.createEl("button", { cls: "block-settings-btn" });
    (0, import_obsidian.setIcon)(settingsBtn, "settings");
    settingsBtn.setAttribute("aria-label", "Block settings");
    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const entry = this.blocks.get(instance.id);
      if (!entry) return;
      const onSave = (config) => {
        const newBlocks = this.plugin.layout.blocks.map(
          (b) => b.id === instance.id ? { ...b, config } : b
        );
        this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
        this.rerender();
      };
      let tempBlock = null;
      const block = entry.block ?? (() => {
        const factory = BlockRegistry.get(instance.type);
        if (!factory) return null;
        tempBlock = factory.create(this.app, instance, this.plugin);
        return tempBlock;
      })();
      if (!block) return;
      const modal = new BlockSettingsModal(this.app, instance, block, (config) => {
        if (tempBlock) tempBlock.unload();
        onSave(config);
      });
      modal.open();
    });
    const removeBtn = bar.createEl("button", { cls: "block-remove-btn" });
    (0, import_obsidian.setIcon)(removeBtn, "x");
    removeBtn.setAttribute("aria-label", "Remove block");
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      new RemoveBlockConfirmModal(this.app, () => {
        const gsItem = this.gridEl.querySelector(`[gs-id="${CSS.escape(instance.id)}"]`);
        if (gsItem instanceof HTMLElement && this.gridStack) {
          this.gridStack.removeWidget(gsItem);
          this.gridStack.compact();
        }
        const entry = this.blocks.get(instance.id);
        if (entry) {
          entry.block?.unload();
          this.blocks.delete(instance.id);
        }
        const remaining = this.plugin.layout.blocks.filter((b) => b.id !== instance.id);
        if (remaining.length === 0) {
          this.onLayoutChange({ ...this.plugin.layout, blocks: [] });
          this.rerender();
          return;
        }
        if (!this.gridStack) {
          this.onLayoutChange({ ...this.plugin.layout, blocks: remaining });
          return;
        }
        const posMap = /* @__PURE__ */ new Map();
        for (const el of this.gridStack.getGridItems()) {
          const node = el.gridstackNode;
          const id = el.getAttribute("gs-id");
          if (id && node) {
            posMap.set(id, { x: node.x ?? 0, y: node.y ?? 0, w: node.w ?? 1, h: node.h ?? 1 });
          }
        }
        const newBlocks = remaining.map((b) => {
          const pos = posMap.get(b.id);
          if (!pos) return b;
          const update = this.editMode ? { x: pos.x, y: pos.y, w: pos.w } : pos;
          return { ...b, ...update };
        });
        this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
      }).open();
    });
    const headerZone = wrapper.querySelector(".block-header-zone");
    if (headerZone) {
      wrapper.insertBefore(bar, headerZone);
    }
  }
  /** Swap a block's position with its nearest spatial neighbor in the given direction. */
  swapWithNeighbor(instance, direction) {
    const blocks = this.plugin.layout.blocks;
    const current = blocks.find((b) => b.id === instance.id);
    if (!current) return;
    const columns = this.plugin.layout.columns;
    const neighbor = blocks.filter((b) => b.id !== instance.id && (direction === "up" ? b.y < current.y || b.y === current.y && b.x < current.x : b.y > current.y || b.y === current.y && b.x > current.x)).sort(
      (a, b) => direction === "up" ? b.y - a.y || b.x - a.x : a.y - b.y || a.x - b.x
    )[0];
    if (!neighbor) return;
    const newBlocks = blocks.map((b) => {
      if (b.id === current.id) {
        return { ...b, x: Math.min(neighbor.x, Math.max(0, columns - current.w)), y: neighbor.y };
      }
      if (b.id === neighbor.id) {
        return { ...b, x: Math.min(current.x, Math.max(0, columns - neighbor.w)), y: current.y };
      }
      return b;
    });
    this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
    this.rerender();
  }
  /** Read current positions from GridStack nodes and persist to layout. */
  syncLayoutFromGrid() {
    if (!this.gridStack) return;
    const nodes = this.gridStack.getGridItems();
    const posMap = /* @__PURE__ */ new Map();
    for (const el of nodes) {
      const node = el.gridstackNode;
      const id = el.getAttribute("gs-id");
      if (id && node) {
        const w = Math.min(node.w ?? 1, this.columns);
        posMap.set(id, {
          x: Math.min(node.x ?? 0, Math.max(0, this.columns - w)),
          y: node.y ?? 0,
          w,
          h: node.h ?? 1
        });
      }
    }
    const changed = this.plugin.layout.blocks.some((b) => {
      const pos = posMap.get(b.id);
      if (!pos) return false;
      const isAuto = this.shouldAutoHeight(b);
      if (this.editMode) return b.x !== pos.x || b.y !== pos.y || b.w !== pos.w || !isAuto && b.h !== pos.h;
      return b.x !== pos.x || b.y !== pos.y || b.w !== pos.w || b.h !== pos.h;
    });
    if (!changed) return;
    const newBlocks = this.plugin.layout.blocks.map((b) => {
      const pos = posMap.get(b.id);
      if (!pos) return b;
      const isAuto = this.shouldAutoHeight(b);
      const update = this.editMode ? { x: pos.x, y: pos.y, w: pos.w, ...isAuto ? {} : { h: pos.h } } : pos;
      return { ...b, ...update };
    });
    this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
  }
  setEditMode(enabled, skipRepack = false) {
    if (!enabled && this.editMode && !skipRepack) {
      const repacked = _GridLayout.repackEditLayout(
        this.plugin.layout.blocks,
        this.effectiveColumns
      );
      this.onLayoutChange({ ...this.plugin.layout, blocks: repacked });
    }
    this.editMode = enabled;
    if (this.gridStack) {
      this.gridStack.setStatic(!enabled);
    }
    this.rerender();
    if (!enabled) {
      this.setZoom(1);
    }
  }
  /**
   * Greedy column-height packing: sort items by position, then assign each
   * the lowest available y in its target columns. Mutates items in place.
   * Works on any object with { x, y, w, h } (GridStackWidget or BlockInstance).
   */
  static packRows(items, columns) {
    const safeCols = Math.max(1, columns);
    items.sort(
      (a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0)
    );
    const colHeights = new Array(safeCols).fill(0);
    for (const item of items) {
      const w = Math.min(item.w ?? 1, safeCols);
      const x = Math.max(0, Math.min(item.x ?? 0, safeCols - w));
      let maxH = 0;
      for (let c = x; c < x + w; c++) {
        maxH = Math.max(maxH, colHeights[c] ?? 0);
      }
      item.x = x;
      item.y = maxH;
      for (let c = x; c < x + w; c++) {
        colHeights[c] = maxH + (item.h ?? 1);
      }
    }
  }
  /**
   * After exiting compact edit mode, y-positions saved during editing
   * reflect compact heights and may overlap at full view-mode heights.
   * Re-pack into a collision-free layout using real h values.
   */
  static repackEditLayout(blocks, columns) {
    const packed = blocks.map((b) => ({ ...b }));
    _GridLayout.packRows(packed, columns);
    return packed;
  }
  /** Compute zoom scale that fits all grid content in the viewport. */
  computeFitZoom() {
    if (!this.gridEl.isConnected) return 1;
    const viewportHeight = this.gridEl.parentElement?.clientHeight ?? 0;
    const contentHeight = this.gridEl.scrollHeight;
    if (viewportHeight <= 0 || contentHeight <= viewportHeight) return 1;
    const scale = viewportHeight / contentHeight;
    return Math.max(0.75, Math.min(1, Math.round(scale * 20) / 20));
  }
  /** Apply a zoom scale (0.1–1) via CSS transform. */
  setZoom(scale) {
    if (!this.gridEl.isConnected) return;
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;
    if (scale >= 1) {
      this.gridEl.style.removeProperty("--hp-grid-transform");
      this.gridEl.removeClass("hp-zoomed");
      this.gridEl.removeClass("viewport-fit");
      return;
    }
    this.gridEl.style.setProperty("--hp-grid-transform", `scale(${scale})`);
    this.gridEl.addClass("hp-zoomed");
    this.gridEl.addClass("viewport-fit");
  }
  /** Update column count, clamping each block's w to fit. */
  setColumns(n) {
    const newBlocks = this.plugin.layout.blocks.map((b) => ({
      ...b,
      w: Math.min(b.w, n)
    }));
    this.onLayoutChange({ ...this.plugin.layout, columns: n, blocks: newBlocks });
    this.rerender();
  }
  /** Get the current effective column count (may differ from user's saved value on narrow screens). */
  getEffectiveColumns() {
    return this.effectiveColumns;
  }
  /**
   * Compute effective columns from container width and user's desired max.
   * Breakpoints: 480 / 768 / 1024 (column reduction).
   * See also styles.css container queries: 380 / 540 / 768 (CSS adaptation).
   */
  computeEffective(width) {
    const max = this.userColumns;
    if (width < 480) return 1;
    if (width < 768) return Math.min(2, max);
    if (width < 1024) return Math.min(3, max);
    return max;
  }
  /**
   * Apply a column count change: clamp block widths (keep original proportions,
   * don't scale down), then repack so blocks stack vertically at narrower widths
   * instead of sitting side-by-side with huge height mismatches.
   */
  applyColumnChange(next) {
    if (!this.gridStack) return;
    const prev = this.effectiveColumns;
    this.effectiveColumns = next;
    this.gridStack.column(next, "none");
    const nodeItems = [];
    for (const gsEl of this.gridStack.getGridItems()) {
      const node = gsEl.gridstackNode;
      if (!node) continue;
      const w = Math.min(node.w ?? 1, next);
      const x = Math.min(node.x ?? 0, Math.max(0, next - w));
      nodeItems.push({ el: gsEl, x, y: node.y ?? 0, w, h: node.h ?? 1 });
    }
    _GridLayout.packRows(nodeItems, next);
    this.gridStack.batchUpdate();
    for (const item of nodeItems) {
      this.gridStack.update(item.el, { w: item.w, x: item.x, y: item.y });
    }
    this.gridStack.batchUpdate(false);
  }
  /**
   * Observe container width and dynamically adjust GridStack column count.
   * The user's saved column count (`this.userColumns`) acts as the desired maximum.
   * The observer persists across rerenders — only created once, disconnected in destroy().
   */
  setupResponsiveColumns(viewEl, userCols) {
    this.userColumns = userCols;
    if (!viewEl) return;
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        if (this.isDestroyed || !this.gridStack) return;
        const entry = entries[0];
        if (!entry) return;
        const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        const next = this.computeEffective(width);
        if (next !== this.effectiveColumns) {
          this.applyColumnChange(next);
        }
      });
      this.resizeObserver.observe(viewEl);
    }
    this.effectiveColumns = this.computeEffective(viewEl.clientWidth);
    if (this.effectiveColumns !== userCols && this.gridStack) {
      this.applyColumnChange(this.effectiveColumns);
    }
  }
  addBlock(instance) {
    const maxY = this.plugin.layout.blocks.reduce((m, b) => Math.max(m, b.y + b.h), 0);
    const positioned = { ...instance, y: maxY };
    const newBlocks = [...this.plugin.layout.blocks, positioned];
    this.lastAddedBlockId = positioned.id;
    this.onLayoutChange({ ...this.plugin.layout, blocks: newBlocks });
    this.rerender();
  }
  rerender() {
    this.render(this.plugin.layout.blocks, this.plugin.layout.columns);
  }
  /** Unload all blocks and destroy GridStack instance. */
  destroyAll() {
    this.isDestroyed = true;
    if (this.animTimer) {
      clearTimeout(this.animTimer);
      this.animTimer = null;
    }
    for (const id of this.pendingRafs) cancelAnimationFrame(id);
    this.pendingRafs.clear();
    for (const { block } of this.blocks.values()) {
      block?.unload();
    }
    this.blocks.clear();
    if (this.gridStack) {
      this.gridStack.removeAll(false);
      this.gridStack.destroy(false);
      this.gridStack = null;
    }
    this.gridEl.empty();
    this.gridEl.removeClass("viewport-fit");
    this.gridEl.style.removeProperty("--hp-grid-transform");
    this.gridEl.removeClass("hp-zoomed");
  }
  /** Full teardown: unload blocks and remove the grid element from the DOM. */
  destroy() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.destroyAll();
    this.gridEl.remove();
  }
};
var BlockSettingsModal = class extends import_obsidian.Modal {
  constructor(app, instance, block, onSave) {
    super(app);
    this.instance = instance;
    this.block = block;
    this.onSave = onSave;
  }
  /** Create a collapsible section and return its body container. */
  createSection(parent, title, desc) {
    const header = parent.createDiv({ cls: "settings-collapsible-header" });
    header.createSpan({ cls: "settings-collapsible-chevron" });
    header.createSpan({ text: title });
    if (desc) header.createSpan({ cls: "settings-collapsible-desc", text: ` \u2014 ${desc}` });
    const body = parent.createDiv({ cls: "settings-collapsible-body is-collapsed" });
    header.addEventListener("click", () => {
      const collapsed = body.hasClass("is-collapsed");
      body.toggleClass("is-collapsed", !collapsed);
      header.toggleClass("is-open", collapsed);
    });
    return body;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian.Setting(contentEl).setName("Block settings").setHeading();
    const draft = structuredClone(this.instance.config);
    const factory = BlockRegistry.get(this.instance.type);
    const defaultTitle = factory?.displayName ?? this.instance.type;
    const previewCard = contentEl.createDiv({ cls: "settings-preview-card homepage-block-wrapper" });
    const previewHeaderZone = previewCard.createDiv({ cls: "block-header-zone" });
    const previewHeader = previewHeaderZone.createDiv({ cls: "block-header" });
    const previewEmoji = previewHeader.createSpan({ cls: "block-header-emoji" });
    const previewTitle = previewHeader.createSpan();
    const previewDivider = previewCard.createDiv({ cls: "block-header-divider" });
    const previewBody = previewCard.createDiv({ cls: "settings-preview-body" });
    previewBody.createSpan({ cls: "settings-preview-body-text", text: "Block content area" });
    let accentDirty = !!(typeof draft._accentColor === "string" && draft._accentColor);
    const hasGradStart = typeof draft._gradientStart === "string" && HEX_COLOR_RE2.test(draft._gradientStart);
    const hasGradEnd = typeof draft._gradientEnd === "string" && HEX_COLOR_RE2.test(draft._gradientEnd);
    let gradDirty = hasGradStart && hasGradEnd;
    const refreshPreview = () => {
      const label = typeof draft._titleLabel === "string" && draft._titleLabel || defaultTitle;
      const emoji = typeof draft._titleEmoji === "string" ? draft._titleEmoji : "";
      previewEmoji.setText(emoji);
      previewEmoji.toggleClass("hp-hidden", !emoji);
      previewTitle.setText(label);
      previewHeader.className = "block-header";
      const sz = typeof draft._titleSize === "string" && /^h[1-6]$/.test(draft._titleSize) ? draft._titleSize : "";
      if (sz) previewHeader.addClass(`block-header-${sz}`);
      previewHeaderZone.toggleClass("hp-hidden", draft._hideTitle === true);
      previewDivider.toggleClass("hp-hidden", draft._showDivider !== true);
      applyBlockStyling(previewCard, draft);
    };
    refreshPreview();
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText(`Configure ${defaultTitle}...`).setCta().onClick(() => {
        this.close();
        this.block.openSettings((blockConfig) => {
          const shared = Object.fromEntries(
            Object.entries(draft).filter(([k]) => k.startsWith("_"))
          );
          this.onSave({ ...blockConfig, ...shared });
        });
      })
    );
    const titleBody = this.createSection(contentEl, "Title & header", "Label, emoji, size, divider");
    new import_obsidian.Setting(titleBody).setName("Title label").setDesc("Leave empty to use the default title.").addText(
      (t) => t.setValue(typeof draft._titleLabel === "string" ? draft._titleLabel : "").setPlaceholder("Default title").onChange((v) => {
        draft._titleLabel = v;
        refreshPreview();
      })
    );
    createEmojiPicker({
      container: titleBody,
      label: "Title emoji",
      value: typeof draft._titleEmoji === "string" ? draft._titleEmoji : "",
      placeholder: "\uFF0B",
      onSelect: (emoji) => {
        draft._titleEmoji = emoji;
        refreshPreview();
      },
      onClear: () => {
        draft._titleEmoji = "";
        refreshPreview();
      }
    });
    new import_obsidian.Setting(titleBody).setName("Hide title").addToggle(
      (t) => t.setValue(draft._hideTitle === true).onChange((v) => {
        draft._hideTitle = v;
        refreshPreview();
      })
    );
    new import_obsidian.Setting(titleBody).setName("Title size").addDropdown(
      (d) => d.addOption("", "Default").addOption("h1", "H1").addOption("h2", "H2").addOption("h3", "H3").addOption("h4", "H4").addOption("h5", "H5").addOption("h6", "H6").setValue(typeof draft._titleSize === "string" ? draft._titleSize : "").onChange((v) => {
        draft._titleSize = /^h[1-6]$/.test(v) ? v : "";
        refreshPreview();
      })
    );
    new import_obsidian.Setting(titleBody).setName("Show divider after title").setDesc("Display a thin separator line between the title and the block content.").addToggle(
      (t) => t.setValue(draft._showDivider === true).onChange((v) => {
        draft._showDivider = v;
        refreshPreview();
      })
    );
    new import_obsidian.Setting(titleBody).setName("Title gap").setDesc("Space between the title and content in pixels (0 = default).").addSlider(
      (s) => s.setLimits(0, 48, 2).setValue(typeof draft._titleGap === "number" ? draft._titleGap : 0).setDynamicTooltip().onChange((v) => {
        draft._titleGap = v;
        refreshPreview();
      })
    );
    const cardBody = this.createSection(contentEl, "Card appearance", "Colors, borders, padding");
    let cpRef = null;
    const accentRow = new import_obsidian.Setting(cardBody).setName("Accent color").setDesc("Pick a color to tint the card header, background, and border.");
    const currentColor = typeof draft._accentColor === "string" ? draft._accentColor : "";
    accentRow.addColorPicker((cp) => {
      cpRef = cp;
      cp.setValue(currentColor || "#888888").onChange((v) => {
        draft._accentColor = v;
        accentDirty = true;
        refreshPreview();
      });
    });
    accentRow.addExtraButton(
      (btn) => btn.setIcon("x").setTooltip("Clear accent color").onClick(() => {
        draft._accentColor = "";
        accentDirty = false;
        cpRef?.setValue("#888888");
        refreshPreview();
      })
    );
    const swatchRow = cardBody.createDiv({ cls: "accent-preset-row" });
    for (const hex of ACCENT_PRESETS) {
      const swatch = swatchRow.createDiv({ cls: "accent-preset-swatch" });
      swatch.style.setProperty("--hp-swatch-bg", hex);
      swatch.setAttribute("aria-label", hex);
      swatch.addEventListener("click", () => {
        draft._accentColor = hex;
        accentDirty = true;
        cpRef?.setValue(hex);
        refreshPreview();
      });
    }
    new import_obsidian.Setting(cardBody).setName("Accent intensity").setDesc("How strong the accent tint appears on the card background (5\u2013100%).").addSlider((s) => {
      s.setLimits(5, 100, 5).setValue(typeof draft._accentIntensity === "number" ? draft._accentIntensity : 15).setDynamicTooltip().onChange((v) => {
        draft._accentIntensity = v;
        refreshPreview();
      });
      s.sliderEl.addEventListener("input", () => {
        draft._accentIntensity = s.getValue();
        refreshPreview();
      });
    });
    new import_obsidian.Setting(cardBody).setName("Hide border").setDesc("Remove the card border and hover highlight.").addToggle(
      (t) => t.setValue(draft._hideBorder === true).onChange((v) => {
        draft._hideBorder = v;
        refreshPreview();
      })
    );
    new import_obsidian.Setting(cardBody).setName("Hide background").setDesc("Remove the card background \u2014 the block blends into the page.").addToggle(
      (t) => t.setValue(draft._hideBackground === true).onChange((v) => {
        draft._hideBackground = v;
        refreshPreview();
      })
    );
    new import_obsidian.Setting(cardBody).setName("Hide header background").setDesc("Remove the colored header bar while keeping the card border and background tint.").addToggle(
      (t) => t.setValue(draft._hideHeaderAccent === true).onChange((v) => {
        draft._hideHeaderAccent = v;
        refreshPreview();
      })
    );
    new import_obsidian.Setting(cardBody).setName("Card padding").setDesc("Custom inner padding in pixels (0 = default). Supports negative values.").addSlider(
      (s) => s.setLimits(-48, 48, 4).setValue(typeof draft._cardPadding === "number" ? draft._cardPadding : 0).setDynamicTooltip().onChange((v) => {
        draft._cardPadding = v;
        refreshPreview();
      })
    );
    const advancedBody = this.createSection(contentEl, "Advanced styling", "Shadow, blur, gradients");
    new import_obsidian.Setting(advancedBody).setName("Shadow / elevation").setDesc("Card shadow depth (0 = none).").addDropdown(
      (d) => d.addOption("0", "None").addOption("1", "Subtle").addOption("2", "Medium").addOption("3", "Elevated").setValue(String(typeof draft._elevation === "number" ? draft._elevation : 0)).onChange((v) => {
        draft._elevation = Number(v);
        refreshPreview();
      })
    );
    new import_obsidian.Setting(advancedBody).setName("Border radius").setDesc("Corner rounding in pixels (0 = theme default).").addSlider(
      (s) => s.setLimits(0, 24, 2).setValue(typeof draft._borderRadius === "number" ? draft._borderRadius : 0).setDynamicTooltip().onChange((v) => {
        draft._borderRadius = v;
        refreshPreview();
      })
    );
    new import_obsidian.Setting(advancedBody).setName("Background opacity").setDesc("Background transparency (100 = fully opaque).").addSlider(
      (s) => s.setLimits(0, 100, 5).setValue(typeof draft._bgOpacity === "number" ? draft._bgOpacity : 100).setDynamicTooltip().onChange((v) => {
        draft._bgOpacity = v;
        refreshPreview();
      })
    );
    new import_obsidian.Setting(advancedBody).setName("Backdrop blur").setDesc("Glassmorphism blur behind the card (works when opacity < 100).").addSlider(
      (s) => s.setLimits(0, 20, 1).setValue(typeof draft._backdropBlur === "number" ? draft._backdropBlur : 0).setDynamicTooltip().onChange((v) => {
        draft._backdropBlur = v;
        refreshPreview();
      })
    );
    new import_obsidian.Setting(advancedBody).setName("Border width").setDesc("Border thickness in pixels (0 = default).").addSlider(
      (s) => s.setLimits(0, 4, 1).setValue(typeof draft._borderWidth === "number" ? draft._borderWidth : 0).setDynamicTooltip().onChange((v) => {
        draft._borderWidth = v;
        refreshPreview();
      })
    );
    new import_obsidian.Setting(advancedBody).setName("Border style").addDropdown(
      (d) => d.addOption("", "Default").addOption("solid", "Solid").addOption("dashed", "Dashed").addOption("dotted", "Dotted").setValue(typeof draft._borderStyle === "string" ? draft._borderStyle : "").onChange((v) => {
        draft._borderStyle = v;
        refreshPreview();
      })
    );
    const gradientNote = advancedBody.createEl("p", {
      text: "Background gradient (overrides background color when both colors are set):",
      cls: "setting-item-name"
    });
    gradientNote.addClass("hp-gradient-note");
    let gradStartRef = null;
    let gradEndRef = null;
    const gradStartRow = new import_obsidian.Setting(advancedBody).setName("Gradient start");
    gradStartRow.addColorPicker((cp) => {
      gradStartRef = cp;
      cp.setValue(typeof draft._gradientStart === "string" ? draft._gradientStart : "#667eea").onChange((v) => {
        draft._gradientStart = v;
        gradDirty = true;
        refreshPreview();
      });
    });
    const gradEndRow = new import_obsidian.Setting(advancedBody).setName("Gradient end");
    gradEndRow.addColorPicker((cp) => {
      gradEndRef = cp;
      cp.setValue(typeof draft._gradientEnd === "string" ? draft._gradientEnd : "#764ba2").onChange((v) => {
        draft._gradientEnd = v;
        gradDirty = true;
        refreshPreview();
      });
    });
    new import_obsidian.Setting(advancedBody).setName("Gradient angle").addSlider(
      (s) => s.setLimits(0, 360, 15).setValue(typeof draft._gradientAngle === "number" ? draft._gradientAngle : 135).setDynamicTooltip().onChange((v) => {
        draft._gradientAngle = v;
        refreshPreview();
      })
    );
    new import_obsidian.Setting(advancedBody).addButton(
      (btn) => btn.setButtonText("Clear gradient").onClick(() => {
        draft._gradientStart = "";
        draft._gradientEnd = "";
        gradDirty = false;
        gradStartRef?.setValue("#667eea");
        gradEndRef?.setValue("#764ba2");
        refreshPreview();
      })
    );
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        if (!accentDirty) draft._accentColor = "";
        if (!gradDirty) {
          draft._gradientStart = "";
          draft._gradientEnd = "";
        }
        this.onSave(draft);
        this.close();
      })
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};
var RemoveBlockConfirmModal = class extends import_obsidian.Modal {
  constructor(app, onConfirm) {
    super(app);
    this.onConfirm = onConfirm;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian.Setting(contentEl).setName("Remove block?").setHeading();
    contentEl.createEl("p", { text: "This block will be removed from the homepage." });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Remove").setWarning().onClick(() => {
        this.onConfirm();
        this.close();
      })
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/EditToolbar.ts
var import_obsidian2 = require("obsidian");
var EditToolbar = class {
  constructor(containerEl, app, plugin, grid, onColumnsChange) {
    this.containerEl = containerEl;
    this.app = app;
    this.plugin = plugin;
    this.grid = grid;
    this.onColumnsChange = onColumnsChange;
    this.fabEl = containerEl.createDiv({ cls: "homepage-edit-fab" });
    this.fabEl.setAttribute("role", "button");
    this.fabEl.setAttribute("tabindex", "0");
    this.fabEl.setAttribute("aria-label", "Enter edit mode");
    this.fabEl.setText("\u270F");
    this.fabEl.addEventListener("click", () => this.toggleEditMode());
    this.fabEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.toggleEditMode();
      }
    });
    this.toolbarEl = containerEl.createDiv({ cls: "homepage-toolbar" });
    this.toolbarEl.setAttribute("role", "toolbar");
    this.toolbarEl.setAttribute("aria-label", "Homepage toolbar");
    this.renderToolbar();
  }
  toolbarEl;
  fabEl;
  editMode = false;
  zoomScale = 1;
  /** Snapshot of blocks array taken when entering edit mode — used by Discard. */
  blocksSnapshot = null;
  /** Toggle edit mode — called from FAB, Done button, and keyboard shortcut command. */
  toggleEditMode() {
    this.editMode = !this.editMode;
    if (this.editMode) {
      this.blocksSnapshot = structuredClone(this.plugin.layout.blocks);
    } else {
      this.blocksSnapshot = null;
      this.zoomScale = 1;
    }
    this.grid.setEditMode(this.editMode);
    this.syncVisibility();
    this.renderToolbar();
    if (this.editMode) {
      requestAnimationFrame(() => {
        this.zoomScale = this.grid.computeFitZoom();
        this.grid.setZoom(this.zoomScale);
        this.renderToolbar();
      });
    }
  }
  /** Exit edit mode and revert all block changes made during this edit session. */
  discardChanges() {
    if (!this.editMode) return;
    if (this.blocksSnapshot) {
      const restored = { ...this.plugin.layout, blocks: this.blocksSnapshot };
      this.plugin.layout = restored;
      void this.plugin.saveLayout(restored);
      this.blocksSnapshot = null;
    }
    this.editMode = false;
    this.zoomScale = 1;
    this.grid.setEditMode(false, true);
    this.syncVisibility();
    this.renderToolbar();
  }
  syncVisibility() {
    this.fabEl.toggleClass("is-hidden", this.editMode);
    this.toolbarEl.toggleClass("is-visible", this.editMode);
  }
  renderToolbar() {
    this.toolbarEl.empty();
    const indicator = this.toolbarEl.createDiv({ cls: "toolbar-edit-indicator is-visible" });
    indicator.createDiv({ cls: "toolbar-edit-dot" });
    indicator.createSpan({ text: "Editing" });
    const colGroup = this.toolbarEl.createDiv({ cls: "toolbar-col-group" });
    const colSelect = colGroup.createEl("select", { cls: "toolbar-col-select" });
    colSelect.setAttribute("aria-label", "Number of columns");
    const effective = this.grid.getEffectiveColumns();
    [2, 3, 4, 5].forEach((n) => {
      const opt = colSelect.createEl("option", { value: String(n), text: `${n} col` });
      if (n === this.plugin.layout.columns) opt.selected = true;
    });
    colSelect.addEventListener("change", () => {
      this.onColumnsChange(Number(colSelect.value));
    });
    if (effective !== this.plugin.layout.columns) {
      colGroup.createSpan({ cls: "toolbar-col-auto-hint", text: `(auto: ${effective})` });
    }
    const zoomGroup = this.toolbarEl.createDiv({ cls: "toolbar-zoom-group" });
    zoomGroup.createSpan({ cls: "toolbar-zoom-label", text: "Zoom" });
    const zoomSlider = zoomGroup.createEl("input", {
      cls: "toolbar-zoom-slider",
      type: "range",
      attr: { min: "0.1", max: "1", step: "0.05", value: String(this.zoomScale), "aria-label": "Zoom level" }
    });
    const zoomValue = zoomGroup.createSpan({ cls: "toolbar-zoom-value", text: this.formatZoom(this.zoomScale) });
    zoomSlider.addEventListener("input", () => {
      this.zoomScale = parseFloat(zoomSlider.value);
      zoomValue.setText(this.formatZoom(this.zoomScale));
      this.grid.setZoom(this.zoomScale);
    });
    const addBtn = this.toolbarEl.createEl("button", { cls: "toolbar-add-btn" });
    addBtn.createSpan({ cls: "toolbar-add-icon", text: "+" });
    addBtn.createSpan({ cls: "toolbar-add-text", text: " Add block" });
    addBtn.addEventListener("click", () => {
      this.openAddBlockModal();
    });
    const discardBtn = this.toolbarEl.createEl("button", { cls: "toolbar-discard-btn", text: "\u2715 discard" });
    discardBtn.addEventListener("click", () => this.discardChanges());
    const doneBtn = this.toolbarEl.createEl("button", { cls: "toolbar-edit-btn toolbar-btn-active", text: "\u2713 done" });
    doneBtn.addEventListener("click", () => this.toggleEditMode());
    this.grid.onRequestAddBlock = () => {
      this.openAddBlockModal();
    };
  }
  /** Opens the Add Block modal. Called from toolbar button, empty state CTA, and command palette. */
  openAddBlockModal() {
    new AddBlockModal(this.app, (type) => {
      const factory = BlockRegistry.get(type);
      if (!factory) return;
      const instance = {
        id: crypto.randomUUID(),
        type,
        x: 0,
        y: 1e3,
        w: Math.min(factory.defaultSize.w, this.plugin.layout.columns),
        h: factory.defaultSize.h,
        config: { ...factory.defaultConfig }
      };
      this.grid.addBlock(instance);
    }).open();
  }
  formatZoom(scale) {
    return `${Math.round(scale * 100)}%`;
  }
  getElement() {
    return this.toolbarEl;
  }
  getFabElement() {
    return this.fabEl;
  }
  destroy() {
    this.grid.onRequestAddBlock = null;
    this.fabEl.remove();
    this.toolbarEl.remove();
  }
};
var BLOCK_META = {
  "greeting": { icon: "\u{1F44B}", desc: "Personalized greeting with time of day" },
  "clock": { icon: "\u{1F550}", desc: "Live clock with date display" },
  "folder-links": { icon: "\u{1F517}", desc: "Quick links to notes and folders" },
  "button-grid": { icon: "\u{1F532}", desc: "Grid of emoji-labeled buttons" },
  "quotes-list": { icon: "\u{1F4AC}", desc: "Collection of quotes from notes" },
  "image-gallery": { icon: "\u{1F5BC}\uFE0F", desc: "Photo grid from a vault folder" },
  "embedded-note": { icon: "\u{1F4C4}", desc: "Render a note inline on the page" },
  "static-text": { icon: "\u{1F4DD}", desc: "Markdown text block you write directly" },
  "html": { icon: "</>", desc: "Custom HTML content (sanitized)" },
  "video-embed": { icon: "\u{1F3AC}", desc: "Embed YouTube, Vimeo, or other videos" },
  "bookmarks": { icon: "\u{1F516}", desc: "Web links and vault bookmarks grid" },
  "recent-files": { icon: "\u{1F4C2}", desc: "Recently modified notes in your vault" },
  "pomodoro": { icon: "\u{1F345}", desc: "Pomodoro timer with work/break cycles" },
  "spacer": { icon: "\u2B1C", desc: "Empty space for layout spacing" },
  "random-note": { icon: "\u{1F3B2}", desc: "Random note card with cover image and preview" }
};
var AddBlockModal = class extends import_obsidian2.Modal {
  constructor(app, onSelect) {
    super(app);
    this.onSelect = onSelect;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian2.Setting(contentEl).setName("Add block").setHeading().settingEl.addClass("add-block-modal-title");
    const grid = contentEl.createDiv({ cls: "add-block-grid" });
    for (const factory of BlockRegistry.getAll()) {
      const meta = BLOCK_META[factory.type];
      const btn = grid.createEl("button", { cls: "add-block-option" });
      btn.createSpan({ cls: "add-block-icon", text: meta?.icon ?? "\u25AA" });
      btn.createSpan({ cls: "add-block-name", text: factory.displayName });
      if (meta?.desc) {
        btn.createSpan({ cls: "add-block-desc", text: meta.desc });
      }
      btn.addEventListener("click", () => {
        this.onSelect(factory.type);
        this.close();
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/HomepageView.ts
var VIEW_TYPE = "homepage-blocks";
var HomepageView = class extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  grid = null;
  toolbar = null;
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Homepage";
  }
  getIcon() {
    return "home";
  }
  onOpen() {
    this.grid?.destroy();
    this.toolbar?.destroy();
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("homepage-view");
    contentEl.toggleClass("homepage-no-scrollbar", !!this.plugin.layout.hideScrollbar);
    const layout = this.plugin.layout;
    const onLayoutChange = (newLayout) => {
      this.plugin.layout = newLayout;
      void this.plugin.saveLayout(newLayout);
    };
    this.grid = new GridLayout(contentEl, this.app, this.plugin, onLayoutChange);
    this.toolbar = new EditToolbar(
      contentEl,
      this.app,
      this.plugin,
      this.grid,
      (columns) => {
        this.grid?.setColumns(columns);
      }
    );
    contentEl.insertBefore(this.toolbar.getElement(), this.grid.getElement());
    contentEl.insertBefore(this.toolbar.getFabElement(), this.toolbar.getElement());
    this.grid.render(layout.blocks, layout.columns, true);
    return Promise.resolve();
  }
  onClose() {
    this.grid?.destroy();
    this.toolbar?.destroy();
    return Promise.resolve();
  }
  /** Toggle edit mode — called from keyboard shortcut command. */
  toggleEditMode() {
    this.toolbar?.toggleEditMode();
  }
  /** Open the Add Block modal — called from command palette. */
  openAddBlockModal() {
    this.toolbar?.openAddBlockModal();
  }
  /** Re-render the view from scratch (e.g. after settings reset). */
  async reload() {
    await this.onOpen();
  }
};

// src/types.ts
var BLOCK_TYPES = [
  "greeting",
  "folder-links",
  "button-grid",
  "quotes-list",
  "image-gallery",
  "clock",
  "embedded-note",
  "static-text",
  "html",
  "video-embed",
  "bookmarks",
  "recent-files",
  "pomodoro",
  "spacer",
  "random-note"
];

// src/blocks/GreetingBlock.ts
var import_obsidian5 = require("obsidian");

// src/blocks/BaseBlock.ts
var import_obsidian4 = require("obsidian");
var BaseBlock = class extends import_obsidian4.Component {
  constructor(app, instance, plugin) {
    super();
    this.app = app;
    this.instance = instance;
    this.plugin = plugin;
  }
  _headerContainer = null;
  _scheduleTimer = null;
  _renderGen = 0;
  /** Set by subclasses in render() to enable scheduleRender(). */
  containerEl = null;
  // Override to open a per-block settings modal.
  // onSave receives the new config; do NOT mutate this.instance.config directly.
  openSettings(_onSave) {
  }
  // Called by GridLayout to redirect renderHeader output outside block-content.
  setHeaderContainer(el) {
    this._headerContainer = el;
  }
  // Render the muted uppercase block header label.
  // Respects _hideTitle, _titleLabel, and _titleEmoji from instance.config.
  // Renders into the header container set by GridLayout (if any), else falls back to el.
  renderHeader(el, title) {
    const cfg = this.instance.config;
    if (cfg._hideTitle === true) return;
    const label = typeof cfg._titleLabel === "string" && cfg._titleLabel.trim() ? cfg._titleLabel.trim() : title;
    if (!label) return;
    const container = this._headerContainer ?? el;
    container.querySelector(".block-header")?.remove();
    const sizeClass = typeof cfg._titleSize === "string" && /^h[1-6]$/.test(cfg._titleSize) ? `block-header-${cfg._titleSize}` : "";
    const header = container.createDiv({ cls: `block-header${sizeClass ? " " + sizeClass : ""}` });
    if (typeof cfg._titleEmoji === "string" && cfg._titleEmoji) {
      header.createSpan({ cls: "block-header-emoji", text: cfg._titleEmoji });
    }
    header.createSpan({ text: label });
  }
  // ── Shared debounced re-render infrastructure ──────────────────────────────
  /**
   * Schedule a debounced re-render. Guards against detached DOM nodes
   * (checks `isConnected`) and catches async errors.
   * After a successful re-render, dispatches a `request-auto-height` event
   * so GridLayout can recalculate the block's row height.
   */
  scheduleRender(delayMs, fn) {
    if (this._scheduleTimer !== null) window.clearTimeout(this._scheduleTimer);
    this._scheduleTimer = window.setTimeout(() => {
      this._scheduleTimer = null;
      if (!this.containerEl?.isConnected) return;
      const result = fn(this.containerEl);
      if (result instanceof Promise) {
        result.then(() => this.requestAutoHeight()).catch((e) => {
          console.error(`[Homepage Blocks] ${this.constructor.name} re-render failed:`, e);
        });
      } else {
        this.requestAutoHeight();
      }
    }, delayMs);
  }
  /** Dispatch an event so GridLayout recalculates auto-height for this block. */
  requestAutoHeight() {
    this.containerEl?.dispatchEvent(new CustomEvent("request-auto-height", { bubbles: true }));
  }
  /**
   * Watch an element for width changes and dispatch request-auto-height when
   * the width changes.  Useful for blocks whose content reflows (e.g. grid
   * galleries, multi-column lists) when the container narrows/widens.
   * Cleanup is registered automatically via `this.register()`.
   */
  observeWidthForAutoHeight(el) {
    let prevWidth = 0;
    let rafId = 0;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0 && w !== prevWidth) {
        prevWidth = w;
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => this.requestAutoHeight());
      }
    });
    ro.observe(el);
    this.register(() => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    });
  }
  /** Increment and return a new render generation. Call at the start of async renders. */
  nextGeneration() {
    return ++this._renderGen;
  }
  /** Returns true if a newer render was started after the given generation. */
  isStale(generation) {
    return generation !== this._renderGen;
  }
  onunload() {
    if (this._scheduleTimer !== null) {
      window.clearTimeout(this._scheduleTimer);
      this._scheduleTimer = null;
    }
  }
};

// src/blocks/GreetingBlock.ts
var LANG_PRESETS = {
  it: { label: "Italiano", morning: "Buongiorno", afternoon: "Buon pomeriggio", evening: "Buonasera" },
  en: { label: "English", morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },
  es: { label: "Espa\xF1ol", morning: "Buenos d\xEDas", afternoon: "Buenas tardes", evening: "Buenas noches" },
  fr: { label: "Fran\xE7ais", morning: "Bonjour", afternoon: "Bon apr\xE8s-midi", evening: "Bonsoir" },
  de: { label: "Deutsch", morning: "Guten Morgen", afternoon: "Guten Tag", evening: "Guten Abend" },
  pt: { label: "Portugu\xEAs", morning: "Bom dia", afternoon: "Boa tarde", evening: "Boa noite" },
  nl: { label: "Nederlands", morning: "Goedemorgen", afternoon: "Goedemiddag", evening: "Goedenavond" },
  sv: { label: "Svenska", morning: "God morgon", afternoon: "God eftermiddag", evening: "God kv\xE4ll" },
  no: { label: "Norsk", morning: "God morgen", afternoon: "God ettermiddag", evening: "God kveld" },
  da: { label: "Dansk", morning: "God morgen", afternoon: "God eftermiddag", evening: "God aften" },
  fi: { label: "Suomi", morning: "Hyv\xE4\xE4 huomenta", afternoon: "Hyv\xE4\xE4 iltap\xE4iv\xE4\xE4", evening: "Hyv\xE4\xE4 iltaa" },
  pl: { label: "Polski", morning: "Dzie\u0144 dobry", afternoon: "Dzie\u0144 dobry", evening: "Dobry wiecz\xF3r" },
  cs: { label: "\u010Ce\u0161tina", morning: "Dobr\xE9 r\xE1no", afternoon: "Dobr\xE9 odpoledne", evening: "Dobr\xFD ve\u010Der" },
  sk: { label: "Sloven\u010Dina", morning: "Dobr\xE9 r\xE1no", afternoon: "Dobr\xE9 popoludnie", evening: "Dobr\xFD ve\u010Der" },
  hu: { label: "Magyar", morning: "J\xF3 reggelt", afternoon: "J\xF3 napot", evening: "J\xF3 est\xE9t" },
  ro: { label: "Rom\xE2n\u0103", morning: "Bun\u0103 diminea\u021Ba", afternoon: "Bun\u0103 ziua", evening: "Bun\u0103 seara" },
  hr: { label: "Hrvatski", morning: "Dobro jutro", afternoon: "Dobar dan", evening: "Dobra ve\u010Der" },
  sr: { label: "Srpski", morning: "Dobro jutro", afternoon: "Dobar dan", evening: "Dobro ve\u010De" },
  bg: { label: "\u0411\u044A\u043B\u0433\u0430\u0440\u0441\u043A\u0438", morning: "\u0414\u043E\u0431\u0440\u043E \u0443\u0442\u0440\u043E", afternoon: "\u0414\u043E\u0431\u044A\u0440 \u0434\u0435\u043D", evening: "\u0414\u043E\u0431\u044A\u0440 \u0432\u0435\u0447\u0435\u0440" },
  uk: { label: "\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430", morning: "\u0414\u043E\u0431\u0440\u043E\u0433\u043E \u0440\u0430\u043D\u043A\u0443", afternoon: "\u0414\u043E\u0431\u0440\u0438\u0439 \u0434\u0435\u043D\u044C", evening: "\u0414\u043E\u0431\u0440\u0438\u0439 \u0432\u0435\u0447\u0456\u0440" },
  ru: { label: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439", morning: "\u0414\u043E\u0431\u0440\u043E\u0435 \u0443\u0442\u0440\u043E", afternoon: "\u0414\u043E\u0431\u0440\u044B\u0439 \u0434\u0435\u043D\u044C", evening: "\u0414\u043E\u0431\u0440\u044B\u0439 \u0432\u0435\u0447\u0435\u0440" },
  el: { label: "\u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC", morning: "\u039A\u03B1\u03BB\u03B7\u03BC\u03AD\u03C1\u03B1", afternoon: "\u039A\u03B1\u03BB\u03CC \u03B1\u03C0\u03CC\u03B3\u03B5\u03C5\u03BC\u03B1", evening: "\u039A\u03B1\u03BB\u03B7\u03C3\u03C0\u03AD\u03C1\u03B1" },
  tr: { label: "T\xFCrk\xE7e", morning: "G\xFCnayd\u0131n", afternoon: "T\xFCnayd\u0131n", evening: "\u0130yi ak\u015Famlar" },
  ar: { label: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", morning: "\u0635\u0628\u0627\u062D \u0627\u0644\u062E\u064A\u0631", afternoon: "\u0645\u0633\u0627\u0621 \u0627\u0644\u062E\u064A\u0631", evening: "\u0645\u0633\u0627\u0621 \u0627\u0644\u062E\u064A\u0631" },
  he: { label: "\u05E2\u05D1\u05E8\u05D9\u05EA", morning: "\u05D1\u05D5\u05E7\u05E8 \u05D8\u05D5\u05D1", afternoon: "\u05E6\u05D4\u05E8\u05D9\u05D9\u05DD \u05D8\u05D5\u05D1\u05D9\u05DD", evening: "\u05E2\u05E8\u05D1 \u05D8\u05D5\u05D1" },
  fa: { label: "\u0641\u0627\u0631\u0633\u06CC", morning: "\u0635\u0628\u062D \u0628\u062E\u06CC\u0631", afternoon: "\u0639\u0635\u0631 \u0628\u062E\u06CC\u0631", evening: "\u0634\u0628 \u0628\u062E\u06CC\u0631" },
  hi: { label: "\u0939\u093F\u0928\u094D\u0926\u0940", morning: "\u0938\u0941\u092A\u094D\u0930\u092D\u093E\u0924", afternoon: "\u0928\u092E\u0938\u094D\u0915\u093E\u0930", evening: "\u0936\u0941\u092D \u0938\u0902\u0927\u094D\u092F\u093E" },
  bn: { label: "\u09AC\u09BE\u0982\u09B2\u09BE", morning: "\u09B8\u09C1\u09AA\u09CD\u09B0\u09AD\u09BE\u09A4", afternoon: "\u09B6\u09C1\u09AD \u0985\u09AA\u09B0\u09BE\u09B9\u09CD\u09A3", evening: "\u09B6\u09C1\u09AD \u09B8\u09A8\u09CD\u09A7\u09CD\u09AF\u09BE" },
  ta: { label: "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD", morning: "\u0B95\u0BBE\u0BB2\u0BC8 \u0BB5\u0BA3\u0B95\u0BCD\u0B95\u0BAE\u0BCD", afternoon: "\u0BAE\u0BA4\u0BBF\u0BAF \u0BB5\u0BA3\u0B95\u0BCD\u0B95\u0BAE\u0BCD", evening: "\u0BAE\u0BBE\u0BB2\u0BC8 \u0BB5\u0BA3\u0B95\u0BCD\u0B95\u0BAE\u0BCD" },
  te: { label: "\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41", morning: "\u0C36\u0C41\u0C2D\u0C4B\u0C26\u0C2F\u0C02", afternoon: "\u0C36\u0C41\u0C2D \u0C2E\u0C27\u0C4D\u0C2F\u0C3E\u0C39\u0C4D\u0C28\u0C02", evening: "\u0C36\u0C41\u0C2D \u0C38\u0C3E\u0C2F\u0C02\u0C24\u0C4D\u0C30\u0C02" },
  mr: { label: "\u092E\u0930\u093E\u0920\u0940", morning: "\u0938\u0941\u092A\u094D\u0930\u092D\u093E\u0924", afternoon: "\u0936\u0941\u092D \u0926\u0941\u092A\u093E\u0930", evening: "\u0936\u0941\u092D \u0938\u0902\u0927\u094D\u092F\u093E\u0915\u093E\u0933" },
  gu: { label: "\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0", morning: "\u0AB8\u0AC1\u0AAA\u0ACD\u0AB0\u0AAD\u0ABE\u0AA4", afternoon: "\u0AB6\u0AC1\u0AAD \u0AAC\u0AAA\u0ACB\u0AB0", evening: "\u0AB6\u0AC1\u0AAD \u0AB8\u0ABE\u0A82\u0A9C" },
  ur: { label: "\u0627\u0631\u062F\u0648", morning: "\u0635\u0628\u062D \u0628\u062E\u06CC\u0631", afternoon: "\u0633\u06C1 \u067E\u06C1\u0631 \u0628\u062E\u06CC\u0631", evening: "\u0634\u0627\u0645 \u0628\u062E\u06CC\u0631" },
  th: { label: "\u0E44\u0E17\u0E22", morning: "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35\u0E15\u0E2D\u0E19\u0E40\u0E0A\u0E49\u0E32", afternoon: "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35\u0E15\u0E2D\u0E19\u0E1A\u0E48\u0E32\u0E22", evening: "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35\u0E15\u0E2D\u0E19\u0E40\u0E22\u0E47\u0E19" },
  vi: { label: "Ti\u1EBFng Vi\u1EC7t", morning: "Ch\xE0o bu\u1ED5i s\xE1ng", afternoon: "Ch\xE0o bu\u1ED5i chi\u1EC1u", evening: "Ch\xE0o bu\u1ED5i t\u1ED1i" },
  id: { label: "Bahasa Indonesia", morning: "Selamat pagi", afternoon: "Selamat siang", evening: "Selamat malam" },
  ms: { label: "Bahasa Melayu", morning: "Selamat pagi", afternoon: "Selamat petang", evening: "Selamat malam" },
  tl: { label: "Filipino", morning: "Magandang umaga", afternoon: "Magandang hapon", evening: "Magandang gabi" },
  zh: { label: "\u4E2D\u6587", morning: "\u65E9\u4E0A\u597D", afternoon: "\u4E0B\u5348\u597D", evening: "\u665A\u4E0A\u597D" },
  ja: { label: "\u65E5\u672C\u8A9E", morning: "\u304A\u306F\u3088\u3046\u3054\u3056\u3044\u307E\u3059", afternoon: "\u3053\u3093\u306B\u3061\u306F", evening: "\u3053\u3093\u3070\u3093\u306F" },
  ko: { label: "\uD55C\uAD6D\uC5B4", morning: "\uC88B\uC740 \uC544\uCE68", afternoon: "\uC88B\uC740 \uC624\uD6C4", evening: "\uC88B\uC740 \uC800\uB141" },
  sw: { label: "Kiswahili", morning: "Habari ya asubuhi", afternoon: "Habari ya mchana", evening: "Habari ya jioni" },
  am: { label: "\u12A0\u121B\u122D\u129B", morning: "\u12A5\u1295\u12F0\u121D\u1295 \u12A0\u12F0\u122D\u12AD", afternoon: "\u12A5\u1295\u12F0\u121D\u1295 \u12CB\u120D\u12AD", evening: "\u12A5\u1295\u12F0\u121D\u1295 \u12A0\u1218\u1238\u1205" },
  yo: { label: "Yor\xF9b\xE1", morning: "E kaaro", afternoon: "E kaasan", evening: "E kaal\u1EB9" },
  zu: { label: "isiZulu", morning: "Sawubona ekuseni", afternoon: "Sawubona emini", evening: "Sawubona kusihlwa" },
  ha: { label: "Hausa", morning: "Ina kwana", afternoon: "Barka da rana", evening: "Barka da yamma" },
  ga: { label: "Gaeilge", morning: "Maidin mhaith", afternoon: "Tr\xE1thn\xF3na maith", evening: "O\xEDche mhaith" },
  cy: { label: "Cymraeg", morning: "Bore da", afternoon: "Prynhawn da", evening: "Noswaith dda" },
  ca: { label: "Catal\xE0", morning: "Bon dia", afternoon: "Bona tarda", evening: "Bona nit" },
  eu: { label: "Euskara", morning: "Egun on", afternoon: "Arratsalde on", evening: "Gabon" },
  gl: { label: "Galego", morning: "Bo d\xEDa", afternoon: "Boa tarde", evening: "Boa noite" }
};
var PRESET_KEYS = Object.keys(LANG_PRESETS).sort(
  (a, b) => LANG_PRESETS[a].label.localeCompare(LANG_PRESETS[b].label)
);
var DEFAULT_SALUT = LANG_PRESETS["it"];
var DEFAULT_EMOJIS = {
  morning: "\u2600\uFE0F",
  afternoon: "\u{1F324}\uFE0F",
  evening: "\u{1F306}",
  night: "\u{1F319}"
};
function timeSlot(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}
function salutSlot(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}
function getSalutation(cfg, hour) {
  const mode = cfg.salutationMode ?? "auto";
  if (mode === "custom") {
    const slot = salutSlot(hour);
    const map = {
      morning: cfg.salutMorning,
      afternoon: cfg.salutAfternoon,
      evening: cfg.salutEvening
    };
    const custom = map[slot]?.trim();
    if (custom) return custom;
  }
  const presetKey = cfg.salutationPreset ?? "it";
  const preset = LANG_PRESETS[presetKey] ?? DEFAULT_SALUT;
  return preset[salutSlot(hour)];
}
function pickEmoji(cfg, hour) {
  const mode = cfg.emojiMode ?? "auto";
  if (mode === "custom") {
    const slot = timeSlot(hour);
    const map = {
      morning: cfg.emojiMorning,
      afternoon: cfg.emojiAfternoon,
      evening: cfg.emojiEvening,
      night: cfg.emojiNight
    };
    return map[slot]?.trim() || DEFAULT_EMOJIS[slot];
  }
  if (mode === "random") {
    const pool = parseEmojiPool(cfg.emojiPool ?? "");
    if (pool.length === 0) return DEFAULT_EMOJIS[timeSlot(hour)];
    if (cfg.emojiDailySeed) {
      const dayOfYear = (0, import_obsidian5.moment)().dayOfYear();
      return pool[dayOfYear % pool.length];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return DEFAULT_EMOJIS[timeSlot(hour)];
}
function parseEmojiPool(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return trimmed.split(/[\s,]+/).filter((s) => s.length > 0);
}
var GreetingBlock = class extends BaseBlock {
  emojiEl = null;
  nameEl = null;
  timeEl = null;
  render(el) {
    el.addClass("greeting-block");
    const cfg = this.instance.config;
    const { showTime = true, showEmoji = true } = cfg;
    if (showEmoji) {
      this.emojiEl = el.createDiv({ cls: "greeting-emoji" });
    }
    this.nameEl = el.createDiv({ cls: "greeting-name" });
    if (showTime) {
      this.timeEl = el.createDiv({ cls: "greeting-time" });
    }
    this.tick();
    this.registerInterval(window.setInterval(() => this.tick(), 6e4));
  }
  tick() {
    const now = (0, import_obsidian5.moment)();
    const hour = now.hour();
    const cfg = this.instance.config;
    const { name = "bentornato", showTime = true, showEmoji = true } = cfg;
    if (this.emojiEl && showEmoji) {
      this.emojiEl.setText(pickEmoji(cfg, hour));
    }
    if (this.nameEl) {
      this.nameEl.empty();
      this.nameEl.createSpan({ cls: "greeting-salut", text: `${getSalutation(cfg, hour)}, ` });
      this.nameEl.createSpan({ cls: "greeting-user", text: name });
    }
    if (this.timeEl && showTime) {
      this.timeEl.setText(now.format("HH:mm"));
    }
  }
  openSettings(onSave) {
    new GreetingSettingsModal(this.app, this.instance.config, onSave).open();
  }
};
var GreetingSettingsModal = class extends import_obsidian5.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian5.Setting(contentEl).setName("Greeting settings").setHeading();
    const draft = structuredClone(this.config);
    new import_obsidian5.Setting(contentEl).setName("Name").addText(
      (t) => t.setValue(draft.name ?? "bentornato").onChange((v) => {
        draft.name = v;
      })
    );
    new import_obsidian5.Setting(contentEl).setName("Show time").addToggle(
      (t) => t.setValue(draft.showTime ?? true).onChange((v) => {
        draft.showTime = v;
      })
    );
    new import_obsidian5.Setting(contentEl).setName("Salutation").setHeading();
    const salutSection = contentEl.createDiv();
    const buildSalutSettings = () => {
      salutSection.empty();
      const mode = draft.salutationMode ?? "auto";
      new import_obsidian5.Setting(salutSection).setName("Salutation mode").setDesc("Auto: pick a language preset \u2014 custom: write your own for each time slot.").addDropdown(
        (d) => d.addOption("auto", "Language preset").addOption("custom", "Custom text").setValue(mode).onChange((v) => {
          draft.salutationMode = v === "custom" ? "custom" : "auto";
          buildSalutSettings();
        })
      );
      if (mode === "auto") {
        new import_obsidian5.Setting(salutSection).setName("Language").addDropdown((d) => {
          for (const key of PRESET_KEYS) {
            d.addOption(key, LANG_PRESETS[key].label);
          }
          d.setValue(draft.salutationPreset ?? "it").onChange((v) => {
            draft.salutationPreset = v;
          });
        });
        const preset = LANG_PRESETS[draft.salutationPreset ?? "it"] ?? DEFAULT_SALUT;
        const preview = salutSection.createDiv({ cls: "setting-item-description" });
        preview.addClass("hp-preview-hint");
        preview.setText(`${preset.morning} / ${preset.afternoon} / ${preset.evening}`);
      }
      if (mode === "custom") {
        const slots = [
          { key: "salutMorning", label: "Morning", time: "5:00\u201312:00", fallback: DEFAULT_SALUT.morning },
          { key: "salutAfternoon", label: "Afternoon", time: "12:00\u201318:00", fallback: DEFAULT_SALUT.afternoon },
          { key: "salutEvening", label: "Evening", time: "18:00\u20135:00", fallback: DEFAULT_SALUT.evening }
        ];
        for (const slot of slots) {
          new import_obsidian5.Setting(salutSection).setName(`${slot.label} greeting`).setDesc(slot.time).addText(
            (t) => t.setValue(draft[slot.key] ?? slot.fallback).setPlaceholder(slot.fallback).onChange((v) => {
              draft[slot.key] = v;
            })
          );
        }
      }
    };
    buildSalutSettings();
    new import_obsidian5.Setting(contentEl).setName("Emoji").setHeading();
    new import_obsidian5.Setting(contentEl).setName("Show emoji").addToggle(
      (t) => t.setValue(draft.showEmoji ?? true).onChange((v) => {
        draft.showEmoji = v;
        buildEmojiSettings();
      })
    );
    const emojiSection = contentEl.createDiv();
    let slotPickers = [];
    const buildEmojiSettings = () => {
      for (const p of slotPickers) p.destroy();
      slotPickers = [];
      emojiSection.empty();
      if (draft.showEmoji === false) return;
      new import_obsidian5.Setting(emojiSection).setName("Emoji mode").setDesc("Auto: time-of-day \u2014 custom: pick one per time slot \u2014 random: pick from a pool.").addDropdown(
        (d) => d.addOption("auto", "Auto (time of day)").addOption("custom", "Custom per slot").addOption("random", "Random pool").setValue(draft.emojiMode ?? "auto").onChange((v) => {
          draft.emojiMode = v === "custom" || v === "random" ? v : "auto";
          buildEmojiSettings();
        })
      );
      const mode = draft.emojiMode ?? "auto";
      if (mode === "custom") {
        const slots = [
          { key: "emojiMorning", label: "Morning", default: "\u2600\uFE0F", time: "5:00\u201312:00" },
          { key: "emojiAfternoon", label: "Afternoon", default: "\u{1F324}\uFE0F", time: "12:00\u201317:00" },
          { key: "emojiEvening", label: "Evening", default: "\u{1F306}", time: "17:00\u201321:00" },
          { key: "emojiNight", label: "Night", default: "\u{1F319}", time: "21:00\u20135:00" }
        ];
        for (const slot of slots) {
          const row = emojiSection.createDiv({ cls: "setting-item" });
          row.createDiv({ cls: "setting-item-info" }).createDiv({ cls: "setting-item-name", text: `${slot.label} emoji (${slot.time})` });
          const control = row.createDiv({ cls: "setting-item-control" });
          const closePickers = () => {
            for (const p of slotPickers) p.close();
          };
          const picker = createEmojiPicker({
            container: control,
            value: draft[slot.key] ?? slot.default,
            placeholder: slot.default,
            onSelect: (emoji) => {
              draft[slot.key] = emoji;
            },
            onClear: () => {
              draft[slot.key] = "";
            },
            onBeforeOpen: closePickers
          });
          slotPickers.push(picker);
        }
      }
      if (mode === "random") {
        const poolRow = emojiSection.createDiv({ cls: "setting-item" });
        const poolInfo = poolRow.createDiv({ cls: "setting-item-info" });
        poolInfo.createDiv({ cls: "setting-item-name", text: "Emoji pool" });
        poolInfo.createDiv({ cls: "setting-item-description", text: "Click to add emoji. Remove by clicking the \u2715 on each." });
        const poolControl = poolRow.createDiv({ cls: "setting-item-control" });
        const poolContainer = poolControl.createDiv({ cls: "greeting-emoji-pool" });
        const currentPool = parseEmojiPool(draft.emojiPool ?? "");
        const renderPool = () => {
          poolContainer.empty();
          for (let i = 0; i < currentPool.length; i++) {
            const chip = poolContainer.createDiv({ cls: "greeting-emoji-chip" });
            chip.createSpan({ text: currentPool[i] });
            const del = chip.createEl("button", { cls: "greeting-emoji-chip-del", text: "\u2715" });
            del.addEventListener("click", () => {
              currentPool.splice(i, 1);
              draft.emojiPool = currentPool.join(" ");
              renderPool();
            });
          }
          const addBtn = poolContainer.createDiv({ cls: "greeting-emoji-pool-add" });
          const closePickers = () => {
            for (const p of slotPickers) p.close();
          };
          const addPicker = createEmojiPicker({
            container: addBtn,
            value: "",
            placeholder: "\uFF0B",
            onSelect: (emoji) => {
              currentPool.push(emoji);
              draft.emojiPool = currentPool.join(" ");
              renderPool();
            },
            onClear: () => {
            },
            onBeforeOpen: closePickers
          });
          slotPickers.push(addPicker);
        };
        renderPool();
        new import_obsidian5.Setting(emojiSection).setName("Same emoji all day").setDesc("Pick one at midnight and keep it all day.").addToggle(
          (t) => t.setValue(draft.emojiDailySeed ?? false).onChange((v) => {
            draft.emojiDailySeed = v;
          })
        );
      }
    };
    buildEmojiSettings();
    new import_obsidian5.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/ClockBlock.ts
var import_obsidian6 = require("obsidian");
var CLOCK_STYLES = {
  minimal: "Minimal",
  centered: "Centered",
  large: "Large",
  accent: "Accent"
};
var ClockBlock = class extends BaseBlock {
  timeEl = null;
  dateEl = null;
  render(el) {
    const { showDate = true, showSeconds = false, clockStyle = "minimal" } = this.instance.config;
    el.addClass("clock-block");
    const safeStyle = clockStyle in CLOCK_STYLES ? clockStyle : "minimal";
    el.addClass(`clock-style-${safeStyle}`);
    this.timeEl = el.createDiv({ cls: "clock-time" });
    if (showDate) {
      this.dateEl = el.createDiv({ cls: "clock-date" });
    }
    this.tick();
    const interval = showSeconds ? 1e3 : 6e4;
    this.registerInterval(window.setInterval(() => this.tick(), interval));
  }
  tick() {
    const now = (0, import_obsidian6.moment)();
    const { showSeconds = false, showDate = true, format = "" } = this.instance.config;
    if (this.timeEl) {
      if (format) {
        this.timeEl.setText(now.format(format));
      } else {
        this.timeEl.setText(now.format(showSeconds ? "HH:mm:ss" : "HH:mm"));
      }
    }
    if (this.dateEl && showDate) {
      this.dateEl.setText(now.format("dddd, D MMMM YYYY"));
    }
  }
  openSettings(onSave) {
    new ClockSettingsModal(this.app, this.instance.config, onSave).open();
  }
};
var ClockSettingsModal = class extends import_obsidian6.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian6.Setting(contentEl).setName("Clock settings").setHeading();
    const draft = structuredClone(this.config);
    new import_obsidian6.Setting(contentEl).setName("Style").setDesc("Visual style of the clock.").addDropdown(
      (d) => d.addOptions(CLOCK_STYLES).setValue(draft.clockStyle ?? "minimal").onChange((v) => {
        draft.clockStyle = v;
      })
    );
    new import_obsidian6.Setting(contentEl).setName("Show seconds").addToggle(
      (t) => t.setValue(draft.showSeconds ?? false).onChange((v) => {
        draft.showSeconds = v;
      })
    );
    new import_obsidian6.Setting(contentEl).setName("Show date").addToggle(
      (t) => t.setValue(draft.showDate ?? true).onChange((v) => {
        draft.showDate = v;
      })
    );
    new import_obsidian6.Setting(contentEl).setName("Custom format").setDesc("Optional moment.js format string (leave empty for default).").addText(
      (t) => t.setValue(draft.format ?? "").onChange((v) => {
        draft.format = v;
      })
    );
    new import_obsidian6.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/FolderLinksBlock.ts
var import_obsidian8 = require("obsidian");

// src/utils/FolderSuggestModal.ts
var import_obsidian7 = require("obsidian");
var FolderSuggestModal = class extends import_obsidian7.SuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder("Type to search vault folders\u2026");
  }
  cachedFolders = null;
  getAllFolders() {
    if (this.cachedFolders) return this.cachedFolders;
    const folders = [];
    const recurse = (f) => {
      folders.push(f);
      for (const child of f.children) {
        if (child instanceof import_obsidian7.TFolder) recurse(child);
      }
    };
    recurse(this.app.vault.getRoot());
    this.cachedFolders = folders;
    return folders;
  }
  getSuggestions(query) {
    const q = query.toLowerCase();
    return this.getAllFolders().filter(
      (f) => f.path.toLowerCase().includes(q)
    );
  }
  renderSuggestion(folder, el) {
    el.createEl("span", { text: folder.path === "/" ? "/ (vault root)" : folder.path });
  }
  onChooseSuggestion(folder) {
    this.onChoose(folder);
  }
};

// src/utils/dragReorder.ts
function enableDragReorder(row, index, items, state, renderList) {
  row.setAttribute("draggable", "true");
  row.addEventListener("dragstart", (e) => {
    state.dragIdx = index;
    row.addClass("is-dragging");
    e.dataTransfer?.setData("text/plain", String(index));
  });
  row.addEventListener("dragend", () => {
    row.removeClass("is-dragging");
  });
  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    row.addClass("drag-over");
  });
  row.addEventListener("dragleave", () => {
    row.removeClass("drag-over");
  });
  row.addEventListener("drop", (e) => {
    e.preventDefault();
    row.removeClass("drag-over");
    if (state.dragIdx >= 0 && state.dragIdx !== index) {
      const [moved] = items.splice(state.dragIdx, 1);
      items.splice(index, 0, moved);
      renderList();
    }
  });
  const grip = row.createSpan({ cls: "drag-grip", text: "\u2630" });
  grip.setAttribute("aria-label", "Drag to reorder");
}

// src/blocks/FolderLinksBlock.ts
var VALID_ALIGNS = /* @__PURE__ */ new Set(["left", "center", "right"]);
var FolderLinksBlock = class _FolderLinksBlock extends BaseBlock {
  static DEBOUNCE_MS = 150;
  render(el) {
    this.containerEl = el;
    el.addClass("folder-links-block");
    const trigger = () => this.scheduleRender(_FolderLinksBlock.DEBOUNCE_MS, () => this.renderContent());
    const cfg = this.instance.config;
    const isRelevant = (file) => {
      const folder = (cfg.folder ?? "").trim().replace(/\/+$/, "");
      return !!folder && file.path.startsWith(folder + "/");
    };
    this.registerEvent(this.app.vault.on("create", (f) => {
      if (isRelevant(f)) trigger();
    }));
    this.registerEvent(this.app.vault.on("delete", (f) => {
      if (isRelevant(f)) trigger();
    }));
    this.registerEvent(this.app.vault.on("rename", (f, oldPath) => {
      const folder = (cfg.folder ?? "").trim().replace(/\/+$/, "");
      if (isRelevant(f) || folder && oldPath.startsWith(folder + "/")) trigger();
    }));
    this.app.workspace.onLayoutReady(() => this.renderContent());
  }
  renderContent() {
    const el = this.containerEl;
    if (!el) return;
    el.empty();
    const cfg = this.instance.config;
    const folder = cfg.folder ?? "";
    const links = cfg.links ?? [];
    const linkAlign = VALID_ALIGNS.has(cfg.linkAlign ?? "") ? cfg.linkAlign : "left";
    const folderEmoji = cfg.folderEmoji ?? "";
    this.renderHeader(el, "Folder links");
    const list = el.createDiv({ cls: "folder-links-list" });
    list.addClass(`folder-links-align-${linkAlign}`);
    if (folder) {
      const normalised = folder.trim().replace(/\/+$/, "");
      if (!normalised) {
        list.createEl("p", { text: "Vault root listing is not supported. Select a subfolder.", cls: "block-loading" });
      } else {
        const folderObj = this.app.vault.getAbstractFileByPath(normalised);
        if (!(folderObj instanceof import_obsidian8.TFolder)) {
          list.createEl("p", { text: `Folder "${normalised}" not found.`, cls: "block-loading" });
        } else {
          const notes = this.getNotesInFolder(folderObj).sort((a, b) => a.basename.localeCompare(b.basename));
          for (const file of notes) {
            const item = list.createDiv({ cls: "folder-link-item" });
            const btn = item.createEl("button", { cls: "folder-link-btn" });
            if (folderEmoji) {
              btn.createSpan({ cls: "link-emoji", text: folderEmoji });
            }
            btn.createSpan({ text: file.basename });
            btn.addEventListener("click", () => {
              void this.app.workspace.openLinkText(file.path, "");
            });
          }
          if (notes.length === 0) {
            list.createEl("p", { text: `No notes in "${folderObj.path}".`, cls: "block-loading" });
          }
        }
      }
    }
    for (const link of links) {
      const item = list.createDiv({ cls: "folder-link-item" });
      const btn = item.createEl("button", { cls: "folder-link-btn" });
      if (link.emoji) {
        btn.createSpan({ cls: "link-emoji", text: link.emoji });
      }
      btn.createSpan({ text: link.label });
      btn.addEventListener("click", () => {
        void this.app.workspace.openLinkText(link.path, "");
      });
    }
    if (!folder && links.length === 0) {
      const hint = list.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F517}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No links yet. Add manual links or pick a folder in settings." });
    }
  }
  /** Recursively collect all files within a folder. */
  getNotesInFolder(folder) {
    const files = [];
    const recurse = (f) => {
      for (const child of f.children) {
        if (child instanceof import_obsidian8.TFile) files.push(child);
        else if (child instanceof import_obsidian8.TFolder) recurse(child);
      }
    };
    recurse(folder);
    return files;
  }
  openSettings(onSave) {
    new FolderLinksSettingsModal(
      this.app,
      this.instance.config,
      (newConfig) => {
        onSave(newConfig);
      }
    ).open();
  }
};
var FolderLinksSettingsModal = class extends import_obsidian8.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian8.Setting(contentEl).setName("Quick links settings").setHeading();
    const draft = structuredClone(this.config);
    draft.links ??= [];
    const links = draft.links;
    const pickers = [];
    const closeAllPickers = () => {
      for (const p of pickers) p.close();
    };
    new import_obsidian8.Setting(contentEl).setName("Link alignment").setDesc("Align links to the left, center, or right.").addDropdown(
      (d) => d.addOptions({ left: "Left", center: "Center", right: "Right" }).setValue(draft.linkAlign ?? "left").onChange((v) => {
        draft.linkAlign = v;
      })
    );
    let folderText;
    new import_obsidian8.Setting(contentEl).setName("Auto-list folder").setDesc("List all notes from this vault folder as links.").addText((t) => {
      folderText = t;
      t.setValue(draft.folder ?? "").setPlaceholder("Projects").onChange((v) => {
        draft.folder = v;
      });
    }).addButton(
      (btn) => btn.setIcon("folder").setTooltip("Browse vault folders").onClick(() => {
        new FolderSuggestModal(this.app, (folder) => {
          const path = folder.path === "/" ? "" : folder.path;
          draft.folder = path;
          folderText.setValue(path);
        }).open();
      })
    );
    const folderPicker = createEmojiPicker({
      container: contentEl,
      label: "Folder link emoji",
      value: draft.folderEmoji ?? "",
      placeholder: "None",
      rowClass: "link-emoji-picker-row",
      panelClass: "link-emoji-panel",
      onSelect: (emoji) => {
        draft.folderEmoji = emoji;
      },
      onClear: () => {
        draft.folderEmoji = "";
      },
      onBeforeOpen: closeAllPickers
    });
    pickers.push(folderPicker);
    new import_obsidian8.Setting(contentEl).setName("Manual links").setHeading();
    const linksContainer = contentEl.createDiv();
    const dragState = { dragIdx: -1 };
    const renderLinks = () => {
      pickers.length = 1;
      linksContainer.empty();
      links.forEach((link, i) => {
        const row = linksContainer.createDiv({ cls: "settings-link-row" });
        enableDragReorder(row, i, links, dragState, renderLinks);
        new import_obsidian8.Setting(row).setName(`Link ${i + 1}`).addText((t) => t.setPlaceholder("Label").setValue(link.label).onChange((v) => {
          link.label = v;
        })).addText((t) => t.setPlaceholder("Path").setValue(link.path).onChange((v) => {
          link.path = v;
        })).addButton((btn) => btn.setIcon("trash").setTooltip("Remove").onClick(() => {
          links.splice(i, 1);
          renderLinks();
        }));
        const linkPicker = createEmojiPicker({
          container: row,
          panelContainer: row,
          value: link.emoji ?? "",
          placeholder: "Emoji",
          rowClass: "link-emoji-picker-row",
          panelClass: "link-emoji-panel",
          onSelect: (emoji) => {
            link.emoji = emoji;
          },
          onClear: () => {
            link.emoji = void 0;
          },
          onBeforeOpen: closeAllPickers
        });
        pickers.push(linkPicker);
      });
    };
    renderLinks();
    new import_obsidian8.Setting(contentEl).addButton((btn) => btn.setButtonText("Add link").onClick(() => {
      links.push({ label: "", path: "" });
      renderLinks();
    })).addButton((btn) => btn.setButtonText("Save").setCta().onClick(() => {
      this.onSave(draft);
      this.close();
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/ButtonGridBlock.ts
var import_obsidian9 = require("obsidian");
var ButtonGridBlock = class extends BaseBlock {
  render(el) {
    el.addClass("button-grid-block");
    const { columns = 2, items = [] } = this.instance.config;
    this.renderHeader(el, "Buttons");
    const grid = el.createDiv({ cls: "button-grid" });
    const safeCols = Math.max(1, Math.min(3, Math.floor(Number(columns) || 2)));
    grid.style.setProperty("--hp-grid-cols", `repeat(${safeCols}, 1fr)`);
    grid.setAttribute("data-auto-height-content", "");
    this.observeWidthForAutoHeight(grid);
    if (items.length === 0) {
      const hint = grid.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F532}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No items yet. Add buttons with emojis and labels in settings." });
      return;
    }
    for (const item of items) {
      const btn = grid.createEl("button", { cls: "grid-btn" });
      if (item.emoji) {
        btn.createSpan({ cls: "grid-btn-emoji", text: item.emoji });
      }
      btn.createSpan({ text: item.label });
      if (item.link) {
        btn.addEventListener("click", () => {
          void this.app.workspace.openLinkText(item.link, "");
        });
      } else {
        btn.addClass("hp-cursor-default");
      }
    }
  }
  openSettings(onSave) {
    new ButtonGridSettingsModal(this.app, this.instance.config, onSave).open();
  }
};
var ButtonGridSettingsModal = class extends import_obsidian9.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian9.Setting(contentEl).setName("Button grid settings").setHeading();
    const draft = structuredClone(this.config);
    if (!Array.isArray(draft.items)) draft.items = [];
    new import_obsidian9.Setting(contentEl).setName("Columns").addDropdown(
      (d) => d.addOption("1", "1").addOption("2", "2").addOption("3", "3").setValue(String(draft.columns ?? 2)).onChange((v) => {
        draft.columns = Number(v);
      })
    );
    contentEl.createEl("p", { text: "Items", cls: "setting-item-name" });
    const listEl = contentEl.createDiv({ cls: "btn-grid-item-list" });
    const dragState = { dragIdx: -1 };
    let pickers = [];
    const renderList = () => {
      pickers.forEach((p) => p.destroy());
      pickers = [];
      listEl.empty();
      draft.items.forEach((item, i) => {
        const row = listEl.createDiv({ cls: "btn-grid-item-row" });
        enableDragReorder(row, i, draft.items, dragState, renderList);
        const picker = createEmojiPicker({
          container: row,
          panelContainer: listEl,
          value: item.emoji,
          placeholder: "\u{1F600}",
          rowClass: "btn-grid-emoji-picker-row",
          onBeforeOpen: () => pickers.forEach((p) => p !== picker && p.close()),
          onSelect: (emoji) => {
            item.emoji = emoji;
          },
          onClear: () => {
            item.emoji = "";
          }
        });
        pickers.push(picker);
        const labelInput = row.createEl("input", { type: "text", cls: "btn-grid-item-label" });
        labelInput.value = item.label;
        labelInput.placeholder = "Label";
        labelInput.addEventListener("input", () => {
          item.label = labelInput.value;
        });
        const linkInput = row.createEl("input", { type: "text", cls: "btn-grid-item-link" });
        linkInput.value = item.link ?? "";
        linkInput.placeholder = "Note path (optional)";
        linkInput.addEventListener("input", () => {
          item.link = linkInput.value || void 0;
        });
        const delBtn = row.createEl("button", { cls: "btn-grid-item-del", text: "\u2715" });
        delBtn.addEventListener("click", () => {
          draft.items.splice(i, 1);
          renderList();
        });
      });
    };
    renderList();
    new import_obsidian9.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("+ add item").onClick(() => {
        draft.items.push({ emoji: "", label: "" });
        renderList();
      })
    );
    new import_obsidian9.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/QuotesListBlock.ts
var import_obsidian10 = require("obsidian");

// src/utils/tags.ts
function cacheHasTag(cache, tag) {
  if (!cache) return false;
  if (cache.tags?.some((t) => t.tag === tag)) return true;
  const rawFmTags = cache.frontmatter?.tags;
  const fmTagArray = Array.isArray(rawFmTags) ? rawFmTags.filter((t) => typeof t === "string") : typeof rawFmTags === "string" ? [rawFmTags] : [];
  return fmTagArray.some((t) => (t.startsWith("#") ? t : `#${t}`) === tag);
}
function getFilesWithTag(app, tag) {
  return app.vault.getMarkdownFiles().filter(
    (file) => cacheHasTag(app.metadataCache.getFileCache(file), tag)
  );
}

// src/utils/noteContent.ts
function parseNoteInsight(content, cache) {
  const heading = cache?.headings?.[0]?.heading ?? "";
  const fmEnd = cache?.frontmatterPosition?.end.offset ?? 0;
  const afterFm = content.slice(fmEnd);
  const body = afterFm.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#")) ?? "";
  return { heading, body };
}

// src/blocks/QuotesListBlock.ts
var COLOR_RE = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*(,\s*[\d.]+\s*)?\)|hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*(,\s*[\d.]+\s*)?\))$/;
var DEBOUNCE_MS = 500;
var MS_PER_DAY = 864e5;
var SAFE_FONT_RE = /^[a-zA-Z0-9\s,'\-_]+$/;
var QuotesListBlock = class extends BaseBlock {
  render(el) {
    this.containerEl = el;
    el.addClass("quotes-list-block");
    const trigger = () => this.scheduleRender(DEBOUNCE_MS, (e) => {
      e.empty();
      return this.loadAndRender(e);
    });
    this.registerEvent(this.app.metadataCache.on("changed", (_file, _data, cache) => {
      const cfg = this.instance.config;
      if (cfg.source === "text" || !cfg.tag) return;
      const tagSearch = cfg.tag.startsWith("#") ? cfg.tag : `#${cfg.tag}`;
      if (cacheHasTag(cache, tagSearch)) trigger();
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      const cfg = this.instance.config;
      if (cfg.source === "text" || !cfg.tag) return;
      if (file.path.endsWith(".md")) trigger();
    }));
    return this.loadAndRender(el).catch((e) => {
      console.error("[Homepage Blocks] QuotesListBlock failed to render:", e);
      el.setText("Error loading quotes. Check console for details.");
    });
  }
  async loadAndRender(el) {
    const gen = this.nextGeneration();
    const {
      source = "tag",
      tag = "",
      quotes = "",
      columns = 2,
      maxItems = 20,
      heightMode = "extend",
      quoteStyle = "classic",
      fontStyle = "default",
      customFont = "",
      mode = "list",
      dailySeed = true,
      textAlign = "left",
      verticalAlign = "top"
    } = this.instance.config;
    el.style.setProperty("--hp-quote-valign", verticalAlign === "middle" ? "center" : verticalAlign === "bottom" ? "flex-end" : "flex-start");
    el.style.setProperty("--hp-quote-align", textAlign === "center" ? "center" : textAlign === "right" ? "right" : "start");
    this.renderHeader(el, "Quotes");
    const safeMode = mode === "single" ? "single" : "list";
    const safeFontStyle = fontStyle === "serif" || fontStyle === "handwriting" ? fontStyle : "default";
    el.toggleClass("quote-font-serif", safeFontStyle === "serif");
    el.toggleClass("quote-font-handwriting", safeFontStyle === "handwriting");
    const safeFont = typeof customFont === "string" && customFont.trim() && SAFE_FONT_RE.test(customFont.trim()) ? customFont.trim() : "";
    if (safeFont) el.style.setProperty("--hp-quote-font", safeFont);
    else el.style.removeProperty("--hp-quote-font");
    el.toggleClass("quote-style-centered", false);
    el.toggleClass("quote-style-card", false);
    el.toggleClass("quotes-list-block--extend", false);
    if (safeMode === "single") {
      if (source === "text") {
        this.renderSingleTextQuote(el, quotes, dailySeed);
        return;
      }
      if (!tag) {
        const hint = el.createDiv({ cls: "block-empty-hint" });
        hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F4A1}" });
        hint.createDiv({ cls: "block-empty-hint-text", text: "No tag configured. Add a tag in settings to show a daily rotating note." });
        return;
      }
      const tagSearch2 = tag.startsWith("#") ? tag : `#${tag}`;
      const files2 = getFilesWithTag(this.app, tagSearch2);
      if (files2.length === 0) {
        el.createDiv({ cls: "insight-card" }).setText(`No files found with tag ${tagSearch2}`);
        return;
      }
      const dayIndex = Math.floor((0, import_obsidian10.moment)().startOf("day").valueOf() / MS_PER_DAY);
      const index = dailySeed ? dayIndex % files2.length : Math.floor(Math.random() * files2.length);
      const file = files2[index];
      try {
        const content = await this.app.vault.read(file);
        if (this.isStale(gen)) return;
        const cache = this.app.metadataCache.getFileCache(file);
        const { heading, body } = parseNoteInsight(content, cache);
        const card2 = el.createDiv({ cls: "insight-card" });
        card2.createDiv({ cls: "insight-title", text: heading || file.basename });
        card2.createDiv({ cls: "insight-body", text: body });
      } catch (e) {
        console.error("[Homepage Blocks] QuotesListBlock single mode failed to read file:", e);
        el.createDiv({ cls: "insight-card" }).setText("Error reading file.");
      }
      const card = el.querySelector(".insight-card");
      if (card && heightMode === "extend") {
        el.toggleClass("quotes-list-block--extend", true);
        card.setAttribute("data-auto-height-content", "");
        setTimeout(() => {
          if (this.app.workspace.layoutReady) {
            window.dispatchEvent(new CustomEvent("hp-block-height-changed", { detail: { blockId: this.instance.id } }));
          }
        }, 50);
      }
      return;
    }
    const safeQuoteStyle = quoteStyle === "centered" || quoteStyle === "card" ? quoteStyle : "classic";
    el.toggleClass("quote-style-centered", safeQuoteStyle === "centered");
    el.toggleClass("quote-style-card", safeQuoteStyle === "card");
    el.toggleClass("quotes-list-block--extend", heightMode === "extend");
    const colsEl = el.createDiv({ cls: "quotes-columns" });
    if (heightMode !== "wrap") colsEl.setAttribute("data-auto-height-content", "");
    if (heightMode === "wrap") {
      colsEl.setAttribute("tabindex", "0");
      colsEl.setAttribute("role", "region");
      colsEl.setAttribute("aria-label", "Quotes");
    }
    if (safeQuoteStyle !== "centered") {
      const MIN_COL_WIDTH = 200;
      const updateCols = () => {
        const w = colsEl.offsetWidth;
        const effective = w > 0 ? Math.max(1, Math.min(columns, Math.floor(w / MIN_COL_WIDTH))) : columns;
        colsEl.style.setProperty("--hp-column-count", String(effective));
      };
      updateCols();
      const ro = new ResizeObserver(updateCols);
      ro.observe(colsEl);
      this.register(() => ro.disconnect());
    }
    if (heightMode !== "wrap") {
      this.observeWidthForAutoHeight(colsEl);
    }
    if (source === "text") {
      this.renderTextQuotes(colsEl, quotes, maxItems);
      return;
    }
    if (!tag) {
      const hint = colsEl.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F4AC}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No tag configured. Add a tag in settings to pull quotes from your notes." });
      return;
    }
    const tagSearch = tag.startsWith("#") ? tag : `#${tag}`;
    const files = getFilesWithTag(this.app, tagSearch).slice(0, maxItems);
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const content = await this.app.vault.read(file);
        const cache = this.app.metadataCache.getFileCache(file);
        return { file, content, cache };
      })
    );
    if (this.isStale(gen)) return;
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[Homepage Blocks] QuotesListBlock failed to read file:", result.reason);
        continue;
      }
      const { file, content, cache } = result.value;
      const color = cache?.frontmatter?.color ?? "";
      const body = this.extractBody(content, cache);
      if (!body) continue;
      const item = colsEl.createDiv({ cls: "quote-item" });
      const quote = item.createEl("blockquote", { cls: "quote-content", text: body });
      if (color && COLOR_RE.test(color)) {
        quote.style.setProperty("--hp-quote-color", color);
        quote.addClass("quote-colored");
      }
      item.createDiv({ cls: "quote-source", text: file.basename });
    }
  }
  /** Render a single quote picked from the text list (daily or random). */
  renderSingleTextQuote(el, raw, dailySeed) {
    if (!raw.trim()) {
      const hint = el.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F4AC}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No quotes yet. Add them in settings, separated by ---." });
      return;
    }
    const blocks = raw.split(/\n---\n/).map((b) => b.trim()).filter(Boolean);
    const dayIndex = Math.floor((0, import_obsidian10.moment)().startOf("day").valueOf() / MS_PER_DAY);
    const index = dailySeed ? dayIndex % blocks.length : Math.floor(Math.random() * blocks.length);
    const block = blocks[index];
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const lastLine = lines[lines.length - 1];
    const hasSource = lines.length > 1 && /^(—|–|--)/.test(lastLine);
    const sourceText = hasSource ? lastLine.replace(/^(—|–|--)\s*/, "") : "";
    const bodyLines = hasSource ? lines.slice(0, -1) : lines;
    const body = bodyLines.join(" ");
    const card = el.createDiv({ cls: "insight-card" });
    if (sourceText) card.createDiv({ cls: "insight-title", text: sourceText });
    card.createDiv({ cls: "insight-body", text: body });
  }
  /**
   * Render quotes from plain text. Each quote is separated by `---` on its own line.
   * Optionally a source line can follow the quote text, prefixed with `—`, `–`, or `--`.
   *
   * Example:
   *   The only way to do great work is to love what you do.
   *   — Steve Jobs
   *   ---
   *   In the middle of difficulty lies opportunity.
   *   — Albert Einstein
   */
  renderTextQuotes(colsEl, raw, maxItems) {
    if (!raw.trim()) {
      const hint = colsEl.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F4AC}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No quotes yet. Add them in settings, separated by ---." });
      return;
    }
    const blocks = raw.split(/\n---\n/).map((b) => b.trim()).filter(Boolean).slice(0, maxItems);
    for (const block of blocks) {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const lastLine = lines[lines.length - 1];
      const hasSource = lines.length > 1 && /^(—|–|--)/.test(lastLine);
      const sourceText = hasSource ? lastLine.replace(/^(—|–|--)\s*/, "") : "";
      const bodyLines = hasSource ? lines.slice(0, -1) : lines;
      const body = bodyLines.join(" ");
      if (!body) continue;
      const item = colsEl.createDiv({ cls: "quote-item" });
      item.createEl("blockquote", { cls: "quote-content", text: body });
      if (sourceText) item.createDiv({ cls: "quote-source", text: sourceText });
    }
  }
  /** Extract the first few lines of body content using metadataCache frontmatter offset. */
  extractBody(content, cache) {
    const fmEnd = cache?.frontmatterPosition?.end.offset ?? 0;
    const afterFm = content.slice(fmEnd);
    const lines = afterFm.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    return lines.slice(0, 3).join(" ");
  }
  openSettings(onSave) {
    new QuotesSettingsModal(this.app, this.instance.config, onSave).open();
  }
};
var QuotesSettingsModal = class extends import_obsidian10.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian10.Setting(contentEl).setName("Quotes list settings").setHeading();
    const draft = structuredClone(this.config);
    draft.source ??= "tag";
    draft.mode ??= "list";
    let tagSection;
    let textSection;
    new import_obsidian10.Setting(contentEl).setName("Source").setDesc("Pull quotes from tagged notes, or enter them manually.").addDropdown(
      (d) => d.addOption("tag", "Notes with tag").addOption("text", "Manual text").setValue(draft.source ?? "tag").onChange((v) => {
        draft.source = v === "text" ? "text" : "tag";
        tagSection.toggleClass("hp-hidden", v !== "tag");
        textSection.toggleClass("hp-hidden", v !== "text");
      })
    );
    tagSection = contentEl.createDiv();
    tagSection.toggleClass("hp-hidden", draft.source !== "tag");
    new import_obsidian10.Setting(tagSection).setName("Tag").setDesc("Without # prefix").addText(
      (t) => t.setValue(draft.tag ?? "").onChange((v) => {
        draft.tag = v;
      })
    );
    textSection = contentEl.createDiv();
    textSection.toggleClass("hp-hidden", draft.source !== "text");
    const textSetting = new import_obsidian10.Setting(textSection).setName("Quotes").setDesc("Separate quotes with --- on its own line, then add a source with \u2014 (e.g. \u2014 author).");
    textSetting.settingEl.addClass("hp-setting-column");
    const textarea = textSetting.settingEl.createEl("textarea");
    textarea.rows = 8;
    textarea.addClass("hp-textarea-full");
    textarea.value = draft.quotes ?? "";
    textarea.addEventListener("input", () => {
      draft.quotes = textarea.value;
    });
    let singleSection;
    let listSection;
    new import_obsidian10.Setting(contentEl).setName("Display").setDesc("Show all items as a grid, or rotate through one at a time.").addDropdown(
      (d) => d.addOption("list", "All items").addOption("single", "One at a time").setValue(draft.mode ?? "list").onChange((v) => {
        draft.mode = v === "single" ? "single" : "list";
        singleSection.toggleClass("hp-hidden", v !== "single");
        listSection.toggleClass("hp-hidden", v !== "list");
      })
    );
    singleSection = contentEl.createDiv();
    singleSection.toggleClass("hp-hidden", draft.mode !== "single");
    new import_obsidian10.Setting(singleSection).setName("Daily seed").setDesc("Show the same item all day; changes at midnight.").addToggle(
      (t) => t.setValue(draft.dailySeed !== false).onChange((v) => {
        draft.dailySeed = v;
      })
    );
    listSection = contentEl.createDiv();
    listSection.toggleClass("hp-hidden", draft.mode !== "list");
    new import_obsidian10.Setting(listSection).setName("Columns").addDropdown(
      (d) => d.addOption("2", "2").addOption("3", "3").setValue(String(typeof draft.columns === "number" ? draft.columns : 2)).onChange((v) => {
        draft.columns = Number(v);
      })
    );
    new import_obsidian10.Setting(listSection).setName("Height mode").setDesc("Scroll keeps the block compact \u2014 grow to fit all works best at full width.").addDropdown(
      (d) => d.addOption("wrap", "Scroll (fixed height)").addOption("extend", "Grow to fit all").setValue(typeof draft.heightMode === "string" ? draft.heightMode : "extend").onChange((v) => {
        draft.heightMode = v === "wrap" ? "wrap" : "extend";
      })
    );
    new import_obsidian10.Setting(listSection).setName("Max items").addText(
      (t) => t.setValue(String(typeof draft.maxItems === "number" ? draft.maxItems : 20)).onChange((v) => {
        draft.maxItems = Math.min(Math.max(1, parseInt(v) || 20), 200);
      })
    );
    new import_obsidian10.Setting(listSection).setName("Quote style").setDesc("Classic shows a left accent bar. Centered stacks quotes in one column. Card wraps each quote in its own box.").addDropdown(
      (d) => d.addOption("classic", "Classic").addOption("centered", "Centered").addOption("card", "Card").setValue(typeof draft.quoteStyle === "string" ? draft.quoteStyle : "classic").onChange((v) => {
        draft.quoteStyle = v === "centered" || v === "card" ? v : "classic";
      })
    );
    new import_obsidian10.Setting(contentEl).setName("Text alignment").setDesc("Align text to the left, center, or right.").addDropdown(
      (d) => d.addOption("left", "Left").addOption("center", "Center").addOption("right", "Right").setValue(typeof draft.textAlign === "string" ? draft.textAlign : "left").onChange((v) => {
        draft.textAlign = v;
      })
    );
    new import_obsidian10.Setting(contentEl).setName("Vertical alignment").setDesc("Align the quotes list or card vertically within the block.").addDropdown(
      (d) => d.addOption("top", "Top").addOption("middle", "Middle").addOption("bottom", "Bottom").setValue(typeof draft.verticalAlign === "string" ? draft.verticalAlign : "top").onChange((v) => {
        draft.verticalAlign = v;
      })
    );
    new import_obsidian10.Setting(contentEl).setName("Font style").setDesc("Preset font family. Overridden by a custom font below (line-height preset still applies).").addDropdown(
      (d) => d.addOption("default", "Default").addOption("serif", "Serif").addOption("handwriting", "Handwriting").setValue(typeof draft.fontStyle === "string" ? draft.fontStyle : "default").onChange((v) => {
        draft.fontStyle = v === "serif" || v === "handwriting" ? v : "default";
      })
    );
    new import_obsidian10.Setting(contentEl).setName("Custom font").setDesc("Any installed font family. Overrides the font style preset above.").addText(
      (t) => t.setPlaceholder("Georgia").setValue(typeof draft.customFont === "string" ? draft.customFont : "").onChange((v) => {
        draft.customFont = v;
      })
    );
    new import_obsidian10.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/ImageGalleryBlock.ts
var import_obsidian11 = require("obsidian");

// src/utils/responsiveGrid.ts
function responsiveGridColumns(safeCols, minPx = 120) {
  return `repeat(auto-fill, minmax(max(${minPx}px, calc(100% / ${safeCols})), 1fr))`;
}

// src/blocks/ImageGalleryBlock.ts
var IMAGE_EXTS = /* @__PURE__ */ new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
var VIDEO_EXTS = /* @__PURE__ */ new Set([".mp4", ".webm", ".mov", ".mkv"]);
var SWIPE_THRESHOLD_PX = 50;
var SWIPE_DIRECTION_RATIO = 1.5;
var activeLightboxAc = null;
function isLightboxOpen() {
  return activeLightboxAc !== null;
}
function openMediaLightbox(items, startIndex) {
  if (items.length === 0) return;
  activeLightboxAc?.abort();
  document.querySelector(".gallery-lightbox")?.remove();
  const ac = new AbortController();
  activeLightboxAc = ac;
  const { signal } = ac;
  let current = startIndex;
  const overlay = document.body.createDiv({ cls: "gallery-lightbox" });
  const prevBtn = overlay.createEl("button", { cls: "gallery-lightbox-prev", attr: { "aria-label": "Previous" } });
  (0, import_obsidian11.setIcon)(prevBtn, "chevron-left");
  const mediaContainer = overlay.createDiv({ cls: "gallery-lightbox-media" });
  const nextBtn = overlay.createEl("button", { cls: "gallery-lightbox-next", attr: { "aria-label": "Next" } });
  (0, import_obsidian11.setIcon)(nextBtn, "chevron-right");
  const counter = overlay.createEl("span", { cls: "gallery-lightbox-counter" });
  if (items.length <= 1) {
    prevBtn.addClass("gallery-lightbox-nav-hidden");
    nextBtn.addClass("gallery-lightbox-nav-hidden");
    counter.addClass("gallery-lightbox-nav-hidden");
  }
  const pauseCurrentVideo = () => {
    const vid = mediaContainer.querySelector("video");
    if (vid) vid.pause();
  };
  const showItem = (index) => {
    pauseCurrentVideo();
    mediaContainer.empty();
    current = (index % items.length + items.length) % items.length;
    const item = items[current];
    counter.setText(`${current + 1} / ${items.length}`);
    if (item.type === "image") {
      const img = mediaContainer.createEl("img", { cls: "gallery-lightbox-img", attr: { src: item.src, alt: item.alt } });
      img.addEventListener("click", (e) => e.stopPropagation());
      img.addEventListener("error", () => {
        img.alt = "Image unavailable";
      });
    } else {
      const video = mediaContainer.createEl("video", {
        cls: "gallery-lightbox-video",
        attr: { src: item.src, "aria-label": item.alt }
      });
      video.controls = true;
      video.muted = true;
      video.loop = true;
      video.setAttribute("playsinline", "");
      video.addEventListener("click", (e) => e.stopPropagation());
      video.play().catch(() => {
      });
    }
  };
  const close = () => {
    pauseCurrentVideo();
    overlay.remove();
    ac.abort();
    activeLightboxAc = null;
  };
  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showItem(current - 1);
  }, { signal });
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showItem(current + 1);
  }, { signal });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target === mediaContainer) close();
  }, { signal });
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      showItem(current - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      showItem(current + 1);
    }
  }, { signal });
  let touchStartX = 0;
  let touchStartY = 0;
  overlay.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { signal, passive: true });
  overlay.addEventListener("touchend", (e) => {
    if (e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_DIRECTION_RATIO) {
      e.preventDefault();
      if (dx < 0) showItem(current + 1);
      else showItem(current - 1);
    }
  }, { signal });
  showItem(current);
}
var DEBOUNCE_MS2 = 300;
var ImageGalleryBlock = class extends BaseBlock {
  /** The AbortController for the lightbox opened by THIS instance (if any). */
  myLightboxAc = null;
  onunload() {
    super.onunload();
    if (this.myLightboxAc && this.myLightboxAc === activeLightboxAc) {
      this.myLightboxAc.abort();
      document.querySelector(".gallery-lightbox")?.remove();
      activeLightboxAc = null;
    }
    this.myLightboxAc = null;
  }
  render(el) {
    this.containerEl = el;
    el.addClass("image-gallery-block");
    const isRelevant = (file) => this.isRelevantMedia(file.path);
    const trigger = () => this.scheduleRender(DEBOUNCE_MS2, (e) => {
      e.empty();
      return this.loadAndRender(e);
    });
    this.registerEvent(this.app.vault.on("create", (f) => {
      if (isRelevant(f)) trigger();
    }));
    this.registerEvent(this.app.vault.on("delete", (f) => {
      if (isRelevant(f)) trigger();
    }));
    this.registerEvent(this.app.vault.on("rename", (f, oldPath) => {
      if (isRelevant(f) || this.isRelevantMedia(oldPath)) trigger();
    }));
    return this.loadAndRender(el).catch((e) => {
      console.error("[Homepage Blocks] ImageGalleryBlock failed to render:", e);
      el.setText("Error loading gallery. Check console for details.");
    });
  }
  isRelevantMedia(path) {
    const { folder = "" } = this.instance.config;
    if (!folder) return false;
    if (!path.startsWith(folder + "/")) return false;
    const dot = path.lastIndexOf(".");
    if (dot < 0) return false;
    const ext = path.slice(dot).toLowerCase();
    return IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext);
  }
  async loadAndRender(el) {
    const gen = this.nextGeneration();
    const cfg = this.instance.config;
    const folder = cfg.folder ?? "";
    const columns = Math.max(1, Math.min(6, Math.floor(Number(cfg.columns) || 3)));
    const maxItems = Math.max(1, Math.min(200, Math.floor(Number(cfg.maxItems) || 20)));
    const layout = cfg.layout ?? "grid";
    const heightMode = cfg.heightMode ?? "auto";
    this.renderHeader(el, "Gallery");
    const gallery = el.createDiv({ cls: "image-gallery" });
    if (heightMode === "fixed") {
      gallery.addClass("image-gallery--fixed-height");
    } else {
      gallery.setAttribute("data-auto-height-content", "");
    }
    if (layout === "masonry") {
      gallery.addClass("masonry-layout");
      let currentCols = -1;
      const updateCols = () => {
        const w = gallery.offsetWidth;
        const effective = w > 0 ? Math.max(1, Math.min(columns, Math.floor(w / 100))) : columns;
        if (effective !== currentCols) {
          currentCols = effective;
          gallery.style.setProperty("--hp-masonry-cols", String(effective));
        }
      };
      updateCols();
      const ro = new ResizeObserver(updateCols);
      ro.observe(gallery);
      this.register(() => ro.disconnect());
    } else {
      const safeCols = Math.max(1, Math.min(6, Math.floor(Number(columns) || 3)));
      gallery.style.setProperty("--hp-grid-cols", responsiveGridColumns(safeCols, 100));
    }
    if (!folder) {
      const hint = gallery.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F5BC}\uFE0F" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No folder selected. Pick an image folder in settings to display a gallery." });
      return;
    }
    const folderObj = this.app.vault.getAbstractFileByPath(folder);
    if (!(folderObj instanceof import_obsidian11.TFolder)) {
      gallery.setText(`Folder "${folder}" not found.`);
      return;
    }
    const files = this.getMediaFiles(folderObj, maxItems);
    const lightboxItems = files.map((f) => {
      const e = `.${f.extension.toLowerCase()}`;
      return {
        src: this.app.vault.getResourcePath(f),
        alt: f.basename,
        type: IMAGE_EXTS.has(e) ? "image" : "video"
      };
    });
    const imageLoadPromises = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = `.${file.extension.toLowerCase()}`;
      const wrapper = gallery.createDiv({ cls: "gallery-item" });
      wrapper.setAttribute("tabindex", "0");
      wrapper.setAttribute("role", "button");
      wrapper.setAttribute("aria-label", file.basename);
      const index = i;
      const action = () => {
        openMediaLightbox(lightboxItems, index);
        this.myLightboxAc = activeLightboxAc;
      };
      wrapper.addEventListener("click", action);
      wrapper.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          action();
        }
      });
      if (IMAGE_EXTS.has(ext)) {
        const img = wrapper.createEl("img");
        img.src = lightboxItems[index].src;
        img.alt = file.basename;
        imageLoadPromises.push(
          new Promise((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
        );
      } else if (VIDEO_EXTS.has(ext)) {
        wrapper.addClass("gallery-item-video");
        wrapper.createDiv({ cls: "video-play-overlay", text: "\u25B6" });
        const video = wrapper.createEl("video");
        video.muted = true;
        video.loop = true;
        video.setAttribute("playsinline", "");
        video.preload = "metadata";
        video.src = lightboxItems[index].src;
        video.addEventListener("loadedmetadata", () => {
          video.currentTime = 0.1;
        }, { once: true });
        wrapper.addEventListener("mouseenter", () => {
          if (!isLightboxOpen()) video.play().catch(() => {
          });
        });
        wrapper.addEventListener("mouseleave", () => {
          video.pause();
          video.currentTime = 0.1;
        });
      }
    }
    await Promise.all(imageLoadPromises);
    if (this.isStale(gen)) return;
    if (heightMode !== "fixed") {
      this.observeWidthForAutoHeight(gallery);
    }
  }
  getMediaFiles(folder, limit = Infinity) {
    const files = [];
    const recurse = (f) => {
      for (const child of f.children) {
        if (files.length >= limit) return;
        if (child instanceof import_obsidian11.TFile) {
          const ext = `.${child.extension.toLowerCase()}`;
          if (IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext)) {
            files.push(child);
          }
        } else if (child instanceof import_obsidian11.TFolder) {
          recurse(child);
        }
      }
    };
    recurse(folder);
    return files;
  }
  openSettings(onSave) {
    new ImageGallerySettingsModal(this.app, this.instance.config, onSave).open();
  }
};
var ImageGallerySettingsModal = class extends import_obsidian11.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian11.Setting(contentEl).setName("Image gallery settings").setHeading();
    const draft = structuredClone(this.config);
    let folderText;
    new import_obsidian11.Setting(contentEl).setName("Folder").setDesc("Pick a vault folder.").addText((t) => {
      folderText = t;
      t.setValue(draft.folder ?? "").setPlaceholder("Attachments/photos").onChange((v) => {
        draft.folder = v;
      });
    }).addButton(
      (btn) => btn.setIcon("folder").setTooltip("Browse vault folders").onClick(() => {
        new FolderSuggestModal(this.app, (folder) => {
          const path = folder.path === "/" ? "" : folder.path;
          draft.folder = path;
          folderText.setValue(path);
        }).open();
      })
    );
    new import_obsidian11.Setting(contentEl).setName("Height").setDesc("Auto: expands to show all images \u2014 fixed: uses the block's row height and scrolls.").addDropdown(
      (d) => d.addOption("auto", "Auto (fit all images)").addOption("fixed", "Fixed (scroll)").setValue(typeof draft.heightMode === "string" ? draft.heightMode : "auto").onChange((v) => {
        draft.heightMode = v === "fixed" ? "fixed" : "auto";
      })
    );
    new import_obsidian11.Setting(contentEl).setName("Layout").addDropdown(
      (d) => d.addOption("grid", "Grid").addOption("masonry", "Masonry").setValue(typeof draft.layout === "string" ? draft.layout : "grid").onChange((v) => {
        draft.layout = v;
      })
    );
    new import_obsidian11.Setting(contentEl).setName("Columns").addDropdown(
      (d) => d.addOption("2", "2").addOption("3", "3").addOption("4", "4").addOption("5", "5").addOption("6", "6").setValue(String(typeof draft.columns === "number" ? draft.columns : 3)).onChange((v) => {
        draft.columns = Number(v);
      })
    );
    new import_obsidian11.Setting(contentEl).setName("Max items").addText(
      (t) => t.setValue(String(typeof draft.maxItems === "number" ? draft.maxItems : 20)).onChange((v) => {
        draft.maxItems = Math.min(Math.max(1, parseInt(v) || 20), 200);
      })
    );
    new import_obsidian11.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/EmbeddedNoteBlock.ts
var import_obsidian12 = require("obsidian");
var DEBOUNCE_MS3 = 300;
var EmbeddedNoteBlock = class extends BaseBlock {
  render(el) {
    this.containerEl = el;
    el.addClass("embedded-note-block");
    const trigger = () => this.scheduleRender(DEBOUNCE_MS3, (e) => this.renderContent(e));
    this.registerEvent(
      this.app.vault.on("modify", (modFile) => {
        const { filePath = "" } = this.instance.config;
        if (modFile.path === filePath) trigger();
      })
    );
    this.registerEvent(this.app.vault.on("delete", (file) => {
      const { filePath = "" } = this.instance.config;
      if (file.path === filePath) trigger();
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      const { filePath = "" } = this.instance.config;
      if (oldPath === filePath) {
        const newBlocks = this.plugin.layout.blocks.map(
          (b) => b.id === this.instance.id ? { ...b, config: { ...b.config, filePath: file.path } } : b
        );
        void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
      }
      if (oldPath === filePath || file.path === filePath) trigger();
    }));
    return this.renderContent(el).catch((e) => {
      console.error("[Homepage Blocks] EmbeddedNoteBlock failed to render:", e);
      el.setText("Error rendering file. Check console for details.");
    });
  }
  async renderContent(el) {
    const gen = this.nextGeneration();
    const { filePath = "", showTitle = true, heightMode = "scroll" } = this.instance.config;
    el.empty();
    el.toggleClass("embedded-note-block--grow", heightMode === "grow");
    if (!filePath) {
      const hint = el.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F4C4}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No note selected. Choose a file path in settings to embed it here." });
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof import_obsidian12.TFile)) {
      el.setText(`File not found: ${filePath}`);
      return;
    }
    if (showTitle) {
      this.renderHeader(el, file.basename);
    }
    const contentEl = el.createDiv({ cls: "embedded-note-content" });
    if (heightMode === "scroll") {
      contentEl.setAttribute("tabindex", "0");
      contentEl.setAttribute("role", "region");
      contentEl.setAttribute("aria-label", file.basename);
    }
    try {
      const content = await this.app.vault.read(file);
      if (this.isStale(gen)) return;
      await import_obsidian12.MarkdownRenderer.render(this.app, content, contentEl, file.path, this);
    } catch (e) {
      console.error("[Homepage Blocks] EmbeddedNoteBlock MarkdownRenderer failed:", e);
      contentEl.setText("Error rendering file.");
    }
  }
  openSettings(onSave) {
    new EmbeddedNoteSettingsModal(this.app, this.instance.config, onSave).open();
  }
};
var FileSuggest = class extends import_obsidian12.AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }
  getSuggestions(query) {
    const q = query.toLowerCase();
    return this.app.vault.getMarkdownFiles().filter((f) => f.path.toLowerCase().includes(q)).sort((a, b) => a.path.localeCompare(b.path)).slice(0, 30);
  }
  renderSuggestion(file, el) {
    el.createEl("span", { text: file.path });
  }
  selectSuggestion(file) {
    this.setValue(file.path);
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
};
var EmbeddedNoteSettingsModal = class extends import_obsidian12.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian12.Setting(contentEl).setName("Embedded note settings").setHeading();
    const draft = structuredClone(this.config);
    new import_obsidian12.Setting(contentEl).setName("File path").setDesc("Vault path to the note (e.g. Notes/MyNote.md)").addText((t) => {
      t.setValue(draft.filePath ?? "").setPlaceholder("Start typing to search\u2026").onChange((v) => {
        draft.filePath = v;
      });
      new FileSuggest(this.app, t.inputEl);
    });
    new import_obsidian12.Setting(contentEl).setName("Show title").addToggle(
      (t) => t.setValue(draft.showTitle ?? true).onChange((v) => {
        draft.showTitle = v;
      })
    );
    new import_obsidian12.Setting(contentEl).setName("Height mode").setDesc("Scroll keeps the block compact \u2014 grow to fit all expands the card to show the full note.").addDropdown(
      (d) => d.addOption("scroll", "Scroll (fixed height)").addOption("grow", "Grow to fit all").setValue(draft.heightMode ?? "scroll").onChange((v) => {
        draft.heightMode = v;
      })
    );
    new import_obsidian12.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/StaticTextBlock.ts
var import_obsidian13 = require("obsidian");
var StaticTextBlock = class extends BaseBlock {
  render(el) {
    el.addClass("static-text-block");
    this.renderContent(el).catch((e) => {
      console.error("[Homepage Blocks] StaticTextBlock failed to render:", e);
      el.setText("Error rendering content.");
    });
  }
  async renderContent(el) {
    const { content = "", heightMode = "auto" } = this.instance.config;
    el.empty();
    this.renderHeader(el, "Text");
    const editBtn = el.createEl("button", {
      cls: "static-text-edit-btn",
      attr: { "aria-label": "Edit content" }
    });
    (0, import_obsidian13.setIcon)(editBtn, "pencil");
    editBtn.addEventListener("click", () => {
      this.enterInlineEdit(el);
    });
    const contentEl = el.createDiv({ cls: "static-text-content" });
    if (heightMode !== "fixed") {
      contentEl.setAttribute("data-auto-height-content", "");
    }
    if (!content) {
      const hint = contentEl.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F4DD}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No content yet. Click the pencil icon to add text." });
      return;
    }
    await import_obsidian13.MarkdownRenderer.render(this.app, content, contentEl, "", this);
  }
  enterInlineEdit(el) {
    const currentContent = this.instance.config.content ?? "";
    const contentEl = el.querySelector(".static-text-content");
    const editBtn = el.querySelector(".static-text-edit-btn");
    if (contentEl) contentEl.addClass("hp-hidden");
    if (editBtn) editBtn.addClass("hp-hidden");
    const editor = el.createDiv({ cls: "static-text-inline-editor" });
    if ((this.instance.config.heightMode ?? "auto") !== "fixed") {
      editor.setAttribute("data-auto-height-content", "");
    }
    const textarea = editor.createEl("textarea");
    textarea.value = currentContent;
    const toolbar = editor.createDiv({ cls: "inline-edit-toolbar" });
    const saveBtn = toolbar.createEl("button", {
      cls: "inline-edit-btn inline-edit-save",
      attr: { "aria-label": "Save" }
    });
    (0, import_obsidian13.setIcon)(saveBtn, "check");
    const cancelBtn = toolbar.createEl("button", {
      cls: "inline-edit-btn inline-edit-cancel",
      attr: { "aria-label": "Cancel" }
    });
    (0, import_obsidian13.setIcon)(cancelBtn, "x");
    const save = () => {
      const newConfig = { ...this.instance.config, content: textarea.value };
      const newBlocks = this.plugin.layout.blocks.map(
        (b) => b.id === this.instance.id ? { ...b, config: newConfig } : b
      );
      void this.plugin.saveLayout({ ...this.plugin.layout, blocks: newBlocks });
      this.renderContent(el).catch(() => {
      });
    };
    const cancel = () => {
      this.renderContent(el).catch(() => {
      });
    };
    saveBtn.addEventListener("click", save);
    cancelBtn.addEventListener("click", cancel);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    });
    textarea.focus();
  }
  openSettings(onSave) {
    new StaticTextSettingsModal(this.app, this.instance.config, onSave).open();
  }
};
var StaticTextSettingsModal = class extends import_obsidian13.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian13.Setting(contentEl).setName("Static text settings").setHeading();
    const draft = structuredClone(this.config);
    new import_obsidian13.Setting(contentEl).setName("Height").setDesc("Auto: expands to fit all content \u2014 fixed: uses grid cell height with scrollbar.").addDropdown(
      (d) => d.addOption("auto", "Auto (fit content)").addOption("fixed", "Fixed (scroll)").setValue(typeof draft.heightMode === "string" ? draft.heightMode : "auto").onChange((v) => {
        draft.heightMode = v;
      })
    );
    new import_obsidian13.Setting(contentEl).setName("Content").setDesc("Supports Markdown.");
    const textarea = contentEl.createEl("textarea", { cls: "static-text-settings-textarea" });
    textarea.value = draft.content ?? "";
    textarea.rows = 10;
    textarea.addEventListener("input", () => {
      draft.content = textarea.value;
    });
    new import_obsidian13.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/HtmlBlock.ts
var import_obsidian14 = require("obsidian");
var HtmlBlock = class extends BaseBlock {
  render(el) {
    el.addClass("html-block");
    const { html = "" } = this.instance.config;
    this.renderHeader(el, "HTML");
    const contentEl = el.createDiv({ cls: "html-block-content" });
    if (!html) {
      const hint = contentEl.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "</>" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No HTML content yet. Add your markup in settings." });
      return;
    }
    const DANGEROUS_TAGS_RE = /<\s*(iframe|object|embed|form|meta|link|base)\b[^>]*>/gi;
    contentEl.appendChild((0, import_obsidian14.sanitizeHTMLToDom)(html.replace(DANGEROUS_TAGS_RE, "")));
  }
  openSettings(onSave) {
    new HtmlBlockSettingsModal(this.app, this.instance.config, onSave).open();
  }
};
var HtmlBlockSettingsModal = class extends import_obsidian14.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian14.Setting(contentEl).setName("HTML block settings").setHeading();
    const draft = structuredClone(this.config);
    new import_obsidian14.Setting(contentEl).setName("HTML").setDesc("HTML is sanitized before rendering.");
    const textarea = contentEl.createEl("textarea", { cls: "html-settings-textarea" });
    textarea.value = draft.html ?? "";
    textarea.rows = 12;
    textarea.setAttribute("spellcheck", "false");
    textarea.addEventListener("input", () => {
      draft.html = textarea.value;
    });
    new import_obsidian14.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/VideoEmbedBlock.ts
var import_obsidian15 = require("obsidian");
function isYtPostMessage(value) {
  return typeof value === "object" && value !== null;
}
function getPlaylistIds(data) {
  const info = data.info;
  if (typeof info !== "object" || info === null) return null;
  const rec = info;
  return Array.isArray(rec.playlist) ? rec.playlist : null;
}
var PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{2,64}$/;
var YT_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
var YT_ORIGIN = "https://www.youtube.com";
var YT_EMBED_BLOCKED_ERRORS = /* @__PURE__ */ new Set([101, 150]);
function validListId(raw) {
  return raw && PLAYLIST_ID_RE.test(raw) ? raw : null;
}
function parseUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (/^(www\.)?youtube\.com$/i.test(url.hostname)) {
    const listId = validListId(url.searchParams.get("list"));
    if (url.pathname === "/playlist" && listId) {
      return { type: "playlist", value: listId };
    }
    const videoId = url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})(?:[?/]|$)/)?.[1];
    if (videoId && YT_VIDEO_ID_RE.test(videoId)) {
      if (listId) return { type: "playlist", value: listId, videoId };
      return { type: "video", value: videoId };
    }
    if (listId) return { type: "playlist", value: listId };
  }
  if (/^youtu\.be$/i.test(url.hostname)) {
    const id = url.pathname.slice(1);
    if (YT_VIDEO_ID_RE.test(id)) {
      const listId = validListId(url.searchParams.get("list"));
      if (listId) return { type: "playlist", value: listId, videoId: id };
      return { type: "video", value: id };
    }
  }
  if (/^(www\.)?vimeo\.com$/i.test(url.hostname)) {
    const id = url.pathname.match(/^\/(\d+)/)?.[1];
    if (id) return { type: "video", value: `https://player.vimeo.com/video/${id}` };
  }
  if (/^(www\.)?dailymotion\.com$/i.test(url.hostname)) {
    const id = url.pathname.match(/^\/video\/([A-Za-z0-9]+)/)?.[1];
    if (id) return { type: "video", value: `https://www.dailymotion.com/embed/video/${id}` };
  }
  return null;
}
function ytEmbedUrl(videoId, extraParams) {
  const params = new URLSearchParams({ enablejsapi: "1", ...extraParams });
  return `${YT_ORIGIN}/embed/${videoId}?${params.toString()}`;
}
function playlistEmbedUrl(listId, opts) {
  const params = new URLSearchParams({ list: listId, enablejsapi: "1" });
  if (opts?.shuffle) params.set("shuffle", "1");
  if (opts?.index !== void 0) params.set("index", String(opts.index));
  if (opts?.autoplay) params.set("autoplay", "1");
  const base = opts?.videoId ? `${YT_ORIGIN}/embed/${opts.videoId}` : `${YT_ORIGIN}/embed/videoseries`;
  return `${base}?${params.toString()}`;
}
var VideoEmbedBlock = class _VideoEmbedBlock extends BaseBlock {
  currentIndex = 0;
  playlistLength = 0;
  playlistVideoIds = [];
  iframeEl = null;
  render(el) {
    this.currentIndex = 0;
    this.playlistLength = 0;
    this.playlistVideoIds = [];
    this.iframeEl = null;
    el.addClass("video-embed-block");
    const { url = "", shuffleOnLoad = false } = this.instance.config;
    this.renderHeader(el, "Video");
    const wrapper = el.createDiv({ cls: "video-embed-inner" });
    const info = parseUrl(url);
    if (!info) {
      const container = wrapper.createDiv({ cls: "video-embed-container" });
      container.addClass("hp-no-padding-bottom");
      const hint = container.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F3AC}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No video URL. Paste a YouTube, Vimeo, or Dailymotion link in settings." });
      return;
    }
    if (info.type === "video") {
      this.renderSingleVideo(wrapper, info.value);
    } else {
      this.renderPlaylist(wrapper, info.value, shuffleOnLoad, info.videoId);
    }
  }
  /** Render a clickable YouTube thumbnail (for embed-blocked videos). */
  renderThumbnail(container, videoId) {
    container.empty();
    container.addClass("video-embed-thumbnail");
    container.createEl("img", {
      cls: "video-embed-thumb-img",
      attr: {
        src: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        alt: "Video thumbnail",
        loading: "lazy"
      }
    });
    const playBtn = container.createDiv({ cls: "video-embed-play-overlay" });
    playBtn.createDiv({ cls: "video-embed-play-icon" });
    const label = container.createDiv({ cls: "video-embed-thumb-label" });
    label.setText("Watch on YouTube");
    this.registerDomEvent(container, "click", () => {
      window.open(`${YT_ORIGIN}/watch?v=${videoId}`, "_blank");
    });
  }
  renderSingleVideo(el, videoIdOrUrl) {
    const container = el.createDiv({ cls: "video-embed-container" });
    const isYt = YT_VIDEO_ID_RE.test(videoIdOrUrl);
    const src = isYt ? ytEmbedUrl(videoIdOrUrl) : videoIdOrUrl;
    this.createIframe(container, src);
    if (isYt) {
      const gen = this.nextGeneration();
      this.listenForYtErrors(gen, container, videoIdOrUrl);
    }
  }
  renderPlaylist(el, listId, shuffleOnLoad, videoId) {
    const container = el.createDiv({ cls: "video-embed-container" });
    const initialSrc = shuffleOnLoad ? playlistEmbedUrl(listId, { shuffle: true }) : playlistEmbedUrl(listId, { index: 0, videoId });
    this.createIframe(container, initialSrc);
    const bar = container.createDiv({ cls: "video-embed-controls" });
    const prevBtn = bar.createEl("button", { cls: "video-embed-ctrl-btn", attr: { "aria-label": "Previous video" } });
    (0, import_obsidian15.setIcon)(prevBtn, "skip-back");
    const gen = this.nextGeneration();
    const fmtLabel = (idx) => {
      const num = `#${idx + 1}`;
      return this.playlistLength > 0 ? `${num}/${this.playlistLength}` : num;
    };
    const indexLabel = bar.createSpan({
      cls: "video-embed-index-label",
      text: shuffleOnLoad ? "\u{1F500}" : fmtLabel(0)
    });
    const nextBtn = bar.createEl("button", { cls: "video-embed-ctrl-btn", attr: { "aria-label": "Next video" } });
    (0, import_obsidian15.setIcon)(nextBtn, "skip-forward");
    const randomBtn = bar.createEl("button", { cls: "video-embed-ctrl-btn", attr: { "aria-label": "Random video" } });
    (0, import_obsidian15.setIcon)(randomBtn, "shuffle");
    this.registerDomEvent(prevBtn, "click", () => {
      if (this.currentIndex <= 0) return;
      this.currentIndex--;
      this.restoreIframeIfThumbnail(container, bar);
      this.updateIframe(playlistEmbedUrl(listId, { index: this.currentIndex, autoplay: true }));
      indexLabel.setText(fmtLabel(this.currentIndex));
    });
    this.registerDomEvent(nextBtn, "click", () => {
      if (this.playlistLength > 0 && this.currentIndex >= this.playlistLength - 1) return;
      this.currentIndex++;
      this.restoreIframeIfThumbnail(container, bar);
      this.updateIframe(playlistEmbedUrl(listId, { index: this.currentIndex, autoplay: true }));
      indexLabel.setText(fmtLabel(this.currentIndex));
    });
    this.registerDomEvent(randomBtn, "click", () => {
      this.restoreIframeIfThumbnail(container, bar);
      if (this.playlistLength > 0) {
        const randIdx = Math.floor(Math.random() * this.playlistLength);
        this.currentIndex = randIdx;
        this.updateIframe(playlistEmbedUrl(listId, { index: randIdx, autoplay: true }));
        indexLabel.setText(fmtLabel(randIdx));
      } else {
        this.updateIframe(playlistEmbedUrl(listId, { shuffle: true, autoplay: true }));
        indexLabel.setText("\u{1F500}");
      }
    });
    this.listenForPlaylistEvents(gen, container, bar, indexLabel, fmtLabel);
  }
  /**
   * If the container is showing a thumbnail (embed-blocked video in playlist),
   * restore it to iframe mode so the next navigation works.
   */
  restoreIframeIfThumbnail(container, controlBar) {
    if (!container.hasClass("video-embed-thumbnail")) return;
    container.empty();
    container.removeClass("video-embed-thumbnail");
    this.createIframe(container, "");
    container.appendChild(controlBar);
  }
  /** Listen for YouTube postMessage events: playlist size + embed errors. */
  listenForPlaylistEvents(gen, container, controlBar, indexLabel, fmtLabel) {
    const handler = (e) => {
      if (this.isStale(gen)) return;
      if (e.origin !== YT_ORIGIN) return;
      if (!this.iframeEl?.contentWindow || e.source !== this.iframeEl.contentWindow) return;
      try {
        const raw = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (!isYtPostMessage(raw)) return;
        if (raw.event === "infoDelivery") {
          const ids = getPlaylistIds(raw);
          if (ids) {
            this.playlistLength = ids.length;
            this.playlistVideoIds = ids;
            if (!indexLabel.getText().includes("\u{1F500}")) {
              indexLabel.setText(fmtLabel(this.currentIndex));
            }
          }
        }
        if (raw.event === "onError" && typeof raw.info === "number" && YT_EMBED_BLOCKED_ERRORS.has(raw.info)) {
          const vidId = this.playlistVideoIds[this.currentIndex];
          if (typeof vidId === "string" && YT_VIDEO_ID_RE.test(vidId)) {
            this.showPlaylistThumbnail(container, controlBar, vidId);
          }
        }
      } catch {
      }
    };
    window.addEventListener("message", handler);
    this.register(() => window.removeEventListener("message", handler));
    this.sendYtHandshake(gen, "hp-playlist");
  }
  /** Send the YouTube postMessage "listening" handshake to the current iframe. */
  sendYtHandshake(gen, id) {
    if (!this.iframeEl) return;
    const iframe = this.iframeEl;
    this.registerDomEvent(iframe, "load", () => {
      if (this.isStale(gen)) return;
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: "listening", id }),
        YT_ORIGIN
      );
    });
  }
  /** Listen for YouTube error on a single video embed. */
  listenForYtErrors(gen, container, videoId) {
    const iframe = this.iframeEl;
    if (!iframe) return;
    const handler = (e) => {
      if (this.isStale(gen)) return;
      if (e.origin !== YT_ORIGIN) return;
      if (!iframe.contentWindow || e.source !== iframe.contentWindow) return;
      try {
        const raw = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (!isYtPostMessage(raw)) return;
        if (raw.event === "onError" && typeof raw.info === "number" && YT_EMBED_BLOCKED_ERRORS.has(raw.info)) {
          this.renderThumbnail(container, videoId);
          window.removeEventListener("message", handler);
        }
      } catch {
      }
    };
    window.addEventListener("message", handler);
    this.register(() => window.removeEventListener("message", handler));
    this.registerDomEvent(iframe, "load", () => {
      if (this.isStale(gen)) return;
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: "listening", id: "hp-video" }),
        YT_ORIGIN
      );
    });
  }
  /** Show thumbnail for a blocked video within a playlist, keeping controls visible. */
  showPlaylistThumbnail(container, controlBar, videoId) {
    if (this.iframeEl) {
      this.iframeEl.addClass("hp-hidden");
    }
    container.querySelectorAll(".video-embed-thumb-img, .video-embed-play-overlay, .video-embed-thumb-label").forEach((el) => el.remove());
    container.addClass("video-embed-thumbnail");
    const img = container.createEl("img", {
      cls: "video-embed-thumb-img",
      attr: {
        src: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        alt: "Video thumbnail",
        loading: "lazy"
      }
    });
    container.insertBefore(img, controlBar);
    const overlay = container.createDiv({ cls: "video-embed-play-overlay" });
    overlay.createDiv({ cls: "video-embed-play-icon" });
    container.insertBefore(overlay, controlBar);
    const label = container.createDiv({ cls: "video-embed-thumb-label" });
    label.setText("Watch on YouTube");
    container.insertBefore(label, controlBar);
    this.registerDomEvent(overlay, "click", () => {
      window.open(`${YT_ORIGIN}/watch?v=${videoId}`, "_blank");
    });
  }
  // SECURITY INVARIANT: allow-same-origin + allow-scripts nullifies the sandbox.
  // This is required by the YouTube IFrame API.  The origin guard below ensures
  // only YouTube/Vimeo/Dailymotion URLs can ever reach this code path.
  // Do NOT add new providers without a security review.
  static ALLOWED_EMBED_HOSTS = /^(?:www\.)?youtube\.com$|^player\.vimeo\.com$|^www\.dailymotion\.com$/;
  createIframe(container, src) {
    try {
      const host = new URL(src).hostname;
      if (!_VideoEmbedBlock.ALLOWED_EMBED_HOSTS.test(host)) {
        throw new Error(`Blocked iframe src from unknown origin: ${host}`);
      }
    } catch (e) {
      console.error("[Homepage Blocks] VideoEmbed origin check failed:", e);
      container.setText("Video source blocked for security reasons.");
      return container.createEl("iframe");
    }
    this.iframeEl = container.createEl("iframe", {
      cls: "video-embed-iframe",
      attr: {
        src,
        title: "Embedded video",
        frameborder: "0",
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        allowfullscreen: "",
        loading: "lazy",
        referrerpolicy: "no-referrer",
        sandbox: "allow-same-origin allow-scripts allow-popups allow-presentation"
      }
    });
    return this.iframeEl;
  }
  updateIframe(src) {
    if (this.iframeEl) {
      this.iframeEl.removeClass("hp-hidden");
      this.iframeEl.setAttribute("src", src);
    }
  }
  openSettings(onSave) {
    new VideoEmbedSettingsModal(this.app, this.instance.config, onSave).open();
  }
};
var VideoEmbedSettingsModal = class extends import_obsidian15.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian15.Setting(contentEl).setName("Video embed settings").setHeading();
    const draft = structuredClone(this.config);
    new import_obsidian15.Setting(contentEl).setName("Video / playlist URL").setDesc("YouTube, vimeo, or dailymotion URL \u2014 playlist links are supported.").addText(
      (t) => t.setValue(draft.url ?? "").setPlaceholder("https://www.youtube.com/playlist?list=...").onChange((v) => {
        draft.url = v;
      })
    );
    new import_obsidian15.Setting(contentEl).setName("Shuffle on load").setDesc("Start with a random video from the playlist each time the homepage opens \u2014 only applies to playlist urls.").addToggle(
      (t) => t.setValue(Boolean(draft.shuffleOnLoad)).onChange((v) => {
        draft.shuffleOnLoad = v;
      })
    );
    new import_obsidian15.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/BookmarkBlock.ts
var import_obsidian16 = require("obsidian");
var BookmarkBlock = class extends BaseBlock {
  render(el) {
    el.addClass("bookmark-block");
    const { items = [], columns = 2, showDescriptions = true } = this.instance.config;
    this.renderHeader(el, "Bookmarks");
    const grid = el.createDiv({ cls: "bookmark-grid" });
    const safeCols = Math.max(1, Math.min(3, Math.floor(Number(columns) || 2)));
    grid.style.setProperty("--hp-grid-cols", responsiveGridColumns(safeCols));
    if (items.length === 0) {
      const hint = grid.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F517}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No bookmarks yet. Add links in settings." });
      return;
    }
    for (const item of items) {
      const card = grid.createEl("button", { cls: "bookmark-card" });
      if (item.emoji) {
        card.createSpan({ cls: "bookmark-emoji", text: item.emoji });
      }
      card.createSpan({ cls: "bookmark-label", text: item.label });
      if (item.description && showDescriptions) {
        card.createSpan({ cls: "bookmark-desc", text: item.description });
      }
      card.addEventListener("click", () => {
        try {
          const parsed = new URL(item.url);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            window.open(item.url, "_blank", "noopener,noreferrer");
            return;
          }
        } catch {
        }
        void this.app.workspace.openLinkText(item.url, "");
      });
    }
  }
  openSettings(onSave) {
    new BookmarkSettingsModal(this.app, this.instance.config, onSave).open();
  }
};
var BookmarkSettingsModal = class extends import_obsidian16.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian16.Setting(contentEl).setName("Bookmark settings").setHeading();
    const draft = structuredClone(this.config);
    if (!Array.isArray(draft.items)) draft.items = [];
    new import_obsidian16.Setting(contentEl).setName("Columns").addDropdown(
      (d) => d.addOption("1", "1").addOption("2", "2").addOption("3", "3").setValue(String(draft.columns ?? 2)).onChange((v) => {
        draft.columns = Number(v);
      })
    );
    new import_obsidian16.Setting(contentEl).setName("Show descriptions").addToggle(
      (t) => t.setValue(draft.showDescriptions !== false).onChange((v) => {
        draft.showDescriptions = v;
      })
    );
    contentEl.createEl("p", { text: "Items", cls: "setting-item-name" });
    const listEl = contentEl.createDiv({ cls: "bookmark-item-list" });
    const dragState = { dragIdx: -1 };
    const renderList = () => {
      listEl.empty();
      draft.items.forEach((item, i) => {
        const row = listEl.createDiv({ cls: "bookmark-item-row" });
        enableDragReorder(row, i, draft.items, dragState, renderList);
        const emojiInput = row.createEl("input", { type: "text", cls: "bookmark-item-emoji" });
        emojiInput.value = item.emoji ?? "";
        emojiInput.placeholder = "\u{1F310}";
        emojiInput.addEventListener("input", () => {
          item.emoji = emojiInput.value || void 0;
        });
        const labelInput = row.createEl("input", { type: "text", cls: "bookmark-item-label" });
        labelInput.value = item.label;
        labelInput.placeholder = "Label";
        labelInput.addEventListener("input", () => {
          item.label = labelInput.value;
        });
        const urlInput = row.createEl("input", { type: "text", cls: "bookmark-item-url" });
        urlInput.value = item.url;
        urlInput.placeholder = "URL or note path";
        urlInput.addEventListener("input", () => {
          item.url = urlInput.value;
        });
        const descInput = row.createEl("input", { type: "text", cls: "bookmark-item-desc" });
        descInput.value = item.description ?? "";
        descInput.placeholder = "Description (optional)";
        descInput.addEventListener("input", () => {
          item.description = descInput.value || void 0;
        });
        const delBtn = row.createEl("button", { cls: "bookmark-item-del", text: "\u2715" });
        delBtn.addEventListener("click", () => {
          draft.items.splice(i, 1);
          renderList();
        });
      });
    };
    renderList();
    new import_obsidian16.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("+ add item").onClick(() => {
        draft.items.push({ label: "", url: "" });
        renderList();
      })
    );
    new import_obsidian16.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/RecentFilesBlock.ts
var import_obsidian17 = require("obsidian");
var DEBOUNCE_MS4 = 500;
var RecentFilesBlock = class extends BaseBlock {
  render(el) {
    this.containerEl = el;
    el.addClass("recent-files-block");
    const trigger = () => this.scheduleRender(DEBOUNCE_MS4, (e) => {
      e.empty();
      this.renderContent(e);
    });
    this.registerEvent(this.app.vault.on("modify", () => trigger()));
    this.registerEvent(this.app.vault.on("create", () => trigger()));
    this.registerEvent(this.app.vault.on("delete", () => trigger()));
    this.registerEvent(this.app.vault.on("rename", () => trigger()));
    this.renderContent(el);
  }
  renderContent(el) {
    const {
      maxItems = 10,
      showTimestamp = true,
      excludeFolders = ""
    } = this.instance.config;
    this.renderHeader(el, "Recent files");
    const excluded = excludeFolders.split(",").map((f) => f.trim()).filter(Boolean);
    const files = this.app.vault.getMarkdownFiles().filter((file) => !excluded.some((folder) => file.path.startsWith(folder + "/"))).sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, maxItems);
    const list = el.createDiv({ cls: "recent-files-list" });
    if (files.length === 0) {
      const hint = list.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F4C4}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No recent files found." });
      return;
    }
    for (const file of files) {
      const item = list.createDiv({ cls: "recent-file-item" });
      const btn = item.createEl("button", { cls: "recent-file-btn" });
      btn.createSpan({ cls: "recent-file-name", text: file.basename });
      if (showTimestamp) {
        btn.createSpan({ cls: "recent-file-time", text: (0, import_obsidian17.moment)(file.stat.mtime).fromNow() });
      }
      btn.addEventListener("click", () => {
        void this.app.workspace.openLinkText(file.path, "");
      });
    }
  }
  openSettings(onSave) {
    new RecentFilesSettingsModal(this.app, this.instance.config, onSave).open();
  }
};
var RecentFilesSettingsModal = class extends import_obsidian17.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian17.Setting(contentEl).setName("Recent files settings").setHeading();
    const draft = structuredClone(this.config);
    new import_obsidian17.Setting(contentEl).setName("Max items").setDesc("Number of recent files to show (5\u201320).").addSlider(
      (s) => s.setLimits(5, 20, 1).setValue(draft.maxItems ?? 10).setDynamicTooltip().onChange((v) => {
        draft.maxItems = v;
      })
    );
    new import_obsidian17.Setting(contentEl).setName("Show timestamps").setDesc("Display relative time next to each file name.").addToggle(
      (t) => t.setValue(draft.showTimestamp ?? true).onChange((v) => {
        draft.showTimestamp = v;
      })
    );
    new import_obsidian17.Setting(contentEl).setName("Exclude folders").setDesc("Comma-separated folder paths to exclude.").addText(
      (t) => t.setPlaceholder("e.g. Templates, Archive/old").setValue(draft.excludeFolders ?? "").onChange((v) => {
        draft.excludeFolders = v;
      })
    );
    new import_obsidian17.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/PomodoroBlock.ts
var import_obsidian18 = require("obsidian");
var CIRCUMFERENCE = 2 * Math.PI * 52;
var timerStore = /* @__PURE__ */ new Map();
var sharedAudioCtx = null;
var PomodoroBlock = class _PomodoroBlock extends BaseBlock {
  phase = "idle";
  secondsLeft = 0;
  completedSessions = 0;
  running = false;
  timerEl = null;
  ringEl = null;
  phaseEl = null;
  sessionDotsEl = null;
  startPauseBtn = null;
  /** Total seconds for the current phase (used to compute ring progress). */
  totalSeconds = 0;
  render(el) {
    const {
      workMinutes = 25
    } = this.instance.config;
    el.addClass("pomodoro-block");
    this.renderHeader(el, "Pomodoro");
    const container = el.createDiv({ cls: "pomodoro-container" });
    const ringWrap = container.createDiv({ cls: "pomodoro-ring" });
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    const bgCircle = document.createElementNS(NS, "circle");
    bgCircle.setAttribute("cx", "60");
    bgCircle.setAttribute("cy", "60");
    bgCircle.setAttribute("r", "52");
    bgCircle.setAttribute("stroke", "var(--background-modifier-border)");
    bgCircle.setAttribute("stroke-width", "8");
    bgCircle.setAttribute("fill", "transparent");
    svg.appendChild(bgCircle);
    const progressCircle = document.createElementNS(NS, "circle");
    progressCircle.setAttribute("cx", "60");
    progressCircle.setAttribute("cy", "60");
    progressCircle.setAttribute("r", "52");
    progressCircle.setAttribute("stroke", "var(--color-accent)");
    progressCircle.setAttribute("stroke-width", "8");
    progressCircle.setAttribute("fill", "transparent");
    progressCircle.setAttribute("stroke-linecap", "round");
    progressCircle.setAttribute("transform", "rotate(-90 60 60)");
    progressCircle.setAttribute("stroke-dasharray", String(CIRCUMFERENCE));
    progressCircle.setAttribute("stroke-dashoffset", String(CIRCUMFERENCE));
    svg.appendChild(progressCircle);
    this.ringEl = progressCircle;
    ringWrap.appendChild(svg);
    this.timerEl = ringWrap.createDiv({ cls: "pomodoro-time" });
    this.phaseEl = container.createDiv({ cls: "pomodoro-phase" });
    this.sessionDotsEl = container.createDiv({ cls: "pomodoro-dots" });
    const controls = container.createDiv({ cls: "pomodoro-controls" });
    const startPauseBtn = controls.createEl("button", {
      cls: "pomodoro-btn is-primary",
      text: "Start"
    });
    this.registerDomEvent(startPauseBtn, "click", () => this.toggleStartPause());
    this.startPauseBtn = startPauseBtn;
    const resetBtn = controls.createEl("button", {
      cls: "pomodoro-btn pomodoro-btn-reset",
      text: "Reset"
    });
    this.registerDomEvent(resetBtn, "click", () => this.resetTimer());
    const skipBtn = controls.createEl("button", {
      cls: "pomodoro-btn pomodoro-btn-skip",
      text: "Skip"
    });
    this.registerDomEvent(skipBtn, "click", () => this.skipPhase());
    const saved = timerStore.get(this.instance.id);
    if (saved) {
      this.phase = saved.phase;
      this.secondsLeft = saved.secondsLeft;
      this.totalSeconds = saved.totalSeconds;
      this.completedSessions = saved.completedSessions;
      this.running = saved.running;
    } else {
      this.secondsLeft = workMinutes * 60;
      this.totalSeconds = this.secondsLeft;
    }
    this.updateDisplay();
    this.registerInterval(window.setInterval(() => this.tick(), 1e3));
  }
  // ── Timer logic ────────────────────────────────────────────────────────
  /** Persist timer state to module-level store so it survives re-renders. */
  saveState() {
    timerStore.set(this.instance.id, {
      phase: this.phase,
      secondsLeft: this.secondsLeft,
      totalSeconds: this.totalSeconds,
      completedSessions: this.completedSessions,
      running: this.running
    });
  }
  tick() {
    if (!this.running || this.phase === "idle") return;
    this.secondsLeft--;
    if (this.secondsLeft <= 0) {
      this.secondsLeft = 0;
      this.onPhaseComplete();
    }
    this.updateDisplay();
    this.saveState();
  }
  onPhaseComplete() {
    const {
      breakMinutes = 5,
      longBreakMinutes = 15,
      sessionsBeforeLong = 4,
      workMinutes = 25,
      soundType = "crystal",
      autoStartCycle = false
    } = this.instance.config;
    if (soundType !== "none") {
      _PomodoroBlock.playNotificationSound(soundType);
    }
    const previousPhase = this.phase;
    if (this.phase === "work") {
      this.completedSessions++;
      if (this.completedSessions % sessionsBeforeLong === 0) {
        this.startPhase("longBreak", longBreakMinutes);
        if (!autoStartCycle) this.running = false;
      } else {
        this.startPhase("break", breakMinutes);
        if (!autoStartCycle) this.running = false;
      }
    } else {
      this.phase = "work";
      this.secondsLeft = workMinutes * 60;
      this.totalSeconds = this.secondsLeft;
      if (previousPhase === "longBreak") {
        this.running = false;
        this.completedSessions = 0;
      } else {
        this.running = !!autoStartCycle;
      }
      this.updateDisplay();
      this.saveState();
    }
  }
  static playNotificationSound(type) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!sharedAudioCtx) {
        sharedAudioCtx = new AudioContextClass();
      }
      const ctx = sharedAudioCtx;
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
      const t = ctx.currentTime;
      if (type === "crystal") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1);
        osc.start(t);
        osc.stop(t + 1.1);
      } else if (type === "chime") {
        [800, 1e3].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t + i * 0.2);
          gain.gain.setValueAtTime(0, t + i * 0.2);
          gain.gain.linearRampToValueAtTime(0.3, t + i * 0.2 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.2 + 1);
          osc.start(t + i * 0.2);
          osc.stop(t + i * 0.2 + 1.1);
        });
      } else if (type === "bowl") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(300, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.6, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 4);
        osc.start(t);
        osc.stop(t + 4.1);
      }
    } catch (e) {
      console.error("[Homepage] Audio playback failed", e);
    }
  }
  startPhase(phase, minutes) {
    this.phase = phase;
    this.secondsLeft = minutes * 60;
    this.totalSeconds = this.secondsLeft;
    this.running = true;
    this.updateDisplay();
    this.saveState();
  }
  toggleStartPause() {
    if (this.phase === "idle") {
      const { workMinutes = 25 } = this.instance.config;
      this.startPhase("work", workMinutes);
      return;
    }
    this.running = !this.running;
    this.updateDisplay();
    this.saveState();
  }
  resetTimer() {
    const { workMinutes = 25 } = this.instance.config;
    this.phase = "idle";
    this.running = false;
    this.completedSessions = 0;
    this.secondsLeft = workMinutes * 60;
    this.totalSeconds = this.secondsLeft;
    this.updateDisplay();
    this.saveState();
  }
  skipPhase() {
    if (this.phase === "idle") return;
    this.secondsLeft = 0;
    this.onPhaseComplete();
    this.updateDisplay();
  }
  // ── Display ────────────────────────────────────────────────────────────
  updateDisplay() {
    if (this.timerEl) {
      const mins = Math.floor(this.secondsLeft / 60);
      const secs = this.secondsLeft % 60;
      this.timerEl.setText(
        `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      );
    }
    if (this.ringEl) {
      const progress = this.totalSeconds > 0 ? (this.totalSeconds - this.secondsLeft) / this.totalSeconds : 0;
      const offset = CIRCUMFERENCE * (1 - progress);
      this.ringEl.setAttribute("stroke-dashoffset", String(offset));
    }
    if (this.phaseEl) {
      const labels = {
        idle: "Ready",
        work: "Work",
        break: "Break",
        longBreak: "Long break"
      };
      this.phaseEl.setText(labels[this.phase]);
    }
    if (this.sessionDotsEl) {
      const { sessionsBeforeLong = 4 } = this.instance.config;
      this.sessionDotsEl.empty();
      for (let i = 0; i < sessionsBeforeLong; i++) {
        const dot = this.sessionDotsEl.createSpan({ cls: "pomodoro-dot" });
        if (i < this.completedSessions % sessionsBeforeLong) {
          dot.addClass("is-complete");
        }
      }
    }
    if (this.startPauseBtn) {
      if (this.phase === "idle") {
        this.startPauseBtn.setText("Start");
      } else {
        this.startPauseBtn.setText(this.running ? "Pause" : "Resume");
      }
    }
  }
  // ── Settings ───────────────────────────────────────────────────────────
  openSettings(onSave) {
    new PomodoroSettingsModal(this.app, this.instance.config, onSave).open();
  }
};
var PomodoroSettingsModal = class extends import_obsidian18.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian18.Setting(contentEl).setName("Pomodoro settings").setHeading();
    const draft = structuredClone(this.config);
    new import_obsidian18.Setting(contentEl).setName("Work duration").setDesc("Minutes per work session.").addSlider(
      (s) => s.setLimits(1, 60, 1).setValue(draft.workMinutes ?? 25).setDynamicTooltip().onChange((v) => {
        draft.workMinutes = v;
      })
    );
    new import_obsidian18.Setting(contentEl).setName("Break duration").setDesc("Minutes per short break.").addSlider(
      (s) => s.setLimits(1, 30, 1).setValue(draft.breakMinutes ?? 5).setDynamicTooltip().onChange((v) => {
        draft.breakMinutes = v;
      })
    );
    new import_obsidian18.Setting(contentEl).setName("Long break duration").setDesc("Minutes per long break.").addSlider(
      (s) => s.setLimits(1, 60, 1).setValue(draft.longBreakMinutes ?? 15).setDynamicTooltip().onChange((v) => {
        draft.longBreakMinutes = v;
      })
    );
    new import_obsidian18.Setting(contentEl).setName("Sessions before long break").setDesc("Number of work sessions before a long break.").addSlider(
      (s) => s.setLimits(2, 8, 1).setValue(draft.sessionsBeforeLong ?? 4).setDynamicTooltip().onChange((v) => {
        draft.sessionsBeforeLong = v;
      })
    );
    new import_obsidian18.Setting(contentEl).setName("Notification sound").setDesc("Play a sound when a phase completes.").addDropdown((d) => {
      d.addOption("none", "None").addOption("crystal", "Crystal").addOption("chime", "Chime").addOption("bowl", "Singing Bowl").setValue(draft.soundType ?? "crystal").onChange((v) => {
        draft.soundType = v;
        if (v !== "none") {
          PomodoroBlock.playNotificationSound(v);
        }
      });
    });
    new import_obsidian18.Setting(contentEl).setName("Auto-start next session").setDesc("Automatically start the next phase of the cycle.").addToggle(
      (t) => t.setValue(draft.autoStartCycle ?? false).onChange((v) => {
        draft.autoStartCycle = v;
      })
    );
    new import_obsidian18.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/blocks/SpacerBlock.ts
var SpacerBlock = class extends BaseBlock {
  render(el) {
    el.addClass("spacer-block");
  }
};

// src/blocks/RandomNoteBlock.ts
var import_obsidian19 = require("obsidian");
var MS_PER_DAY2 = 864e5;
var DEBOUNCE_MS5 = 500;
var DELETE_RENAME_DEBOUNCE_MS = 2e3;
function stripWikiLink(raw) {
  const m = raw.match(/^\[\[(.+?)(?:\|.*)?\]\]$/);
  return m ? m[1] : raw;
}
var RandomNoteBlock = class extends BaseBlock {
  /** Cached daily-seed file path so the selection is stable across file-count changes. */
  dailyCache = null;
  getTag() {
    const { tag = "" } = this.instance.config;
    return tag;
  }
  render(el) {
    this.containerEl = el;
    el.addClass("random-note-block");
    const trigger = () => this.scheduleRender(DEBOUNCE_MS5, (e) => {
      e.empty();
      return this.loadAndRender(e);
    });
    const slowTrigger = () => this.scheduleRender(DELETE_RENAME_DEBOUNCE_MS, (e) => {
      e.empty();
      return this.loadAndRender(e);
    });
    this.registerEvent(this.app.metadataCache.on("changed", (_file, _data, cache) => {
      const tag = this.getTag();
      if (!tag) return;
      const tagSearch = tag.startsWith("#") ? tag : `#${tag}`;
      if (cacheHasTag(cache, tagSearch)) trigger();
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (!this.getTag() || !file.path.endsWith(".md")) return;
      slowTrigger();
    }));
    this.registerEvent(this.app.vault.on("rename", (file) => {
      if (!this.getTag() || !file.path.endsWith(".md")) return;
      slowTrigger();
    }));
    this.loadAndRender(el).catch((e) => {
      console.error("[Homepage Blocks] RandomNoteBlock failed to render:", e);
      el.setText("Error loading random note. Check console for details.");
    });
  }
  async loadAndRender(el) {
    const gen = this.nextGeneration();
    const {
      tag = "",
      dailySeed = false,
      imageProperty = "cover",
      titleProperty = "title",
      showImage = true,
      showPreview = true
    } = this.instance.config;
    this.renderHeader(el, "Random note");
    if (!tag) {
      const hint = el.createDiv({ cls: "block-empty-hint" });
      hint.createDiv({ cls: "block-empty-hint-icon", text: "\u{1F3B2}" });
      hint.createDiv({ cls: "block-empty-hint-text", text: "No tag configured. Add a tag in settings to show random notes." });
      return;
    }
    const tagSearch = tag.startsWith("#") ? tag : `#${tag}`;
    const files = getFilesWithTag(this.app, tagSearch).sort((a, b) => a.path.localeCompare(b.path));
    if (files.length === 0) {
      el.createDiv({ cls: "block-empty-hint" }).createDiv({
        cls: "block-empty-hint-text",
        text: `No files found with tag ${tagSearch}`
      });
      return;
    }
    const file = this.pickFile(files, dailySeed);
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter ?? {};
    let preview = "";
    if (showPreview) {
      const desc = typeof fm["description"] === "string" ? fm["description"] : typeof fm["excerpt"] === "string" ? fm["excerpt"] : "";
      if (desc) {
        preview = desc;
      } else {
        try {
          const content = await this.app.vault.read(file);
          if (this.isStale(gen)) return;
          preview = this.extractPreview(content, cache?.frontmatterPosition?.end.offset ?? 0);
        } catch (e) {
          console.error("[Homepage Blocks] RandomNoteBlock failed to read file:", e);
        }
      }
    }
    if (this.isStale(gen)) return;
    el.setAttribute("data-auto-height-content", "");
    this.observeWidthForAutoHeight(el);
    if (showImage) {
      const rawProp = fm[imageProperty];
      const rawImage = typeof rawProp === "string" ? rawProp : Array.isArray(rawProp) && typeof rawProp[0] === "string" ? rawProp[0] : "";
      if (rawImage) {
        const trimmed = rawImage.trim();
        let imgSrc = "";
        if (trimmed.startsWith("https://")) {
          imgSrc = trimmed;
        } else {
          const imagePath = stripWikiLink(trimmed);
          const resolved = this.app.metadataCache.getFirstLinkpathDest(imagePath, file.path);
          const imageFile = resolved ?? this.app.vault.getAbstractFileByPath(imagePath) ?? null;
          if (imageFile instanceof import_obsidian19.TFile) {
            imgSrc = this.app.vault.getResourcePath(imageFile);
          }
        }
        if (imgSrc) {
          const img = el.createEl("img", { cls: "random-note-cover" });
          img.src = imgSrc;
          img.alt = file.basename;
          img.referrerPolicy = "no-referrer";
        }
      }
    }
    const title = typeof fm[titleProperty] === "string" && fm[titleProperty] ? fm[titleProperty] : file.basename;
    const titleEl = el.createEl("button", { cls: "random-note-title" });
    titleEl.setText(title);
    titleEl.addEventListener("click", () => {
      void this.app.workspace.openLinkText(file.path, "");
    });
    if (preview) {
      el.createDiv({ cls: "random-note-preview", text: preview });
    }
    const footer = el.createDiv({ cls: "random-note-footer" });
    footer.createSpan({ cls: "random-note-filename", text: file.basename });
    const openBtn = footer.createEl("button", { cls: "random-note-open-btn", text: "Open" });
    openBtn.addEventListener("click", () => {
      void this.app.workspace.openLinkText(file.path, "");
    });
    this.requestAutoHeight();
  }
  /** Pick the file to display. Daily seed caches the path so the selection
   *  is stable even when the tagged-file count changes mid-day. */
  pickFile(files, dailySeed) {
    if (!dailySeed) return files[Math.floor(Math.random() * files.length)];
    const dayIndex = Math.floor((0, import_obsidian19.moment)().startOf("day").valueOf() / MS_PER_DAY2);
    if (this.dailyCache?.dayIndex === dayIndex) {
      const cached = files.find((f) => f.path === this.dailyCache.path);
      if (cached) return cached;
    }
    const idx = dayIndex % files.length;
    const picked = files[idx];
    this.dailyCache = { dayIndex, path: picked.path };
    return picked;
  }
  extractPreview(content, fmEnd) {
    const afterFm = content.slice(fmEnd);
    for (const line of afterFm.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("!") && !trimmed.startsWith("```") && !trimmed.startsWith("---")) {
        const capped = trimmed.slice(0, 500);
        return capped.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1").slice(0, 200);
      }
    }
    return "";
  }
  openSettings(onSave) {
    new RandomNoteSettingsModal(this.app, this.instance.config, onSave).open();
  }
};
var RandomNoteSettingsModal = class extends import_obsidian19.Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian19.Setting(contentEl).setName("Random note settings").setHeading();
    const draft = structuredClone(this.config);
    new import_obsidian19.Setting(contentEl).setName("Tag filter").setDesc("Required. Only notes with this tag are candidates.").addText(
      (t) => t.setPlaceholder("#tag or tag").setValue(draft.tag ?? "").onChange((v) => {
        draft.tag = v.trim();
      })
    );
    new import_obsidian19.Setting(contentEl).setName("Daily seed").setDesc("Show the same note all day; changes at midnight.").addToggle(
      (t) => t.setValue(draft.dailySeed ?? false).onChange((v) => {
        draft.dailySeed = v;
      })
    );
    new import_obsidian19.Setting(contentEl).setName("Show cover image").addToggle(
      (t) => t.setValue(draft.showImage ?? true).onChange((v) => {
        draft.showImage = v;
      })
    );
    new import_obsidian19.Setting(contentEl).setName("Cover image property").setDesc("Frontmatter property name that holds the image path.").addText(
      (t) => t.setPlaceholder("Cover").setValue(draft.imageProperty ?? "").onChange((v) => {
        draft.imageProperty = v.trim() || "cover";
      })
    );
    new import_obsidian19.Setting(contentEl).setName("Title property").setDesc("Frontmatter property for the note title. Falls back to filename.").addText(
      (t) => t.setPlaceholder("Title").setValue(draft.titleProperty ?? "title").onChange((v) => {
        draft.titleProperty = v.trim() || "title";
      })
    );
    new import_obsidian19.Setting(contentEl).setName("Show content preview").setDesc("Show first paragraph or frontmatter description/excerpt.").addToggle(
      (t) => t.setValue(draft.showPreview ?? true).onChange((v) => {
        draft.showPreview = v;
      })
    );
    new import_obsidian19.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(() => {
        this.onSave(draft);
        this.close();
      })
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/main.ts
var VALID_OPEN_MODES = /* @__PURE__ */ new Set(["replace-all", "replace-last", "retain"]);
function isOpenMode(v) {
  return typeof v === "string" && VALID_OPEN_MODES.has(v);
}
var DEFAULT_LAYOUT_DATA = {
  columns: 3,
  openOnStartup: false,
  openMode: "retain",
  manualOpenMode: "retain",
  openWhenEmpty: false,
  pin: false,
  hideScrollbar: false,
  blocks: [
    // Row 0 (y: 0–2)
    {
      id: "default-static-text",
      type: "static-text",
      x: 0,
      y: 0,
      w: 1,
      h: 3,
      config: { content: "" }
    },
    {
      id: "default-clock",
      type: "clock",
      x: 1,
      y: 0,
      w: 1,
      h: 3,
      config: { showSeconds: false, showDate: true }
    },
    {
      id: "default-folder-links",
      type: "folder-links",
      x: 2,
      y: 0,
      w: 1,
      h: 3,
      config: { _titleLabel: "Quick links", links: [] }
    },
    // Row 1 (y: 3–5)
    {
      id: "default-insight",
      type: "insight",
      x: 0,
      y: 3,
      w: 2,
      h: 3,
      config: { tag: "", _titleLabel: "Daily insight", dailySeed: true }
    },
    {
      id: "default-button-grid",
      type: "button-grid",
      x: 2,
      y: 3,
      w: 1,
      h: 5,
      config: {
        _titleLabel: "Quick actions",
        columns: 2,
        items: [
          { emoji: "\u{1F4DD}", label: "New note" },
          { emoji: "\u{1F4C5}", label: "Today" },
          { emoji: "\u2B50", label: "Favorites" },
          { emoji: "\u{1F50D}", label: "Search" },
          { emoji: "\u{1F4DA}", label: "Library" },
          { emoji: "\u2699\uFE0F", label: "Settings" }
        ]
      }
    },
    // Row 2 (y: 6–8)
    {
      id: "default-quotes",
      type: "quotes-list",
      x: 0,
      y: 6,
      w: 2,
      h: 3,
      config: { tag: "", _titleLabel: "Quotes", columns: 2, maxItems: 20 }
    },
    // Row 3 (y: 9–11)
    {
      id: "default-gallery",
      type: "image-gallery",
      x: 0,
      y: 9,
      w: 3,
      h: 3,
      config: { folder: "", _titleLabel: "Gallery", columns: 3, maxItems: 20 }
    }
  ]
};
function getDefaultLayout() {
  return structuredClone(DEFAULT_LAYOUT_DATA);
}
var VALID_BLOCK_TYPES = new Set(BLOCK_TYPES);
var SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;
var MAX_BLOCKS = 100;
function migrateBlockInstance(b) {
  const m = { ...b };
  if (typeof m.col === "number") {
    m.x = m.col - 1;
  }
  if (typeof m.row === "number") {
    m.y = m.row - 1;
  }
  if (typeof m.colSpan === "number") {
    m.w = m.colSpan;
  }
  if (typeof m.rowSpan === "number") {
    m.h = m.rowSpan;
  }
  delete m.col;
  delete m.row;
  delete m.colSpan;
  delete m.rowSpan;
  delete m.newRow;
  if (m.type === "tag-grid") {
    m.type = "button-grid";
  }
  if (m.type === "insight") {
    m.type = "quotes-list";
    const cfg2 = m.config;
    if (cfg2) {
      cfg2.mode = "single";
      cfg2.source = "tag";
      cfg2.dailySeed ??= true;
    }
  }
  const cfg = m.config;
  if (cfg && cfg._transparent === true) {
    cfg._hideBorder = true;
    cfg._hideBackground = true;
    delete cfg._transparent;
  }
  if (m.type === "button-grid" && cfg && typeof cfg.columns === "number" && cfg.columns > 3) {
    cfg.columns = 3;
  }
  if (cfg && typeof cfg.title === "string") {
    if (cfg.title && !cfg._titleLabel) {
      cfg._titleLabel = cfg.title;
    }
    if (!cfg.title && (m.type === "html" || m.type === "static-text")) {
      if (cfg._hideTitle === void 0) cfg._hideTitle = true;
    }
    delete cfg.title;
  }
  return m;
}
function isValidBlockInstance(b) {
  if (!b || typeof b !== "object") return false;
  const block = b;
  return typeof block.id === "string" && SAFE_ID_RE.test(block.id) && typeof block.type === "string" && VALID_BLOCK_TYPES.has(block.type) && typeof block.x === "number" && Number.isFinite(block.x) && block.x >= 0 && typeof block.y === "number" && Number.isFinite(block.y) && block.y >= 0 && typeof block.w === "number" && Number.isFinite(block.w) && block.w >= 1 && typeof block.h === "number" && block.h >= 1 && Number.isFinite(block.h) && block.config !== null && typeof block.config === "object" && !Array.isArray(block.config);
}
function validateLayout(raw) {
  const defaults = getDefaultLayout();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const r = raw;
  const columns = typeof r.columns === "number" && [2, 3, 4, 5].includes(r.columns) ? r.columns : defaults.columns;
  const openOnStartup = typeof r.openOnStartup === "boolean" ? r.openOnStartup : defaults.openOnStartup;
  const openMode = isOpenMode(r.openMode) ? r.openMode : defaults.openMode;
  const manualOpenMode = isOpenMode(r.manualOpenMode) ? r.manualOpenMode : defaults.manualOpenMode;
  const openWhenEmpty = typeof r.openWhenEmpty === "boolean" ? r.openWhenEmpty : defaults.openWhenEmpty;
  const pin = typeof r.pin === "boolean" ? r.pin : defaults.pin;
  const hideScrollbar = typeof r.hideScrollbar === "boolean" ? r.hideScrollbar : defaults.hideScrollbar;
  let rawBlocks;
  if (Array.isArray(r.blocks)) {
    const migrated = r.blocks.map((b) => migrateBlockInstance(b));
    rawBlocks = migrated.filter(isValidBlockInstance).slice(0, MAX_BLOCKS);
  } else {
    rawBlocks = defaults.blocks;
  }
  const blocks = rawBlocks.map((b) => ({
    ...b,
    w: Math.min(b.w, columns),
    x: Math.min(b.x, Math.max(0, columns - Math.min(b.w, columns)))
  }));
  return { columns, openOnStartup, openMode, manualOpenMode, openWhenEmpty, pin, hideScrollbar, blocks };
}
function registerBlocks() {
  BlockRegistry.clear();
  BlockRegistry.register({
    type: "greeting",
    displayName: "Greeting",
    defaultConfig: { name: "World", showTime: true },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new GreetingBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "clock",
    displayName: "Clock / date",
    defaultConfig: { showSeconds: false, showDate: true },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new ClockBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "folder-links",
    displayName: "Quick links",
    defaultConfig: { _titleLabel: "Quick links", folder: "", links: [] },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new FolderLinksBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "button-grid",
    displayName: "Button grid",
    defaultConfig: { _titleLabel: "Button grid", columns: 2, items: [] },
    defaultSize: { w: 1, h: 5 },
    create: (app, instance, plugin) => new ButtonGridBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "quotes-list",
    displayName: "Quotes list",
    defaultConfig: { tag: "", _titleLabel: "Quotes", columns: 2, maxItems: 20, quoteStyle: "classic", fontStyle: "default", customFont: "", mode: "list", dailySeed: true },
    defaultSize: { w: 2, h: 3 },
    create: (app, instance, plugin) => new QuotesListBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "image-gallery",
    displayName: "Image gallery",
    defaultConfig: { folder: "", _titleLabel: "Gallery", columns: 3, maxItems: 20 },
    defaultSize: { w: 3, h: 3 },
    create: (app, instance, plugin) => new ImageGalleryBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "embedded-note",
    displayName: "Embedded note",
    defaultConfig: { filePath: "", showTitle: true },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new EmbeddedNoteBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "static-text",
    displayName: "Static text",
    defaultConfig: { content: "" },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new StaticTextBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "html",
    displayName: "HTML block",
    defaultConfig: { html: "" },
    defaultSize: { w: 1, h: 3 },
    create: (app, instance, plugin) => new HtmlBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "video-embed",
    displayName: "Video embed",
    defaultConfig: { url: "" },
    defaultSize: { w: 2, h: 4 },
    create: (app, instance, plugin) => new VideoEmbedBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "bookmarks",
    displayName: "Bookmarks",
    defaultConfig: { _titleLabel: "Bookmarks", items: [], columns: 2, showDescriptions: true },
    defaultSize: { w: 2, h: 3 },
    create: (app, instance, plugin) => new BookmarkBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "recent-files",
    displayName: "Recent files",
    defaultConfig: { _titleLabel: "Recent files", maxItems: 10, showTimestamp: true, excludeFolders: "" },
    defaultSize: { w: 1, h: 4 },
    create: (app, instance, plugin) => new RecentFilesBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "pomodoro",
    displayName: "Pomodoro timer",
    defaultConfig: { _titleLabel: "Pomodoro", workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLong: 4 },
    defaultSize: { w: 1, h: 4 },
    create: (app, instance, plugin) => new PomodoroBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "spacer",
    displayName: "Spacer",
    defaultConfig: { _hideTitle: true, _hideBorder: true, _hideBackground: true, _hideHeaderAccent: true },
    defaultSize: { w: 1, h: 2 },
    create: (app, instance, plugin) => new SpacerBlock(app, instance, plugin)
  });
  BlockRegistry.register({
    type: "random-note",
    displayName: "Random note",
    defaultConfig: { _titleLabel: "Random note", tag: "", dailySeed: false, imageProperty: "cover", titleProperty: "title", showImage: true, showPreview: true },
    defaultSize: { w: 1, h: 4 },
    create: (app, instance, plugin) => new RandomNoteBlock(app, instance, plugin)
  });
}
var HomepagePlugin = class extends import_obsidian20.Plugin {
  layout = getDefaultLayout();
  async onload() {
    registerBlocks();
    const raw = await this.loadData();
    this.layout = validateLayout(raw);
    await this.saveData(this.layout);
    this.registerView(VIEW_TYPE, (leaf) => new HomepageView(leaf, this));
    this.addCommand({
      id: "open-homepage",
      name: "Open homepage",
      callback: () => {
        void this.openHomepage(this.layout.manualOpenMode);
      }
    });
    this.addCommand({
      id: "toggle-edit-mode",
      name: "Toggle edit mode",
      callback: () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        for (const leaf of leaves) {
          if (leaf.view instanceof HomepageView) {
            leaf.view.toggleEditMode();
          }
        }
      }
    });
    this.addCommand({
      id: "add-block",
      name: "Add block",
      callback: () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        for (const leaf of leaves) {
          if (leaf.view instanceof HomepageView) {
            leaf.view.openAddBlockModal();
          }
        }
      }
    });
    this.addRibbonIcon("home", "Open homepage", () => {
      void this.openHomepage(this.layout.manualOpenMode);
    });
    this.addSettingTab(new HomepageSettingTab(this.app, this));
    let layoutReady = false;
    this.app.workspace.onLayoutReady(() => {
      layoutReady = true;
      if (this.layout.openOnStartup) {
        void this.openHomepage(this.layout.openMode);
      }
    });
    let emptyCheckTimer = null;
    this.register(() => {
      if (emptyCheckTimer) clearTimeout(emptyCheckTimer);
    });
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        if (!layoutReady || !this.layout.openWhenEmpty) return;
        if (emptyCheckTimer) clearTimeout(emptyCheckTimer);
        emptyCheckTimer = setTimeout(() => {
          emptyCheckTimer = null;
          if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length > 0) return;
          let hasContent = false;
          this.app.workspace.iterateRootLeaves((leaf) => {
            if (leaf.view.getViewType() !== "empty") hasContent = true;
          });
          if (!hasContent) {
            void this.openHomepage("retain");
          }
        }, 150);
      })
    );
  }
  onunload() {
  }
  async saveLayout(layout) {
    this.layout = layout;
    await this.saveData(layout);
  }
  async openHomepage(mode = "retain") {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      await workspace.revealLeaf(existing[0]);
      if (this.layout.pin) existing[0].setPinned(true);
      return;
    }
    let leaf;
    if (mode === "replace-all") {
      const toClose = [];
      workspace.iterateAllLeaves((l) => {
        if (l.getRoot() === workspace.rootSplit) toClose.push(l);
      });
      toClose.forEach((l) => l.detach());
      leaf = workspace.getLeaf(true);
    } else if (mode === "replace-last") {
      leaf = workspace.getLeaf(false);
    } else {
      leaf = workspace.getLeaf("tab");
    }
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await workspace.revealLeaf(leaf);
    if (this.layout.pin) leaf.setPinned(true);
  }
};
var HomepageSettingTab = class extends import_obsidian20.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const openModeOptions = {
      "retain": "Keep existing tabs (new tab)",
      "replace-last": "Replace active tab",
      "replace-all": "Close all tabs"
    };
    new import_obsidian20.Setting(containerEl).setName("Open on startup").setDesc("Automatically open the homepage when Obsidian starts.").addToggle(
      (toggle) => toggle.setValue(this.plugin.layout.openOnStartup).onChange((value) => {
        void this.plugin.saveLayout({ ...this.plugin.layout, openOnStartup: value }).then(() => this.display());
      })
    );
    if (this.plugin.layout.openOnStartup) {
      new import_obsidian20.Setting(containerEl).setName("Startup open mode").setDesc("How to handle existing tabs when opening homepage on startup.").addDropdown((drop) => {
        for (const [value, label] of Object.entries(openModeOptions)) {
          drop.addOption(value, label);
        }
        drop.setValue(this.plugin.layout.openMode).onChange((value) => {
          if (!isOpenMode(value)) return;
          void this.plugin.saveLayout({ ...this.plugin.layout, openMode: value });
        });
      });
    }
    new import_obsidian20.Setting(containerEl).setName("Open when empty").setDesc("Automatically open the homepage when all tabs are closed.").addToggle(
      (toggle) => toggle.setValue(this.plugin.layout.openWhenEmpty).onChange((value) => {
        void this.plugin.saveLayout({ ...this.plugin.layout, openWhenEmpty: value });
      })
    );
    new import_obsidian20.Setting(containerEl).setName("Manual open mode").setDesc("How to handle existing tabs when opening homepage via command or ribbon.").addDropdown((drop) => {
      for (const [value, label] of Object.entries(openModeOptions)) {
        drop.addOption(value, label);
      }
      drop.setValue(this.plugin.layout.manualOpenMode).onChange((value) => {
        if (!isOpenMode(value)) return;
        void this.plugin.saveLayout({ ...this.plugin.layout, manualOpenMode: value });
      });
    });
    new import_obsidian20.Setting(containerEl).setName("Pin homepage tab").setDesc("Pin the homepage tab so it cannot be accidentally closed.").addToggle(
      (toggle) => toggle.setValue(this.plugin.layout.pin).onChange((value) => {
        void this.plugin.saveLayout({ ...this.plugin.layout, pin: value });
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          leaf.setPinned(value);
        }
      })
    );
    new import_obsidian20.Setting(containerEl).setName("Default columns").setDesc("Number of columns in the grid layout.").addDropdown(
      (drop) => drop.addOption("2", "2 columns").addOption("3", "3 columns").addOption("4", "4 columns").addOption("5", "5 columns").setValue(String(this.plugin.layout.columns)).onChange((value) => {
        void this.plugin.saveLayout({ ...this.plugin.layout, columns: Number(value) });
      })
    );
    new import_obsidian20.Setting(containerEl).setName("Hide scrollbar").setDesc("Hide the scrollbar on the homepage \u2014 content is still scrollable.").addToggle(
      (toggle) => toggle.setValue(this.plugin.layout.hideScrollbar).onChange((value) => {
        void this.plugin.saveLayout({ ...this.plugin.layout, hideScrollbar: value });
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          leaf.view.containerEl.toggleClass("homepage-no-scrollbar", value);
        }
      })
    );
    new import_obsidian20.Setting(containerEl).setName("Reset to default layout").setDesc("Restore all blocks to the original default layout \u2014 cannot be undone.").addButton(
      (btn) => btn.setButtonText("Reset layout").setWarning().onClick(() => void (async () => {
        await this.plugin.saveLayout(getDefaultLayout());
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          if (leaf.view instanceof HomepageView) {
            await leaf.view.reload();
          }
        }
      })())
    );
    new import_obsidian20.Setting(containerEl).setName("Export / import").setHeading();
    new import_obsidian20.Setting(containerEl).setName("Export layout").setDesc("Copy the current layout to clipboard as JSON.").addButton(
      (btn) => btn.setButtonText("Copy to clipboard").onClick(() => void (async () => {
        try {
          const json = JSON.stringify(this.plugin.layout, null, 2);
          await navigator.clipboard.writeText(json);
          btn.setButtonText("Copied!");
        } catch {
          btn.setButtonText("Copy failed");
        }
        setTimeout(() => {
          btn.setButtonText("Copy to clipboard");
        }, 2e3);
      })())
    );
    new import_obsidian20.Setting(containerEl).setName("Import layout").setDesc("Paste a previously exported layout JSON to restore it.").addButton(
      (btn) => btn.setButtonText("Import from clipboard").onClick(() => void (async () => {
        try {
          const text = await navigator.clipboard.readText();
          const parsed = JSON.parse(text);
          const validated = validateLayout(parsed);
          const blockTypes = validated.blocks.map((b) => b.type);
          const summary = `${validated.blocks.length} block(s): ${[...new Set(blockTypes)].join(", ")}`;
          new ConfirmPresetModal(this.app, `Import (${summary})`, async () => {
            await this.plugin.saveLayout(validated);
            for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
              if (leaf.view instanceof HomepageView) {
                await leaf.view.reload();
              }
            }
            btn.setButtonText("Imported!");
            setTimeout(() => {
              btn.setButtonText("Import from clipboard");
            }, 2e3);
          }).open();
        } catch {
          btn.setButtonText("Invalid JSON");
          setTimeout(() => {
            btn.setButtonText("Import from clipboard");
          }, 2e3);
        }
      })())
    );
    new import_obsidian20.Setting(containerEl).setName("Layout presets").setHeading();
    containerEl.createEl("p", {
      text: "Load a preset layout. This will replace your current layout.",
      cls: "setting-item-description"
    });
    const presetGrid = containerEl.createDiv({ cls: "preset-grid" });
    const presets = [
      {
        name: "Minimal",
        desc: "Greeting + clock + static text",
        icon: "\u2728",
        layout: {
          ...getDefaultLayout(),
          columns: 2,
          blocks: [
            { id: "p1", type: "greeting", x: 0, y: 0, w: 2, h: 2, config: { name: "", showTime: true } },
            { id: "p2", type: "clock", x: 0, y: 2, w: 1, h: 3, config: { showSeconds: false, showDate: true } },
            { id: "p3", type: "static-text", x: 1, y: 2, w: 1, h: 3, config: { _titleLabel: "Notes", content: "" } }
          ]
        }
      },
      {
        name: "Dashboard",
        desc: "Greeting + clock + links + insight + quotes",
        icon: "\u{1F4CA}",
        layout: {
          ...getDefaultLayout(),
          columns: 3,
          blocks: [
            { id: "p1", type: "greeting", x: 0, y: 0, w: 2, h: 2, config: { name: "", showTime: true } },
            { id: "p2", type: "clock", x: 2, y: 0, w: 1, h: 2, config: { showSeconds: false, showDate: true } },
            { id: "p3", type: "folder-links", x: 0, y: 2, w: 1, h: 3, config: { _titleLabel: "Quick links", links: [] } },
            { id: "p4", type: "insight", x: 1, y: 2, w: 2, h: 3, config: { tag: "", _titleLabel: "Daily insight", dailySeed: true } },
            { id: "p5", type: "quotes-list", x: 0, y: 5, w: 3, h: 3, config: { tag: "", _titleLabel: "Quotes", columns: 2, maxItems: 20 } }
          ]
        }
      },
      {
        name: "Focus",
        desc: "Greeting + embedded note + recent files",
        icon: "\u{1F3AF}",
        layout: {
          ...getDefaultLayout(),
          columns: 2,
          blocks: [
            { id: "p1", type: "greeting", x: 0, y: 0, w: 2, h: 2, config: { name: "", showTime: true } },
            { id: "p2", type: "embedded-note", x: 0, y: 2, w: 1, h: 5, config: { filePath: "", showTitle: true } },
            { id: "p3", type: "recent-files", x: 1, y: 2, w: 1, h: 5, config: { _titleLabel: "Recent files", maxItems: 10, showTimestamp: true, excludeFolders: "" } }
          ]
        }
      }
    ];
    for (const preset of presets) {
      const card = presetGrid.createEl("button", { cls: "preset-card" });
      card.createSpan({ cls: "preset-icon", text: preset.icon });
      card.createSpan({ cls: "preset-name", text: preset.name });
      card.createSpan({ cls: "preset-desc", text: preset.desc });
      card.addEventListener("click", () => {
        new ConfirmPresetModal(this.app, preset.name, async () => {
          const freshLayout = structuredClone(preset.layout);
          freshLayout.blocks = freshLayout.blocks.map((b) => ({ ...b, id: crypto.randomUUID() }));
          await this.plugin.saveLayout(freshLayout);
          for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
            if (leaf.view instanceof HomepageView) {
              await leaf.view.reload();
            }
          }
        }).open();
      });
    }
  }
};
var ConfirmPresetModal = class extends import_obsidian20.Modal {
  constructor(app, presetName, onConfirm) {
    super(app);
    this.presetName = presetName;
    this.onConfirm = onConfirm;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian20.Setting(contentEl).setName("Load preset?").setHeading();
    contentEl.createEl("p", { text: `This will replace your current layout with the "${this.presetName}" preset. This cannot be undone.` });
    new import_obsidian20.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Load preset").setWarning().onClick(() => {
        void Promise.resolve(this.onConfirm()).catch((e) => console.error("[Homepage Blocks] Preset apply failed:", e));
        this.close();
      })
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};
/*! Bundled license information:

gridstack/dist/gridstack.js:
  (*!
   * GridStack 12.4.2
   * https://gridstackjs.com/
   *
   * Copyright (c) 2021-2025  Alain Dumesny
   * see root license https://github.com/gridstack/gridstack.js/tree/master/LICENSE
   *)
*/
