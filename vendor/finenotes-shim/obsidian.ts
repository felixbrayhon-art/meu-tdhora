// "obsidian" para o navegador: só o que o motor e a tela do FineNotes 1.5.0 (MIT) usam do Obsidian.
// O que depende de cofre de arquivos (TFile, App.vault) fica como esqueleto: cadernos aqui moram no IndexedDB do app.
import { icons } from 'lucide';
import { installObsidianDom } from './dom';

installObsidianDom();

export type IconNode = [string, Record<string, string>][];

const pascal = (name: string) => name.replace(/^lucide-/, '').split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');

/** Troca o conteúdo de `el` pelo ícone Lucide `name` (o Obsidian usa a mesma biblioteca). */
export function setIcon(el: Element, name: string): void {
  el.replaceChildren();
  const node = (icons as unknown as Record<string, IconNode>)[pascal(name)];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [k, v] of Object.entries({ xmlns: 'http://www.w3.org/2000/svg', width: '24', height: '24', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) svg.setAttribute(k, v);
  svg.classList.add('svg-icon', `lucide-${name.replace(/^lucide-/, '')}`);
  for (const [tag, attrs] of node ?? []) {
    const child = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) child.setAttribute(k, v);
    svg.appendChild(child);
  }
  el.appendChild(svg);
}

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
const touch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 1;
const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touch);
const android = /Android/.test(ua);
const phone = typeof window !== 'undefined' && Math.min(window.screen.width, window.screen.height) < 600 && (ios || android);
export const Platform = {
  isMobile: ios || android, isDesktop: !(ios || android), isIosApp: ios, isAndroidApp: android, isPhone: phone, isTablet: (ios || android) && !phone,
  isMacOS: /Mac/.test(ua) && !touch, isWin: /Windows/.test(ua), isLinux: /Linux/.test(ua) && !android, isSafari: /^((?!chrome|android).)*safari/i.test(ua), isDesktopApp: false, isMobileApp: false,
};

/** Aviso passageiro (toast). */
export class Notice {
  noticeEl: HTMLElement;
  private timer = 0;
  constructor(message: string | DocumentFragment, duration = 5000) {
    let host = document.querySelector<HTMLElement>('.notice-container');
    if (!host) { host = document.body.createDiv({ cls: 'notice-container' }); }
    this.noticeEl = host.createDiv({ cls: 'notice' });
    this.noticeEl.append(message as string | Node);
    if (duration > 0) this.timer = window.setTimeout(() => this.hide(), duration);
  }
  setMessage(message: string | DocumentFragment): this { this.noticeEl.replaceChildren(message as string | Node); return this; }
  hide(): void { window.clearTimeout(this.timer); this.noticeEl.remove(); }
}

export class Component {
  private children: Component[] = [];
  private disposers: (() => void)[] = [];
  load(): void { this.onload(); }
  onload(): void {}
  unload(): void { this.children.forEach((c) => c.unload()); this.disposers.forEach((d) => d()); this.onunload(); }
  onunload(): void {}
  addChild<T extends Component>(c: T): T { this.children.push(c); return c; }
  register(cb: () => void): void { this.disposers.push(cb); }
  registerDomEvent(el: EventTarget, type: string, cb: (e: any) => void, opts?: any): void { el.addEventListener(type, cb, opts); this.register(() => el.removeEventListener(type, cb, opts)); }
  registerInterval(id: number): number { this.register(() => window.clearInterval(id)); return id; }
}

export class Scope { register(): void {} unregister(): void {} }

export class Modal extends Component {
  app: App;
  containerEl: HTMLElement;
  modalEl: HTMLElement;
  titleEl: HTMLElement;
  contentEl: HTMLElement;
  scope = new Scope();
  constructor(app: App) {
    super();
    this.app = app;
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'modal-container mod-dim';
    const bg = this.containerEl.createDiv({ cls: 'modal-bg' });
    bg.addEventListener('click', () => this.close());
    this.modalEl = this.containerEl.createDiv({ cls: 'modal' });
    const close = this.modalEl.createDiv({ cls: 'modal-close-button' });
    close.addEventListener('click', () => this.close());
    this.titleEl = this.modalEl.createDiv({ cls: 'modal-title' });
    this.contentEl = this.modalEl.createDiv({ cls: 'modal-content' });
  }
  open(): void { document.body.appendChild(this.containerEl); this.onOpen(); }
  close(): void { this.onClose(); this.containerEl.remove(); }
  onOpen(): void {}
  onClose(): void {}
  setTitle(title: string): this { this.titleEl.setText(title); return this; }
}

export class Menu {
  private items: { title: string; icon?: string; onClick?: () => void; disabled?: boolean; separator?: boolean }[] = [];
  private el: HTMLElement | null = null;
  addItem(cb: (item: MenuItem) => void): this {
    const data: { title: string; icon?: string; onClick?: () => void; disabled?: boolean } = { title: '' };
    const item = new MenuItem(data);
    cb(item);
    this.items.push(data);
    return this;
  }
  addSeparator(): this { this.items.push({ title: '', separator: true }); return this; }
  showAtMouseEvent(e: MouseEvent): void { this.showAtPosition({ x: e.clientX, y: e.clientY }); }
  showAtPosition(pos: { x: number; y: number }): void {
    this.hide();
    const el = document.body.createDiv({ cls: 'menu' });
    this.el = el;
    for (const it of this.items) {
      if (it.separator) { el.createDiv({ cls: 'menu-separator' }); continue; }
      const row = el.createDiv({ cls: 'menu-item' });
      if (it.disabled) row.addClass('is-disabled');
      if (it.icon) setIcon(row.createDiv({ cls: 'menu-item-icon' }), it.icon);
      row.createDiv({ cls: 'menu-item-title', text: it.title });
      row.addEventListener('click', () => { this.hide(); it.onClick?.(); });
    }
    el.style.left = `${Math.min(pos.x, window.innerWidth - 200)}px`;
    el.style.top = `${Math.min(pos.y, window.innerHeight - 40 * this.items.length)}px`;
    window.setTimeout(() => document.addEventListener('pointerdown', this.outside, { once: true, capture: true }), 0);
  }
  private outside = (e: Event) => { if (this.el && !this.el.contains(e.target as Node)) this.hide(); else if (this.el) document.addEventListener('pointerdown', this.outside, { once: true, capture: true }); };
  hide(): void { this.el?.remove(); this.el = null; }
  close(): void { this.hide(); }
  onHide(): void {}
}
export class MenuItem {
  constructor(private data: { title: string; icon?: string; onClick?: () => void; disabled?: boolean }) {}
  setTitle(t: string): this { this.data.title = t; return this; }
  setIcon(i: string | null): this { this.data.icon = i ?? undefined; return this; }
  onClick(cb: () => void): this { this.data.onClick = cb; return this; }
  setDisabled(d: boolean): this { this.data.disabled = d; return this; }
  setChecked(): this { return this; }
  setSection(): this { return this; }
  setWarning(): this { return this; }
}

// --- Cofre de arquivos: esqueleto (os cadernos daqui não usam arquivos do Obsidian) ---
export class TAbstractFile { path = ''; name = ''; parent: TFolder | null = null; }
export class TFile extends TAbstractFile { extension = ''; basename = ''; stat = { ctime: 0, mtime: 0, size: 0 }; }
export class TFolder extends TAbstractFile { children: TAbstractFile[] = []; }
export class App { vault: any = { getAbstractFileByPath: () => null, adapter: {}, getName: () => 'ToDaHORA', on: () => ({}) }; workspace: any = { on: () => ({}), getActiveFile: () => null }; }
export const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/|\/$/g, '');
export const requireApiVersion = () => true;
export type RequestUrlParam = { url: string; method?: string; headers?: Record<string, string>; body?: string | ArrayBuffer; contentType?: string; throw?: boolean };
export type RequestUrlResponse = { status: number; headers: Record<string, string>; arrayBuffer: ArrayBuffer; json: any; text: string };
export async function requestUrl(p: RequestUrlParam | string): Promise<RequestUrlResponse> {
  const o = typeof p === 'string' ? { url: p } : p;
  const r = await fetch(o.url, { method: o.method, headers: o.headers, body: o.body as BodyInit | undefined });
  const buf = await r.arrayBuffer();
  const text = new TextDecoder().decode(buf);
  return { status: r.status, headers: Object.fromEntries(r.headers.entries()), arrayBuffer: buf, text, get json() { return JSON.parse(text); } } as RequestUrlResponse;
}
export async function loadPdfJs(): Promise<any> { return import('pdfjs-dist'); }
export const MarkdownRenderer = { render: async (_app: App, md: string, el: HTMLElement) => { el.setText(md); }, renderMarkdown: async (md: string, el: HTMLElement) => { el.setText(md); } };

// Telas de configuração do Obsidian: não existem aqui.
export class Setting { constructor(public containerEl: HTMLElement) {} setName(): this { return this; } setDesc(): this { return this; } addToggle(): this { return this; } addText(): this { return this; } addButton(): this { return this; } addDropdown(): this { return this; } addSlider(): this { return this; } }
export class ToggleComponent {}
export class SuggestModal<T> extends Modal { getSuggestions(_q: string): T[] { return []; } renderSuggestion(): void {} onChooseSuggestion(): void {} }
export class FuzzySuggestModal<T> extends SuggestModal<T> { getItems(): T[] { return []; } getItemText(_i: T): string { return ''; } }
export class AbstractInputSuggest<T> { constructor(public app: App, public textInputEl: HTMLElement) {} getSuggestions(_q: string): T[] { return []; } close(): void {} setValue(): void {} }
