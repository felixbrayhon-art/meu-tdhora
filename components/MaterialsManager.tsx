import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { QuizFolder, Notebook, QuizAttempt, EditalConfig } from '../types';
import { MoveAllNotebookQuestionsModal } from './MoveAllNotebookQuestionsModal';
import Folder3D from './Folder3D';
import StudyBook3D from './StudyBook3D';
import CustomColorField from './CustomColorField';

const FOLDER_COLORS = [
  { name: 'Dourado', value: '#f4ad2d' },
  { name: 'Laranja', value: '#f97316' },
  { name: 'Verde', value: '#94bd63' },
  { name: 'Azul', value: '#60a5fa' },
  { name: 'Rosa', value: '#fb7185' },
  { name: 'Roxo', value: '#a78bfa' },
];

interface MaterialsManagerProps {
  folders: QuizFolder[];
  attempts: QuizAttempt[];
  onBack: () => void;
  onPlayQuiz: (folderId: string, notebookId: string) => void;
  onCreateFolder: (name: string, parentId?: string, color?: string) => void;
  onUpdateFolderColor: (folderId: string, color: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onCreateNotebook: (folderId: string, name: string, color?: string) => void;
  onUpdateNotebook?: (folderId: string, notebookId: string, changes: { name?: string; color?: string }) => void;
  onDeleteFolder?: (folderId: string) => void;
  onDeleteNotebook?: (folderId: string, notebookId: string) => void;
  onMergeNotebooks?: (sourceNotebookId: string, sourceFolderId: string, targetNotebookId: string, targetFolderId: string) => void;
  onMoveAllQuestions?: (sourceNotebookId: string, sourceFolderId: string, targetNotebookId: string, targetFolderId: string) => void;
  strategicMode?: boolean;
  editalConfig?: EditalConfig;
  selectedFolderId: string | null;
  setSelectedFolderId: (id: string | null) => void;
  selectedNotebookId: string | null;
  setSelectedNotebookId: (id: string | null) => void;
}

// Same paper/ink tokens as the Aula Viva sheet (LivingLessonView), so both
// screens read alike in light and dark mode.
const SHEET_INK = 'text-[#473c33] dark:text-[#f2efd2]';
const SHEET_MUTED = 'text-[#725442] dark:text-[#c8c5a9]';
const SHEET_PAPER = 'bg-[#fdfbf7] dark:bg-[#24251f]';
const SHEET_CARD = 'bg-white dark:bg-[#2d2e27]';
const SHEET_RULE = 'border-[#e8dcc8] dark:border-white/10';

const MaterialsManager: React.FC<MaterialsManagerProps> = ({ folders, attempts, onBack, onPlayQuiz, onCreateFolder, onUpdateFolderColor, onRenameFolder, onCreateNotebook, onUpdateNotebook, onDeleteFolder, onDeleteNotebook, onMoveAllQuestions, strategicMode, editalConfig, selectedFolderId, setSelectedFolderId, selectedNotebookId, setSelectedNotebookId }) => {
  const [moveAllNotebook, setMoveAllNotebook] = useState<Notebook | null>(null);
  const [isCreating, setIsCreating] = useState<'FOLDER' | 'NOTEBOOK' | null>(null);
  const [newName, setNewName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0].value);
  const [editingNotebookId, setEditingNotebookId] = useState<string | null>(null);
  const [openColorPickerId, setOpenColorPickerId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);
  const selectedNotebook = selectedFolder?.notebooks.find((n) => n.id === selectedNotebookId);

  // Get current level folders and notebooks
  const currentFolders = folders.filter((f) => f.parentId === (selectedFolderId || undefined));

  const getBreadcrumbs = () => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'MATERIAIS' }];
    if (!selectedFolderId) return crumbs;

    const path: { id: string | null; name: string }[] = [];
    let curr: QuizFolder | undefined = folders.find((f) => f.id === selectedFolderId);
    while (curr) {
      path.unshift({ id: curr.id, name: curr.name });
      curr = folders.find((f) => f.id === curr?.parentId);
    }
    return [...crumbs, ...path];
  };

  const breadcrumbs = getBreadcrumbs();

  const handleCreate = () => {
    if (!newName.trim()) return;
    if (isCreating === 'FOLDER') {
      onCreateFolder(newName.trim(), selectedFolderId || undefined, newFolderColor);
    } else if (isCreating === 'NOTEBOOK' && selectedFolderId) {
      if (editingNotebookId) onUpdateNotebook?.(selectedFolderId, editingNotebookId, { name: newName.trim(), color: newFolderColor });
      else onCreateNotebook(selectedFolderId, newName.trim(), newFolderColor);
    }
    setNewName('');
    setEditingNotebookId(null);
    setIsCreating(null);
  };

  return (
    <div className="animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <button onClick={selectedNotebookId ? () => setSelectedNotebookId(null) : selectedFolderId ? () => setSelectedFolderId(selectedFolder?.parentId || null) : onBack} className="text-gray-400 font-bold text-xs tracking-widest flex items-center gap-2 hover:text-gray-600 transition-colors uppercase">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
          </svg>
          {selectedNotebookId ? 'VOLTAR PARA PASTA' : selectedFolderId ? (selectedFolder?.parentId ? 'VOLTAR PARA PASTA PAI' : 'VOLTAR ÀS PASTAS') : 'HUB PRINCIPAL'}
        </button>

        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar max-w-full md:max-w-2xl">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id || 'root'}>
                {idx > 0 && <span className="text-gray-300 font-bold text-[10px]">/</span>}
                <button
                  onClick={() => {
                    setSelectedFolderId(crumb.id);
                    setSelectedNotebookId(null);
                  }}
                  className={`text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${idx === breadcrumbs.length - 1 ? 'text-[#fecc73]' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
          <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">
            {selectedNotebookId ? 'CADERNO DE' : strategicMode ? 'MATERIAIS' : 'MEUS'} <span className={strategicMode && !selectedNotebookId ? 'text-[#ac6e00]' : 'text-[#fecc73]'}>{selectedNotebookId ? 'QUESTÕES' : strategicMode ? 'ESTRATÉGICOS' : 'MATERIAIS'}</span>
          </h2>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {!selectedNotebookId && (
            <>
              <button onClick={() => { setNewName(''); setEditingNotebookId(null); setNewFolderColor(FOLDER_COLORS[0].value); setIsCreating('FOLDER'); }} className="bg-[#fff6e8] hover:bg-[#fff0d5] text-[#fec868] px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                </svg>
                {selectedFolderId ? 'Subpasta' : 'Pasta'}
              </button>
              {selectedFolderId && (
                <button onClick={() => { setNewName(''); setEditingNotebookId(null); setNewFolderColor(FOLDER_COLORS[0].value); setIsCreating('NOTEBOOK'); }} className="bg-[#fff1e8] hover:bg-[#fee6d5] text-[#fda769] px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                  </svg>
                  Caderno
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#473c33]/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-[40px] shadow-2xl p-7 sm:p-10 animate-in zoom-in-95 duration-500">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black tracking-tighter uppercase">{isCreating === 'FOLDER' ? (selectedFolderId ? 'CRIAR SUBPASTA' : 'CRIAR NOVA PASTA') : editingNotebookId ? 'EDITAR CADERNO' : 'CRIAR NOVO CADERNO'}</h3>
              <button onClick={() => { setIsCreating(null); setEditingNotebookId(null); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-6 flex items-center gap-5">
              <div className="w-20 shrink-0">
                <StudyBook3D title={newName || (isCreating === 'NOTEBOOK' ? 'Novo caderno' : 'Nova pasta')} color={newFolderColor} />
              </div>
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={isCreating === 'FOLDER' ? 'Ex: Revisão OAB' : 'Ex: Atos Administrativos'} className="min-w-0 flex-1 bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-4 text-base font-bold focus:outline-none focus:border-[#fed386] transition-all" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreate())} />
            </div>
            <CustomColorField label={isCreating === 'FOLDER' ? 'Cor da pasta' : 'Cor da capa'} color={newFolderColor} onChange={setNewFolderColor} />
            <div className="flex gap-4">
              <button onClick={() => { setIsCreating(null); setEditingNotebookId(null); }} className="flex-1 py-4 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-gray-600">
                CANCELAR
              </button>
              <button onClick={handleCreate} disabled={!newName.trim()} className="flex-1 bg-[#fecc73] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-[#fff0d5]/60 dark:shadow-black/30 disabled:opacity-30 transition-all">
                {editingNotebookId ? 'SALVAR ALTERAÇÕES' : 'CRIAR AGORA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      {selectedNotebookId && selectedNotebook && selectedFolderId ? (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-6">
              <article className={`rounded-[28px] p-5 sm:p-8 ${SHEET_PAPER}`}>
                <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="font-logo text-xs uppercase tracking-[0.2em] text-[#e96f34] mb-1">Caderno salvo</p>
                    <h3 className={`font-logo text-2xl sm:text-3xl uppercase leading-tight break-words ${SHEET_INK}`}>{selectedNotebook.name}</h3>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wide ${SHEET_RULE} ${SHEET_CARD} ${SHEET_MUTED}`}>{selectedNotebook.questions.length} questões</span>
                </div>
                <div
                  aria-hidden="true"
                  className="mb-6 h-3 opacity-60"
                  style={{ backgroundImage: 'url("/sul-americano-triangulos.svg")', backgroundRepeat: 'repeat-x', backgroundSize: 'auto 100%' }}
                />

                {selectedNotebook.questions.length > 0 ? (
                  <section aria-label="Questões salvas" className={`overflow-hidden rounded-2xl border ${SHEET_RULE} ${SHEET_CARD}`}>
                    <div className="rounded-t-2xl bg-[#e96f34] px-4 py-2 text-center font-logo text-lg tracking-wide text-white">Questões salvas</div>
                    <ol className="divide-y divide-[#efe6d6] dark:divide-white/10">
                      {selectedNotebook.questions.map((question, index) => (
                        <li key={question.id || index} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff0e5] text-sm font-black text-[#e96f34] dark:bg-[#35362e]">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm sm:text-base leading-relaxed line-clamp-3 ${SHEET_INK}`} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(question.question) }} />
                            <p className={`mt-2 text-xs leading-relaxed ${SHEET_MUTED}`}>
                              <b className="font-black uppercase tracking-wide">{question.options.filter((option) => option.trim()).length || question.options.length} alternativas</b>
                              {question.topic && <><span className="mx-1.5 text-[#e96f34]">|</span>{question.topic}</>}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : (
                  <div className={`rounded-2xl border border-dashed py-12 text-center ${SHEET_RULE} ${SHEET_CARD}`}>
                    <p className={`text-sm font-bold ${SHEET_MUTED}`}>Este caderno ainda não possui questões salvas.</p>
                  </div>
                )}

                <div className="hidden" aria-hidden="true">
                {selectedNotebook.summary ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-[#fec868] font-black uppercase text-[10px] tracking-widest">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" />
                      </svg>
                      Resumo do Caderno
                    </div>
                    <p className="text-lg leading-relaxed text-gray-700 font-medium whitespace-pre-wrap">{selectedNotebook.summary}</p>
                  </div>
                ) : (
                  <div className="py-12 text-center bg-gray-50 rounded-[35px] border border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold ">Este caderno não possui um resumo salvo.</p>
                  </div>
                )}
                </div>
              </article>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <section aria-label="Praticar agora" className={`overflow-hidden rounded-2xl border lg:sticky lg:top-6 ${SHEET_RULE} ${SHEET_CARD}`}>
                <div className="rounded-t-2xl bg-[#e96f34] px-4 py-2 text-center font-logo text-lg tracking-wide text-white">Praticar agora</div>
                <dl className="divide-y divide-[#efe6d6] dark:divide-white/10">
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <dt className="text-xs font-black uppercase tracking-wide text-[#e96f34]">Questões</dt>
                    <dd className={`font-logo text-lg ${SHEET_INK}`}>{selectedNotebook.questions.length}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <dt className="text-xs font-black uppercase tracking-wide text-[#e96f34]">Pasta</dt>
                    <dd className={`min-w-0 truncate text-right text-sm font-bold ${SHEET_INK}`}>{selectedFolder?.name}</dd>
                  </div>
                </dl>
                <div className="p-4">
                  <button onClick={() => onPlayQuiz(selectedFolderId, selectedNotebookId)} disabled={selectedNotebook.questions.length === 0} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#a8431a] px-5 text-sm font-black uppercase tracking-wide text-white transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40">
                    Iniciar treino
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-16">
          <div className="flex flex-col gap-4">
            {/* List Subfolders */}
            {currentFolders.map((folder) => {
              const totalQuestionsInFolder = folder.notebooks.reduce((acc, n) => acc + n.questions.length, 0);
              return (
                <div key={folder.id} onClick={() => setSelectedFolderId(folder.id)} className="bg-white rounded-[30px] p-6 border border-gray-100 hover:shadow-xl hover:shadow-[#ac4800]/5 transform hover:-translate-x-1 transition-all group cursor-pointer relative flex items-center gap-6">
                  <div className="w-28 sm:w-32 shrink-0 px-1 py-3">
                    <Folder3D color={folder.color || FOLDER_COLORS[0].value} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {editingFolderId === folder.id ? (
                      <form
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const nextName = editingFolderName.trim();
                          if (!nextName) return;
                          onRenameFolder(folder.id, nextName);
                          setEditingFolderId(null);
                          setEditingFolderName('');
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          autoFocus
                          aria-label={`Novo nome para ${folder.name}`}
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setEditingFolderId(null);
                              setEditingFolderName('');
                            }
                          }}
                          className="min-w-0 flex-1 rounded-xl border border-[#ead9b9] bg-[#fffdf9] px-3 py-2 text-sm font-bold text-[#473c33] outline-none focus:border-[#f4ad2d]"
                        />
                        <button type="submit" aria-label="Salvar nome da pasta" disabled={!editingFolderName.trim()} className="rounded-lg p-2 text-[#64813b] hover:bg-[#eff5e8] disabled:opacity-40">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                            <path d="m5 12 4 4L19 6" />
                          </svg>
                        </button>
                        <button type="button" aria-label="Cancelar edição do nome" onClick={() => { setEditingFolderId(null); setEditingFolderName(''); }} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                            <path d="m6 6 12 12M18 6 6 18" />
                          </svg>
                        </button>
                      </form>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="min-w-0 truncate text-xl font-black uppercase tracking-tighter">{folder.name}</h3>
                        <button
                          type="button"
                          aria-label={`Editar nome da pasta ${folder.name}`}
                          title="Editar nome"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenColorPickerId(null);
                            setEditingFolderId(folder.id);
                            setEditingFolderName(folder.name);
                          }}
                          className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-[#fff6e8] hover:text-[#ac6e00]"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#fecc73] bg-[#fff6e8] px-2 py-0.5 rounded-full">{folder.notebooks.length} CADERNOS</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{totalQuestionsInFolder} QUESTÕES TOTAIS</span>
                    </div>
                    <div className="relative mt-3 w-fit" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={`Mudar cor da pasta ${folder.name}`}
                        aria-expanded={openColorPickerId === folder.id}
                        onClick={() => setOpenColorPickerId(openColorPickerId === folder.id ? null : folder.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-[#faf8f3] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500 transition-colors hover:border-[#e9d8b8] hover:text-[#473c33]"
                      >
                        <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: folder.color || FOLDER_COLORS[0].value }} />
                        Cor da pasta
                      </button>
                      {openColorPickerId === folder.id && (
                        <div role="group" aria-label={`Cores disponíveis para ${folder.name}`} className="absolute left-0 top-full z-30 mt-2 flex gap-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-xl">
                          {FOLDER_COLORS.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              aria-label={`Usar cor ${color.name}`}
                              aria-pressed={(folder.color || FOLDER_COLORS[0].value) === color.value}
                              title={color.name}
                              onClick={() => { onUpdateFolderColor(folder.id, color.value); setOpenColorPickerId(null); }}
                              className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${(folder.color || FOLDER_COLORS[0].value) === color.value ? 'ring-2 ring-[#473c33] ring-offset-2' : 'ring-1 ring-black/10'}`}
                              style={{ backgroundColor: color.value }}
                            />
                          ))}
                          <label className="flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white text-[8px] font-black text-gray-500" title="Escolher qualquer cor">
                            <span className="sr-only">Escolher qualquer cor</span>
                            <input type="color" value={folder.color || FOLDER_COLORS[0].value} onChange={(e) => onUpdateFolderColor(folder.id, e.target.value)} aria-label={`Cor personalizada para ${folder.name}`} className="h-10 w-10 cursor-pointer border-0 bg-transparent p-0" />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {onDeleteFolder && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Deseja realmente apagar esta pasta?')) onDeleteFolder(folder.id);
                      }}
                      className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1.012 0 00-1-1h-4a1 1.012 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}

                  <div className="text-gray-300 group-hover:text-[#fecc73] transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              );
            })}

            {/* List Notebooks */}
            {selectedFolder?.notebooks.map((notebook) => {
              const notebookAttempts = attempts.filter((a) => a.notebookId === notebook.id);
              const notebookAccuracy = notebookAttempts.length > 0 ? Math.round((notebookAttempts.reduce((acc, c) => acc + c.score, 0) / notebookAttempts.reduce((acc, c) => acc + c.total, 0)) * 100) : 0;

              return (
                <div key={notebook.id} onClick={() => setSelectedNotebookId(notebook.id)} className="bg-white rounded-[30px] p-6 border border-gray-100 hover:shadow-xl hover:shadow-[#ac4800]/5 transform hover:-translate-x-1 transition-all group cursor-pointer relative flex items-center gap-6">
                  <div className="w-[4.5rem] shrink-0">
                    <StudyBook3D title={notebook.name} color={notebook.color || '#f97316'} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black uppercase tracking-tighter truncate">{notebook.name}</h3>
                      <button
                        type="button"
                        aria-label={`Editar caderno ${notebook.name}`}
                        title="Editar título e cor da capa"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNotebookId(notebook.id);
                          setNewName(notebook.name);
                          setNewFolderColor(notebook.color || '#f97316');
                          setIsCreating('NOTEBOOK');
                        }}
                        className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-[#fff6e8] hover:text-[#ac6e00]"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{notebook.questions.length} QUESTÕES</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#fda769] bg-[#fff1e8] px-2 py-0.5 rounded-full">{notebookAccuracy}% ACC</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {onMoveAllQuestions && selectedFolderId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoveAllNotebook(notebook);
                        }}
                        className="p-3 text-gray-300 hover:text-[#fecc73] hover:bg-[#fff6e8] rounded-full transition-all"
                        title="Mover questões"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                    )}
                    {onDeleteNotebook && selectedFolderId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Apagar este caderno?')) onDeleteNotebook(selectedFolderId, notebook.id);
                        }}
                        className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1.012 0 00-1-1h-4a1 1.012 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="text-gray-300 group-hover:text-[#fdad74] transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              );
            })}

            {currentFolders.length === 0 && (!selectedFolder || selectedFolder.notebooks.length === 0) && (
              <div className="py-32 text-center border-4 border-dashed border-gray-100 rounded-[50px] bg-gray-50/30">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-gray-400 font-bold text-xl tracking-tight ">Nenhum conteúdo encontrado aqui.</p>
                <p className="text-gray-400 text-xs mt-2 uppercase tracking-widest font-black">Use os botões acima para começar!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {moveAllNotebook && selectedFolderId && (
        <MoveAllNotebookQuestionsModal
          folders={folders}
          currentFolderId={selectedFolderId}
          currentNotebookId={moveAllNotebook.id}
          onConfirm={(targetFolderId, targetNotebookId) => {
            if (onMoveAllQuestions) {
              onMoveAllQuestions(moveAllNotebook.id, selectedFolderId, targetNotebookId, targetFolderId);
            }
            setMoveAllNotebook(null);
          }}
          onClose={() => setMoveAllNotebook(null)}
        />
      )}
    </div>
  );
};

export default MaterialsManager;
