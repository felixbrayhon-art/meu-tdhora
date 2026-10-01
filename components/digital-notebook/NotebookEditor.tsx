import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, Upload, Download, Undo2, Redo2, PenLine, Highlighter, Eraser, Minus, Square, Circle, Type, Move, Trash2, ChevronLeft, ChevronRight } from '../icons';
import { createPage, type DigitalNotebook, type DrawingTool, type NotePage, type PaperStyle, type Point } from '../../services/digital-notebook/model';
import { exportBackup, exportPdf, importDocument, MAX_PAGES } from '../../services/digital-notebook/media';
import NotebookCanvas from './NotebookCanvas';
import NotebookDialog from './NotebookDialog';

const TOOLS = [
  { id: 'pen', label: 'Caneta (B)', icon: PenLine }, { id: 'highlighter', label: 'Marca-texto (H)', icon: Highlighter },
  { id: 'eraser', label: 'Borracha: apagar traços (E)', icon: Eraser }, { id: 'line', label: 'Linha (L)', icon: Minus },
  { id: 'rectangle', label: 'Retângulo (R)', icon: Square }, { id: 'ellipse', label: 'Elipse (O)', icon: Circle },
  { id: 'text', label: 'Texto (T)', icon: Type }, { id: 'hand', label: 'Mover página (V)', icon: Move },
] as const;
const COLORS = ['#172033', '#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#facc15'];
interface Props {
  notebook: DigitalNotebook;
  onChange: (notebook: DigitalNotebook) => void;
  onBack: () => void;
  status: 'saving' | 'saved' | 'error';
  onRetry: () => void;
}

export default function NotebookEditor({ notebook, onChange, onBack, status, onRetry }: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(3);
  const [penOnly, setPenOnly] = useState(false);
  const [zoom, setZoom] = useState(0.8);
  const [past, setPast] = useState<NotePage[][]>([]);
  const [future, setFuture] = useState<NotePage[][]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [textAt, setTextAt] = useState<Point | null>(null);
  const [text, setText] = useState('');
  const [deletePage, setDeletePage] = useState(false);
  const [title, setTitle] = useState(notebook.title);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const index = Math.min(pageIndex, notebook.pages.length - 1);
  const page = notebook.pages[index];

  const commit = (pages: NotePage[]) => {
    setPast(previous => [...previous.slice(-39), notebook.pages]);
    setFuture([]);
    onChange({ ...notebook, pages, updatedAt: Date.now() });
  };
  const updatePage = (value: NotePage) => commit(notebook.pages.map(p => p.id === value.id ? value : p));
  const undo = () => {
    if (!past.length || busy) return;
    setFuture(previous => [notebook.pages, ...previous]);
    onChange({ ...notebook, pages: past[past.length - 1], updatedAt: Date.now() });
    setPast(previous => previous.slice(0, -1));
  };
  const redo = () => {
    if (!future.length || busy) return;
    setPast(previous => [...previous, notebook.pages]);
    onChange({ ...notebook, pages: future[0], updatedAt: Date.now() });
    setFuture(previous => previous.slice(1));
  };
  const fit = () => {
    if (scroller.current) setZoom(Math.max(0.15, Math.min(1, (scroller.current.clientWidth - 48) / page.width)));
  };
  useEffect(() => { fit(); }, [page.id]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (busy || textAt || deletePage || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
        event.preventDefault();
        if (key === 'y' || event.shiftKey) redo(); else undo();
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const shortcuts: Record<string, DrawingTool> = { b: 'pen', h: 'highlighter', e: 'eraser', l: 'line', r: 'rectangle', o: 'ellipse', t: 'text', v: 'hand' };
        if (shortcuts[key]) { event.preventDefault(); setTool(shortcuts[key]); }
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });

  const importFile = async (file?: File) => {
    if (!file) return;
    setBusy('Abrindo documento…'); setError('');
    try {
      const replaceEmpty = notebook.pages.length === 1 && !page.background && page.elements.length === 0;
      const pages = await importDocument(file, MAX_PAGES - notebook.pages.length + (replaceEmpty ? 1 : 0), setBusy);
      commit(replaceEmpty ? pages : [...notebook.pages, ...pages]);
      setPageIndex(replaceEmpty ? 0 : notebook.pages.length);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível importar o documento.'); }
    finally { setBusy(''); if (fileInput.current) fileInput.current.value = ''; }
  };
  const download = async () => {
    setBusy('Preparando PDF…'); setError('');
    try { await exportPdf(notebook, setBusy); }
    catch { setError('Não foi possível exportar o PDF. Tente novamente ou baixe o backup editável.'); }
    finally { setBusy(''); }
  };
  const saveTitle = () => {
    const value = title.trim() || 'Caderno sem título';
    setTitle(value);
    if (value !== notebook.title) onChange({ ...notebook, title: value, updatedAt: Date.now() });
  };

  return <section className="dn-editor" aria-label="Editor do Caderno Digital" aria-busy={!!busy}>
    <header className="dn-editor-header">
      <button className="dn-icon-button" onClick={onBack} disabled={!!busy} aria-label="Voltar aos cadernos" title="Voltar aos cadernos"><ArrowLeft size={20} /></button>
      <div className="dn-title-group">
        <input aria-label="Nome do caderno" value={title} maxLength={120} onChange={event => setTitle(event.target.value)} onBlur={saveTitle} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} disabled={!!busy} />
        <span role="status" className={status === 'error' ? 'dn-save-error' : ''}>
          {status === 'saved' ? 'Salvo neste navegador' : status === 'saving' ? 'Salvando…' : 'Não foi possível salvar'}
        </span>
      </div>
      <div className="dn-header-actions">
        <button className="dn-button" onClick={() => fileInput.current?.click()} disabled={!!busy}><Upload size={16} /> Importar</button>
        <button className="dn-button" onClick={() => exportBackup(notebook)} disabled={!!busy} title="Baixar cópia editável para restaurar em outro navegador"><Download size={16} /> Backup</button>
        <button className="dn-button dn-primary" onClick={download} disabled={!!busy}><Download size={16} /> Exportar PDF</button>
      </div>
      <input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden aria-label="Importar PDF ou imagem" onChange={event => importFile(event.target.files?.[0])} />
    </header>
    {status === 'error' && <div className="dn-alert" role="alert">As alterações ainda não foram salvas. Libere espaço ou baixe um backup. <button onClick={onRetry}>Tentar salvar novamente</button></div>}
    {error && <div className="dn-alert" role="alert">{error}<button onClick={() => setError('')}>Fechar</button></div>}
    <fieldset className="dn-toolbar" disabled={!!busy}>
      <legend className="dn-sr-only">Ferramentas de desenho</legend>
      <div className="dn-tool-group" role="toolbar" aria-label="Desenho">
        {TOOLS.map(item => <button key={item.id} className={`dn-icon-button ${tool === item.id ? 'dn-selected' : ''}`} title={item.label} aria-label={item.label} aria-pressed={tool === item.id} onClick={() => { setTool(item.id); if (item.id === 'highlighter' && color === COLORS[0]) setColor('#facc15'); }}><item.icon size={19} /></button>)}
      </div>
      <div className="dn-tool-group dn-colors" aria-label="Cores">
        {COLORS.map(value => <button key={value} className={`dn-color ${color === value ? 'dn-color-selected' : ''}`} style={{ background: value }} aria-label={`Cor ${value}`} aria-pressed={color === value} onClick={() => setColor(value)} />)}
        <input type="color" aria-label="Cor personalizada" value={color} onChange={event => setColor(event.target.value)} />
      </div>
      <label className="dn-width">Espessura <input type="range" min="1" max="12" value={width} onChange={event => setWidth(Number(event.target.value))} /><span>{width}</span></label>
      <div className="dn-tool-group">
        <button className="dn-icon-button" onClick={undo} disabled={!past.length} aria-label="Desfazer" title="Desfazer (Ctrl/⌘ Z)"><Undo2 size={19} /></button>
        <button className="dn-icon-button" onClick={redo} disabled={!future.length} aria-label="Refazer" title="Refazer (Ctrl/⌘ Shift Z)"><Redo2 size={19} /></button>
      </div>
    </fieldset>
    <div className="dn-page-options">
      <label>Papel <select aria-label="Tipo de papel" value={page.paper} disabled={!!page.background || !!busy} onChange={event => updatePage({ ...page, paper: event.target.value as PaperStyle })}>
        <option value="plain">Em branco</option><option value="ruled">Pautado</option><option value="grid">Quadriculado</option><option value="dots">Pontilhado</option>
      </select></label>
      <label className="dn-checkbox"><input type="checkbox" checked={penOnly} onChange={event => setPenOnly(event.target.checked)} /> Toque só para navegar</label>
      <div className="dn-zoom">
        <button className="dn-icon-button" aria-label="Diminuir zoom" onClick={() => setZoom(value => Math.max(0.15, value - 0.1))}><Minus size={16} /></button>
        <output aria-label="Zoom">{Math.round(zoom * 100)}%</output>
        <button className="dn-icon-button" aria-label="Aumentar zoom" onClick={() => setZoom(value => Math.min(2, value + 0.1))}><Plus size={16} /></button>
        <button className="dn-button dn-small" onClick={fit}>Ajustar</button>
      </div>
    </div>
    <div className="dn-workspace">
      <aside className="dn-pages" aria-label="Páginas do caderno">
        <div className="dn-pages-label">Páginas <span>{notebook.pages.length}</span></div>
        {notebook.pages.map((item, number) => <button key={item.id} className={`dn-page-item ${number === index ? 'dn-page-active' : ''}`} onClick={() => setPageIndex(number)} disabled={!!busy} aria-label={`Página ${number + 1}`} aria-current={number === index ? 'page' : undefined}>
          <span className={`dn-page-preview dn-preview-${item.paper}`}>
            {item.background ? <img src={item.background} alt="" loading="lazy" /> : <PenLine size={20} />}
            {!!item.elements.length && <span className="dn-mark-count">{item.elements.length} traços</span>}
          </span>
          <span>Página {number + 1}</span>
        </button>)}
        <button className="dn-button dn-add-page" disabled={!!busy || notebook.pages.length >= MAX_PAGES} onClick={() => { commit([...notebook.pages, createPage(page.paper)]); setPageIndex(notebook.pages.length); }}><Plus size={16} /> Página</button>
      </aside>
      <div ref={scroller} className="dn-canvas-scroll">
        <div className="dn-canvas-stage">
          <NotebookCanvas key={page.id} page={page} tool={tool} color={color} width={width} zoom={zoom} penOnly={penOnly} scrollRef={scroller}
            onChange={elements => updatePage({ ...page, elements })} onText={point => { setText(''); setTextAt(point); }} />
        </div>
      </div>
      {!!busy && <div className="dn-busy" role="status"><span className="dn-spinner" />{busy}</div>}
    </div>
    <footer className="dn-editor-footer">
      <div className="dn-pagination">
        <button className="dn-icon-button" aria-label="Página anterior" disabled={index === 0 || !!busy} onClick={() => setPageIndex(index - 1)}><ChevronLeft size={16} /></button>
        <span>{index + 1} / {notebook.pages.length}</span>
        <button className="dn-icon-button" aria-label="Próxima página" disabled={index === notebook.pages.length - 1 || !!busy} onClick={() => setPageIndex(index + 1)}><ChevronRight size={16} /></button>
      </div>
      <span className="dn-tool-hint">{tool === 'eraser' ? 'A borracha remove o traço inteiro.' : penOnly ? 'Desenhe com caneta ou mouse. Use o dedo para navegar.' : 'Desenhe com mouse, dedo ou caneta.'}</span>
      <button className="dn-icon-button" aria-label="Adicionar página" title="Adicionar página" disabled={!!busy || notebook.pages.length >= MAX_PAGES} onClick={() => { commit([...notebook.pages, createPage(page.paper)]); setPageIndex(notebook.pages.length); }}><Plus size={16} /></button>
      <button className="dn-icon-button dn-danger" aria-label="Excluir página" title="Excluir página" disabled={notebook.pages.length === 1 || !!busy} onClick={() => setDeletePage(true)}><Trash2 size={16} /></button>
    </footer>
    {textAt && <NotebookDialog title="Adicionar texto" onClose={() => setTextAt(null)}>
      <textarea aria-label="Texto da anotação" autoFocus value={text} maxLength={3000} rows={5} onChange={event => setText(event.target.value)} placeholder="Escreva sua anotação…" />
      <div className="dn-dialog-actions"><button className="dn-button" onClick={() => setTextAt(null)}>Cancelar</button><button className="dn-button dn-primary" disabled={!text.trim()} onClick={() => {
        updatePage({ ...page, elements: [...page.elements, { id: crypto.randomUUID(), tool: 'text', color, width, points: [textAt], text: text.trim() }] });
        setTextAt(null);
      }}>Adicionar texto</button></div>
    </NotebookDialog>}
    {deletePage && <NotebookDialog title="Excluir esta página?" onClose={() => setDeletePage(false)}>
      <p>O conteúdo da página {index + 1} será removido. Você pode desfazer enquanto este caderno estiver aberto.</p>
      <div className="dn-dialog-actions"><button className="dn-button" onClick={() => setDeletePage(false)}>Cancelar</button><button className="dn-button dn-danger-button" onClick={() => { commit(notebook.pages.filter(p => p.id !== page.id)); setPageIndex(Math.max(0, index - 1)); setDeletePage(false); }}>Excluir página</button></div>
    </NotebookDialog>}
  </section>;
}
