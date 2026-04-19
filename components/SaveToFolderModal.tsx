
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
  const [selectedFolderId, setSelectedFolderId] = useState<string>(folders[0]?.id || '');

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[50px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="p-10">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-2xl font-black italic tracking-tighter">SALVAR EM CADERNO</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-xl">
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Escolha a Pasta</label>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {folders.map(f => (
                  <button 
                    key={f.id}
                    onClick={() => setSelectedFolderId(f.id)}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${selectedFolderId === f.id ? 'border-blue-500 bg-blue-50' : 'border-gray-50 bg-gray-50/30'}`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 ${selectedFolderId === f.id ? 'bg-blue-500 border-blue-500' : 'border-gray-200'}`} />
                    <span className="font-bold text-sm uppercase">{f.name}</span>
                  </button>
                ))}
                {folders.length === 0 && (
                   <div className="p-4 text-center bg-gray-50 rounded-2xl text-xs font-bold text-gray-400 italic">
                     Nenhuma pasta encontrada. Crie uma em "Materiais" primeiro.
                   </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Nome do Caderno</label>
              <input 
                autoFocus
                value={notebookName}
                onChange={(e) => setNotebookName(e.target.value)}
                placeholder="Ex: Resumo de Direito..."
                className="w-full bg-gray-50 border-2 border-transparent rounded-3xl px-6 py-4 text-base font-bold focus:outline-none focus:border-blue-400 transition-all"
              />
            </div>
          </div>

          <div className="mt-12 flex gap-4">
            <button 
              onClick={onClose}
              className="flex-1 py-5 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-gray-600 transition-colors"
            >
              CANCELAR
            </button>
            <button 
              onClick={() => onConfirm(selectedFolderId, notebookName)}
              disabled={!notebookName.trim() || !selectedFolderId}
              className="flex-1 bg-yellow-400 text-white py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-yellow-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30"
            >
              SALVAR
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #F3F4F6;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E7EB;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default SaveToFolderModal;
