
import React, { useState } from 'react';
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

const MaterialsManager: React.FC<MaterialsManagerProps> = ({ 
  folders, 
  attempts, 
  onBack, 
  onPlayQuiz, 
  onCreateFolder, 
  onCreateNotebook, 
  onDeleteFolder, 
  onDeleteNotebook, 
  onMoveAllQuestions, 
  strategicMode, 
  editalConfig,
  selectedFolderId,
  setSelectedFolderId,
  selectedNotebookId,
  setSelectedNotebookId
}) => {
  const [moveAllNotebook, setMoveAllNotebook] = useState<Notebook | null>(null);
  const [isCreating, setIsCreating] = useState<'FOLDER' | 'NOTEBOOK' | null>(null);
  const [newName, setNewName] = useState('');

  const totalQuestions = attempts.reduce((acc, curr) => acc + curr.total, 0);
  const totalCorrect = attempts.reduce((acc, curr) => acc + curr.score, 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const selectedNotebook = selectedFolder?.notebooks.find(n => n.id === selectedNotebookId);

  // Get current level folders and notebooks
  const currentFolders = folders.filter(f => f.parentId === (selectedFolderId || undefined));

  const getBreadcrumbs = () => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'MATERIAIS' }];
    if (!selectedFolderId) return crumbs;

    const path: { id: string | null; name: string }[] = [];
    let curr: QuizFolder | undefined = folders.find(f => f.id === selectedFolderId);
    while (curr) {
      path.unshift({ id: curr.id, name: curr.name });
      curr = folders.find(f => f.id === curr?.parentId);
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
        <button 
          onClick={selectedNotebookId ? () => setSelectedNotebookId(null) : (selectedFolderId ? () => setSelectedFolderId(selectedFolder?.parentId || null) : onBack)} 
          className="text-gray-400 font-bold text-xs tracking-widest flex items-center gap-2 hover:text-gray-600 transition-colors uppercase"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          {selectedNotebookId ? 'VOLTAR PARA PASTA' : (selectedFolderId ? (selectedFolder?.parentId ? 'VOLTAR PARA PASTA PAI' : 'VOLTAR ÀS PASTAS') : 'HUB PRINCIPAL')}
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
                  className={`text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${idx === breadcrumbs.length - 1 ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
          <h2 className="text-3xl font-black tracking-tighter italic uppercase leading-none">
            {strategicMode ? 'MATERIAIS' : 'MEUS'} <span className={strategicMode ? 'text-blue-900' : 'text-blue-500'}>{selectedNotebookId ? 'CADERNO' : (strategicMode ? 'ESTRATÉGICOS' : 'MATERIAIS')}</span>
          </h2>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {(!selectedNotebookId) && (
            <>
              <button 
                onClick={() => setIsCreating('FOLDER')}
                className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                {selectedFolderId ? 'Subpasta' : 'Pasta'}
              </button>
              {selectedFolderId && (
                <button 
                  onClick={() => setIsCreating('NOTEBOOK')}
                  className="bg-orange-50 hover:bg-orange-100 text-orange-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                  Caderno
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-10 animate-in zoom-in-95 duration-500">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black italic tracking-tighter uppercase">
                {isCreating === 'FOLDER' ? (selectedFolderId ? 'CRIAR SUBPASTA' : 'CRIAR NOVA PASTA') : 'CRIAR NOVO CADERNO'}
              </h3>
              <button onClick={() => setIsCreating(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <input 
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={isCreating === 'FOLDER' ? "Ex: Revisão OAB" : "Ex: Atos Administrativos"}
              className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-base font-bold focus:outline-none focus:border-blue-400 transition-all mb-8"
              onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-4">
              <button 
                onClick={() => setIsCreating(null)}
                className="flex-1 py-4 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-gray-600"
              >
                CANCELAR
              </button>
              <button 
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 bg-blue-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 disabled:opacity-30 transition-all"
              >
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
              <div className="bg-white rounded-[50px] p-10 md:p-14 shadow-xl border border-gray-100">
                <h3 className="text-3xl font-black mb-8 italic uppercase tracking-tighter">{selectedNotebook.name}</h3>
                
                {selectedNotebook.summary ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] tracking-widest">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                       Resumo do Caderno
                    </div>
                    <p className="text-lg leading-relaxed text-gray-700 font-medium whitespace-pre-wrap">
                      {selectedNotebook.summary}
                    </p>
                  </div>
                ) : (
                  <div className="py-12 text-center bg-gray-50 rounded-[35px] border border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold italic">Este caderno não possui um resumo salvo.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#0A0F1E] rounded-[45px] p-10 text-white shadow-2xl">
                 <h4 className="text-xl font-black mb-6 italic uppercase tracking-tighter">PRATICAR</h4>
                 <div className="space-y-4 mb-10">
                    <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                       <span>Total Questões</span>
                       <span className="text-blue-400">{selectedNotebook.questions.length}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                       <span>Sua Pasta</span>
                       <span className="text-yellow-400">{selectedFolder?.name}</span>
                    </div>
                 </div>
                 <button 
                   onClick={() => onPlayQuiz(selectedFolderId, selectedNotebookId)}
                   disabled={selectedNotebook.questions.length === 0}
                   className="w-full bg-blue-500 text-white py-6 rounded-[25px] font-black text-lg hover:bg-blue-600 transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3 disabled:opacity-20"
                 >
                   INICIAR TREINO
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                 </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-16">
          {!selectedFolderId && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-white p-10 rounded-[50px] shadow-xl shadow-blue-900/5 border border-gray-100 group hover:-translate-y-1 transition-all">
                <p className="text-gray-400 font-black uppercase text-[10px] tracking-[0.3em] mb-4">Precisão Geral</p>
                <div className="flex items-end gap-2">
                  <span className="text-6xl font-black text-blue-600 italic tracking-tighter leading-none">{accuracy}%</span>
                  <div className="w-1.5 h-10 bg-blue-100 rounded-full mb-1"></div>
                </div>
              </div>
              <div className="bg-white p-10 rounded-[50px] shadow-xl shadow-gray-900/5 border border-gray-100 group hover:-translate-y-1 transition-all">
                <p className="text-gray-400 font-black uppercase text-[10px] tracking-[0.3em] mb-4">Pastas</p>
                <div className="flex items-end gap-2">
                  <span className="text-6xl font-black text-gray-800 italic tracking-tighter leading-none">{folders.length}</span>
                  <div className="w-1.5 h-10 bg-gray-100 rounded-full mb-1"></div>
                </div>
              </div>
              <div className="bg-white p-10 rounded-[50px] shadow-xl shadow-green-900/5 border border-gray-100 group hover:-translate-y-1 transition-all">
                <p className="text-gray-400 font-black uppercase text-[10px] tracking-[0.3em] mb-4">Acertos</p>
                <div className="flex items-end gap-2">
                  <span className="text-6xl font-black text-green-500 italic tracking-tighter leading-none">{totalCorrect}</span>
                  <div className="w-1.5 h-10 bg-green-100 rounded-full mb-1"></div>
                </div>
              </div>
              <div className="bg-[#0A0F1E] p-10 rounded-[50px] text-white shadow-2xl shadow-blue-900/20 group hover:-translate-y-1 transition-all">
                <p className="text-blue-400 font-black uppercase text-[10px] tracking-[0.3em] mb-4">Treinos</p>
                <div className="flex items-end gap-2">
                  <span className="text-6xl font-black italic tracking-tighter leading-none">{attempts.length}</span>
                  <div className="w-1.5 h-10 bg-blue-900/50 rounded-full mb-1"></div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* List Subfolders */}
            {currentFolders.map(folder => {
              const totalQuestionsInFolder = folder.notebooks.reduce((acc, n) => acc + n.questions.length, 0);
              return (
                <div 
                  key={folder.id} 
                  onClick={() => setSelectedFolderId(folder.id)}
                  className="bg-white rounded-[30px] p-6 border border-gray-100 hover:shadow-xl hover:shadow-blue-900/5 transform hover:-translate-x-1 transition-all group cursor-pointer relative flex items-center gap-6"
                >
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-black uppercase tracking-tighter italic truncate">{folder.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{folder.notebooks.length} CADERNOS</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{totalQuestionsInFolder} QUESTÕES TOTAIS</span>
                    </div>
                  </div>

                  {onDeleteFolder && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (window.confirm("Deseja realmente apagar esta pasta?")) onDeleteFolder(folder.id); 
                      }}
                      className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1.012 0 00-1-1h-4a1 1.012 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                  
                  <div className="text-gray-300 group-hover:text-blue-500 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              );
            })}

            {/* List Notebooks */}
            {selectedFolder?.notebooks.map(notebook => {
              const notebookAttempts = attempts.filter(a => a.notebookId === notebook.id);
              const notebookAccuracy = notebookAttempts.length > 0 
                ? Math.round((notebookAttempts.reduce((acc, c) => acc + c.score, 0) / notebookAttempts.reduce((acc, c) => acc + c.total, 0)) * 100) 
                : 0;

              return (
                <div 
                  key={notebook.id} 
                  onClick={() => setSelectedNotebookId(notebook.id)}
                  className="bg-white rounded-[30px] p-6 border border-gray-100 hover:shadow-xl hover:shadow-orange-900/5 transform hover:-translate-x-1 transition-all group cursor-pointer relative flex items-center gap-6"
                >
                  <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 shrink-0 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black uppercase tracking-tighter italic truncate">{notebook.name}</h3>
                      {notebook.summary && <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shrink-0">RESUMO</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{notebook.questions.length} QUESTÕES</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{notebookAccuracy}% ACC</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {onMoveAllQuestions && selectedFolderId && (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setMoveAllNotebook(notebook);
                        }}
                        className="p-3 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-all"
                        title="Mover questões"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                      </button>
                    )}
                    {onDeleteNotebook && selectedFolderId && (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (window.confirm("Apagar este caderno?")) onDeleteNotebook(selectedFolderId, notebook.id); 
                        }}
                        className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1.012 0 00-1-1h-4a1 1.012 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>

                  <div className="text-gray-300 group-hover:text-orange-500 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              );
            })}

            {currentFolders.length === 0 && (!selectedFolder || selectedFolder.notebooks.length === 0) && (
              <div className="py-32 text-center border-4 border-dashed border-gray-100 rounded-[50px] bg-gray-50/30">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                   <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                </div>
                <p className="text-gray-400 font-bold text-xl tracking-tight italic">Nenhum conteúdo encontrado aqui.</p>
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
