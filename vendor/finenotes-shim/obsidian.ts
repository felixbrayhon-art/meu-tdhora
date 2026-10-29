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
  open(): void { document.body.appendChild(this.containerEl); void this.onOpen(); }
  close(): void { this.onClose(); this.containerEl.remove(); }
  onOpen(): void | Promise<void> {}
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
  setChecked(_checked?: boolean | null): this { return this; }
  setSection(_section?: string): this { return this; }
  setWarning(_warning?: boolean): this { return this; }
}

// --- Cofre de arquivos: esqueleto (os cadernos daqui não usam arquivos do Obsidian) ---
export class TAbstractFile { path = ''; name = ''; parent: TFolder | null = null; }
export class TFile extends TAbstractFile { extension = ''; basename = ''; stat = { ctime: 0, mtime: 0, size: 0 }; }
export class TFolder extends TAbstractFile { children: TAbstractFile[] = []; isRoot(): boolean { return this.path === '/' || this.path === ''; } }
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

// --- Formulários (Setting e componentes) ---
export class TextComponent {
  inputEl: HTMLInputElement;
  constructor(parent: HTMLElement) { this.inputEl = parent.createEl('input', { type: 'text' }); }
  setValue(v: string): this { this.inputEl.value = v; return this; }
  getValue(): string { return this.inputEl.value; }
  setPlaceholder(p: string): this { this.inputEl.placeholder = p; return this; }
  setDisabled(d: boolean): this { this.inputEl.disabled = d; return this; }
  onChange(cb: (v: string) => unknown): this { this.inputEl.addEventListener('input', () => cb(this.inputEl.value)); return this; }
}
export class DropdownComponent {
  selectEl: HTMLSelectElement;
  constructor(parent: HTMLElement) { this.selectEl = parent.createEl('select', { cls: 'dropdown' }); }
  addOption(value: string, display: string): this { this.selectEl.createEl('option', { value, text: display }); return this; }
  addOptions(options: Record<string, string>): this { for (const [v, d] of Object.entries(options)) this.addOption(v, d); return this; }
  setValue(v: string): this { this.selectEl.value = v; return this; }
  getValue(): string { return this.selectEl.value; }
  setDisabled(d: boolean): this { this.selectEl.disabled = d; return this; }
  onChange(cb: (v: string) => unknown): this { this.selectEl.addEventListener('change', () => cb(this.selectEl.value)); return this; }
}
export class ToggleComponent {
  toggleEl: HTMLElement;
  private on = false;
  private cb: ((v: boolean) => unknown) | null = null;
  constructor(parent: HTMLElement) {
    this.toggleEl = parent.createDiv({ cls: 'checkbox-container', attr: { role: 'switch', tabindex: '0' } });
    this.toggleEl.addEventListener('click', () => { this.setValue(!this.on); this.cb?.(this.on); });
  }
  setValue(v: boolean): this { this.on = v; this.toggleEl.toggleClass('is-enabled', v); this.toggleEl.setAttribute('aria-checked', String(v)); return this; }
  getValue(): boolean { return this.on; }
  setDisabled(d: boolean): this { this.toggleEl.toggleClass('is-disabled', d); return this; }
  onChange(cb: (v: boolean) => unknown): this { this.cb = cb; return this; }
}
export class SliderComponent {
  sliderEl: HTMLInputElement;
  constructor(parent: HTMLElement) { this.sliderEl = parent.createEl('input', { type: 'range', cls: 'slider' }); }
  setLimits(min: number, max: number, step: number | 'any'): this { this.sliderEl.min = String(min); this.sliderEl.max = String(max); this.sliderEl.step = String(step); return this; }
  setValue(v: number): this { this.sliderEl.value = String(v); return this; }
  getValue(): number { return Number(this.sliderEl.value); }
  setDynamicTooltip(): this { return this; }
  onChange(cb: (v: number) => unknown): this { this.sliderEl.addEventListener('input', () => cb(Number(this.sliderEl.value))); return this; }
}
export class ButtonComponent {
  buttonEl: HTMLButtonElement;
  constructor(parent: HTMLElement) { this.buttonEl = parent.createEl('button'); }
  setButtonText(t: string): this { this.buttonEl.setText(t); return this; }
  setCta(): this { this.buttonEl.addClass('mod-cta'); return this; }
  setWarning(): this { this.buttonEl.addClass('mod-warning'); return this; }
  setClass(c: string): this { this.buttonEl.addClass(c); return this; }
  setIcon(i: string): this { setIcon(this.buttonEl, i); return this; }
  setDisabled(d: boolean): this { this.buttonEl.disabled = d; return this; }
  setTooltip(t: string): this { this.buttonEl.title = t; return this; }
  onClick(cb: (e: MouseEvent) => unknown): this { this.buttonEl.addEventListener('click', cb); return this; }
}
export class ExtraButtonComponent {
  extraSettingsEl: HTMLElement;
  constructor(parent: HTMLElement) { this.extraSettingsEl = parent.createDiv({ cls: 'clickable-icon extra-setting-button', attr: { role: 'button', tabindex: '0' } }); }
  setIcon(i: string): this { setIcon(this.extraSettingsEl, i); return this; }
  setTooltip(t: string): this { this.extraSettingsEl.title = t; this.extraSettingsEl.setAttribute('aria-label', t); return this; }
  setDisabled(d: boolean): this { this.extraSettingsEl.toggleClass('is-disabled', d); return this; }
  onClick(cb: () => unknown): this { this.extraSettingsEl.addEventListener('click', () => cb()); return this; }
}
export class Setting {
  settingEl: HTMLElement; infoEl: HTMLElement; nameEl: HTMLElement; descEl: HTMLElement; controlEl: HTMLElement;
  constructor(public containerEl: HTMLElement) {
    this.settingEl = containerEl.createDiv({ cls: 'setting-item' });
    this.infoEl = this.settingEl.createDiv({ cls: 'setting-item-info' });
    this.nameEl = this.infoEl.createDiv({ cls: 'setting-item-name' });
    this.descEl = this.infoEl.createDiv({ cls: 'setting-item-description' });
    this.controlEl = this.settingEl.createDiv({ cls: 'setting-item-control' });
  }
  setName(n: string | DocumentFragment): this { this.nameEl.setText(n); return this; }
  setDesc(d: string | DocumentFragment): this { this.descEl.setText(d); return this; }
  setHeading(): this { this.settingEl.addClass('setting-item-heading'); return this; }
  setClass(c: string): this { this.settingEl.addClass(c); return this; }
  setTooltip(t: string): this { this.settingEl.title = t; return this; }
  setDisabled(d: boolean): this { this.settingEl.toggleClass('is-disabled', d); return this; }
  addText(cb: (c: TextComponent) => unknown): this { cb(new TextComponent(this.controlEl)); return this; }
  addDropdown(cb: (c: DropdownComponent) => unknown): this { cb(new DropdownComponent(this.controlEl)); return this; }
  addToggle(cb: (c: ToggleComponent) => unknown): this { cb(new ToggleComponent(this.controlEl)); return this; }
  addSlider(cb: (c: SliderComponent) => unknown): this { cb(new SliderComponent(this.controlEl)); return this; }
  addButton(cb: (c: ButtonComponent) => unknown): this { cb(new ButtonComponent(this.controlEl)); return this; }
  addExtraButton(cb: (c: ExtraButtonComponent) => unknown): this { cb(new ExtraButtonComponent(this.controlEl)); return this; }
}

// --- Janelas de busca (a paleta de comandos do Obsidian) ---
export abstract class SuggestModal<T> extends Modal {
  limit = 100;
  emptyStateText = 'Nada encontrado.';
  inputEl: HTMLInputElement;
  resultContainerEl: HTMLElement;
  private items: T[] = [];
  private selected = 0;
  private token = 0;
  constructor(app: App) {
    super(app);
    this.modalEl.addClass('prompt');
    this.containerEl.addClass('mod-prompt');
    this.inputEl = this.modalEl.createEl('input', { cls: 'prompt-input', type: 'text', attr: { autocomplete: 'off', enterkeyhint: 'search' } });
    this.resultContainerEl = this.modalEl.createDiv({ cls: 'prompt-results' });
    this.inputEl.addEventListener('input', () => void this.refresh());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); this.choose(this.selected, e); }
      else if (e.key === 'Escape') { this.close(); }
    });
  }
  setPlaceholder(p: string): void { this.inputEl.placeholder = p; }
  setInstructions(): void {}
  override async onOpen(): Promise<void> { this.inputEl.value = ''; await this.refresh(); this.inputEl.focus(); }
  abstract getSuggestions(query: string): T[] | Promise<T[]>;
  abstract renderSuggestion(item: T, el: HTMLElement): void;
  abstract onChooseSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void;
  private async refresh(): Promise<void> {
    const mine = ++this.token;
    const found = (await this.getSuggestions(this.inputEl.value)).slice(0, this.limit);
    if (mine !== this.token) return;
    this.items = found; this.selected = 0;
    this.resultContainerEl.empty();
    if (!found.length) { this.resultContainerEl.createDiv({ cls: 'prompt-empty', text: this.emptyStateText }); return; }
    found.forEach((item, i) => {
      const row = this.resultContainerEl.createDiv({ cls: 'suggestion-item' + (i === 0 ? ' is-selected' : '') });
      this.renderSuggestion(item, row);
      row.addEventListener('click', (e) => this.choose(i, e));
    });
  }
  private move(d: number): void {
    const rows = [...this.resultContainerEl.querySelectorAll('.suggestion-item')];
    if (!rows.length) return;
    rows[this.selected]?.classList.remove('is-selected');
    this.selected = (this.selected + d + rows.length) % rows.length;
    rows[this.selected].classList.add('is-selected');
    rows[this.selected].scrollIntoView({ block: 'nearest' });
  }
  private choose(i: number, e: MouseEvent | KeyboardEvent): void { const item = this.items[i]; if (item === undefined) return; this.close(); this.onChooseSuggestion(item, e); }
}
export abstract class FuzzySuggestModal<T> extends SuggestModal<T> {
  abstract getItems(): T[];
  abstract getItemText(item: T): string;
  abstract onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void;
  getSuggestions(query: string): T[] { const q = query.toLowerCase(); return this.getItems().filter((i) => this.getItemText(i).toLowerCase().includes(q)); }
  renderSuggestion(item: T, el: HTMLElement): void { el.setText(this.getItemText(item)); }
  onChooseSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void { this.onChooseItem(item, evt); }
}
export abstract class AbstractInputSuggest<T> {
  constructor(public app: App, public textInputEl: HTMLInputElement | HTMLDivElement) {}
  limit = 100;
  protected abstract getSuggestions(query: string): T[] | Promise<T[]>;
  abstract renderSuggestion(value: T, el: HTMLElement): void;
  abstract selectSuggestion(value: T, evt: MouseEvent | KeyboardEvent): void;
  onSelect(_cb: (value: T, evt: MouseEvent | KeyboardEvent) => unknown): this { return this; }
  setValue(_v: string): void {}
  getValue(): string { return ''; }
  open(): void {}
  close(): void {}
}
