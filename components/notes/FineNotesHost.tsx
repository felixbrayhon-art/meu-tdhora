import React, { useEffect, useRef, useState } from 'react';
import '../../vendor/finenotes/styles.css';
import '../../vendor/finenotes-shim/theme.css';
import { Platform } from '../../vendor/finenotes-shim/obsidian';
import { InkSurface } from '../../vendor/finenotes/src/view/ink-surface';
import { Toolbar, type ToolbarState } from '../../vendor/finenotes/src/view/toolbar';
import { PALETTE, SIZES } from '../../vendor/finenotes/src/constants';
import { DEFAULT_SETTINGS } from '../../vendor/finenotes/src/settings-data';
import { DEFAULT_NOTEBOOK_CHOICES, buildNewDocument } from '../../vendor/finenotes/src/model/new-notebook';
import { DocumentEncoder, decodeDocument } from '../../vendor/finenotes/src/model/serialize';
import { AddPage } from '../../vendor/finenotes/src/model/commands';
import { pageToInsertAfter } from '../../vendor/finenotes/src/model/page-commands';
import { penGesturesOf } from '../../vendor/finenotes/src/ink/pen-gestures';
import { eraserFilterOf } from '../../vendor/finenotes/src/ink/stroke-eraser';
import { lassoFilterOf, lassoModeOf } from '../../vendor/finenotes/src/canvas/lasso';
import { sanitizeTextStyle } from '../../vendor/finenotes/src/model/text-style';
import { DEFAULT_SHAPE_COLOR, parseHexColor, recentColorsOf } from '../../vendor/finenotes/src/model/colors';
import { loadFnNotebook, saveFnNotebook } from '../../services/ink/store';
import type { HandwrittenNote } from '../../types';

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

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let surface: InkSurface | null = null;
    let toolbar: Toolbar | null = null;
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
        toolbar = new Toolbar(root, palette, SIZES, toolState, {
          returnToPenOnReselect: () => false,
          onToolChange: (tool) => surface?.setTool(tool),
          onColorChange: ignore,
          onSizeChange: ignore,
          onPressureToggle: ignore,
          pressureAllowed: () => true,
          onUndo: () => surface?.undo(),
          onRedo: () => surface?.redo(),
          onClear: () => { if (surface?.clearStrokes()) requestSave(); },
          onAddPage: () => addPage(surface?.currentPage ?? 0),
          onPenTypeChange: () => toolbar?.syncActive(),
          onTextStyle: (patch) => surface?.applyTextStyle(patch),
          onTextList: (kind) => void surface?.applyTextList(kind),
          onTextDelete: () => void surface?.deleteEditingTextBox(),
        }, { defaultSize: DEFAULT_SETTINGS.defaultSize });
        const body = root.createDiv({ cls: 'goodobsidian-body' });
        surface = new InkSurface(body, doc, toolState, {
          desynchronizedCanvas: DEFAULT_SETTINGS.desynchronizedCanvas,
          highlighterAlpha: DEFAULT_SETTINGS.highlighterAlpha,
          debug: false,
          palette,
        }, {
          onChange: requestSave,
          onToolChange: () => toolbar?.setState(toolState),
          onHistoryChange: (canUndo, canRedo) => toolbar?.setHistoryState(canUndo, canRedo),
          onAddPageRequested: (afterIndex) => addPage(afterIndex, true),
          onPullAddPage: () => addPage(surface!.document.pages.length - 1, true),
          onTextEditing: (style) => toolbar?.setTextTarget(style),
        });
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
