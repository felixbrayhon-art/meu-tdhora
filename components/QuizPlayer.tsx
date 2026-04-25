
import React, { useState } from 'react';
import { Scissors, Trash2 } from 'lucide-react';
import { QuizFolder, Notebook, QuizQuestion } from '../types';
import ReactMarkdown from 'react-markdown';

interface QuizPlayerProps {
  folder: QuizFolder;
  notebook: Notebook;
  onBack: () => void;
  onComplete: (score: number, total: number) => void;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ folder, notebook, onBack, onComplete }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>(notebook.questions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);
  const [crossedOut, setCrossedOut] = useState<number[]>([]);

  const handleSelect = (optionIndex: number) => {
    if (selectedAnswer !== null) return; 
    
    setSelectedAnswer(optionIndex);
    const isCorrect = optionIndex === questions[currentIndex].correctAnswer;
    
    if (isCorrect) setScore(s => s + 1);
  };

  const handleDoubleClick = (idx: number) => {
    if (selectedAnswer !== null) return;
    setCrossedOut(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleDeleteQuestion = () => {
    if (confirm("Tem certeza que deseja excluir esta questão? Ela será removida apenas desta sessão.")) {
      const newQuestions = questions.filter((_, idx) => idx !== currentIndex);
      if (newQuestions.length === 0) {
        onBack();
        return;
      }
      setQuestions(newQuestions);
      if (currentIndex >= newQuestions.length) {
        setCurrentIndex(newQuestions.length - 1);
      }
      setSelectedAnswer(null);
      setShowCommentary(false);
      setCrossedOut([]);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowCommentary(false);
      setCrossedOut([]);
    } else {
      setShowResult(true);
    }
  };

  const currentQ = questions[currentIndex];

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
            <p className="text-2xl font-black text-blue-600">{Math.round((score / questions.length) * 100)}%</p>
          </div>
          <div className="border-l border-gray-200"></div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">XP Ganho</p>
            <p className="text-2xl font-black text-orange-500">+{score * 50}</p>
          </div>
        </div>
        <button 
          onClick={() => onComplete(score, questions.length)} 
          className="w-full bg-[#0A0F1E] text-white py-6 rounded-[25px] font-black hover:scale-[1.02] transition-all shadow-xl shadow-gray-200"
        >
          SALVAR RESULTADO E VOLTAR
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-10 pb-20">
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
          <div className="h-full bg-blue-600 transition-all duration-700 ease-out" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}></div>
        </div>
        <span className="font-black text-blue-600 tabular-nums">{currentIndex + 1}/{questions.length}</span>
      </div>

      <div className="bg-white rounded-[45px] p-10 md:p-14 shadow-xl border border-gray-100 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
        <div className="flex justify-between items-start mb-12">
          <h3 className="text-2xl font-black text-[#1E293B] mb-12 leading-tight flex-1">{currentQ.question}</h3>
          <button 
            onClick={handleDeleteQuestion}
            className="ml-4 p-2 text-gray-300 hover:text-red-500 transition-colors"
            title="Excluir questão"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
        
        {selectedAnswer === null ? (
          <div className="grid grid-cols-1 gap-4">
            {questions[currentIndex].options.map((opt, idx) => {
              const isCorrect = idx === currentQ.correctAnswer;
              const isSelected = selectedAnswer === idx;
              const isCrossedOut = crossedOut.includes(idx);
              
              let btnClass = "border-2 border-gray-50 text-gray-700 bg-gray-50/50 hover:border-blue-200 hover:bg-white";
              
              if (isCrossedOut && selectedAnswer === null) {
                btnClass = "border-2 border-gray-100 text-gray-300 bg-gray-50/20 line-through opacity-50";
              }
              
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
                <div 
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  onDoubleClick={() => handleDoubleClick(idx)}
                  className={`w-full text-left p-8 rounded-[30px] font-bold text-lg transition-all flex justify-between items-center select-none cursor-pointer ${btnClass}`}
                  role="button"
                  aria-disabled={selectedAnswer !== null}
                  tabIndex={0}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-sm ${selectedAnswer !== null && isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-white border border-gray-100'}`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt}
                  </div>
                  
                  {selectedAnswer === null && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDoubleClick(idx);
                      }}
                      className={`p-2 rounded-full transition-colors ${isCrossedOut ? 'bg-orange-100 text-orange-600' : 'hover:bg-gray-200 text-gray-400'}`}
                      title="Recortar alternativa"
                    >
                      <Scissors className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className={`p-8 rounded-[40px] mb-8 ${selectedAnswer === currentQ.correctAnswer ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'}`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-xl ${selectedAnswer === currentQ.correctAnswer ? 'bg-green-500 shadow-lg shadow-green-200' : 'bg-red-500 shadow-lg shadow-red-200'}`}>
                  {selectedAnswer === currentQ.correctAnswer ? '✓' : '✗'}
                </div>
                <div>
                  <p className={`text-sm font-black uppercase tracking-widest ${selectedAnswer === currentQ.correctAnswer ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedAnswer === currentQ.correctAnswer ? 'Muito Bem!' : 'Não foi dessa vez'}
                  </p>
                  <p className="text-gray-600 font-bold">
                    A resposta correta era: <span className="font-black text-gray-900">{questions[currentIndex].options[currentQ.correctAnswer]}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[40px] p-10 border-2 border-gray-50 shadow-sm mb-8 leading-relaxed">
              <h4 className="flex items-center gap-3 text-lg font-black text-blue-600 mb-6 underline decoration-4 underline-offset-8 uppercase">
                 🧠 Explicação e Estratégia
              </h4>
              <div className="markdown-body text-gray-700 text-lg md:text-xl font-medium space-y-4 mb-8 prose prose-blue prose-lg max-w-none">
                <ReactMarkdown>{currentQ.commentary}</ReactMarkdown>
              </div>

              {currentQ.memoryHint && (
                <div className="bg-blue-50 p-8 rounded-[35px] border-2 border-blue-100 animate-in slide-in-from-top-2 duration-500 relative overflow-hidden mt-10">
                   <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <svg className="w-24 h-24 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.1 15.1h-2.2v-2.2h2.2v2.2zm0-4.4h-2.2V7.1h2.2v5.6z"/></svg>
                  </div>
                  <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <span className="text-xl">🔥</span> DICA DE MEMORIZAÇÃO (ALTO IMPACTO)
                  </p>
                  <div className="markdown-body text-lg md:text-xl font-bold text-blue-900 italic leading-relaxed prose prose-blue prose-lg max-w-none">
                    <ReactMarkdown>{currentQ.memoryHint}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setSelectedAnswer(null)}
              className="text-gray-400 hover:text-blue-600 font-black text-xs uppercase tracking-widest transition-colors flex items-center gap-2 mb-4"
            >
              ← REVER ALTERNATIVAS
            </button>
          </div>
        )}

        {selectedAnswer !== null && (
          <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-4">
             <button 
              onClick={nextQuestion}
              className="w-full bg-[#0A0F1E] text-white py-6 rounded-[30px] font-black hover:bg-blue-600 transition-all flex items-center justify-center gap-4 text-lg shadow-xl shadow-blue-900/10"
            >
              PRÓXIMA QUESTÃO
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizPlayer;
