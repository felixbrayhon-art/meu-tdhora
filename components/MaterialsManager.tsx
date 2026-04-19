
import React, { useState } from 'react';
import { QuizFolder, Notebook, QuizAttempt, EditalConfig } from '../types';

interface MaterialsManagerProps {
  folders: QuizFolder[];
  attempts: QuizAttempt[];
  onBack: () => void;
  onPlayQuiz: (folderId: string, notebookId: string) => void;
  onCreateFolder: (name: string) => void;
  onCreateNotebook: (folderId: string, name: string) => void;
  strategicMode?: boolean;
  editalConfig?: EditalConfig;
}

const MaterialsManager: React.FC<MaterialsManagerProps> = ({ folders, attempts, onBack, onPlayQuiz, onCreateFolder, onCreateNotebook, strategicMode, editalConfig }) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<'FOLDER' | 'NOTEBOOK' | null>(null);
  const [newName, setNewName] = useState('');

  const totalQuestions = attempts.reduce((acc, curr) => acc + curr.total, 0);
  const totalCorrect = attempts.reduce((acc, curr) => acc + curr.score, 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const selectedNotebook = selectedFolder?.notebooks.find(n => n.id === selectedNotebookId);

  const handleCreate = () => {
    if (!newName.trim()) return;
    if (isCreating === 'FOLDER') {
      onCreateFolder(newName.trim());
    } else if (isCreating === 'NOTEBOOK' && selectedFolderId) {
      onCreateNotebook(selectedFolderId, newName.trim());
    }
    setNewName('');
    setIsCreating(null);
  };

  return (
    <div className="animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
        <button 
          onClick={selectedNotebookId ? () => setSelectedNotebookId(null) : (selectedFolderId ? () => setSelectedFolderId(null) : onBack)} 
          className="text-gray-400 font-bold text-xs tracking-widest flex items-center gap-2 hover:text-gray-600 transition-colors uppercase"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          {selectedNotebookId ? 'VOLTAR PARA PASTA' : (selectedFolderId ? 'VOLTAR ÀS PASTAS' : 'HUB PRINCIPAL')}
        </button>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <h2 className="text-3xl font-black tracking-tighter italic uppercase flex-1">
            {strategicMode ? 'MATERIAIS' : 'MEUS'} <span className={strategicMode ? 'text-blue-900' : 'text-blue-500'}>{selectedFolderId ? 'CADERNOS' : (strategicMode ? 'ESTRATÉGICOS' : 'MATERIAIS')}</span>
          </h2>
          {!selectedNotebookId && (
            <button 
              onClick={() => setIsCreating(selectedFolderId ? 'NOTEBOOK' : 'FOLDER')}
              className="bg-blue-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
              {selectedFolderId ? 'NOVO CADERNO' : 'NOVA PASTA'}
            </button>
          )}
        </div>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-10 animate-in zoom-in-95 duration-500">
            <h3 className="text-2xl font-black italic tracking-tighter mb-8 uppercase">
              {isCreating === 'FOLDER' ? 'CRIAR NOVA PASTA' : 'CRIAR NOVO CADERNO'}
            </h3>
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

      {/* Stats Summary Only on Folders View */}
      {!selectedFolderId && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12 animate-in slide-in-from-top-4">
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-2">Sua Precisão</p>
            <span className="text-5xl font-black text-blue-600">{accuracy}%</span>
          </div>
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-2">Pastas</p>
            <span className="text-5xl font-black text-gray-800">{folders.length}</span>
          </div>
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-2">Acertos</p>
            <span className="text-5xl font-black text-green-500">{totalCorrect}</span>
          </div>
          <div className="bg-[#0A0F1E] p-8 rounded-[40px] text-white shadow-2xl">
            <p className="text-blue-400 font-bold uppercase text-[10px] tracking-widest mb-2">Treinos</p>
            <span className="text-5xl font-black">{attempts.length}</span>
          </div>
        </div>
      )}

      {selectedNotebookId && selectedNotebook && selectedFolderId ? (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-[50px] p-10 md:p-14 shadow-xl border border-gray-100">
                <h3 className="text-3xl font-black mb-8 italic uppercase tracking-tighter">{selectedNotebook.name}</h3>
                
                {selectedNotebook.summary ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] tracking-widest">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
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
      ) : selectedFolderId && selectedFolder ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
          {selectedFolder.notebooks.map(notebook => {
             const notebookAttempts = attempts.filter(a => a.notebookId === notebook.id);
             const accuracy = notebookAttempts.length > 0 
               ? Math.round((notebookAttempts.reduce((acc, c) => acc + c.score, 0) / notebookAttempts.reduce((acc, c) => acc + c.total, 0)) * 100) 
               : 0;

             return (
               <div 
                 key={notebook.id} 
                 onClick={() => setSelectedNotebookId(notebook.id)}
                 className="bg-white rounded-[45px] p-10 border border-gray-100 hover:shadow-2xl transition-all group cursor-pointer relative overflow-hidden h-full flex flex-col"
               >
                 <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                 </div>
                 
                 <div className="flex justify-between items-start mb-8">
                   <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                   </div>
                   {notebook.summary && (
                     <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">RESUMO</span>
                   )}
                 </div>
                 
                 <h3 className="text-2xl font-black mb-6 uppercase tracking-tighter leading-none italic flex-1">{notebook.name}</h3>
                 
                 <div className="space-y-4">
                   <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                     <span>QUESTÕES</span>
                     <span className="text-blue-600">{notebook.questions.length}</span>
                   </div>
                   <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                     <div 
                       className="bg-blue-400 h-full" 
                       style={{ width: `${accuracy}%` }}
                     />
                   </div>
                   <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-gray-300">
                     <span>PRECISÃO MÉDIA</span>
                     <span>{accuracy}%</span>
                   </div>
                 </div>
               </div>
             );
          })}

          <button 
            onClick={() => setIsCreating('NOTEBOOK')}
            className="bg-gray-50 rounded-[45px] p-10 border-4 border-dashed border-gray-100 hover:border-orange-200 hover:bg-white transition-all group flex flex-col items-center justify-center text-center min-h-[280px]"
          >
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-gray-200 group-hover:text-orange-500 shadow-sm transition-colors mb-4">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            </div>
            <p className="text-gray-400 group-hover:text-orange-600 font-black text-lg tracking-tight uppercase italic">Novo Caderno</p>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {folders.map(folder => {
            const totalNotebookQuestions = folder.notebooks.reduce((acc, n) => acc + n.questions.length, 0);
            return (
              <div 
                key={folder.id} 
                onClick={() => setSelectedFolderId(folder.id)}
                className="bg-white rounded-[45px] p-10 border border-gray-100 hover:shadow-2xl transition-all group cursor-pointer relative overflow-hidden h-full flex flex-col"
              >
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                   <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                </div>
                
                <div className="flex justify-between items-start mb-8">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  </div>
                  <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{folder.notebooks.length} CADERNOS</span>
                </div>
                
                <h3 className="text-2xl font-black mb-6 uppercase tracking-tighter leading-none italic flex-1">{folder.name}</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    <span>QUESTÕES TOTAIS</span>
                    <span className="text-blue-600">{totalNotebookQuestions}</span>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-400 h-full" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            );
          })}

          <button 
            onClick={() => setIsCreating('FOLDER')}
            className="bg-gray-50 rounded-[45px] p-10 border-4 border-dashed border-gray-100 hover:border-blue-200 hover:bg-white transition-all group flex flex-col items-center justify-center text-center min-h-[280px]"
          >
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-gray-200 group-hover:text-blue-500 shadow-sm transition-colors mb-4">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            </div>
            <p className="text-gray-400 group-hover:text-blue-600 font-black text-lg tracking-tight uppercase italic">Nova Pasta</p>
          </button>
        </div>
      )}

      {!selectedFolderId && folders.length === 0 && (
        <div className="py-20 text-center animate-in fade-in slide-in-from-bottom-4">
          <p className="text-gray-300 text-sm mt-2">Organize seu material criando pastas primeiro.</p>
        </div>
      )}
    </div>
  );
};

export default MaterialsManager;
