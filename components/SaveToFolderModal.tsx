
import React, { useState } from 'react';
import { QuizFolder } from '../types';

interface SaveToFolderModalProps {
  folders: QuizFolder[];
  suggestedName: string;
  onConfirm: (folderId: string, notebookName: string) => void;
  onClose: () => void;
}

const SaveToFolderModal: React.FC<SaveToFolderModalProps> = ({ folders, suggestedName, onConfirm, onClose }) => {
  const [notebookName, setNotebookName] = useState(suggestedName);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(folders[0]?.id || 'NEW');
  const [newFolderName, setNewFolderName] = useState('');

  const handleConfirm = () => {
    if (selectedFolderId === 'NEW') {
      if (!newFolderName.trim()) return;
      onConfirm('NEW:' + newFolderName, notebookName);
    } else {
      onConfirm(selectedFolderId, notebookName);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#0A0F1E] w-full max-w-md rounded-[50px] shadow-2xl border border-white/10 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="p-10">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-2xl font-black italic tracking-tighter text-white">SALVAR EM CADERNO</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block ml-2">Destino do Material</label>
              <div className="space-y-3 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                {folders.map(f => (
                  <button 
                    key={f.id}
                    onClick={() => setSelectedFolderId(f.id)}
                    className={`w-full p-6 rounded-[30px] border-2 text-left transition-all flex items-center gap-4 group ${selectedFolderId === f.id ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/10' : 'border-white/5 bg-white/5 hover:border-white/20'}`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedFolderId === f.id ? 'bg-orange-500 border-orange-500' : 'border-white/10 group-hover:border-white/30'}`}>
                      {selectedFolderId === f.id && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div>
                      <span className={`font-black text-sm uppercase tracking-tight transition-colors ${selectedFolderId === f.id ? 'text-white' : 'text-slate-400'}`}>{f.name}</span>
                      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{f.notebooks.length} cadernos</p>
                    </div>
                  </button>
                ))}
                
                <button 
                  onClick={() => setSelectedFolderId('NEW')}
                  className={`w-full p-6 rounded-[30px] border-2 border-dashed text-left transition-all flex items-center gap-4 group ${selectedFolderId === 'NEW' ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-white/5 hover:border-white/20'}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedFolderId === 'NEW' ? 'bg-blue-500 border-blue-500' : 'border-white/10 group-hover:border-white/30'}`}>
                    {selectedFolderId === 'NEW' && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M12 4v16m8-8H4" /></svg>}
                  </div>
                  <span className={`font-black text-sm uppercase tracking-tight ${selectedFolderId === 'NEW' ? 'text-white' : 'text-slate-500'}`}>+ CRIAR NOVA PASTA</span>
                </button>
              </div>
            </div>

            {selectedFolderId === 'NEW' && (
              <div className="animate-in slide-in-from-top-4 duration-300">
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] block mb-3 ml-2">Nome da Nova Pasta</label>
                <input 
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="EX: DIREITO CONSTITUCIONAL"
                  className="w-full bg-white/5 border-2 border-blue-500/30 rounded-[25px] px-8 py-5 text-lg font-black text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-white/10 uppercase italic"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block mb-3 ml-2">Título do Caderno</label>
              <input 
                value={notebookName}
                onChange={(e) => setNotebookName(e.target.value)}
                placeholder="Ex: Resumo de Atos Administrativos"
                className="w-full bg-white/5 border-2 border-white/10 rounded-[25px] px-8 py-5 text-lg font-black text-white focus:outline-none focus:border-orange-500 transition-all placeholder:text-white/10 italic"
              />
            </div>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4">
            <button 
              onClick={onClose}
              className="py-6 text-gray-500 font-black text-[10px] uppercase tracking-[0.4em] hover:text-white transition-all active:scale-95"
            >
              CANCELAR
            </button>
            <button 
              onClick={handleConfirm}
              disabled={!notebookName.trim() || (selectedFolderId === 'NEW' && !newFolderName.trim())}
              className="bg-orange-500 text-white py-6 rounded-[30px] font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl shadow-orange-900/40 hover:bg-orange-400 active:scale-95 transition-all disabled:opacity-20 disabled:grayscale"
            >
              SALVAR AGORA
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default SaveToFolderModal;
