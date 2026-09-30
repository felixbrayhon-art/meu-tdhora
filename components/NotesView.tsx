import React, { useEffect, useRef, useState } from 'react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { PenLine, Trash2, Plus, X, Folder, FolderPlus, Check, ChevronLeft, MoreVertical, CheckSquare, Pencil } from './icons';
import { HandwrittenNote, NoteFolder, NotePaperStyle, NotePenPreset } from '../types';
import Folder3D from './Folder3D';
import StudyBook3D from './StudyBook3D';

interface NotesViewProps {
  notes: HandwrittenNote[];
  folders: NoteFolder[];
  onSave: (note: HandwrittenNote) => void;
  onDelete: (id: string) => void;
  onCreateFolder: (name: string, color: string) => void;
  onUpdateFolderColor?: (id: string, color: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameFolder?: (id: string, name: string) => void;
  onBack: () => void;
}

// Sentinel folder id for the "loose notes" group shown alongside real
// folders at the root of the gallery (notes with no folderId).
const NONE_FOLDER = '__none__';

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Notes have no stored byte size — approximated from the serialized scene
// data, which is close enough for a "how much is in this folder" hint.
const estimateNoteSize = (note: HandwrittenNote): number => {
  try {
    return JSON.stringify(note.excalidrawElements ?? []).length + JSON.stringify(note.excalidrawFiles ?? {}).length;
  } catch {
    return 0;
  }
};

const formatDate = (ts: number): string =>
  new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const FOLDER_COLORS = ['#f59e0b', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899'];

// Excalidraw has no built-in notebook-paper backgrounds, so these render as a
// CSS layer behind its (transparent) canvas instead. Line thickness is a %
// of the tile rather than a fixed px so it scales naturally with zoom — the
// tile's pixel size itself is set dynamically from Excalidraw's zoom level.
const PAPER_STYLES: { id: NotePaperStyle; label: string; description: string; backgroundImage: string; tileSize: number }[] = [
  { id: 'grid', label: 'Quadriculado', description: 'Ótimo para gráficos, tabelas e exatas.', tileSize: 28,
    backgroundImage: 'linear-gradient(to right, #E2E8F0 0, #E2E8F0 4%, transparent 4%), linear-gradient(to bottom, #E2E8F0 0, #E2E8F0 4%, transparent 4%)' },
  { id: 'lines', label: 'Pautado', description: 'Estilo caderno tradicional com margem vermelha.', tileSize: 22,
    backgroundImage: 'linear-gradient(to bottom, #BFDBFE 0, #BFDBFE 5%, transparent 5%)' },
  { id: 'dots', label: 'Pontilhado', description: 'Ideal para Bullet Journaling e diagramas.', tileSize: 24,
    backgroundImage: 'radial-gradient(circle, #9CA3AF 7%, transparent 7%)' },
  { id: 'blank', label: 'Em Branco', description: 'Folha limpa de rascunho.', tileSize: 28, backgroundImage: 'none' },
];

const PEN_PRESETS: { id: NotePenPreset; label: string; description: string; width: number; opacity: number; roughness: number; constantPressure?: boolean }[] = [
  { id: 'ballpoint', label: 'Esferográfica', description: 'Traço regular para escrita diária.', width: 2, opacity: 100, roughness: 0 },
  { id: 'fineliner', label: 'Ponta fina', description: 'Traço leve e preciso para detalhes.', width: 1, opacity: 100, roughness: 0 },
  { id: 'pencil', label: 'Lápis', description: 'Traço suave para rascunhos.', width: 2, opacity: 55, roughness: 1 },
  { id: 'monoline', label: 'Monolinha', description: 'Largura constante; ignora a pressão da Apple Pencil.', width: 2, opacity: 100, roughness: 0, constantPressure: true },
  { id: 'highlighter', label: 'Marca-texto', description: 'Traço largo e translúcido para destacar.', width: 12, opacity: 35, roughness: 0 },
  { id: 'brush', label: 'Pincel', description: 'Traço encorpado para títulos e ênfase.', width: 7, opacity: 90, roughness: 0 },
];

const NOTE_INK_COLORS = [
  { name: 'Grafite', value: '#473c33' },
  { name: 'Preto', value: '#171717' },
  { name: 'Branco', value: '#ffffff' },
  { name: 'Laranja', value: '#ec6300' },
  { name: 'Amarelo', value: '#e5aa00' },
  { name: 'Verde', value: '#64834a' },
  { name: 'Azul', value: '#2878c7' },
  { name: 'Vermelho', value: '#d83b32' },
  { name: 'Roxo', value: '#8055a5' },
  { name: 'Rosa', value: '#cf4f7b' },
];

const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const NoteEditor: React.FC<{
  note: HandwrittenNote;
  folders: NoteFolder[];
  onSave: (note: HandwrittenNote) => void;
  onClose: () => void;
}> = ({ note, folders, onSave, onClose }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawAPIRef = useRef<any>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const excalidrawWrapperRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(note.title);
  const [folderId, setFolderId] = useState(note.folderId ?? '');
  const [coverColor, setCoverColor] = useState(note.color || '#f97316');
  const [paperStyle, setPaperStyle] = useState<NotePaperStyle>(note.paperStyle ?? 'blank');
  const [showPaperMenu, setShowPaperMenu] = useState(false);
  const [penPreset, setPenPreset] = useState<NotePenPreset>(note.penPreset ?? 'ballpoint');
  const [showPenMenu, setShowPenMenu] = useState(false);
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const initialPenPreset = PEN_PRESETS.find(preset => preset.id === (note.penPreset ?? 'ballpoint')) ?? PEN_PRESETS[0];
  const [strokeColor, setStrokeColor] = useState(() => typeof note.excalidrawAppState?.currentItemStrokeColor === 'string' ? note.excalidrawAppState.currentItemStrokeColor : '#473c33');
  const [strokeWidth, setStrokeWidth] = useState(() => typeof note.excalidrawAppState?.currentItemStrokeWidth === 'number' ? note.excalidrawAppState.currentItemStrokeWidth : initialPenPreset.width);
  const [strokeOpacity, setStrokeOpacity] = useState(() => typeof note.excalidrawAppState?.currentItemOpacity === 'number' ? note.excalidrawAppState.currentItemOpacity : initialPenPreset.opacity);
  const [showColorPanel, setShowColorPanel] = useState(false);
  const activePaper = PAPER_STYLES.find(p => p.id === paperStyle)!;

  // Keep Excalidraw's next-stroke settings in sync with the visible controls,
  // including when its API becomes ready just after the editor toolbar.
  useEffect(() => {
    excalidrawAPIRef.current?.updateScene({ appState: {
      currentItemStrokeColor: strokeColor,
      currentItemStrokeWidth: strokeWidth,
      currentItemOpacity: strokeOpacity,
    } });
  }, [strokeColor, strokeWidth, strokeOpacity]);

  // iPad-specific workaround for a known, currently-open upstream Excalidraw
  // bug (not something a prop fixes): palm rejection
  // (github.com/excalidraw/excalidraw#6088) — resting a hand while writing
  // with Apple Pencil still draws stray marks. We intercept touch pointer
  // events ourselves, in the capture phase (before Excalidraw's own handlers
  // see them), and swallow single-finger touch input for a short window
  // after the pen was last active — mirrors the same palm-rejection
  // convention (GoodNotes/Notability) built earlier for the old canvas
  // engine. Multi-touch (2+ fingers, for pinch/pan) is still let through.
  useEffect(() => {
    const wrapper = excalidrawWrapperRef.current;
    if (!wrapper) return;

    let hasStylus = false;
    let penActiveUntil = 0;
    const activeTouches = new Set<number>();
    const blockedPointerIds = new Set<number>();

    // Two-finger tap → undo (the Notability/GoodNotes shortcut): if exactly
    // two touches land and both lift again quickly without traveling far,
    // treat it as "undo" instead of a real canvas gesture. A third finger
    // joining, or either finger moving past the threshold, cancels it —
    // that's a real pinch/pan, not a tap.
    const TAP_MAX_MS = 300;
    const TAP_MAX_MOVE_PX = 12;
    let tapGesture: { startTime: number; positions: Map<number, { x: number; y: number }> } | null = null;

    // Excalidraw's imperative API only exposes history.clear(), not an
    // undo() call — dispatching its own Ctrl/Cmd+Z shortcut is the
    // documented workaround for triggering undo from outside the canvas.
    const triggerUndo = () => {
      const ev = new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', keyCode: 90, which: 90, ctrlKey: true, metaKey: true, bubbles: true, cancelable: true });
      wrapper.dispatchEvent(ev);
    };

    const onPointerCapture = (e: PointerEvent) => {
      if (e.pointerType === 'pen') {
        // Excalidraw treats exactly 0.5 as a device without pressure and then
        // simulates width from drawing speed. Keep a slightly lower, constant
        // value instead so monoline strokes use a uniform pressure at every point.
        if (wrapper.dataset.constantPressure === 'true' && (e.type === 'pointerdown' || e.type === 'pointermove')) {
          try {
            Object.defineProperty(e, 'pressure', { configurable: true, value: 0.49 });
          } catch {
            // If a browser exposes a non-configurable event, leave native input intact.
          }
        }
        hasStylus = true;
        penActiveUntil = Date.now() + 500;
        return;
      }
      if (e.pointerType !== 'touch') return;

      if (e.type === 'pointerdown') {
        activeTouches.add(e.pointerId);
        const inGraceWindow = hasStylus && Date.now() < penActiveUntil;
        if (inGraceWindow && activeTouches.size === 1) {
          blockedPointerIds.add(e.pointerId);
        }
        if (activeTouches.size === 2 && blockedPointerIds.size === 0) {
          tapGesture = { startTime: Date.now(), positions: new Map() };
          activeTouches.forEach((id) => tapGesture!.positions.set(id, { x: e.clientX, y: e.clientY }));
        } else if (activeTouches.size > 2) {
          tapGesture = null;
        }
      }

      if (e.type === 'pointermove' && tapGesture?.positions.has(e.pointerId)) {
        const start = tapGesture.positions.get(e.pointerId)!;
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_MAX_MOVE_PX) {
          tapGesture = null;
        }
      }

      if (blockedPointerIds.has(e.pointerId)) {
        e.stopPropagation();
        e.preventDefault();
        if (e.type === 'pointerup' || e.type === 'pointercancel') {
          blockedPointerIds.delete(e.pointerId);
          activeTouches.delete(e.pointerId);
        }
        return;
      }
      if (e.type === 'pointerup' || e.type === 'pointercancel') {
        if (e.type === 'pointerup' && tapGesture?.positions.has(e.pointerId) && Date.now() - tapGesture.startTime <= TAP_MAX_MS) {
          triggerUndo();
        }
        tapGesture = null;
        activeTouches.delete(e.pointerId);
      }
    };

    // The hamburger main menu (.dropdown-menu) still has the same
    // "doesn't close on an outside tap" issue as before
    // (github.com/excalidraw/excalidraw#11434-adjacent) — only re-clicking
    // its own trigger does. The color/stroke panel is handled separately
    // now (plain React state, closed by the click-outside-of-our-own-toggle
    // logic further down), so this only needs to know about the menu.
    const onTapMaybeClosesMenu = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const menu = wrapper.querySelector('.dropdown-menu');
      if (menu && !menu.contains(target) && !target.closest('.main-menu-trigger')) {
        wrapper.querySelector<HTMLButtonElement>('.main-menu-trigger')?.click();
      }
    };

    wrapper.addEventListener('pointerdown', onPointerCapture, { capture: true });
    wrapper.addEventListener('pointermove', onPointerCapture, { capture: true });
    wrapper.addEventListener('pointerup', onPointerCapture, { capture: true });
    wrapper.addEventListener('pointercancel', onPointerCapture, { capture: true });
    // On document, not wrapper: the menu-dismiss tap needs to catch clicks
    // on our OWN header (title/folder/paper-style/Salvar), which sits
    // outside the Excalidraw wrapper entirely.
    document.addEventListener('pointerdown', onTapMaybeClosesMenu);

    // Tracks whether the hamburger menu is open so we can render our own
    // explicit X on top of it (outside-tap-closes isn't discoverable enough
    // on its own) — watches the DOM instead of hooking Excalidraw's state,
    // since none of that is exposed through its public API.
    const menuObserver = new MutationObserver(() => {
      setMainMenuOpen(!!wrapper.querySelector('.dropdown-menu'));
    });
    menuObserver.observe(wrapper, { childList: true, subtree: true });

    return () => {
      wrapper.removeEventListener('pointerdown', onPointerCapture, { capture: true });
      wrapper.removeEventListener('pointermove', onPointerCapture, { capture: true });
      wrapper.removeEventListener('pointerup', onPointerCapture, { capture: true });
      wrapper.removeEventListener('pointercancel', onPointerCapture, { capture: true });
      document.removeEventListener('pointerdown', onTapMaybeClosesMenu);
      menuObserver.disconnect();
    };
  }, []);

  // Close the custom pen settings popover when the user taps elsewhere.
  useEffect(() => {
    if (!showColorPanel) return;
    const onTapOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-pen-settings]')) return;
      setShowColorPanel(false);
    };
    document.addEventListener('pointerdown', onTapOutside);
    return () => document.removeEventListener('pointerdown', onTapOutside);
  }, [showColorPanel]);

  // Keeps the CSS paper pattern visually anchored to the canvas content as
  // the user pans/zooms Excalidraw — written straight to the DOM (not React
  // state) since onChange fires on every pointer move, including on every
  // single point added while actively drawing a stroke. Writing to
  // el.style unconditionally on each of those calls forces a style
  // recalc even when scroll/zoom haven't actually changed (the overwhelming
  // majority of calls during a stroke) — that's what was making drawing
  // itself feel laggy. Skip the write entirely unless something moved.
  const lastViewRef = useRef({ scrollX: NaN, scrollY: NaN, zoom: NaN });
  const handleExcalidrawChange = (_elements: unknown, appState: { scrollX: number; scrollY: number; zoom: { value: number } }) => {
    if (activePaper.backgroundImage === 'none') return;
    const zoom = appState.zoom?.value ?? 1;
    const last = lastViewRef.current;
    if (last.scrollX === appState.scrollX && last.scrollY === appState.scrollY && last.zoom === zoom) return;
    last.scrollX = appState.scrollX;
    last.scrollY = appState.scrollY;
    last.zoom = zoom;
    const el = bgRef.current;
    if (!el) return;
    const size = activePaper.tileSize * zoom;
    el.style.backgroundSize = `${size}px ${size}px`;
    el.style.backgroundPosition = `${appState.scrollX * zoom}px ${appState.scrollY * zoom}px`;
  };

  const handleSaveAndClose = async () => {
    const api = excalidrawAPIRef.current;
    let elements = note.excalidrawElements ?? [];
    let appState = note.excalidrawAppState;
    let files = note.excalidrawFiles;
    let thumbnail = note.thumbnail;

    if (api) {
      const sceneElements = api.getSceneElements();
      const fullAppState = api.getAppState();
      elements = sceneElements;
      // Only the safe/serializable slice — the full appState carries things
      // like a Map (collaborators) that don't survive JSON persistence.
      appState = {
        viewBackgroundColor: fullAppState.viewBackgroundColor,
        scrollX: fullAppState.scrollX,
        scrollY: fullAppState.scrollY,
        zoom: fullAppState.zoom,
        currentItemStrokeColor: fullAppState.currentItemStrokeColor,
        currentItemStrokeWidth: fullAppState.currentItemStrokeWidth,
        currentItemStrokeStyle: fullAppState.currentItemStrokeStyle,
        currentItemRoughness: fullAppState.currentItemRoughness,
        currentItemOpacity: fullAppState.currentItemOpacity,
      };
      files = api.getFiles();
      try {
        const blob = await exportToBlob({ elements: sceneElements, appState: fullAppState, files, mimeType: 'image/png' });
        thumbnail = await blobToDataURL(blob);
      } catch {
        // Thumbnail is a nice-to-have — an empty/failed export shouldn't block saving.
      }
    }

    onSave({
      ...note,
      title: title.trim() || 'Sem título',
      color: coverColor,
      folderId: folderId || undefined,
      paperStyle,
      penPreset,
      excalidrawElements: elements,
      excalidrawAppState: appState,
      excalidrawFiles: files,
      thumbnail,
      updatedAt: Date.now(),
    });
    onClose();
  };

  const applyPenPreset = (preset: typeof PEN_PRESETS[number]) => {
    setPenPreset(preset.id);
    setStrokeWidth(preset.width);
    setStrokeOpacity(preset.opacity);
    setShowPenMenu(false);
    const api = excalidrawAPIRef.current;
    if (!api) return;

    api.updateScene({
      appState: {
        currentItemStrokeWidth: preset.width,
        currentItemOpacity: preset.opacity,
        currentItemRoughness: preset.roughness,
        currentItemStrokeStyle: 'solid',
      },
    });
    api.setActiveTool({ type: 'freedraw', customType: null });
  };

  const updateStrokeColor = (color: string) => {
    setStrokeColor(color);
    excalidrawAPIRef.current?.updateScene({ appState: { currentItemStrokeColor: color } });
  };

  const updateStrokeWidth = (width: number) => {
    setStrokeWidth(width);
    excalidrawAPIRef.current?.updateScene({ appState: { currentItemStrokeWidth: width } });
  };

  const updateStrokeOpacity = (opacity: number) => {
    setStrokeOpacity(opacity);
    excalidrawAPIRef.current?.updateScene({ appState: { currentItemOpacity: opacity } });
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-white flex flex-col">
      <div className="relative z-20 bg-white px-3 sm:px-4 lg:px-6 py-3 shadow-sm border-b border-gray-100 flex-shrink-0 flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-3">
        <button aria-label="Salvar e fechar anotação" onClick={handleSaveAndClose} className="order-1 inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0 touch-manipulation">
          <X className="w-6 h-6 text-gray-500" />
        </button>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Título da anotação"
          aria-label="Título da anotação"
          className="order-2 flex-1 min-w-[7rem] text-lg sm:text-xl font-black text-gray-900 focus:outline-none bg-transparent"
        />
        <div className="order-4 lg:order-3 basis-full lg:basis-auto min-w-0 flex flex-wrap items-center gap-2 pb-1 lg:pb-0">
          <input
            type="color"
            value={coverColor}
            onChange={e => setCoverColor(e.target.value)}
            aria-label="Cor da capa da anotação"
            title="Cor da capa da anotação"
            className="h-11 w-11 cursor-pointer rounded-xl border border-gray-200 bg-white p-1 flex-shrink-0 touch-manipulation"
          />
          <div data-pen-settings className="relative flex-shrink-0">
            <button
              data-testid="color-panel-toggle"
              onClick={() => setShowColorPanel(v => !v)}
              aria-label="Cor, espessura e opacidade da caneta"
              aria-haspopup="dialog"
              aria-controls="note-pen-settings-panel"
              aria-expanded={showColorPanel}
              className={`inline-flex h-11 items-center gap-2 rounded-xl border px-2.5 transition-colors flex-shrink-0 touch-manipulation ${showColorPanel ? 'border-[#fdad74] bg-[#fff1e8]' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              title="Cor, espessura e opacidade da caneta"
            >
              <span className="h-5 w-5 rounded-full border border-black/15 shadow-inner" style={{ backgroundColor: strokeColor }} />
              <span className="hidden sm:inline text-[11px] font-bold text-gray-600">Traço</span>
            </button>
            {showColorPanel && (
              <section id="note-pen-settings-panel" role="dialog" aria-label="Ajustes do traço" className="absolute left-0 top-full z-[1170] mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-[#e8deca] bg-white p-4 text-[#473c33] shadow-2xl sm:w-80">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black">Ajustes do traço</h2>
                    <p className="mt-0.5 text-[11px] text-[#8a7968]">Ajuste o próximo traço sem interromper a escrita.</p>
                  </div>
                  <button type="button" aria-label="Fechar ajustes do traço" onClick={() => setShowColorPanel(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#725442] hover:bg-[#f4ebdd] touch-manipulation"><X className="h-4 w-4" /></button>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#8a7968]">Cor da caneta</span>
                    <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e8deca] px-2 text-[10px] font-bold text-[#725442] touch-manipulation">
                      <input type="color" value={strokeColor} onChange={e => updateStrokeColor(e.target.value)} aria-label="Escolher cor personalizada" className="h-7 w-7 cursor-pointer rounded-md border-0 bg-transparent p-0" />
                      Personalizar
                    </label>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {NOTE_INK_COLORS.map(color => (
                      <button
                        key={color.value}
                        type="button"
                        aria-label={color.name}
                        aria-pressed={strokeColor.toLowerCase() === color.value}
                        onClick={() => updateStrokeColor(color.value)}
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition-transform touch-manipulation ${strokeColor.toLowerCase() === color.value ? 'scale-105 ring-2 ring-[#ec6300] ring-offset-2' : 'border-black/10 hover:scale-105'}`}
                        style={{ backgroundColor: color.value }}
                      >
                        {strokeColor.toLowerCase() === color.value && <Check className={`h-4 w-4 ${['#ffffff', '#eee7cf', '#e5aa00'].includes(color.value) ? 'text-[#473c33]' : 'text-white'}`} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-[#faf7f0] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor="note-stroke-width" className="text-xs font-bold">Espessura</label>
                    <output htmlFor="note-stroke-width" className="min-w-12 rounded-full bg-white px-2 py-1 text-center text-[11px] font-black tabular-nums">{strokeWidth}px</output>
                  </div>
                  <input id="note-stroke-width" type="range" min="1" max="16" step="1" value={strokeWidth} onChange={e => updateStrokeWidth(Number(e.target.value))} className="h-11 w-full accent-[#ec6300] touch-manipulation" />
                  <div className="mt-1 flex items-center justify-between text-[10px] text-[#8a7968]"><span>Fina</span><span>Grossa</span></div>
                  <div className="mt-3 mb-2 flex items-center justify-between gap-3">
                    <label htmlFor="note-stroke-opacity" className="text-xs font-bold">Opacidade</label>
                    <output htmlFor="note-stroke-opacity" className="min-w-12 rounded-full bg-white px-2 py-1 text-center text-[11px] font-black tabular-nums">{strokeOpacity}%</output>
                  </div>
                  <input id="note-stroke-opacity" type="range" min="10" max="100" step="5" value={strokeOpacity} onChange={e => updateStrokeOpacity(Number(e.target.value))} className="h-11 w-full accent-[#ec6300] touch-manipulation" />
                  <div className="mt-1 flex items-center justify-between text-[10px] text-[#8a7968]"><span>Transparente</span><span>Sólida</span></div>
                </div>
                <div className="mt-3 flex min-h-10 items-center gap-3 rounded-xl border border-[#eee6d6] px-3 py-2.5">
                  <span className="flex-1 rounded-full" style={{ backgroundColor: strokeColor, opacity: strokeOpacity / 100, height: `${Math.min(strokeWidth, 14)}px` }} />
                  <span className="text-[10px] font-bold text-[#8a7968]">Prévia</span>
                </div>
              </section>
            )}
          </div>
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowPenMenu(v => !v)}
              aria-label={`Tipo de caneta: ${PEN_PRESETS.find(p => p.id === penPreset)?.label ?? 'Esferográfica'}`}
              aria-expanded={showPenMenu}
              className={`inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border px-2.5 text-xs font-bold transition-colors sm:px-3 touch-manipulation ${showPenMenu ? 'border-[#fdad74] bg-[#fff1e8] text-[#c85d27]' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Escolher tipo de caneta"
            >
              <PenLine className="h-4 w-4" />
              <span className="hidden md:inline">{PEN_PRESETS.find(p => p.id === penPreset)?.label ?? 'Caneta'}</span>
            </button>
            {showPenMenu && (
              <>
                <div className="fixed inset-0 z-[1150]" onClick={() => setShowPenMenu(false)} />
                <div role="menu" aria-label="Tipos de caneta" className="absolute left-0 sm:left-auto sm:right-0 top-full z-[1160] mt-2 max-h-[min(70vh,28rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-[20px] border border-gray-100 bg-white p-2 shadow-2xl">
                  {PEN_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={penPreset === preset.id}
                      onClick={() => applyPenPreset(preset)}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors touch-manipulation ${penPreset === preset.id ? 'bg-[#fff1e8] text-[#9f491f]' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                        <span className="block rounded-full bg-current" style={{ width: 20, height: Math.max(2, Math.min(preset.width, 8)), opacity: preset.opacity / 100 }} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-black">{preset.label}</span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-gray-400">{preset.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="relative flex-shrink-0">
            <button
              type="button"
              aria-label={`Tipo de folha: ${activePaper.label}`}
              aria-expanded={showPaperMenu}
              onClick={() => setShowPaperMenu(v => !v)}
              className="h-11 w-11 rounded-xl border border-gray-200 overflow-hidden flex-shrink-0 touch-manipulation"
              style={{ backgroundImage: activePaper.backgroundImage, backgroundSize: `${activePaper.tileSize}px ${activePaper.tileSize}px`, backgroundColor: '#fff' }}
              title="Tipo de folha"
            />
            {showPaperMenu && (
              <>
                <div className="fixed inset-0 z-[1150]" onClick={() => setShowPaperMenu(false)} />
                <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-[1160] bg-white rounded-[20px] shadow-2xl border border-gray-100 p-3 grid grid-cols-2 gap-2 w-[min(20rem,calc(100vw-2rem))]">
                  {PAPER_STYLES.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setPaperStyle(p.id); setShowPaperMenu(false); }}
                      className={`flex min-h-11 flex-col items-center gap-1.5 p-2 rounded-2xl transition-colors text-center touch-manipulation ${paperStyle === p.id ? 'bg-[#fff1e8] ring-2 ring-[#fdb887]' : 'hover:bg-gray-50'}`}
                    >
                      <span
                        className="w-full h-12 rounded-xl border border-gray-200"
                        style={{ backgroundImage: p.backgroundImage, backgroundSize: `${p.tileSize}px ${p.tileSize}px`, backgroundColor: '#fff' }}
                      />
                      <span className="text-[10px] font-black uppercase tracking-wide text-gray-700">{p.label}</span>
                      <span className="text-[9px] text-gray-400 leading-tight">{p.description}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <select
            value={folderId}
            onChange={e => setFolderId(e.target.value)}
            aria-label="Pasta da anotação"
            className="min-h-11 min-w-32 flex-1 sm:flex-none bg-gray-100 rounded-xl px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wide focus:outline-none touch-manipulation"
          >
            <option value="">Sem pasta</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleSaveAndClose}
          className="order-3 lg:order-4 ml-auto min-h-11 px-5 sm:px-6 py-2.5 bg-[#fdad74] text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#fda769] transition-colors flex-shrink-0 touch-manipulation"
        >
          Salvar
        </button>
      </div>

      <div className="flex-1 min-h-0 relative bg-white">
        <div
          ref={bgRef}
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: activePaper.backgroundImage, backgroundSize: `${activePaper.tileSize}px ${activePaper.tileSize}px` }}
        />
        {paperStyle === 'lines' && (
          <div className="absolute top-0 bottom-0 left-14 w-px bg-red-300 pointer-events-none" />
        )}
        {/* Use the same color/width controls on every screen size; hide the
            duplicate Excalidraw panel because its touch and desktop layouts
            behave differently and can become difficult to dismiss. */}
        <style>{`.App-mobile-menu, .Island.App-menu__left { display: none !important; }`}</style>
        <div ref={excalidrawWrapperRef} data-constant-pressure={PEN_PRESETS.find(p => p.id === penPreset)?.constantPressure ? 'true' : 'false'} className="notes-excalidraw-surface absolute inset-0">
          <Excalidraw
            langCode="pt-BR"
            excalidrawAPI={api => {
              excalidrawAPIRef.current = api;
              api.updateScene({ appState: { currentItemStrokeColor: strokeColor, currentItemStrokeWidth: strokeWidth, currentItemOpacity: strokeOpacity } });
            }}
            onChange={handleExcalidrawChange as never}
            initialData={{
              // Opaque to our own types (we never inspect these, just store
              // and hand them back) — cast at the boundary where Excalidraw's
              // own types actually need to match.
              elements: (note.excalidrawElements ?? []) as any,
              appState: { ...(note.excalidrawAppState ?? {}), viewBackgroundColor: 'transparent' } as any,
              files: (note.excalidrawFiles ?? {}) as any,
            }}
          />
        </div>
        {mainMenuOpen && (
          <button
            onClick={() => excalidrawWrapperRef.current?.querySelector<HTMLButtonElement>('.main-menu-trigger')?.click()}
            className="absolute top-3 right-3 z-10 inline-flex h-11 w-11 items-center justify-center bg-white rounded-full shadow-md border border-gray-200 text-gray-600 hover:text-red-500 hover:border-red-200 transition-colors touch-manipulation"
            title="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

const NotesView: React.FC<NotesViewProps> = ({ notes, folders, onSave, onDelete, onCreateFolder, onUpdateFolderColor, onDeleteFolder, onRenameFolder, onBack }) => {
  const [editingNote, setEditingNote] = useState<HandwrittenNote | null>(null);
  const [editingCoverNote, setEditingCoverNote] = useState<HandwrittenNote | null>(null);
  const [coverTitle, setCoverTitle] = useState('');
  const [coverColor, setCoverColor] = useState('#f97316');
  // null = root folder list; NONE_FOLDER = the "Sem pasta" group; else a real folder id.
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!rowMenuId) return;
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-note-menu]')) setRowMenuId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRowMenuId(null);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [rowMenuId]);

  const createNote = (folderId?: string) => {
    const note: HandwrittenNote = {
      id: Math.random().toString(36).slice(2, 10),
      title: '',
      folderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setEditingNote(note);
  };

  const confirmCreateFolder = () => {
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim(), newFolderColor);
    setNewFolderName('');
    setCreatingFolder(false);
  };

  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const deleteSelected = () => {
    if (openFolderId === null) selectedIds.forEach(id => onDeleteFolder(id));
    else selectedIds.forEach(id => onDelete(id));
    exitSelection();
  };

  const openFolder = (id: string | null) => { setOpenFolderId(id); exitSelection(); setRowMenuId(null); setCreatingFolder(false); };

  const editNoteCover = (note: HandwrittenNote) => {
    setEditingCoverNote(note);
    setCoverTitle(note.title || '');
    setCoverColor(note.color || '#f97316');
    setRowMenuId(null);
  };

  const saveNoteCover = () => {
    if (!editingCoverNote) return;
    onSave({
      ...editingCoverNote,
      title: coverTitle.trim() || 'Sem título',
      color: coverColor,
      updatedAt: Date.now(),
    });
    setEditingCoverNote(null);
  };

  const unfiledNotes = notes.filter(n => !n.folderId);
  const folderStats = folders.map(f => {
    const items = notes.filter(n => n.folderId === f.id);
    const size = items.reduce((sum, n) => sum + estimateNoteSize(n), 0);
    const lastModified = items.reduce((max, n) => Math.max(max, n.updatedAt), f.createdAt);
    return { folder: f, count: items.length, size, lastModified };
  });

  const currentNotes = openFolderId === null ? [] : openFolderId === NONE_FOLDER ? unfiledNotes : notes.filter(n => n.folderId === openFolderId);
  const currentFolder = folders.find(f => f.id === openFolderId);

  const canSelect = openFolderId === null ? folders.length > 0 : currentNotes.length > 0;
  const activeFolderId = openFolderId !== null && openFolderId !== NONE_FOLDER ? openFolderId : undefined;

  return (
    <section className="relative w-full min-w-0 min-h-[calc(100dvh-12rem)] flex flex-col rounded-[32px] bg-white border border-[#eee6d6] shadow-sm text-[#473c33]">
      <header className="px-4 sm:px-6 xl:px-8 py-6 border-b border-[#eee6d6]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1 basis-60">
            <button
              onClick={() => (openFolderId !== null ? openFolder(null) : onBack())}
              aria-label={openFolderId !== null ? 'Voltar às pastas' : 'Voltar ao painel'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#725442] hover:bg-[#f4ebdd] transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-[#ec6300] touch-manipulation"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="font-logo text-2xl sm:text-3xl flex items-center gap-2">
                {openFolderId === null && <PenLine className="w-6 h-6 text-[#ec6300] shrink-0" />}
                <span className="truncate">{openFolderId === null ? 'Minhas anotações' : openFolderId === NONE_FOLDER ? 'Sem pasta' : currentFolder?.name}</span>
              </h2>
              <p className="text-[#725442] text-sm mt-1">
                {openFolderId === null
                  ? `${folders.length} ${folders.length === 1 ? 'pasta' : 'pastas'} · ${notes.length} ${notes.length === 1 ? 'anotação' : 'anotações'}`
                  : `${currentNotes.length} ${currentNotes.length === 1 ? 'anotação' : 'anotações'}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectionMode ? (
              <>
                <span className="text-sm text-[#725442]">{selectedIds.size} selecionado{selectedIds.size === 1 ? '' : 's'}</span>
                {selectedIds.size > 0 && (
                  <button onClick={deleteSelected} aria-label="Excluir selecionados" className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors touch-manipulation">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button onClick={exitSelection} className="min-h-11 px-4 py-2.5 rounded-xl bg-[#f4ebdd] hover:bg-[#eee6d6] transition-colors font-bold text-sm touch-manipulation">
                  Cancelar seleção
                </button>
              </>
            ) : (
              <>
                {canSelect && (
                  <button onClick={() => setSelectionMode(true)} className="min-h-11 px-3 py-2.5 rounded-xl hover:bg-[#f4ebdd] transition-colors font-bold text-sm flex items-center gap-2 touch-manipulation">
                    <CheckSquare className="w-4 h-4" /> Selecionar
                  </button>
                )}
                {openFolderId === null && (
                  <button onClick={() => { setCreatingFolder(true); setRowMenuId(null); }} className="min-h-11 px-4 py-2.5 rounded-xl border border-[#eee6d6] hover:bg-[#f4ebdd] transition-colors font-bold text-sm flex items-center gap-2 touch-manipulation">
                    <FolderPlus className="w-4 h-4" /> Nova pasta
                  </button>
                )}
                <button onClick={() => createNote(activeFolderId)} className="min-h-11 px-4 py-2.5 rounded-xl bg-[#ff832a] text-white hover:bg-[#ec6300] transition-colors font-bold text-sm flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ec6300] touch-manipulation">
                  <Plus className="w-4 h-4" /> Nova anotação
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 xl:p-8 pb-24 w-full flex-1">
        {creatingFolder && (
          <form onSubmit={e => { e.preventDefault(); confirmCreateFolder(); }} className="bg-[#fdfbf7] border border-[#eee6d6] rounded-2xl p-4 sm:p-5 mb-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="new-note-folder" className="font-bold">Criar uma pasta</label>
              <button type="button" aria-label="Cancelar criação de pasta" onClick={() => { setCreatingFolder(false); setNewFolderName(''); }} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#725442] hover:bg-[#eee6d6] touch-manipulation">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              id="new-note-folder"
              autoFocus
              required
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); } }}
              placeholder="Nome da pasta"
              className="w-full min-w-0 bg-white border border-[#ddd2c2] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ec6300] focus:ring-2 focus:ring-[#ff832a]/20"
            />
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(100px,130px)_1fr] items-center gap-4">
              <StudyBook3D title={newFolderName || 'Nova pasta'} color={newFolderColor} />
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-[#725442]">Cor</span>
                {FOLDER_COLORS.map((c, index) => (
                  <button
                    type="button"
                    key={c}
                    aria-label={`Cor da pasta: ${['amarelo', 'azul', 'verde', 'vermelho', 'roxo', 'rosa'][index]}`}
                    aria-pressed={newFolderColor === c}
                    onClick={() => setNewFolderColor(c)}
                    className={`h-11 w-11 rounded-full shrink-0 flex items-center justify-center transition-transform hover:scale-110 touch-manipulation ${newFolderColor === c ? 'ring-2 ring-offset-2 ring-[#725442]' : ''}`}
                    style={{ backgroundColor: c }}
                  >
                    {newFolderColor === c && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
                <input type="color" value={newFolderColor} onChange={e => setNewFolderColor(e.target.value)} aria-label="Escolher qualquer cor para a pasta" title="Escolher qualquer cor" className="h-11 w-11 cursor-pointer rounded-xl border border-[#ddd2c2] bg-white p-1 touch-manipulation" />
              </div>
              <button type="submit" disabled={!newFolderName.trim()} className="sm:col-span-2 min-h-11 px-4 py-2.5 rounded-xl bg-[#473c33] text-white text-sm font-bold hover:bg-[#725442] disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation">
                Criar pasta
              </button>
            </div>
          </form>
        )}

        {openFolderId === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5">
            {folderStats.map(({ folder: f, count, size, lastModified }) => (
              <div key={f.id} className="relative group">
                {renamingFolderId === f.id ? (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#f4ebdd] h-full">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: f.color + '22' }}>
                      <Folder className="w-5 h-5" style={{ color: f.color }} />
                    </div>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { onRenameFolder?.(f.id, renameValue.trim() || f.name); setRenamingFolderId(null); }
                        if (e.key === 'Escape') setRenamingFolderId(null);
                      }}
                      className="flex-1 min-w-0 bg-transparent text-[15px] font-bold text-[#473c33] focus:outline-none"
                    />
                    <button aria-label="Salvar nome da pasta" onClick={() => { onRenameFolder?.(f.id, renameValue.trim() || f.name); setRenamingFolderId(null); }} className="inline-flex h-11 w-11 items-center justify-center text-[#647938] flex-shrink-0 touch-manipulation"><Check className="w-5 h-5" /></button>
                    <button aria-label="Cancelar renomeação" onClick={() => setRenamingFolderId(null)} className="inline-flex h-11 w-11 items-center justify-center text-[#725442] flex-shrink-0 touch-manipulation"><X className="w-5 h-5" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => (selectionMode ? toggleSelected(f.id) : openFolder(f.id))}
                    aria-pressed={selectionMode ? selectedIds.has(f.id) : undefined}
                    className={`w-full flex flex-col gap-3 p-4 rounded-[22px] border transition-colors text-left ${selectedIds.has(f.id) ? 'bg-[#fff1e8] border-[#fdb887]' : 'bg-white border-[#eee6d6] hover:bg-[#fdfbf7] hover:border-[#ddd2c2]'}`}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Folder3D color={f.color} />
                    <div className="flex items-start gap-2">
                      {selectionMode && (
                        <span className={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${selectedIds.has(f.id) ? 'bg-[#fdad74] border-[#fdad74]' : 'border-[#a79c8e]'}`}>
                          {selectedIds.has(f.id) && <Check className="w-3.5 h-3.5 text-[#473c33]" />}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#473c33] text-[15px] truncate">{f.name}</p>
                        <p className="text-xs text-[#725442] mt-0.5 truncate">{count} {count === 1 ? 'anotação' : 'anotações'} · {formatBytes(size)}</p>
                        <p className="text-xs text-[#a79c8e] mt-0.5 truncate">{formatDate(lastModified)}</p>
                      </div>
                    </div>
                  </button>
                )}
                {!selectionMode && renamingFolderId !== f.id && (
                  <div data-note-menu className="absolute right-3 top-3">
                    <button
                      aria-label={`Opções da pasta ${f.name}`}
                      aria-expanded={rowMenuId === f.id}
                      onClick={(e) => { e.stopPropagation(); setRowMenuId(rowMenuId === f.id ? null : f.id); }}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/90 backdrop-blur text-[#725442] hover:text-[#473c33] hover:bg-white transition-colors shadow-sm border border-[#eee6d6] touch-manipulation"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {rowMenuId === f.id && (
                      <>
                        <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-xl shadow-2xl border border-[#eee6d6] p-1.5 w-40">
                          <label className="flex min-h-11 items-center justify-between gap-2 px-3 py-2 rounded-lg text-[#473c33] text-xs font-bold cursor-pointer hover:bg-[#f4ebdd] touch-manipulation">
                            <span>Mudar cor</span>
                            <input
                              type="color"
                              value={f.color}
                              aria-label={`Escolher qualquer cor para ${f.name}`}
                              onChange={e => onUpdateFolderColor?.(f.id, e.target.value)}
                              className="h-10 w-10 cursor-pointer rounded-lg border border-[#eee6d6] bg-white p-1 touch-manipulation"
                            />
                          </label>
                          <button
                            onClick={() => { setRenamingFolderId(f.id); setRenameValue(f.name); setRowMenuId(null); }}
                            className="w-full min-h-11 flex items-center gap-2 px-3 py-2 rounded-lg text-[#473c33] hover:bg-[#f4ebdd] text-xs font-bold text-left touch-manipulation"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Renomear
                          </button>
                          <button
                            onClick={() => { onDeleteFolder(f.id); setRowMenuId(null); }}
                            className="w-full min-h-11 flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 text-xs font-bold text-left touch-manipulation"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}

            {unfiledNotes.length > 0 && (
              <button
                onClick={() => !selectionMode && openFolder(NONE_FOLDER)}
                className={`w-full flex flex-col gap-3 p-4 rounded-[22px] border border-[#eee6d6] bg-white text-left transition-colors ${selectionMode ? 'opacity-40 pointer-events-none' : 'hover:bg-[#fdfbf7] hover:border-[#ddd2c2]'}`}
              >
                <Folder3D color="#a79c8e" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#473c33] text-[15px] truncate">Sem pasta</p>
                  <p className="text-xs text-[#725442] mt-0.5">{unfiledNotes.length} {unfiledNotes.length === 1 ? 'anotação' : 'anotações'}</p>
                </div>
              </button>
            )}

            {folders.length === 0 && unfiledNotes.length === 0 && !creatingFolder && (
              <div className="flex flex-col items-center justify-center text-center min-h-[340px] sm:min-h-[400px] rounded-[24px] border-2 border-dashed border-[#eee6d6] bg-[#fdfbf7] px-4 sm:px-8 py-10">
                <div className="w-20 h-20 rounded-[24px] bg-[#fff1e8] text-[#ec6300] flex items-center justify-center mb-6">
                  <PenLine className="w-9 h-9" />
                </div>
                <h3 className="font-logo text-2xl sm:text-3xl">Comece sua primeira anotação</h3>
                <p className="text-[#725442] text-sm sm:text-base max-w-md mt-3 leading-relaxed">Escreva à mão, desenhe e organize suas ideias em pastas por matéria.</p>
                <div className="flex flex-wrap justify-center gap-3 mt-6">
                  <button onClick={() => createNote()} className="px-5 py-3 rounded-xl bg-[#ff832a] text-white font-bold text-sm flex items-center gap-2 hover:bg-[#ec6300] transition-colors">
                    <PenLine className="w-4 h-4" /> Criar minha primeira anotação
                  </button>
                  <button onClick={() => setCreatingFolder(true)} className="px-5 py-3 rounded-xl border border-[#ddd2c2] bg-white font-bold text-sm flex items-center gap-2 hover:bg-[#f4ebdd] transition-colors">
                    <FolderPlus className="w-4 h-4" /> Organizar em uma pasta
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {[...currentNotes].sort((a, b) => b.updatedAt - a.updatedAt).map(note => (
              <div key={note.id} className="relative group">
                <button
                  onClick={() => (selectionMode ? toggleSelected(note.id) : setEditingNote(note))}
                  aria-pressed={selectionMode ? selectedIds.has(note.id) : undefined}
                  className={`w-full aspect-[3/4] rounded-[20px] border overflow-hidden transition-all flex flex-col bg-white p-3 ${selectedIds.has(note.id) ? 'border-[#fdb887] ring-2 ring-[#fdb887]/40' : 'border-[#eee6d6] hover:border-[#ddd2c2]'}`}
                >
                  <StudyBook3D title={note.title || 'Sem título'} color={note.color || '#f97316'} className="min-h-0 flex-1 study-book--saved-note study-book--compact" preview={note.thumbnail ? <img src={note.thumbnail} alt="Prévia da anotação" /> : undefined} />
                  <div className="pt-2 text-left">
                    <p className="font-black text-[#473c33] text-xs truncate">{note.title || 'Sem título'}</p>
                    <p className="text-[10px] text-[#725442] mt-0.5">{formatDate(note.updatedAt)}</p>
                  </div>
                </button>
                {selectionMode ? (
                  <span className={`absolute top-2 left-2 w-5 h-5 rounded-md border-2 flex items-center justify-center pointer-events-none ${selectedIds.has(note.id) ? 'bg-[#fdad74] border-[#fdad74]' : 'border-white bg-[#473c33]/40'}`}>
                    {selectedIds.has(note.id) && <Check className="w-3.5 h-3.5 text-[#473c33]" />}
                  </span>
                ) : (
                  <div data-note-menu className="absolute top-2 right-2">
                    <button
                      aria-label={`Opções do caderno ${note.title || 'Sem título'}`}
                      aria-expanded={rowMenuId === `note:${note.id}`}
                      onClick={() => setRowMenuId(rowMenuId === `note:${note.id}` ? null : `note:${note.id}`)}
                      className="inline-flex h-11 w-11 items-center justify-center bg-white/90 dark:bg-[#252420]/90 border border-[#eee6d6] dark:border-white/10 rounded-full text-[#725442] dark:text-[#e7dcc1] hover:text-[#473c33] dark:hover:text-white transition-colors touch-manipulation"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {rowMenuId === `note:${note.id}` && (
                      <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-[#252420] rounded-xl shadow-2xl border border-[#eee6d6] dark:border-white/10 p-1.5 w-48">
                        <button
                          onClick={() => editNoteCover(note)}
                          className="w-full min-h-11 flex items-center gap-2 px-3 py-2 rounded-lg text-[#473c33] dark:text-[#eee7cf] hover:bg-[#f4ebdd] dark:hover:bg-white/5 text-xs font-bold text-left touch-manipulation"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar caderno
                        </button>
                        <button
                          onClick={() => { onDelete(note.id); setRowMenuId(null); }}
                          className="w-full min-h-11 flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-bold text-left touch-manipulation"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir anotação
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={() => createNote(openFolderId !== NONE_FOLDER ? openFolderId : undefined)}
              className="aspect-[3/4] rounded-[20px] border-2 border-dashed border-[#ddd2c2] flex flex-col items-center justify-center gap-2 text-[#725442] hover:border-[#fdb887]/50 hover:text-[#fdb887] transition-colors touch-manipulation"
            >
              <Plus className="w-8 h-8" />
              <span className="font-black uppercase tracking-widest text-[10px]">Nova anotação</span>
            </button>
          </div>
        )}
      </div>

      {editingNote && (
        <NoteEditor
          note={editingNote}
          folders={folders}
          onSave={onSave}
          onClose={() => setEditingNote(null)}
        />
      )}

      {editingCoverNote && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4" onPointerDown={e => { if (e.target === e.currentTarget) setEditingCoverNote(null); }}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-note-cover-title"
            onSubmit={e => { e.preventDefault(); saveNoteCover(); }}
            className="w-full max-w-md rounded-[28px] border border-[#eee6d6] dark:border-white/10 bg-white dark:bg-[#252420] p-5 sm:p-6 shadow-2xl text-[#473c33] dark:text-[#eee7cf]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[.2em] font-black text-[#ec6300]">Caderno salvo</p>
                <h3 id="edit-note-cover-title" className="mt-1 text-xl font-black">Editar caderno</h3>
              </div>
              <button type="button" aria-label="Fechar edição da capa" onClick={() => setEditingCoverNote(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#725442] dark:text-[#c9bea5] hover:bg-[#f4ebdd] dark:hover:bg-white/5 touch-manipulation">
                <X className="w-5 h-5" />
              </button>
            </div>

            <label htmlFor="saved-note-title" className="block mt-5 mb-2 text-xs font-black uppercase tracking-wider">Nome do caderno</label>
            <input
              id="saved-note-title"
              autoFocus
              value={coverTitle}
              onChange={e => setCoverTitle(e.target.value)}
              placeholder="Ex.: Direito Penal"
              className="w-full rounded-xl border border-[#ddd2c2] dark:border-white/10 bg-[#fdfbf7] dark:bg-[#1d1d1a] px-4 py-3 text-sm text-[#473c33] dark:text-[#eee7cf] placeholder:text-[#a79c8e] focus:outline-none focus:ring-2 focus:ring-[#ff832a]/30"
            />

            <div className="mt-4 flex items-center gap-4 rounded-2xl bg-[#fdfbf7] dark:bg-white/[.03] p-3">
              <div className="w-20 shrink-0">
                <StudyBook3D title={coverTitle || 'Sem título'} color={coverColor} className="h-28" />
              </div>
              <label className="flex-1 min-w-0 text-xs font-black uppercase tracking-wider">
                Cor da capa
                <div className="mt-2 flex items-center gap-3">
                  <input type="color" value={coverColor} onChange={e => setCoverColor(e.target.value)} aria-label="Escolher cor da capa do caderno" className="h-10 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
                  <span className="font-mono text-[11px] font-semibold text-[#725442] dark:text-[#c9bea5]">{coverColor.toUpperCase()}</span>
                </div>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingCoverNote(null)} className="min-h-11 px-4 py-2.5 rounded-xl text-sm font-bold text-[#725442] dark:text-[#c9bea5] hover:bg-[#f4ebdd] dark:hover:bg-white/5 touch-manipulation">Cancelar</button>
              <button type="submit" className="min-h-11 px-5 py-2.5 rounded-xl bg-[#ff832a] text-white text-sm font-black hover:bg-[#ec6300] transition-colors touch-manipulation">Salvar alterações</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default NotesView;
