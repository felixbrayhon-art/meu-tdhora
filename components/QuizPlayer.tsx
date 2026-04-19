
import React, { useState } from 'react';
import { QuizFolder, Notebook, QuizQuestion } from '../types';

interface QuizPlayerProps {
  folder: QuizFolder;
  notebook: Notebook;
  onBack: () => void;
  onComplete: (score: number, total: number) => void;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ folder, notebook, onBack, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);

  const handleSelect = (optionIndex: number) => {
    if (selectedAnswer !== null) return; 
    
    setSelectedAnswer(optionIndex);
    const isCorrect = optionIndex === notebook.questions[currentIndex].correctAnswer;
    
    if (isCorrect) setScore(s => s + 1);
  };

  const nextQuestion = () => {
    if (currentIndex < notebook.questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowCommentary(false);
    } else {
      setShowResult(true);
    }
  };

  const currentQ = notebook.questions[currentIndex];

  if (showResult) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 animate-in zoom-in-95 duration-500">
        <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
           <span className="text-xl font-black text-blue-600">RESULTADO</span>
        </div>
        <h2 className="text-4xl font-black mb-4 tracking-tight">Treino Finalizado!</h2>
        <p className="text-gray-400 text-lg mb-12 font-medium">Você acertou {score} de {notebook.questions.length} questões nesta rodada.</p>
        <div className="bg-gray-50 p-6 rounded-[30px] mb-12 flex justify-around">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Precisão</p>
            <p className="text-2xl font-black text-blue-600">{Math.round((score / notebook.questions.length) * 100)}%</p>
          </div>
          <div className="border-l border-gray-200"></div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">XP Ganho</p>
            <p className="text-2xl font-black text-orange-500">+{score * 50}</p>
          </div>
        </div>
        <button 
          onClick={() => onComplete(score, notebook.questions.length)} 
          className="w-full bg-[#0A0F1E] text-white py-6 rounded-[25px] font-black hover:scale-[1.02] transition-all shadow-xl shadow-gray-200"
        >
          SALVAR RESULTADO E VOLTAR
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-10">
      <div className="flex justify-between items-center mb-12">
        <button 
          onClick={onBack} 
          className="text-gray-400 font-bold text-xs tracking-widest flex items-center gap-2 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
          </svg>
          SAIR
        </button>
        <div className="h-2 flex-1 mx-12 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all duration-700 ease-out" style={{ width: `${((currentIndex + 1) / notebook.questions.length) * 100}%` }}></div>
        </div>
        <span className="font-black text-blue-600 tabular-nums">{currentIndex + 1}/{notebook.questions.length}</span>
      </div>

      <div className="bg-white rounded-[45px] p-10 md:p-14 shadow-xl border border-gray-100 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
        <h3 className="text-2xl font-black text-[#1E293B] mb-12 leading-tight">{currentQ.question}</h3>
        
        <div className="grid grid-cols-1 gap-4">
          {currentQ.options.map((opt, idx) => {
            const isCorrect = idx === currentQ.correctAnswer;
            const isSelected = selectedAnswer === idx;
            
            let btnClass = "border-2 border-gray-50 text-gray-700 bg-gray-50/50 hover:border-blue-200 hover:bg-white";
            
            if (selectedAnswer !== null) {
              if (isCorrect) {
                btnClass = "border-green-500 bg-green-50 text-green-700 ring-4 ring-green-100";
              } else if (isSelected) {
                btnClass = "border-red-500 bg-red-50 text-red-700 ring-4 ring-red-100";
              } else {
                btnClass = "opacity-40 border-gray-100 text-gray-400 cursor-not-allowed";
              }
            }

            return (
              <button 
                key={idx}
                onClick={() => handleSelect(idx)}
                disabled={selectedAnswer !== null}
                className={`w-full text-left p-8 rounded-[30px] font-bold text-lg transition-all flex justify-between items-center ${btnClass}`}
              >
                <div className="flex items-center gap-4">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-sm ${selectedAnswer !== null && isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-white border border-gray-100'}`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {opt}
                </div>
              </button>
            );
          })}
        </div>

        {selectedAnswer !== null && (
          <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-4">
            {currentQ.commentary && (
              <>
                <button 
                  onClick={() => setShowCommentary(!showCommentary)}
                  className="w-full bg-blue-50 text-blue-600 py-4 rounded-[20px] font-black text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm-1-11V7h2v4h-2zm0 6v-4h2v4h-2z" /></svg>
                  {showCommentary ? 'ESCONDER GABARITO COMENTADO' : 'VER GABARITO COMENTADO'}
                </button>
                {showCommentary && (
                  <div className="bg-gray-50 p-8 rounded-[30px] border border-gray-100 text-sm leading-relaxed text-gray-600">
                    <p className="font-black text-blue-600 mb-2 uppercase tracking-widest text-[10px]">Análise da Questão</p>
                    {currentQ.commentary}
                  </div>
                )}
              </>
            )}
            
            <button 
              onClick={nextQuestion}
              className="w-full bg-[#0A0F1E] text-white py-6 rounded-[25px] font-black hover:bg-orange-500 transition-all flex items-center justify-center gap-2"
            >
              PRÓXIMA QUESTÃO
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizPlayer;
