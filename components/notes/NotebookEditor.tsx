import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InkCanvas, { InkCanvasHandle, ShapeKind, ToolState } from './InkCanvas';
import type { InkNotebook, InkPage, InkStroke, PageSize, PaperColor, PaperTemplate, PenKind } from '../../services/ink/types';
import { PAGE_SIZES, PAPERS, PEN_LABELS, TEMPLATES, renderThumbnail } from '../../services/ink/render';
import { loadNotebook, newPage, newPageId, saveNotebook } from '../../services/ink/store';
import { translateStroke, uid } from '../../services/ink/geometry';
import type { HandwrittenNote } from '../../types';

// Editor do caderno à mão (motor de tinta próprio). Convive com as anotações antigas (Excalidraw), que continuam abrindo como antes.

interface Props {
  note: HandwrittenNote;
  onSaveMeta: (note: HandwrittenNote) => void;
  onClose: () => void;
}

interface PenSlot { kind: PenKind; color: string; width: number }
const DEFAULT_PENS: PenSlot[] = [
  { kind: 'pen', color: '#2b2118', width: 2.2 }, { kind: 'fineliner', color: '#1f4e8c', width: 1.8 }, { kind: 'fountain', color: '#4a2f8a', width: 2.6 },
  { kind: 'calligraphy', color: '#8a2f2f', width: 3 }, { kind: 'pencil', color: '#555555', width: 2.4 }, { kind: 'highlighter', color: '#ffd84a', width: 4 },
  { kind: 'crayon', color: '#c96c4a', width: 4 }, { kind: 'watercolour', color: '#2e7bb4', width: 5 },
];
const PALETTE = ['#2b2118', '#555555', '#ffffff', '#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#16a085', '#2980b9', '#4a2f8a', '#d35a8a', '#7a4b2a'];
const SHAPES: { id: ShapeKind; label: string }[] = [{ id: 'line', label: 'Linha' }, { id: 'arrow', label: 'Seta' }, { id: 'ellipse', label: 'Círculo' }, { id: 'rect', label: 'Retângulo' }, { id: 'triangle', label: 'Triângulo' }];

const Svg: React.FC<{ d: string; size?: number }> = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const ICON = {
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3', redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  eraser: 'm7 21-4-4a2 2 0 0 1 0-3l10-10a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 9H7zM9 12l6 6', lasso: 'M12 4c5 0 9 2 9 5s-4 5-9 5-9-2-9-5 4-5 9-5zM8 14c-2 2-1 5 1 6s3-1 2-3',
  shape: 'M4 20 12 4l8 16zM9 14h6', hand: 'M8 13V6a1.5 1.5 0 0 1 3 0v5m0-6a1.5 1.5 0 0 1 3 0v6m0-4a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2-2l2 2',
  plus: 'M12 5v14M5 12h14', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', copy: 'M9 9h10v11H9zM5 15V4h10', back: 'm15 18-6-6 6-6', pages: 'M7 3h10v18H7zM3 7v14h10', fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
};

const Btn: React.FC<{ on?: boolean; title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ on, title, onClick, disabled, children }) => (
  <button type="button" className={`ink-btn${on ? ' on' : ''}`} title={title} aria-label={title} aria-pressed={on} disabled={disabled} onClick={onClick}>{children}</button>
);

const Thumb: React.FC<{ page: InkPage; active: boolean; index: number; onClick: () => void }> = ({ page, active, index, onClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const host = ref.current; if (!host) return;
      host.replaceChildren(renderThumbnail(page, 96));
    }, 250);
    return () => window.clearTimeout(id);
  }, [page.strokes, page.template, page.paper, page.size]);
  return (
    <button type="button" className={`ink-thumb${active ? ' on' : ''}`} onClick={onClick} aria-label={`Página ${index + 1}`} aria-current={active}>
      <div ref={ref} className="ink-thumb-img" /><span>{index + 1}</span>
    </button>
  );
};

const NotebookEditor: React.FC<Props> = ({ note, onSaveMeta, onClose }) => {
  const canvasRef = useRef<InkCanvasHandle>(null);
  const [pages, setPages] = useState<InkPage[] | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [title, setTitle] = useState(note.title);
  const [pens, setPens] = useState<PenSlot[]>(DEFAULT_PENS);
  const [penIdx, setPenIdx] = useState(0);
  const [tool, setTool] = useState<ToolState['tool']>('pen');
  const [eraserMode, setEraserMode] = useState<'whole' | 'partial'>('partial');
  const [eraserSize, setEraserSize] = useState(14);
  const [shape, setShape] = useState<ShapeKind>('rect');
  const [fingerDraws, setFingerDraws] = useState(true);
  const [holdToShape, setHoldToShape] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [scale, setScale] = useState(1);
  const [panel, setPanel] = useState<null | 'pen' | 'paper' | 'shape' | 'eraser' | 'pages'>(null);
  const [saveState, setSaveState] = useState<'ok' | 'saving' | 'error'>('ok');
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const history = useRef(new Map<string, { past: InkStroke[][]; future: InkStroke[][] }>());
  const [, bump] = useState(0);
  const dirty = useRef(false);
  const pagesRef = useRef<InkPage[] | null>(null);
  pagesRef.current = pages;

  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let vivo = true;
    loadNotebook(note.id).then((nb) => { if (vivo) setPages(nb?.pages?.length ? nb.pages : [newPage()]); }).catch(() => { if (vivo) { setPages([newPage()]); setSaveState('error'); } });
    return () => { vivo = false; };
  }, [note.id]);

  const page = pages?.[Math.min(pageIdx, (pages?.length ?? 1) - 1)] ?? null;
  const pen = pens[penIdx];

  const toolState: ToolState = useMemo(() => ({
    tool, kind: pen.kind, color: pen.color, width: pen.width, opacity: 1, eraserMode, eraserSize, shape, fingerDraws, holdToShape,
  }), [tool, pen, eraserMode, eraserSize, shape, fingerDraws, holdToShape]);

  const flush = useCallback(async () => {
    const list = pagesRef.current; if (!list || !dirty.current) return;
    dirty.current = false; setSaveState('saving');
    try {
      const nb: InkNotebook = { id: note.id, pages: list, updatedAt: Date.now() };
      await saveNotebook(nb);
      setSaveState('ok');
    } catch { dirty.current = true; setSaveState('error'); }
  }, [note.id]);

  // Salva depois de uma pausa; a miniatura da capa é atualizada na mesma hora.
  useEffect(() => {
    if (!pages || !dirty.current) return;
    const id = window.setTimeout(() => {
      flush();
      try {
        const thumb = renderThumbnail(pages[0], 220).toDataURL('image/jpeg', 0.6);
        onSaveMeta({ ...note, title, kind: 'notebook', pageCount: pages.length, thumbnail: thumb, updatedAt: Date.now() });
      } catch { /* a miniatura é opcional */ }
    }, 900);
    return () => window.clearTimeout(id);
  }, [pages, title, flush, note, onSaveMeta]);

  useEffect(() => () => { flush(); }, [flush]);

  const mutate = (fn: (list: InkPage[]) => InkPage[]) => { setPages((p) => (p ? fn(p) : p)); dirty.current = true; };
  const setPageStrokes = (id: string, strokes: InkStroke[]) => mutate((list) => list.map((p) => (p.id === id ? { ...p, strokes } : p)));

  const commit = (strokes: InkStroke[]) => {
    if (!page) return;
    const h = history.current.get(page.id) ?? { past: [], future: [] };
    h.past = [...h.past.slice(-99), page.strokes]; h.future = [];
    history.current.set(page.id, h);
    setPageStrokes(page.id, strokes); bump((n) => n + 1);
  };
  const undo = () => {
    if (!page) return; const h = history.current.get(page.id); if (!h?.past.length) return;
    const prev = h.past[h.past.length - 1]; h.past = h.past.slice(0, -1); h.future = [...h.future, page.strokes];
    setPageStrokes(page.id, prev); setSelected([]); bump((n) => n + 1);
  };
  const redo = () => {
    if (!page) return; const h = history.current.get(page.id); if (!h?.future.length) return;
    const next = h.future[h.future.length - 1]; h.future = h.future.slice(0, -1); h.past = [...h.past, page.strokes];
    setPageStrokes(page.id, next); setSelected([]); bump((n) => n + 1);
  };
  const hist = page ? history.current.get(page.id) : undefined;

  const removeSelected = () => { if (!page || !selected.length) return; const s = new Set(selected); commit(page.strokes.filter((x) => !s.has(x.id))); setSelected([]); };
  const duplicateSelected = () => {
    if (!page || !selected.length) return; const s = new Set(selected);
    const copies = page.strokes.filter((x) => s.has(x.id)).map((x) => ({ ...translateStroke(x, 16, 16), id: uid() }));
    commit([...page.strokes, ...copies]); setSelected(copies.map((c) => c.id));
  };
  const recolorSelected = () => {
    if (!page || !selected.length) return; const s = new Set(selected);
    commit(page.strokes.map((x) => (s.has(x.id) ? { ...x, color: pen.color } : x)));
  };

  const addPage = () => {
    if (!page) return;
    const np = newPage(page.template, page.paper, page.size);
    mutate((list) => { const i = list.findIndex((p) => p.id === page.id); return [...list.slice(0, i + 1), np, ...list.slice(i + 1)]; });
    setPageIdx(pageIdx + 1); setSelected([]);
  };
  const duplicatePage = () => {
    if (!page) return;
    const copy: InkPage = { ...page, id: newPageId(), strokes: page.strokes.map((s) => ({ ...s, id: uid() })) };
    mutate((list) => { const i = list.findIndex((p) => p.id === page.id); return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)]; });
    setPageIdx(pageIdx + 1);
  };
  const deletePage = () => {
    if (!page || !pages || pages.length < 2) return;
    if (page.strokes.length && !window.confirm('Excluir esta página e o que está escrito nela?')) return;
    mutate((list) => list.filter((p) => p.id !== page.id)); setPageIdx(Math.max(0, pageIdx - 1)); setSelected([]);
  };
  const setPageProps = (patch: Partial<Pick<InkPage, 'template' | 'paper' | 'size'>>) => { if (page) mutate((list) => list.map((p) => (p.id === page.id ? { ...p, ...patch } : p))); };
  const setPenColor = (color: string) => setPens((list) => list.map((p, i) => (i === penIdx ? { ...p, color } : p)));
  const setPenWidth = (width: number) => setPens((list) => list.map((p, i) => (i === penIdx ? { ...p, width } : p)));
  const choosePen = (i: number) => { if (tool === 'pen' && penIdx === i) setPanel(panel === 'pen' ? null : 'pen'); else { setPenIdx(i); setTool('pen'); setSelected([]); setPanel(null); } };
  const pickTool = (t: ToolState['tool']) => { setTool(t); setSelected([]); setPanel(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key === '0') { e.preventDefault(); canvasRef.current?.fitWidth(); }
      else if (mod && e.key === '9') { e.preventDefault(); canvasRef.current?.fitPage(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { if (selected.length) { e.preventDefault(); removeSelected(); } }
      else if (e.key === 'Escape') { setSelected([]); setPanel(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);  // eslint-disable-line react-hooks/exhaustive-deps
  });

  const close = async () => { await flush(); onClose(); };

  if (!pages || !page) return <div className="ink-root" data-dark={dark}><style>{CSS}</style><p className="ink-loading">Abrindo o caderno...</p></div>;

  return (
    <div className="ink-root" data-dark={dark}>
      <style>{CSS}</style>
      <header className="ink-top">
        <button type="button" className="ink-btn wide" onClick={close}><Svg d={ICON.back} />Voltar</button>
        <input className="ink-title" value={title} onChange={(e) => { setTitle(e.target.value); dirty.current = true; }} aria-label="Título do caderno" placeholder="Sem título" />
        <div className="ink-group">
          <Btn title="Desfazer (⌘Z)" onClick={undo} disabled={!hist?.past.length}><Svg d={ICON.undo} /></Btn>
          <Btn title="Refazer (⇧⌘Z)" onClick={redo} disabled={!hist?.future.length}><Svg d={ICON.redo} /></Btn>
        </div>
        <div className="ink-group">
          <Btn title="Diminuir zoom" onClick={() => canvasRef.current?.zoomBy(1 / 1.25)}>−</Btn>
          <button type="button" className="ink-zoom" onClick={() => canvasRef.current?.setScale(1)} title="Voltar a 100%">{Math.round(scale * 100)}%</button>
          <Btn title="Aumentar zoom" onClick={() => canvasRef.current?.zoomBy(1.25)}>+</Btn>
          <Btn title="Ajustar à largura (⌘0)" onClick={() => canvasRef.current?.fitWidth()}><Svg d={ICON.fit} /></Btn>
        </div>
        <Btn title="Páginas" on={panel === 'pages'} onClick={() => setPanel(panel === 'pages' ? null : 'pages')}><Svg d={ICON.pages} /></Btn>
        <Btn title="Papel e tamanho" on={panel === 'paper'} onClick={() => setPanel(panel === 'paper' ? null : 'paper')}>Papel</Btn>
        <span className={`ink-save ${saveState}`} role="status">{saveState === 'saving' ? 'Salvando...' : saveState === 'error' ? 'Não foi possível salvar' : 'Salvo'}</span>
      </header>

      <div className="ink-body">
        <InkCanvas ref={canvasRef} page={page} strokes={page.strokes} tools={toolState} selectedIds={selected} onSelect={setSelected} onCommit={commit} onScale={setScale} />

        {selected.length > 0 && (
          <div className="ink-floating" role="toolbar" aria-label="Seleção">
            <span>{selected.length} {selected.length === 1 ? 'traço' : 'traços'}</span>
            <button type="button" onClick={duplicateSelected}><Svg d={ICON.copy} size={16} />Duplicar</button>
            <button type="button" onClick={recolorSelected}><i style={{ background: pen.color }} />Pintar</button>
            <button type="button" className="danger" onClick={removeSelected}><Svg d={ICON.trash} size={16} />Excluir</button>
          </div>
        )}

        {panel === 'paper' && (
          <aside className="ink-panel right" aria-label="Papel e tamanho">
            <h3>Modelo</h3>
            <div className="ink-chips">{TEMPLATES.map((t) => <button key={t.id} type="button" className={page.template === t.id ? 'on' : ''} onClick={() => setPageProps({ template: t.id as PaperTemplate })}>{t.label}</button>)}</div>
            <h3>Cor do papel</h3>
            <div className="ink-swatches">{(Object.keys(PAPERS) as PaperColor[]).map((c) => <button key={c} type="button" title={PAPERS[c].label} aria-label={PAPERS[c].label} className={page.paper === c ? 'on' : ''} style={{ background: PAPERS[c].bg }} onClick={() => setPageProps({ paper: c })} />)}</div>
            <h3>Tamanho da página</h3>
            <div className="ink-chips">{(Object.keys(PAGE_SIZES) as PageSize[]).map((s) => <button key={s} type="button" className={page.size === s ? 'on' : ''} onClick={() => setPageProps({ size: s })}>{PAGE_SIZES[s].label}</button>)}</div>
          </aside>
        )}

        {panel === 'pages' && (
          <aside className="ink-panel right" aria-label="Páginas">
            <h3>Páginas ({pages.length})</h3>
            <div className="ink-thumbs">{pages.map((p, i) => <Thumb key={p.id} page={p} index={i} active={i === pageIdx} onClick={() => { setPageIdx(i); setSelected([]); }} />)}</div>
            <div className="ink-chips">
              <button type="button" onClick={addPage}>Nova página</button>
              <button type="button" onClick={duplicatePage}>Duplicar</button>
              <button type="button" className="danger" onClick={deletePage} disabled={pages.length < 2}>Excluir</button>
            </div>
          </aside>
        )}

        <div className="ink-pager">
          <button type="button" onClick={() => { setPageIdx(Math.max(0, pageIdx - 1)); setSelected([]); }} disabled={pageIdx === 0} aria-label="Página anterior">‹</button>
          <span>{pageIdx + 1} / {pages.length}</span>
          <button type="button" onClick={() => { if (pageIdx === pages.length - 1) addPage(); else { setPageIdx(pageIdx + 1); setSelected([]); } }} aria-label={pageIdx === pages.length - 1 ? 'Nova página' : 'Próxima página'}>{pageIdx === pages.length - 1 ? '+' : '›'}</button>
        </div>
      </div>

      {panel === 'pen' && (
        <div className="ink-pop" role="dialog" aria-label={`Ajustes: ${PEN_LABELS[pen.kind]}`}>
          <strong>{PEN_LABELS[pen.kind]}</strong>
          <div className="ink-swatches">{PALETTE.map((c) => <button key={c} type="button" aria-label={`Cor ${c}`} className={pen.color.toLowerCase() === c ? 'on' : ''} style={{ background: c }} onClick={() => setPenColor(c)} />)}
            <label className="ink-custom" title="Outra cor"><input type="color" value={pen.color} onChange={(e) => setPenColor(e.target.value)} aria-label="Escolher outra cor" /></label></div>
          <label className="ink-range">Espessura <input type="range" min={0.8} max={14} step={0.2} value={pen.width} onChange={(e) => setPenWidth(Number(e.target.value))} /><b>{pen.width.toFixed(1)}</b></label>
          <label className="ink-check"><input type="checkbox" checked={holdToShape} onChange={(e) => setHoldToShape(e.target.checked)} />Segurar no fim endireita linhas e formas</label>
          <label className="ink-check"><input type="checkbox" checked={fingerDraws} onChange={(e) => setFingerDraws(e.target.checked)} />Desenhar também com o dedo</label>
        </div>
      )}
      {panel === 'eraser' && (
        <div className="ink-pop" role="dialog" aria-label="Ajustes da borracha">
          <strong>Borracha</strong>
          <div className="ink-chips"><button type="button" className={eraserMode === 'partial' ? 'on' : ''} onClick={() => setEraserMode('partial')}>Parcial</button><button type="button" className={eraserMode === 'whole' ? 'on' : ''} onClick={() => setEraserMode('whole')}>Traço inteiro</button></div>
          <label className="ink-range">Tamanho <input type="range" min={4} max={48} value={eraserSize} onChange={(e) => setEraserSize(Number(e.target.value))} /><b>{eraserSize}</b></label>
        </div>
      )}
      {panel === 'shape' && (
        <div className="ink-pop" role="dialog" aria-label="Formas">
          <strong>Forma</strong>
          <div className="ink-chips">{SHAPES.map((s) => <button key={s.id} type="button" className={shape === s.id ? 'on' : ''} onClick={() => { setShape(s.id); setTool('shape'); setPanel(null); }}>{s.label}</button>)}</div>
        </div>
      )}

      <footer className="ink-tray" role="toolbar" aria-label="Ferramentas">
        {pens.map((p, i) => (
          <button key={i} type="button" className={`ink-pen${tool === 'pen' && penIdx === i ? ' on' : ''}`} onClick={() => choosePen(i)} title={PEN_LABELS[p.kind]} aria-label={PEN_LABELS[p.kind]} aria-pressed={tool === 'pen' && penIdx === i}>
            <i style={{ background: p.color }} /><span>{PEN_LABELS[p.kind]}</span>
          </button>
        ))}
        <span className="ink-sep" />
        <Btn on={tool === 'eraser'} title="Borracha" onClick={() => { if (tool === 'eraser') setPanel(panel === 'eraser' ? null : 'eraser'); else pickTool('eraser'); }}><Svg d={ICON.eraser} /></Btn>
        <Btn on={tool === 'lasso'} title="Laço: selecionar e mover" onClick={() => pickTool('lasso')}><Svg d={ICON.lasso} /></Btn>
        <Btn on={tool === 'shape'} title="Formas" onClick={() => { if (tool === 'shape') setPanel(panel === 'shape' ? null : 'shape'); else { setTool('shape'); setSelected([]); setPanel('shape'); } }}><Svg d={ICON.shape} /></Btn>
        <Btn on={tool === 'hand'} title="Mover a página" onClick={() => pickTool('hand')}><Svg d={ICON.hand} /></Btn>
      </footer>
    </div>
  );
};

const CSS = `
.ink-root{--i-bg:#F4EBDD;--i-card:#FBF7F0;--i-sand:#E8DDCC;--i-ink:#4A352A;--i-ink2:#725442;--i-terra:#C96C4A;--i-on:#fff;--i-olive:#446B4E;--i-line:rgba(74,53,42,.18);--i-stage:#d9cdb8;
  position:fixed;inset:0;z-index:1300;display:flex;flex-direction:column;background:var(--i-bg);color:var(--i-ink);font-family:'Manrope',system-ui,sans-serif;font-size:14px;overscroll-behavior:none}
.ink-root[data-dark="true"]{--i-bg:#241A14;--i-card:#2E221B;--i-sand:#3A2C23;--i-ink:#F1E6D6;--i-ink2:#C9B49E;--i-terra:#E07F5C;--i-on:#2A1710;--i-olive:#8FB596;--i-line:rgba(241,230,214,.18);--i-stage:#16110d}
.ink-root *{box-sizing:border-box}
.ink-root button,.ink-root input{font:inherit;color:inherit}
.ink-loading{margin:auto;color:var(--i-ink2);font-weight:600}
.ink-top{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--i-line);background:var(--i-card);flex-wrap:wrap;padding-top:max(8px,env(safe-area-inset-top))}
.ink-title{flex:1;min-width:120px;border:0;background:transparent;outline:0;font-weight:700;font-size:16px;padding:6px 8px;border-radius:10px}
.ink-title:focus{background:var(--i-sand)}
.ink-group{display:flex;align-items:center;gap:2px;background:var(--i-sand);border-radius:12px;padding:2px}
.ink-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:40px;height:40px;padding:0 10px;border:0;border-radius:10px;background:transparent;cursor:pointer;font-weight:700}
.ink-btn.wide{background:var(--i-sand)}
.ink-btn:hover:not(:disabled){background:var(--i-sand)}
.ink-btn.on{background:var(--i-terra);color:var(--i-on)}
.ink-btn:disabled{opacity:.35;cursor:default}
.ink-zoom{min-width:52px;height:40px;border:0;background:transparent;font-weight:700;cursor:pointer;font-variant-numeric:tabular-nums}
.ink-save{font-size:12px;font-weight:700;color:var(--i-ink2)}.ink-save.error{color:#c0392b}
.ink-body{position:relative;flex:1;min-height:0;background:var(--i-stage)}
.ink-stage{position:absolute;inset:0;overflow:hidden}
.ink-layer{position:absolute;inset:0;width:100%;height:100%}
.ink-floating{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;background:var(--i-card);border:1px solid var(--i-line);border-radius:14px;padding:6px 10px;box-shadow:0 6px 20px rgba(0,0,0,.18);font-weight:700}
.ink-floating button{display:inline-flex;align-items:center;gap:6px;border:0;background:var(--i-sand);border-radius:10px;padding:8px 10px;cursor:pointer;font-weight:700}
.ink-floating button.danger{color:#b03a2e}.ink-floating i{width:14px;height:14px;border-radius:50%;border:1px solid var(--i-line)}
.ink-panel{z-index:4;position:absolute;top:10px;bottom:10px;width:min(300px,calc(100% - 20px));overflow:auto;background:var(--i-card);border:1px solid var(--i-line);border-radius:16px;padding:14px;box-shadow:0 8px 28px rgba(0,0,0,.2)}
.ink-panel.right{right:10px}
.ink-panel h3,.ink-pop strong{display:block;margin:10px 0 8px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--i-ink2)}
.ink-panel h3:first-child{margin-top:0}
.ink-chips{display:flex;flex-wrap:wrap;gap:6px}
.ink-chips button{border:1px solid var(--i-line);background:var(--i-bg);border-radius:999px;padding:7px 12px;font-weight:600;cursor:pointer}
.ink-chips button.on{background:var(--i-terra);color:var(--i-on);border-color:transparent}
.ink-chips button.danger{color:#b03a2e}.ink-chips button:disabled{opacity:.4}
.ink-swatches{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ink-swatches button{width:30px;height:30px;border-radius:50%;border:2px solid var(--i-line);cursor:pointer}
.ink-swatches button.on{outline:3px solid var(--i-terra);outline-offset:2px}
.ink-custom{width:30px;height:30px;border-radius:50%;border:2px dashed var(--i-ink2);overflow:hidden;display:grid;place-items:center;cursor:pointer}
.ink-custom input{opacity:0;width:100%;height:100%;cursor:pointer}
.ink-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:10px;margin-bottom:12px}
.ink-thumb{display:flex;flex-direction:column;align-items:center;gap:4px;border:2px solid transparent;border-radius:10px;background:var(--i-bg);padding:6px;cursor:pointer;font-weight:700;font-size:12px}
.ink-thumb.on{border-color:var(--i-terra)}
.ink-thumb-img{min-height:60px;display:grid;place-items:center}.ink-thumb-img canvas{max-width:100%;height:auto;border:1px solid var(--i-line)}
.ink-pager{z-index:2;position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;background:var(--i-card);border:1px solid var(--i-line);border-radius:999px;padding:4px 6px;font-weight:700;font-variant-numeric:tabular-nums;box-shadow:0 4px 14px rgba(0,0,0,.15)}
.ink-pager button{width:36px;height:36px;border:0;border-radius:50%;background:var(--i-sand);font-size:20px;line-height:1;cursor:pointer}.ink-pager button:disabled{opacity:.35}
.ink-pop{position:absolute;left:50%;bottom:calc(76px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:5;width:min(340px,calc(100% - 20px));background:var(--i-card);border:1px solid var(--i-line);border-radius:16px;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;flex-direction:column;gap:10px}
.ink-pop strong{margin:0}
.ink-range{display:flex;align-items:center;gap:10px;font-weight:600}.ink-range input{flex:1;accent-color:var(--i-terra)}.ink-range b{min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
.ink-check{display:flex;align-items:center;gap:8px;font-weight:600}.ink-check input{accent-color:var(--i-terra);width:18px;height:18px}
.ink-tray{display:flex;align-items:center;gap:4px;padding:8px 10px calc(8px + env(safe-area-inset-bottom));border-top:1px solid var(--i-line);background:var(--i-card);overflow-x:auto}
.ink-pen{flex:none;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:64px;padding:6px 8px;border:0;border-radius:12px;background:transparent;cursor:pointer;font-size:11px;font-weight:700}
.ink-pen i{width:26px;height:26px;border-radius:50%;border:2px solid var(--i-line)}
.ink-pen.on{background:var(--i-sand);outline:2px solid var(--i-terra)}
.ink-sep{flex:none;width:1px;height:36px;background:var(--i-line);margin:0 6px}
.ink-root :focus-visible{outline:2px solid var(--i-ink);outline-offset:2px}
@media (max-width:700px){.ink-pen span{display:none}.ink-pen{min-width:44px}.ink-btn.wide{min-width:40px}}
`;

export default NotebookEditor;
