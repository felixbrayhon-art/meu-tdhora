import React, { useEffect, useRef, useState } from 'react';
import '../../vendor/finenotes/styles.css';
import '../../vendor/finenotes-shim/theme.css';
import { App, Notice, Platform } from '../../vendor/finenotes-shim/obsidian';
import { InkSurface } from '../../vendor/finenotes/src/view/ink-surface';
import { Toolbar, type ToolbarState } from '../../vendor/finenotes/src/view/toolbar';
import { PALETTE, SIZES } from '../../vendor/finenotes/src/constants';
import { DEFAULT_SETTINGS } from '../../vendor/finenotes/src/settings-data';
import { DEFAULT_NOTEBOOK_CHOICES, buildNewDocument } from '../../vendor/finenotes/src/model/new-notebook';
import { DocumentEncoder, decodeDocument } from '../../vendor/finenotes/src/model/serialize';
import { AddPage, RemovePage } from '../../vendor/finenotes/src/model/commands';
import { ClearPage, MovePage, SetPageBookmark, SetPageTemplate, duplicatePageAfter, insertIndexFor, pageFromTemplate, pageToInsertAfter, type InsertPosition } from '../../vendor/finenotes/src/model/page-commands';
import { type PageGeometry, type SyntheticBackdrop, isCoverRuling } from '../../vendor/finenotes/src/model/document';
import { paperTemplateFor, parseRecent, pushRecent } from '../../vendor/finenotes/src/model/templates';
import { changeCover } from '../../vendor/finenotes/src/model/notebook-commands';
import { AddPagePopover, TemplatePickerModal } from '../../vendor/finenotes/src/view/template-picker';
import { CoverPopover } from '../../vendor/finenotes/src/view/cover-picker';
import { SetPageTitle } from '../../vendor/finenotes/src/model/contents';
import { SetScrollDirection, scrollDirectionOf } from '../../vendor/finenotes/src/model/scroll-direction';
import { SetAttachmentFolder } from '../../vendor/finenotes/src/model/attachment-folders';
import { PageSidebar, thumbnailRasterScale, type PageAction } from '../../vendor/finenotes/src/view/page-sidebar';
import { VaultBackdropRenderer } from '../../vendor/finenotes/src/view/backdrop-renderer';
import { NotebookSearchModal } from '../../vendor/finenotes/src/view/search-modal';
import { NoteSettingsModal } from '../../vendor/finenotes/src/view/note-settings-modal';
import { ContentsTitleModal } from '../../vendor/finenotes/src/view/contents-title-modal';
import { collectPageText } from '../../vendor/finenotes/src/search/notebook-search';
import { paperTheme } from '../../vendor/finenotes/src/canvas/backdrop';
import { PANEL_SLIDE_MS } from '../../vendor/finenotes/src/view/motion';
import type { Command } from '../../vendor/finenotes/src/model/commands';
import { penGesturesOf } from '../../vendor/finenotes/src/ink/pen-gestures';
import { eraserFilterOf } from '../../vendor/finenotes/src/ink/stroke-eraser';
import { lassoFilterOf, lassoModeOf } from '../../vendor/finenotes/src/canvas/lasso';
import { sanitizeTextStyle } from '../../vendor/finenotes/src/model/text-style';
import { DEFAULT_SHAPE_COLOR, parseHexColor, recentColorsOf } from '../../vendor/finenotes/src/model/colors';
import { loadFnNotebook, saveFnNotebook } from '../../services/ink/store';
import type { HandwrittenNote } from '../../types';
import { iniciaTraducao } from './finenotesPt';

// Caderno à mão com o motor e a tela do FineNotes 1.5.0 (MIT, vendor/finenotes), montados dentro do app por uma camada que
// imita a parte do Obsidian que eles usam (vendor/finenotes-shim). O que o FineNotes liga a arquivos, IA e áudio fica de fora por enquanto.

interface Props {
  note: HandwrittenNote;
  onSaveMeta: (note: HandwrittenNote) => void;
  onClose: () => void;
}

const ignore = (): void => undefined;

const toolStateFrom = (s = DEFAULT_SETTINGS): ToolbarState => ({
  tool: s.defaultTool,
  color: s.defaultColor,
  size: s.defaultSize,
  pressureEnabled: s.pressureWidth,
  shapeSnapEnabled: s.drawAndHold,
  eraserMode: s.eraserMode,
  eraserSize: s.eraserSize,
  eraserFilter: eraserFilterOf(s.eraserFilter),
  lassoMode: lassoModeOf(s.lassoMode),
  lassoFilter: lassoFilterOf(s.lassoFilter),
  textStyle: sanitizeTextStyle(s.textStyle),
  textPinned: s.textToolPinned === true,
  textDragSize: s.textDragSize === true,
  penAutoShape: s.penAutoShape === true,
  penGestures: penGesturesOf(s.penGestures),
  shapeColor: parseHexColor(s.shapeColor ?? '') ?? DEFAULT_SHAPE_COLOR,
  recentColors: recentColorsOf(s.recentColors),
});

const FineNotesHost: React.FC<Props> = ({ note, onSaveMeta, onClose }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState<'carregando' | 'salvo' | 'salvando' | 'erro'>('carregando');
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef(title);
  titleRef.current = title;
  const noteRef = useRef(note);
  noteRef.current = note;
  const metaRef = useRef(onSaveMeta);
  metaRef.current = onSaveMeta;
  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => iniciaTraducao(), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let surface: InkSurface | null = null;
    let toolbar: Toolbar | null = null;
    let sidebar: PageSidebar | null = null;
    let lastSearch = '';
    const app = new App();
    let saveTimer = 0;
    let dirty = false;
    const encoder = new DocumentEncoder();
    const dark = document.documentElement.classList.contains('dark');
    const bodyClasses = ['fn-open', dark ? 'theme-dark' : 'theme-light', ...(Platform.isMobile ? ['is-mobile'] : []), ...(Platform.isPhone ? ['is-phone'] : []), ...(Platform.isTablet ? ['is-tablet'] : [])];
    document.body.classList.add(...bodyClasses);

    const save = async () => {
      window.clearTimeout(saveTimer);
      if (!surface || !dirty) return;
      dirty = false;
      setStatus('salvando');
      try {
        const doc = surface.document;
        await saveFnNotebook({ id: noteRef.current.id, payload: encoder.encode(doc), updatedAt: Date.now() });
        metaRef.current({ ...noteRef.current, title: titleRef.current, kind: 'finenotes', pageCount: doc.pages.length, updatedAt: Date.now() });
        setStatus('salvo');
      } catch (e) {
        dirty = true;
        setStatus('erro');
        console.error('[anotações] falha ao salvar', e);
      }
    };
    flushRef.current = save;
    const requestSave = () => { dirty = true; window.clearTimeout(saveTimer); saveTimer = window.setTimeout(() => void save(), 800); };

    (async () => {
      try {
        const rec = await loadFnNotebook(noteRef.current.id);
        if (cancelled) return;
        const doc = rec
          ? decodeDocument(rec.payload)
          : buildNewDocument({ ...DEFAULT_NOTEBOOK_CHOICES, ruling: 'ruled-narrow', cover: 'none', type: 'notebook' }, titleRef.current || 'Sem título');
        const toolState = toolStateFrom();
        const palette = [...PALETTE];
        host.replaceChildren();
        const root = host.createDiv({ cls: 'goodobsidian-view' });
        const addPage = (afterIndex: number, animate = false) => {
          const insert = pageToInsertAfter(surface!.document, afterIndex);
          if (!insert) return;
          surface!.applyCommand(new AddPage(insert.index, insert.page));
          surface!.goToPage(insert.index, animate);
          requestSave();
        };
        // Tipos de página: o "+" da barra e o da barra lateral abrem o seletor do FineNotes; o último usado fica lembrado.
        let addPop: { popover: AddPagePopover; anchor: HTMLElement } | null = null;
        let coverPop: { popover: CoverPopover; anchor: HTMLElement } | null = null;
        const RECENT = 'goodobsidian:recent-templates';
        const recents = (): SyntheticBackdrop[] => { try { return parseRecent(JSON.parse(localStorage.getItem(RECENT) ?? '[]')); } catch { return []; } };
        const remember = (b: SyntheticBackdrop) => { try { localStorage.setItem(RECENT, JSON.stringify(pushRecent(recents(), b))); } catch { /* sem armazenamento */ } };
        const addTemplatePage = (backdrop: SyntheticBackdrop, geometry: PageGeometry, position: InsertPosition, ref: number) => {
          if (!surface) return;
          const index = insertIndexFor(position, ref, surface.document.pages.length);
          const insert = pageFromTemplate(surface.document, index, backdrop, geometry);
          surface.applyCommand(new AddPage(insert.index, insert.page));
          surface.goToPage(insert.index, true);
          remember(backdrop);
          requestSave();
        };
        const openTemplatePicker = (mode: 'add' | 'change', ref: number, position: InsertPosition) => {
          const page = surface?.document.pages[ref];
          if (!surface || !page) return;
          const reference = mode === 'add' ? paperTemplateFor(surface.document.pages, ref) : page.backdrop;
          new TemplatePickerModal(app as never, {
            mode,
            initial: reference.kind === 'pdf' ? { kind: 'blank' } : reference,
            geometry: page.geometry,
            onApply: ({ backdrop, geometry }) => {
              if (mode === 'add') { addTemplatePage(backdrop, geometry ?? page.geometry, position, ref); return; }
              apply(new SetPageTemplate(page, backdrop, geometry ?? undefined));
              remember(backdrop);
            },
          }).open();
        };
        const openAddPage = (anchor: HTMLElement, ref: number, position: InsertPosition) => {
          const open = addPop; addPop = null;
          if (open?.popover.isOpen) { open.popover.close(); if (open.anchor === anchor) return; }
          const doc2 = surface?.document;
          if (!doc2) return;
          const at = Math.max(0, Math.min(doc2.pages.length - 1, ref));
          const page = doc2.pages[at];
          if (!page) return;
          const popover = new AddPagePopover(anchor, {
            current: paperTemplateFor(doc2.pages, at),
            geometry: page.geometry,
            recent: recents(),
            position,
            onPick: (backdrop, where) => addTemplatePage(backdrop, page.geometry, where, ref),
            onMore: (where) => openTemplatePicker('add', ref, where),
          });
          addPop = { popover, anchor };
        };
        const openCoverPicker = (anchor: HTMLElement, index: number) => {
          const open = coverPop; coverPop = null;
          if (open?.popover.isOpen) { open.popover.close(); if (open.anchor === anchor) return; }
          const page = surface?.document.pages[index];
          if (!surface || !page || page.backdrop.kind === 'pdf' || !isCoverRuling(page.backdrop.kind)) return;
          const popover = new CoverPopover(anchor, {
            backdrop: page.backdrop,
            geometry: page.geometry,
            onPick: (backdrop) => {
              const now = page.backdrop;
              if (now.kind !== 'pdf' && now.kind === backdrop.kind && now.paperColor === backdrop.paperColor) return;
              const command = changeCover(page, backdrop);
              if (command) surface?.applyCommand(command);
            },
          });
          coverPop = { popover, anchor };
        };
        const toggleSidebar = () => {
          if (!sidebar) return;
          const before = surface?.pageClientRect() ?? null;
          const open = sidebar.toggle(true);
          if (open) sidebar.setCurrentPage(surface?.currentPage ?? 0);
          toolbar?.setThumbnailsOpen(open, open ? sidebar.el.offsetWidth : 0);
          surface?.layout();
          if (before) surface?.glideFrom(before, PANEL_SLIDE_MS);
        };
        const apply = (command: Command) => { surface?.applyCommand(command); requestSave(); };
        const pageAction = (action: PageAction, index: number, anchor: HTMLElement) => {
          const sf = surface; if (!sf) return;
          const doc2 = sf.document, page = doc2.pages[index];
          if (!page) return;
          switch (action) {
            case 'add-before': case 'add-after': openAddPage(anchor, index, action === 'add-before' ? 'before' : 'after'); return;
            case 'change-template': openTemplatePicker('change', index, 'after'); return;
            case 'change-cover': openCoverPicker(anchor, index); return;
            case 'bookmark': apply(new SetPageBookmark(page, page.bookmarked !== true)); return;
            case 'contents':
              new ContentsTitleModal(app as never, index, page.title, (title) => { if (sf.document.pages.includes(page)) apply(new SetPageTitle(page, title)); }).open();
              return;
            case 'contents-remove': if (page.title !== undefined) apply(new SetPageTitle(page, null)); return;
            case 'duplicate': { const copy = duplicatePageAfter(doc2, index); if (copy) { sf.applyCommand(new AddPage(copy.index, copy.page)); sf.goToPage(copy.index, true); requestSave(); } return; }
            case 'move-up': case 'move-down': {
              const to = action === 'move-up' ? index - 1 : index + 1;
              if (to < 0 || to >= doc2.pages.length) return;
              sf.applyCommand(new MovePage(index, to)); sf.goToPage(to, true); requestSave(); return;
            }
            case 'clear': if (page.strokes.length) apply(new ClearPage(page.id)); return;
            case 'delete':
              if (doc2.pages.length <= 1) return;
              sf.applyCommand(new RemovePage(index)); sf.goToPage(Math.min(index, doc2.pages.length - 1)); requestSave();
              new Notice(`Página ${index + 1} excluída. Desfazer (Cmd/Ctrl+Z) traz de volta.`);
              return;
            default: new Notice('Esta opção ainda não está disponível no ToDaHORA.');
          }
        };
        const openSearch = () => {
          if (!surface) return;
          new NotebookSearchModal(app as never, {
            index: collectPageText(surface.document.pages, null, null),
            initial: lastSearch,
            onQuery: (q) => { lastSearch = q; },
            goTo: (i) => surface?.goToPage(i, true),
          }).open();
        };
        const openNoteSettings = () => {
          new NoteSettingsModal(app as never, {
            single: surface?.document.single === true,
            folders: () => ({ ...(surface?.document.folders ?? {}) }),
            setFolder: (kind, folder) => apply(new SetAttachmentFolder(kind, folder)),
            scrollDirection: () => scrollDirectionOf(surface!.document),
            setScrollDirection: (direction) => apply(new SetScrollDirection(direction)),
          }).open();
        };
        toolbar = new Toolbar(root, palette, SIZES, toolState, {
          onToggleThumbnails: toggleSidebar,
          onSearch: openSearch,
          onSettings: openNoteSettings,
          returnToPenOnReselect: () => false,
          onToolChange: (tool) => surface?.setTool(tool),
          onColorChange: ignore,
          onSizeChange: ignore,
          onPressureToggle: ignore,
          pressureAllowed: () => true,
          onUndo: () => surface?.undo(),
          onRedo: () => surface?.redo(),
          onClear: () => { if (surface?.clearStrokes()) requestSave(); },
          onAddPage: (anchor) => openAddPage(anchor, surface?.currentPage ?? 0, 'after'),
          onPenTypeChange: () => toolbar?.syncActive(),
          onTextStyle: (patch) => surface?.applyTextStyle(patch),
          onTextList: (kind) => void surface?.applyTextList(kind),
          onTextDelete: () => void surface?.deleteEditingTextBox(),
        }, { defaultSize: DEFAULT_SETTINGS.defaultSize });
        const body = root.createDiv({ cls: 'goodobsidian-body' });
        const backdrops = new VaultBackdropRenderer(null);
        const thumbBackdrops = new VaultBackdropRenderer(null);
        thumbBackdrops.setDeviceScale(thumbnailRasterScale(window.devicePixelRatio || 1));
        sidebar = new PageSidebar(body, {
          onSelectPage: (index) => surface?.goToPage(index, true),
          onPageAction: (action, index, anchor) => pageAction(action, index, anchor),
          onAddPage: (anchor) => openAddPage(anchor, surface!.document.pages.length - 1, 'last'),
          onClose: () => { if (sidebar?.isOpen) toggleSidebar(); },
        }, { painter: thumbBackdrops, paper: paperTheme(false), usePressure: toolState.pressureEnabled, highlighterAlpha: DEFAULT_SETTINGS.highlighterAlpha });
        sidebar.setDocument(doc);
        surface = new InkSurface(body, doc, toolState, {
          desynchronizedCanvas: DEFAULT_SETTINGS.desynchronizedCanvas,
          highlighterAlpha: DEFAULT_SETTINGS.highlighterAlpha,
          debug: false,
          palette,
        }, {
          onChange: () => { if (surface) sidebar?.setDocument(surface.document); requestSave(); },
          onPageChange: (index) => sidebar?.setCurrentPage(index),
          onToolChange: () => toolbar?.setState(toolState),
          onHistoryChange: (canUndo, canRedo) => toolbar?.setHistoryState(canUndo, canRedo),
          onAddPageRequested: (afterIndex) => addPage(afterIndex, true),
          onPullAddPage: () => addPage(surface!.document.pages.length - 1, true),
          onTextEditing: (style) => toolbar?.setTextTarget(style),
        });
        surface.setBackdropPainter(backdrops);
        setStatus('salvo');
        if (!rec) requestSave();
      } catch (e) {
        console.error('[anotações] falha ao abrir o caderno', e);
        setError(e instanceof Error ? e.message : String(e));
        setStatus('erro');
      }
    })();

    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (surface?.handleKeyDown(e)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => surface?.handleKeyUp(e);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const ro = new ResizeObserver(() => surface?.layout());
    ro.observe(host);

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      ro.disconnect();
      void save();
      try { surface?.destroy(); toolbar?.destroy(); } catch { /* a tela já foi desmontada */ }
      host.replaceChildren();
      document.body.classList.remove(...bodyClasses);
    };
  }, [note.id]);

  const close = async () => { await flushRef.current(); onClose(); };

  return (
    <div className="fn-host" role="dialog" aria-label="Caderno">
      <div className="fn-topbar">
        <button type="button" onClick={close}>Voltar</button>
        <input className="fn-title" value={title} onChange={(e) => { setTitle(e.target.value); }} onBlur={() => metaRef.current({ ...noteRef.current, title: titleRef.current, kind: 'finenotes', updatedAt: Date.now() })} aria-label="Título do caderno" placeholder="Sem título" />
        <span className="fn-state" role="status">{status === 'salvando' ? 'Salvando...' : status === 'erro' ? 'Não foi possível salvar' : status === 'carregando' ? 'Abrindo...' : 'Salvo'}</span>
      </div>
      {error && <p style={{ padding: 16, color: 'var(--text-error)' }}>Não foi possível abrir o caderno: {error}</p>}
      <div ref={hostRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} />
    </div>
  );
};

export default FineNotesHost;
