
import React from 'react';
import { QuizFolder, QuizAttempt } from '../types';

interface QuizManagerProps {
  folders: QuizFolder[];
  attempts: QuizAttempt[];
  onBack: () => void;
  onPlay: (folderId: string) => void;
}

const QuizManager: React.FC<QuizManagerProps> = ({ folders, attempts, onBack, onPlay }) => {
  const totalQuestions = attempts.reduce((acc, curr) => acc + curr.total, 0);
  const totalCorrect = attempts.reduce((acc, curr) => acc + curr.score, 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  return (
    <div className="animate-in fade-in duration-700">
      <div className="flex justify-between items-center mb-12">
        <button onClick={onBack} className="text-gray-400 font-bold text-xs tracking-widest flex items-center gap-2 hover:text-gray-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          HUB PRINCIPAL
        </button>
        <h2 className="text-3xl font-black tracking-tighter">BANCO DE MATERIAIS</h2>
      </div>

      {/* Estatísticas Consolidadas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-gray-100 border border-gray-50">
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-2">Sua Precisão</p>
          <div className="flex items-end gap-2">
             <span className="text-5xl font-black text-blue-600">{accuracy}%</span>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-gray-100 border border-gray-50">
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-2">Acertos</p>
          <span className="text-5xl font-black text-green-500">{totalCorrect}</span>
        </div>
        <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-gray-100 border border-gray-100">
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-2">Erros</p>
          <span className="text-5xl font-black text-red-500">{totalQuestions - totalCorrect}</span>
        </div>
        <div className="bg-[#0A0F1E] p-8 rounded-[40px] text-white shadow-2xl">
          <p className="text-blue-400 font-bold uppercase text-[10px] tracking-widest mb-2">Total Treinos</p>
          <span className="text-5xl font-black">{attempts.length}</span>
        </div>
      </div>

      {/* Lista de Pastas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {folders.map(folder => {
          const folderAttempts = attempts.filter(a => a.folderId === folder.id);
          const lastAttempt = folderAttempts.length > 0 ? folderAttempts[folderAttempts.length - 1] : null;
          const bestScore = folderAttempts.length > 0 ? Math.max(...folderAttempts.map(a => (a.score/a.total)*100)) : 0;
          
          // Calculate total questions by summing up questions in all notebooks of this folder
          const totalQuestionsInFolder = folder.notebooks.reduce((acc, n) => acc + n.questions.length, 0);
          
          return (
            <div key={folder.id} className="bg-white rounded-[45px] p-10 border border-gray-100 hover:shadow-2xl transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                 <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              </div>
              
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-8 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              
              <h3 className="text-2xl font-black mb-4 uppercase tracking-tighter leading-none">{folder.name}</h3>
              
              <div className="space-y-4 mb-10">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <span>Conteúdo</span>
                  {/* Fixed: folder.questions.length was invalid as questions belong to notebooks */}
                  <span className="text-blue-600">{totalQuestionsInFolder} questões</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <span>Melhor Pontuação</span>
                  <span className="text-green-500">{Math.round(bestScore)}%</span>
                </div>
                {lastAttempt && (
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    <span>Último Treino</span>
                    <span className="text-orange-500">{lastAttempt.score}/{lastAttempt.total}</span>
                  </div>
                )}
              </div>

              <button 
                onClick={() => onPlay(folder.id)}
                className="w-full bg-[#0A0F1E] text-white py-5 rounded-[22px] font-black hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-100"
              >
                TREINAR AGORA
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </button>
            </div>
          );
        })}

        {folders.length === 0 && (
          <div className="col-span-full py-32 text-center border-4 border-dashed border-gray-100 rounded-[50px]">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
               <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <p className="text-gray-400 font-black text-xl tracking-tight">Crie seu primeiro Bizu com a IA para ver pastas aqui!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizManager;
