import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { QuizFolder, Notebook, QuizAttempt, EditalConfig } from '../types';
import { MoveAllNotebookQuestionsModal } from './MoveAllNotebookQuestionsModal';

interface MaterialsManagerProps {
  folders: QuizFolder[];
  attempts: QuizAttempt[];
  onBack: () => void;
  onPlayQuiz: (folderId: string, notebookId: string) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onCreateNotebook: (folderId: string, name: string) => void;
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

const MaterialsManager: React.FC<MaterialsManagerProps> = ({ folders, attempts, onBack, onPlayQuiz, onCreateFolder, onCreateNotebook, onDeleteFolder, onDeleteNotebook, onMoveAllQuestions, strategicMode, editalConfig, selectedFolderId, setSelectedFolderId, selectedNotebookId, setSelectedNotebookId }) => {
  const [moveAllNotebook, setMoveAllNotebook] = useState<Notebook | null>(null);
  const [isCreating, setIsCreating] = useState<'FOLDER' | 'NOTEBOOK' | null>(null);
  const [newName, setNewName] = useState('');

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
      onCreateFolder(newName.trim(), selectedFolderId || undefined);
    } else if (isCreating === 'NOTEBOOK' && selectedFolderId) {
      onCreateNotebook(selectedFolderId, newName.trim());
    }
    setNewName('');
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
              <button onClick={() => setIsCreating('FOLDER')} className="bg-[#fff6e8] hover:bg-[#fff0d5] text-[#fec868] px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                </svg>
                {selectedFolderId ? 'Subpasta' : 'Pasta'}
              </button>
              {selectedFolderId && (
                <button onClick={() => setIsCreating('NOTEBOOK')} className="bg-[#fff1e8] hover:bg-[#fee6d5] text-[#fda769] px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm">
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
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-10 animate-in zoom-in-95 duration-500">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black tracking-tighter uppercase">{isCreating === 'FOLDER' ? (selectedFolderId ? 'CRIAR SUBPASTA' : 'CRIAR NOVA PASTA') : 'CRIAR NOVO CADERNO'}</h3>
              <button onClick={() => setIsCreating(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={isCreating === 'FOLDER' ? 'Ex: Revisão OAB' : 'Ex: Atos Administrativos'} className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-base font-bold focus:outline-none focus:border-[#fed386] transition-all mb-8" onKeyPress={(e) => e.key === 'Enter' && handleCreate()} />
            <div className="flex gap-4">
              <button onClick={() => setIsCreating(null)} className="flex-1 py-4 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-gray-600">
                CANCELAR
              </button>
              <button onClick={handleCreate} disabled={!newName.trim()} className="flex-1 bg-[#fecc73] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-[#fff0d5]/60 disabled:opacity-30 transition-all">
                CRIAR AGORA
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
              <div className="bg-white rounded-[36px] p-6 sm:p-8 shadow-xl border border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-5 border-b border-gray-100">
                  <div>
                    <p className="text-[10px] font-black text-[#fec868] uppercase tracking-[0.3em] mb-2">Caderno salvo</p>
                    <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-[#473c33]">{selectedNotebook.name}</h3>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-[#fff6e8] text-[#ec9700] text-[10px] font-black uppercase tracking-widest">{selectedNotebook.questions.length} questões</span>
                </div>

                {selectedNotebook.questions.length > 0 ? (
                  <div className="space-y-3" aria-label="Questões salvas">
                    {selectedNotebook.questions.map((question, index) => (
                      <article key={question.id || index} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 sm:p-5 hover:border-[#ffe6b9] hover:bg-[#fffaf2] transition-colors">
                        <div className="flex items-start gap-3">
                          <span className="w-8 h-8 shrink-0 rounded-xl bg-[#fff6e8] text-[#ec9700] flex items-center justify-center text-xs font-black">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm sm:text-base leading-relaxed font-semibold text-[#334155] line-clamp-3" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(question.question) }} />
                            <div className="flex flex-wrap items-center gap-2 mt-3 text-[9px] font-black uppercase tracking-widest text-gray-400">
                              <span>{question.options.filter((option) => option.trim()).length || question.options.length} alternativas</span>
                              {question.topic && <span className="text-[#fda769]">{question.topic}</span>}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold">Este caderno ainda não possui questões salvas.</p>
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
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#473c33] rounded-[45px] p-10 text-white shadow-2xl">
                <p className="text-[10px] font-black text-[#fed386] uppercase tracking-[0.3em] mb-3">Caderno de questões</p>
                <h4 className="text-2xl font-black mb-6 uppercase tracking-tighter">PRATICAR AGORA</h4>
                <div className="space-y-4 mb-10">
                  <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <span>Total Questões</span>
                    <span className="text-[#fed386]">{selectedNotebook.questions.length}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <span>Sua Pasta</span>
                    <span className="text-[#fed386]">{selectedFolder?.name}</span>
                  </div>
                </div>
                <button onClick={() => onPlayQuiz(selectedFolderId, selectedNotebookId)} disabled={selectedNotebook.questions.length === 0} className="w-full bg-[#fecc73] text-white py-6 rounded-[25px] font-black text-lg hover:bg-[#fec868] transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-20">
                  INICIAR TREINO
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
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
                <div key={folder.id} onClick={() => setSelectedFolderId(folder.id)} className="bg-white rounded-[30px] p-6 border border-gray-100 hover:shadow-xl hover: transform hover:-translate-x-1 transition-all group cursor-pointer relative flex items-center gap-6">
                  <div className="w-14 h-14 bg-[#fff6e8] rounded-2xl flex items-center justify-center text-[#fec868] shrink-0 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-black uppercase tracking-tighter truncate">{folder.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#fecc73] bg-[#fff6e8] px-2 py-0.5 rounded-full">{folder.notebooks.length} CADERNOS</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{totalQuestionsInFolder} QUESTÕES TOTAIS</span>
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
                  <div className="w-14 h-14 bg-[#fff1e8] rounded-2xl flex items-center justify-center text-[#fda769] shrink-0 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black uppercase tracking-tighter truncate">{notebook.name}</h3>
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
