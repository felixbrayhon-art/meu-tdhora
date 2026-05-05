
import React, { useState } from 'react';
import { QuizFolder } from '../types';
import { ChevronRight } from 'lucide-react';

interface MoveToNotebookModalProps {
  folders: QuizFolder[];
  currentFolderId: string;
  currentNotebookId: string;
  onConfirm: (targetFolderId: string, targetNotebookId: string) => void;
  onClose: () => void;
}

export const MoveToNotebookModal: React.FC<MoveToNotebookModalProps> = ({ folders, currentFolderId, currentNotebookId, onConfirm, onClose }) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string>(currentFolderId);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>('');

  const selectedFolder = folders.find(f => f.id === selectedFolderId);

  const handleConfirm = () => {
    if (selectedFolderId && selectedNotebookId) {
      onConfirm(selectedFolderId, selectedNotebookId);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#0A0F1E] w-full max-w-md rounded-[50px] shadow-2xl border border-white/10 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="p-10">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-2xl font-black italic tracking-tighter text-white">MOVER QUESTÃO</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-colors">
              ✕
            </button>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block ml-2">Escolha a Pasta</label>
              <select
                value={selectedFolderId}
                onChange={(e) => { setSelectedFolderId(e.target.value); setSelectedNotebookId(''); }}
                className="w-full p-4 rounded-[20px] bg-white/5 border border-white/10 text-white font-bold"
              >
                {folders.map(f => <option key={f.id} value={f.id} className="bg-[#0A0F1E]">{f.name}</option>)}
              </select>
            </div>

            {selectedFolder && (
              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] block ml-2">Escolha o Caderno</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedFolder.notebooks.map(n => (
                        <button
                            key={n.id}
                            onClick={() => setSelectedNotebookId(n.id)}
                            disabled={selectedFolderId === currentFolderId && n.id === currentNotebookId}
                            className={`w-full p-4 rounded-xl text-left border ${selectedNotebookId === n.id ? 'bg-orange-500/20 border-orange-500' : 'bg-white/5 border-white/5 disabled:opacity-30'}`}
                        >
                            {n.name}
                        </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-12">
            <button 
              onClick={handleConfirm}
              disabled={!selectedNotebookId || (selectedFolderId === currentFolderId && selectedNotebookId === currentNotebookId)}
              className="w-full bg-orange-500 text-white py-6 rounded-[30px] font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl hover:bg-orange-400 disabled:opacity-20"
            >
              MOVER QUESTÃO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
