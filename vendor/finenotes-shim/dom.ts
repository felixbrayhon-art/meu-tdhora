// Os atalhos de DOM que o Obsidian instala em todo elemento (createDiv, createEl, addClass…). O código do FineNotes os usa direto.
// Referência de comportamento: a API pública do Obsidian (obsidian.d.ts). Instale uma vez com installObsidianDom().

export type DomInfo = string | {
  cls?: string | string[]; text?: string | DocumentFragment; attr?: Record<string, string | number | boolean | null>;
  title?: string; parent?: Node; value?: string; type?: string; prepend?: boolean; href?: string; placeholder?: string;
};


declare global {
  interface Node {
    createEl<K extends keyof HTMLElementTagNameMap>(tag: K, info?: DomInfo, cb?: (el: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K];
    createDiv(info?: DomInfo, cb?: (el: HTMLDivElement) => void): HTMLDivElement;
    createSpan(info?: DomInfo, cb?: (el: HTMLSpanElement) => void): HTMLSpanElement;
    createSvg<K extends keyof SVGElementTagNameMap>(tag: K, info?: DomInfo, cb?: (el: SVGElementTagNameMap[K]) => void): SVGElementTagNameMap[K];
    empty(): void;
    detach(): void;
    appendText(text: string): void;
    instanceOf<T>(type: { new (...args: any[]): T }): this is T;
    setText(text: string | DocumentFragment): void;
  }
  interface Element {
    addClass(...classes: string[]): void;
    addClasses(classes: string[]): void;
    removeClass(...classes: string[]): void;
    removeClasses(classes: string[]): void;
    toggleClass(classes: string | string[], value: boolean): void;
    hasClass(cls: string): boolean;
    setAttr(name: string, value: string | number | boolean | null): void;
    setAttrs(attrs: Record<string, string | number | boolean | null>): void;
    getAttr(name: string): string | null;
    setCssStyles(styles: Partial<CSSStyleDeclaration>): void;
    setCssProps(props: Record<string, string>): void;
    find(selector: string): Element | null;
    findAll(selector: string): HTMLElement[];
    hide(): void;
    show(): void;
    toggle(show?: boolean): void;
    isShown(): boolean;
  }
  function createEl<K extends keyof HTMLElementTagNameMap>(tag: K, info?: DomInfo, cb?: (el: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K];
  function createDiv(info?: DomInfo, cb?: (el: HTMLDivElement) => void): HTMLDivElement;
  function createSpan(info?: DomInfo, cb?: (el: HTMLSpanElement) => void): HTMLSpanElement;
  function createFragment(cb?: (el: DocumentFragment) => void): DocumentFragment;
  const activeDocument: Document;
  const activeWindow: Window;
}

const classes = (cls: string | string[] | undefined): string[] => (cls == null ? [] : (Array.isArray(cls) ? cls : cls.split(/\s+/)).filter(Boolean));

function build<T extends Element>(this: Node, el: T, info?: DomInfo, cb?: (el: T) => void): T {
  const o = typeof info === 'string' ? { cls: info } : (info ?? {});
  el.classList.add(...classes(o.cls));
  if (o.text != null) el.append(o.text as string | Node);
  if (o.attr) for (const [k, v] of Object.entries(o.attr)) if (v !== null && v !== undefined) el.setAttribute(k, String(v));
  if (o.title != null) (el as unknown as HTMLElement).title = o.title;
  if (o.value != null) (el as unknown as HTMLInputElement).value = o.value;
  if (o.type != null) el.setAttribute('type', o.type);
  if (o.href != null) el.setAttribute('href', o.href);
  if (o.placeholder != null) el.setAttribute('placeholder', o.placeholder);
  const parent = o.parent ?? this;
  if (o.prepend) parent.insertBefore(el, parent.firstChild); else parent.appendChild(el);
  cb?.(el);
  return el;
}

let installed = false;
export function installObsidianDom(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const N = Node.prototype as any, E = Element.prototype as any;
  N.createEl = function (tag: string, info?: DomInfo, cb?: (el: HTMLElement) => void) { return build.call(this, document.createElement(tag), info, cb); };
  N.createDiv = function (info?: DomInfo, cb?: (el: HTMLDivElement) => void) { return build.call(this, document.createElement('div'), info, cb); };
  N.createSpan = function (info?: DomInfo, cb?: (el: HTMLSpanElement) => void) { return build.call(this, document.createElement('span'), info, cb); };
  N.createSvg = function (tag: string, info?: DomInfo, cb?: (el: SVGElement) => void) { return build.call(this, document.createElementNS('http://www.w3.org/2000/svg', tag), info, cb); };
  N.instanceOf = function (type: any) { return this instanceof type; };
  N.empty = function () { while (this.firstChild) this.removeChild(this.firstChild); };
  N.detach = function () { this.parentNode?.removeChild(this); };
  N.appendText = function (text: string) { this.appendChild(document.createTextNode(text)); };
  N.setText = function (text: string | DocumentFragment) { this.empty(); this.append(text as string | Node); };
  E.addClass = function (...c: string[]) { this.classList.add(...c.flatMap((x) => classes(x))); };
  E.addClasses = function (c: string[]) { this.classList.add(...c.flatMap((x) => classes(x))); };
  E.removeClass = function (...c: string[]) { this.classList.remove(...c.flatMap((x) => classes(x))); };
  E.removeClasses = function (c: string[]) { this.classList.remove(...c.flatMap((x) => classes(x))); };
  E.toggleClass = function (c: string | string[], on: boolean) { for (const x of classes(c)) this.classList.toggle(x, on); };
  E.hasClass = function (c: string) { return this.classList.contains(c); };
  E.setAttr = function (name: string, value: string | number | boolean | null) { if (value === null) this.removeAttribute(name); else this.setAttribute(name, String(value)); };
  E.setAttrs = function (attrs: Record<string, string | number | boolean | null>) { for (const [k, v] of Object.entries(attrs)) this.setAttr(k, v); };
  E.getAttr = function (name: string) { return this.getAttribute(name); };
  E.setCssStyles = function (styles: Record<string, string>) { Object.assign(this.style, styles); };
  E.setCssProps = function (props: Record<string, string>) { for (const [k, v] of Object.entries(props)) this.style.setProperty(k, v); };
  E.find = function (selector: string) { return this.querySelector(selector); };
  E.findAll = function (selector: string) { return Array.from(this.querySelectorAll(selector)); };
  E.hide = function () { this.style.display = 'none'; };
  E.show = function () { this.style.display = ''; };
  E.toggle = function (show?: boolean) { const visible = show ?? this.style.display === 'none'; this.style.display = visible ? '' : 'none'; };
  E.isShown = function () { return this.style.display !== 'none'; };
  const w = window as any;
  const detached = (tag: string, info?: DomInfo, cb?: (el: any) => void) => {
    const frag = document.createDocumentFragment();
    const el = build.call(frag, document.createElement(tag), info, cb);
    frag.removeChild(el);
    return el;
  };
  w.createEl = detached;
  w.createDiv = (info?: DomInfo, cb?: (el: any) => void) => detached('div', info, cb);
  w.createSpan = (info?: DomInfo, cb?: (el: any) => void) => detached('span', info, cb);
  w.createFragment = (cb?: (el: DocumentFragment) => void) => { const f = document.createDocumentFragment(); cb?.(f); return f; };
  (window as any).activeDocument ??= document;
  (window as any).activeWindow ??= window;
}

export {};
