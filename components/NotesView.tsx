import React, { useEffect, useRef, useState } from 'react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { PenLine, Trash2, Plus, X, Folder, FolderPlus, Check, Palette, ChevronLeft, ChevronRight, MoreVertical, CheckSquare, Pencil } from './icons';
import { HandwrittenNote, NoteFolder, NotePaperStyle } from '../types';

interface NotesViewProps {
  notes: HandwrittenNote[];
  folders: NoteFolder[];
  onSave: (note: HandwrittenNote) => void;
  onDelete: (id: string) => void;
  onCreateFolder: (name: string, color: string) => void;
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
  const [paperStyle, setPaperStyle] = useState<NotePaperStyle>(note.paperStyle ?? 'blank');
  const [showPaperMenu, setShowPaperMenu] = useState(false);
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  // The stroke/color/width panel no longer auto-shows just because a
  // drawing tool (pencil, shapes, ...) is selected — it's hidden via CSS
  // (see the <style> below) until the user explicitly opens it with the
  // dedicated palette button, and this state is what that CSS keys off.
  const [showColorPanel, setShowColorPanel] = useState(false);
  const activePaper = PAPER_STYLES.find(p => p.id === paperStyle)!;

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

    const onPointerCapture = (e: PointerEvent) => {
      if (e.pointerType === 'pen') {
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

  // Tapping outside the (now explicitly-opened) color panel closes it —
  // plain React state this time, no DOM-toggle chasing needed, since we're
  // the ones deciding whether it's visible in the first place.
  useEffect(() => {
    if (!showColorPanel) return;
    const onTapOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.panelColumn') || target.closest('[data-testid="color-panel-toggle"]')) return;
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
      folderId: folderId || undefined,
      paperStyle,
      excalidrawElements: elements,
      excalidrawAppState: appState,
      excalidrawFiles: files,
      thumbnail,
      updatedAt: Date.now(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-white flex flex-col">
      <div className="bg-white px-6 py-4 shadow-sm border-b border-gray-100 flex-shrink-0 flex items-center gap-3">
        <button onClick={handleSaveAndClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0">
          <X className="w-6 h-6 text-gray-500" />
        </button>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Título da anotação"
          className="flex-1 min-w-0 text-xl font-black text-gray-900 focus:outline-none bg-transparent"
        />
        <button
          data-testid="color-panel-toggle"
          onClick={() => setShowColorPanel(v => !v)}
          className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${showColorPanel ? 'bg-[#fdad74] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          title="Cores, espessura e opções do traço"
        >
          <Palette className="w-5 h-5" />
        </button>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowPaperMenu(v => !v)}
            className="w-9 h-9 rounded-xl border border-gray-200 overflow-hidden flex-shrink-0"
            style={{ backgroundImage: activePaper.backgroundImage, backgroundSize: `${activePaper.tileSize}px ${activePaper.tileSize}px`, backgroundColor: '#fff' }}
            title="Tipo de folha"
          />
          {showPaperMenu && (
            <>
              <div className="fixed inset-0 z-[1150]" onClick={() => setShowPaperMenu(false)} />
              <div className="absolute right-0 top-full mt-2 z-[1160] bg-white rounded-[20px] shadow-2xl border border-gray-100 p-3 grid grid-cols-2 gap-2 w-64">
                {PAPER_STYLES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setPaperStyle(p.id); setShowPaperMenu(false); }}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-colors text-center ${paperStyle === p.id ? 'bg-[#fff1e8] ring-2 ring-[#fdb887]' : 'hover:bg-gray-50'}`}
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
          className="hidden sm:block bg-gray-100 rounded-xl px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wide focus:outline-none flex-shrink-0"
        >
          <option value="">Sem pasta</option>
          {folders.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <button
          onClick={handleSaveAndClose}
          className="px-6 py-3 bg-[#fdad74] text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#fda769] transition-colors flex-shrink-0"
        >
          Salvar
        </button>
      </div>

      <div className="sm:hidden px-6 py-2 bg-white border-b border-gray-100 flex-shrink-0">
        <select
          value={folderId}
          onChange={e => setFolderId(e.target.value)}
          className="w-full bg-gray-100 rounded-xl px-3 py-2 text-xs font-bold text-gray-600 uppercase tracking-wide focus:outline-none"
        >
          <option value="">Sem pasta</option>
          {folders.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
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
        {/* Hides Excalidraw's own stroke/color/width panel (.App-mobile-menu
            in narrow layout, .App-menu__left in wide layout) unless our own
            palette button has explicitly opened it — it otherwise
            auto-shows just from selecting a drawing tool, with no built-in
            way to dismiss it (github.com/excalidraw/excalidraw#11434). */}
        {!showColorPanel && (
          <style>{`
            .App-mobile-menu, .Island.App-menu__left {
              display: none !important;
            }
          `}</style>
        )}
        <div ref={excalidrawWrapperRef} className="absolute inset-0">
          <Excalidraw
            excalidrawAPI={api => { excalidrawAPIRef.current = api; }}
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
            className="absolute top-3 right-3 z-10 p-2 bg-white rounded-full shadow-md border border-gray-200 text-gray-600 hover:text-red-500 hover:border-red-200 transition-colors"
            title="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

const NotesView: React.FC<NotesViewProps> = ({ notes, folders, onSave, onDelete, onCreateFolder, onDeleteFolder, onRenameFolder, onBack }) => {
  const [editingNote, setEditingNote] = useState<HandwrittenNote | null>(null);
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
              className="p-2 rounded-xl text-[#725442] hover:bg-[#f4ebdd] transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-[#ec6300]"
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
                  <button onClick={deleteSelected} aria-label="Excluir selecionados" className="p-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button onClick={exitSelection} className="px-4 py-2.5 rounded-xl bg-[#f4ebdd] hover:bg-[#eee6d6] transition-colors font-bold text-sm">
                  Cancelar seleção
                </button>
              </>
            ) : (
              <>
                {canSelect && (
                  <button onClick={() => setSelectionMode(true)} className="px-3 py-2.5 rounded-xl hover:bg-[#f4ebdd] transition-colors font-bold text-sm flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" /> Selecionar
                  </button>
                )}
                {openFolderId === null && (
                  <button onClick={() => { setCreatingFolder(true); setRowMenuId(null); }} className="px-4 py-2.5 rounded-xl border border-[#eee6d6] hover:bg-[#f4ebdd] transition-colors font-bold text-sm flex items-center gap-2">
                    <FolderPlus className="w-4 h-4" /> Nova pasta
                  </button>
                )}
                <button onClick={() => createNote(activeFolderId)} className="px-4 py-2.5 rounded-xl bg-[#ff832a] text-white hover:bg-[#ec6300] transition-colors font-bold text-sm flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ec6300]">
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
              <button type="button" aria-label="Cancelar criação de pasta" onClick={() => { setCreatingFolder(false); setNewFolderName(''); }} className="p-2 rounded-lg text-[#725442] hover:bg-[#eee6d6]">
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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#725442]">Cor</span>
                {FOLDER_COLORS.map((c, index) => (
                  <button
                    type="button"
                    key={c}
                    aria-label={`Cor da pasta: ${['amarelo', 'azul', 'verde', 'vermelho', 'roxo', 'rosa'][index]}`}
                    aria-pressed={newFolderColor === c}
                    onClick={() => setNewFolderColor(c)}
                    className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center transition-transform hover:scale-110 ${newFolderColor === c ? 'ring-2 ring-offset-2 ring-[#725442]' : ''}`}
                    style={{ backgroundColor: c }}
                  >
                    {newFolderColor === c && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
              <button type="submit" disabled={!newFolderName.trim()} className="px-4 py-2.5 rounded-xl bg-[#473c33] text-white text-sm font-bold hover:bg-[#725442] disabled:opacity-40 disabled:cursor-not-allowed">
                Criar pasta
              </button>
            </div>
          </form>
        )}

        {openFolderId === null ? (
          <div className="space-y-3">
            {folderStats.map(({ folder: f, count, size, lastModified }) => (
              <div key={f.id} className="relative group">
                {renamingFolderId === f.id ? (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#f4ebdd]">
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
                    <button aria-label="Salvar nome da pasta" onClick={() => { onRenameFolder?.(f.id, renameValue.trim() || f.name); setRenamingFolderId(null); }} className="text-[#647938] flex-shrink-0"><Check className="w-5 h-5" /></button>
                    <button aria-label="Cancelar renomeação" onClick={() => setRenamingFolderId(null)} className="text-[#725442] flex-shrink-0"><X className="w-5 h-5" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => (selectionMode ? toggleSelected(f.id) : openFolder(f.id))}
                    aria-pressed={selectionMode ? selectedIds.has(f.id) : undefined}
                    className={`w-full flex items-center gap-3 pl-4 pr-12 py-4 rounded-2xl border transition-colors text-left ${selectedIds.has(f.id) ? 'bg-[#fff1e8] border-[#fdb887]' : 'bg-white border-[#eee6d6] hover:bg-[#fdfbf7] hover:border-[#ddd2c2]'}`}
                  >
                    {selectionMode && (
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${selectedIds.has(f.id) ? 'bg-[#fdad74] border-[#fdad74]' : 'border-[#a79c8e]'}`}>
                        {selectedIds.has(f.id) && <Check className="w-3.5 h-3.5 text-[#473c33]" />}
                      </span>
                    )}
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: f.color + '22' }}>
                      <Folder className="w-5 h-5" style={{ color: f.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#473c33] text-[15px] truncate">{f.name}</p>
                      <p className="text-xs text-[#725442] mt-0.5">{count} {count === 1 ? 'anotação' : 'anotações'} · {formatBytes(size)}</p>
                    </div>
                    <p className="text-xs text-[#725442] shrink-0 hidden xl:block pr-10">{formatDate(lastModified)}</p>
                    {!selectionMode && <ChevronRight className="w-4 h-4 text-[#a79c8e] flex-shrink-0 sm:hidden" />}
                  </button>
                )}
                {!selectionMode && renamingFolderId !== f.id && (
                  <div data-note-menu className="absolute right-2 top-1/2 -translate-y-1/2">
                    <button
                      aria-label={`Opções da pasta ${f.name}`}
                      aria-expanded={rowMenuId === f.id}
                      onClick={(e) => { e.stopPropagation(); setRowMenuId(rowMenuId === f.id ? null : f.id); }}
                      className="p-2 rounded-lg text-[#725442] hover:text-[#473c33] hover:bg-[#eee6d6] transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {rowMenuId === f.id && (
                      <>
                        <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-xl shadow-2xl border border-[#eee6d6] p-1.5 w-40">
                          <button
                            onClick={() => { setRenamingFolderId(f.id); setRenameValue(f.name); setRowMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#473c33] hover:bg-[#f4ebdd] text-xs font-bold text-left"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Renomear
                          </button>
                          <button
                            onClick={() => { onDeleteFolder(f.id); setRowMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 text-xs font-bold text-left"
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors text-left ${selectionMode ? 'opacity-40 pointer-events-none' : 'hover:bg-[#f4ebdd] active:bg-[#eee6d6]'}`}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#f4ebdd]">
                  <Folder className="w-5 h-5 text-[#725442]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#473c33] text-[15px] truncate">Sem pasta</p>
                  <p className="text-xs text-[#725442] mt-0.5">{unfiledNotes.length} {unfiledNotes.length === 1 ? 'anotação' : 'anotações'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#a79c8e] flex-shrink-0" />
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
                  className={`w-full aspect-[3/4] rounded-[20px] border overflow-hidden transition-all flex flex-col bg-white ${selectedIds.has(note.id) ? 'border-[#fdb887] ring-2 ring-[#fdb887]/40' : 'border-[#eee6d6] hover:border-[#ddd2c2]'}`}
                >
                  {note.thumbnail ? (
                    <img src={note.thumbnail} alt="" className="w-full flex-1 object-cover object-top bg-white" />
                  ) : (
                    <div className="w-full flex-1 bg-white" />
                  )}
                  <div className="p-3 text-left border-t border-[#eee6d6]">
                    <p className="font-black text-[#473c33] text-sm truncate">{note.title || 'Sem título'}</p>
                    <p className="text-[10px] text-[#725442] mt-0.5">{formatDate(note.updatedAt)}</p>
                  </div>
                </button>
                {selectionMode ? (
                  <span className={`absolute top-2 left-2 w-5 h-5 rounded-md border-2 flex items-center justify-center pointer-events-none ${selectedIds.has(note.id) ? 'bg-[#fdad74] border-[#fdad74]' : 'border-white bg-[#473c33]/40'}`}>
                    {selectedIds.has(note.id) && <Check className="w-3.5 h-3.5 text-[#473c33]" />}
                  </span>
                ) : (
                  <button
                    aria-label={`Excluir anotação ${note.title || 'Sem título'}`}
                    onClick={() => onDelete(note.id)}
                    className="absolute top-2 right-2 p-2 bg-white/90 border border-[#eee6d6] rounded-full text-[#725442] hover:text-red-600 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={() => createNote(openFolderId !== NONE_FOLDER ? openFolderId : undefined)}
              className="aspect-[3/4] rounded-[20px] border-2 border-dashed border-[#ddd2c2] flex flex-col items-center justify-center gap-2 text-[#725442] hover:border-[#fdb887]/50 hover:text-[#fdb887] transition-colors"
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
    </section>
  );
};

export default NotesView;
