import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Upload, PenLine, Plus, Search, Trash2 } from './icons';
import { createNotebook, type DigitalNotebook } from '../services/digital-notebook/model';
import { deleteNotebook, hasUnsavedNotebook, listNotebooks, saveNotebook } from '../services/digital-notebook/storage';
import { importBackup } from '../services/digital-notebook/media';
import NotebookEditor from './digital-notebook/NotebookEditor';
import NotebookDialog from './digital-notebook/NotebookDialog';
import './digital-notebook/notebook.css';

export default function DigitalNotebookView({ owner, onBack }: { owner: string; onBack: () => void }) {
  const [notes, setNotes] = useState<DigitalNotebook[]>([]);
  const [active, setActive] = useState<DigitalNotebook | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [deleting, setDeleting] = useState<DigitalNotebook | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const saveVersion = useRef(0);
  const mounted = useRef(true);
  const latestSave = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    mounted.current = true;
    listNotebooks(owner).then(value => { if (mounted.current) setNotes(value); })
      .catch(() => { if (mounted.current) setError('Não foi possível abrir os cadernos. Verifique se o navegador permite armazenamento local e tente novamente.'); })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, [owner]);

  const change = (notebook: DigitalNotebook) => {
    setActive(notebook);
    setNotes(previous => previous.map(note => note.id === notebook.id ? notebook : note));
    const version = ++saveVersion.current;
    setStatus('saving');
    latestSave.current = saveNotebook(notebook).then(() => {
      if (mounted.current && version === saveVersion.current) setStatus('saved');
      return true;
    }).catch(() => {
      if (mounted.current && version === saveVersion.current) setStatus('error');
      return false;
    });
  };
  const add = async (file?: File) => {
    setBusy(true); setError('');
    try {
      const notebook = file ? await importBackup(file, owner) : createNotebook(owner);
      await saveNotebook(notebook);
      setNotes(previous => [notebook, ...previous]);
      setStatus('saved'); setActive(notebook);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar o caderno.'); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  };
  const leaveEditor = async () => {
    if (await latestSave.current === false) return;
    if (active && hasUnsavedNotebook(owner, active.id)) { setStatus('error'); return; }
    setActive(null);
  };

  if (active) return <div className="dn-root"><NotebookEditor key={active.id} notebook={active} onChange={change} onBack={leaveEditor} status={status} onRetry={() => change(active)} /></div>;
  const filtered = notes.filter(note => note.title.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).sort((a, b) => b.updatedAt - a.updatedAt);
  return <section className="dn-root dn-library" aria-label="Caderno Digital">
    <button className="dn-back" onClick={onBack}><ArrowLeft size={16} /> Painel principal</button>
    <header className="dn-library-header">
      <div><span className="dn-eyebrow">Seu espaço para pensar</span><h1>Caderno <em>Digital</em></h1><p>Escreva, desenhe e anote seus materiais de estudo.</p></div>
      <div className="dn-header-actions">
        <button className="dn-button" disabled={loading || busy} onClick={() => fileInput.current?.click()}><Upload size={17} /> Restaurar backup</button>
        <button className="dn-button dn-primary" disabled={loading || busy} onClick={() => add()}><Plus size={18} /> Novo caderno</button>
      </div>
    </header>
    <input ref={fileInput} hidden type="file" accept=".tdnote,application/json" aria-label="Restaurar backup do caderno" onChange={event => { if (event.target.files?.[0]) add(event.target.files[0]); }} />
    <div className="dn-local-notice"><BookOpen size={18} /><span>Seus cadernos ficam neste navegador e neste dispositivo. Baixe um <strong>backup editável</strong> para guardar uma cópia ou transferir para outro dispositivo.</span></div>
    {error && <div role="alert" className="dn-alert">{error}<button onClick={() => { setLoading(true); listNotebooks(owner).then(setNotes).then(() => setError('')).catch(() => setError('O armazenamento local continua indisponível.')).finally(() => setLoading(false)); }}>Tentar novamente</button></div>}
    {!!notes.length && <label className="dn-search"><Search size={18} /><input aria-label="Buscar cadernos" placeholder="Buscar cadernos…" value={search} onChange={event => setSearch(event.target.value)} /></label>}
    {loading || busy ? <div className="dn-empty" role="status"><span className="dn-spinner" />{loading ? 'Abrindo seus cadernos…' : 'Preparando caderno…'}</div> : notes.length === 0 ? <div className="dn-empty">
      <div className="dn-empty-icon"><PenLine size={36} /></div><h2>Uma página para suas ideias.</h2>
      <p>Comece com uma folha em branco ou importe um PDF para estudar com suas próprias anotações.</p>
      <button className="dn-button dn-primary" onClick={() => add()}><Plus size={18} /> Criar meu primeiro caderno</button>
      <div className="dn-feature-tags"><span>Escrita à mão</span><span>PDFs e imagens</span><span>Papel pautado ou quadriculado</span></div>
    </div> : <div className="dn-notebook-grid">
      {filtered.map(note => <article className="dn-notebook-card" key={note.id}>
        <button className="dn-open-notebook" onClick={() => { setActive(note); setStatus(hasUnsavedNotebook(owner, note.id) ? 'error' : 'saved'); latestSave.current = Promise.resolve(); }}>
          <div className="dn-cover"><PenLine size={30} /><span>{note.pages.length} {note.pages.length === 1 ? 'página' : 'páginas'}</span></div>
          <h2>{note.title}</h2><p>Editado em {new Date(note.updatedAt).toLocaleDateString('pt-BR')}</p>
          {hasUnsavedNotebook(owner, note.id) && <span className="dn-save-error">Alterações pendentes de salvamento</span>}
        </button>
        <button className="dn-icon-button dn-delete-notebook" aria-label={`Excluir caderno ${note.title}`} onClick={() => setDeleting(note)}><Trash2 size={17} /></button>
      </article>)}
      {filtered.length === 0 && <p>Nenhum caderno encontrado.</p>}
    </div>}
    {deleting && <NotebookDialog title="Excluir caderno?" onClose={() => setDeleting(null)}>
      <p>O caderno “{deleting.title}” e todas as páginas serão excluídos deste navegador. Esta ação não pode ser desfeita.</p>
      <div className="dn-dialog-actions"><button className="dn-button" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button><button className="dn-button dn-danger-button" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await deleteNotebook(owner, deleting.id); setNotes(previous => previous.filter(note => note.id !== deleting.id)); setDeleting(null); }
        catch { setError('Não foi possível excluir o caderno.'); setDeleting(null); }
        finally { setBusy(false); }
      }}>Excluir caderno</button></div>
    </NotebookDialog>}
  </section>;
}
