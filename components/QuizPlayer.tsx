
import React, { useState } from 'react';
import { Scissors, Trash2, ChevronLeft, ChevronRight, Brain, FileText, Maximize2, Minimize2, X } from 'lucide-react';
import { QuizFolder, Notebook, QuizQuestion } from '../types';
import ReactMarkdown from 'react-markdown';

interface QuizPlayerProps {
  folder: QuizFolder;
  notebook: Notebook;
  onBack: () => void;
  onComplete: (score: number, total: number) => void;
  onUpdateQuestions?: (questions: QuizQuestion[]) => void;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ folder, notebook, onBack, onComplete, onUpdateQuestions }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>(notebook.questions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);
  const [crossedOut, setCrossedOut] = useState<number[]>([]);
  const [userCommentaryInput, setUserCommentaryInput] = useState('');
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);

  const currentQ = questions[currentIndex];

  React.useEffect(() => {
    setUserCommentaryInput(questions[currentIndex]?.userCommentary || '');
  }, [currentIndex, questions]);

  const handleSaveUserCommentary = (overrideValue?: string) => {
    const valueToSave = overrideValue !== undefined ? overrideValue : userCommentaryInput;
    const newQuestions = [...questions];
    newQuestions[currentIndex] = {
      ...newQuestions[currentIndex],
      userCommentary: valueToSave
    };
    setQuestions(newQuestions);
    onUpdateQuestions?.(newQuestions);
  };

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
    handleSaveUserCommentary();
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowCommentary(false);
      setCrossedOut([]);
    } else {
      setShowResult(true);
    }
  };


  if (showResult) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0A0F1E] flex flex-col items-center justify-center p-8 animate-in zoom-in-95 duration-500 overflow-y-auto">
        <div className="w-full max-w-xl text-center space-y-12">
          <div className="w-40 h-40 bg-blue-500/10 border-4 border-blue-500/20 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-blue-900/20 relative">
             <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping opacity-20"></div>
             <span className="text-xl font-black text-blue-400 italic">RESULTS</span>
          </div>
          
          <div>
            <h2 className="text-5xl font-black mb-4 tracking-tighter text-white italic uppercase">Ciclo <span className="text-blue-500">Concluído</span></h2>
            <p className="text-slate-400 text-lg font-bold uppercase tracking-[0.2em] opacity-60">Consolidação de Conhecimento Finalizada</p>
          </div>

          <div className="bg-white/5 border border-white/10 p-10 rounded-[40px] flex justify-around backdrop-blur-3xl shadow-3xl">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Precisão</p>
              <p className="text-4xl font-black text-blue-500 italic leading-none">{Math.round((score / questions.length) * 100)}%</p>
            </div>
            <div className="w-px h-16 bg-white/10 self-center"></div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Acertos</p>
              <p className="text-4xl font-black text-white italic leading-none">{score}<span className="text-xl text-slate-500">/{questions.length}</span></p>
            </div>
            <div className="w-px h-16 bg-white/10 self-center"></div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">XP Ganho</p>
              <p className="text-4xl font-black text-orange-500 italic leading-none">+{score * 50}</p>
            </div>
          </div>

          <button 
            onClick={() => onComplete(score, questions.length)} 
            className="w-full bg-white text-black py-8 rounded-[30px] font-black text-xl hover:bg-blue-500 hover:text-white transition-all shadow-2xl active:scale-95 uppercase tracking-widest"
          >
            SALVAR JORNADA E CONTINUAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#0A0F1E] text-white selection:bg-blue-500/30 overflow-y-auto font-sans">
      <div className="w-full max-w-5xl mx-auto px-6 py-12 animate-in fade-in slide-in-from-bottom-10 duration-700">
        <div className="flex justify-between items-center mb-12">
          <button 
            onClick={() => { handleSaveUserCommentary(); onBack(); }} 
            className="text-gray-500 font-black text-[10px] tracking-[0.3em] flex items-center gap-3 hover:text-white transition-all group active:scale-90"
          >
            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1" />
            ABANDONAR TREINO
          </button>
          
          <div className="flex-1 max-w-md mx-12">
            <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
               <span>PROCESSO DE APRENDIZAGEM</span>
               <span className="text-blue-500">{currentIndex + 1} de {questions.length}</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5 shadow-inner">
              <div 
                className="h-full bg-blue-600 rounded-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(37,99,235,0.4)]" 
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="w-12"></div> {/* Spacer for symmetry */}
        </div>

        <div className="bg-white/5 backdrop-blur-2xl rounded-[60px] p-12 md:p-16 border border-white/10 shadow-2xl relative overflow-hidden mb-10">
          <div className="absolute top-0 left-0 w-2 h-full bg-blue-600 opacity-50"></div>
          
          <div className="flex justify-between items-start mb-12">
            <h3 className="text-3xl font-black text-white leading-tight flex-1 italic tracking-tight">{currentQ.question}</h3>
            <button 
              onClick={handleDeleteQuestion}
              className="ml-6 p-3 bg-red-500/10 text-red-500/40 hover:text-red-500 hover:bg-red-500/20 rounded-2xl transition-all active:scale-90"
              title="Excluir questão"
            >
              <Trash2 className="w-6 h-6" />
            </button>
          </div>
          
          {selectedAnswer === null ? (
            <div className="grid grid-cols-1 gap-5">
              {questions[currentIndex].options.map((opt, idx) => {
                const isCorrect = idx === currentQ.correctAnswer;
                const isSelected = selectedAnswer === idx;
                const isCrossedOut = crossedOut.includes(idx);
                
                let btnClass = "border-2 border-white/5 bg-white/5 hover:bg-white/10 hover:border-blue-500/50 text-slate-300";
                
                if (isCrossedOut && selectedAnswer === null) {
                  btnClass = "border-2 border-white/5 text-white/10 bg-black/20 line-through opacity-20 grayscale";
                }
                
                return (
                  <div 
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    onDoubleClick={() => handleDoubleClick(idx)}
                    className={`w-full text-left p-10 rounded-[40px] font-bold text-xl transition-all flex justify-between items-center select-none cursor-pointer group active:scale-[0.98] ${btnClass}`}
                    role="button"
                    aria-disabled={selectedAnswer !== null}
                    tabIndex={0}
                  >
                    <div className="flex items-center gap-6 flex-1">
                      <span className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center text-sm font-black shadow-lg transition-colors ${selectedAnswer !== null && isCorrect ? 'bg-green-500 border-green-500 text-white' : 'border-white/10 text-white/30 group-hover:border-blue-500/50 group-hover:text-blue-500'}`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="leading-relaxed">{opt}</span>
                    </div>
                    
                    {selectedAnswer === null && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDoubleClick(idx);
                        }}
                        className={`p-3 rounded-2xl transition-all active:scale-90 ${isCrossedOut ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'bg-white/5 text-white/20 hover:text-white hover:bg-white/10'}`}
                        title="Recortar alternativa"
                      >
                        <Scissors className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
              <div className={`p-10 rounded-[50px] mb-10 border backdrop-blur-xl ${selectedAnswer === currentQ.correctAnswer ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <div className="flex items-center gap-6">
                  <div className={`w-16 h-16 rounded-[25px] flex items-center justify-center text-white font-black text-2xl shadow-2xl ${selectedAnswer === currentQ.correctAnswer ? 'bg-green-500 shadow-green-900/30' : 'bg-red-500 shadow-red-900/30'}`}>
                    {selectedAnswer === currentQ.correctAnswer ? '✓' : '✗'}
                  </div>
                  <div>
                    <p className={`text-xs font-black uppercase tracking-[0.4em] mb-1 ${selectedAnswer === currentQ.correctAnswer ? 'text-green-500' : 'text-red-500'}`}>
                      {selectedAnswer === currentQ.correctAnswer ? 'ALVO ATINGIDO' : 'DEFEITO NA ROTA'}
                    </p>
                    <p className="text-white text-xl font-black italic">
                      Gabarito: <span className="text-blue-400">{questions[currentIndex].options[currentQ.correctAnswer]}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 rounded-[50px] p-12 border border-white/10 shadow-3xl mb-10 leading-relaxed">
                <h4 className="flex items-center gap-3 text-xs font-black text-blue-500 mb-8 uppercase tracking-[0.3em]">
                   🧠 MAPEAMENTO DA LÓGICA
                </h4>
                <div className="markdown-body text-slate-300 text-xl font-medium space-y-6 mb-10 prose prose-invert prose-xl max-w-none">
                  <ReactMarkdown>{currentQ.commentary}</ReactMarkdown>
                </div>

                <div className="bg-white/5 border border-white/10 p-8 rounded-[40px] mt-10 relative">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3 text-xs font-black text-yellow-500 uppercase tracking-[0.3em]">
                      <FileText className="w-4 h-4" /> SUA NOTA PESSOAL
                    </div>
                    <button 
                      onClick={() => setIsNoteExpanded(true)}
                      className="p-3 hover:bg-white/10 rounded-xl transition-all text-white/50 hover:text-white active:scale-90 cursor-pointer"
                      title="Expandir anotação"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <textarea
                    value={userCommentaryInput}
                    onChange={(e) => setUserCommentaryInput(e.target.value)}
                    onBlur={() => handleSaveUserCommentary()}
                    placeholder="Adicione sua própria explicação ou anotação para esta questão..."
                    className="w-full bg-black/20 border-2 border-white/5 rounded-[30px] p-6 text-slate-300 focus:outline-none focus:border-yellow-500/50 transition-all font-medium text-lg min-h-[150px] resize-none"
                  />
                  
                  <p className="mt-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">
                    Salva automaticamente ao sair do campo
                  </p>
                </div>

                {isNoteExpanded && (
                  <div className="fixed inset-0 z-[1000] bg-[#0A0F1E]/95 backdrop-blur-2xl animate-in fade-in duration-300 p-6 md:p-12 flex flex-col">
                    <div className="flex items-center justify-between mb-8 max-w-6xl mx-auto w-full">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-yellow-500/20 rounded-2xl flex items-center justify-center text-yellow-500">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">Expansão de Nota</h2>
                          <p className="text-white/40 text-[10px] font-black tracking-[0.3em] uppercase">Foco total na sua explicação pessoal</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => { handleSaveUserCommentary(); setIsNoteExpanded(false); }}
                        className="p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all active:scale-90 cursor-pointer"
                      >
                        <Minimize2 className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="flex-1 max-w-6xl mx-auto w-full bg-white/5 rounded-[50px] p-12 border border-white/10 shadow-3xl">
                      <textarea
                        autoFocus
                        value={userCommentaryInput}
                        onChange={(e) => setUserCommentaryInput(e.target.value)}
                        placeholder="Escreva livremente aqui sua explicação detalhada..."
                        className="w-full h-full bg-transparent border-none text-slate-200 text-2xl md:text-3xl font-medium focus:outline-none resize-none leading-relaxed placeholder:text-white/5"
                      />
                    </div>

                    <div className="max-w-6xl mx-auto w-full mt-8 flex justify-between items-center">
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">TDAH ORA • MODO FOCO EDITOR</p>
                      <button 
                        onClick={() => { handleSaveUserCommentary(); setIsNoteExpanded(false); }}
                        className="px-12 py-6 bg-yellow-500 text-black font-black uppercase tracking-[0.3em] text-xs rounded-full hover:scale-105 transition-all shadow-2xl shadow-yellow-500/20 active:scale-95 cursor-pointer"
                      >
                        SALVAR E RECOLHER
                      </button>
                    </div>
                  </div>
                )}

                {currentQ.memoryHint && (
                  <div className="bg-blue-600/5 p-10 rounded-[40px] border-2 border-blue-600/20 shadow-2xl shadow-blue-900/10 animate-in slide-in-from-top-4 relative overflow-hidden mt-12">
                     <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                       <Brain className="w-32 h-32 text-blue-500" />
                    </div>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
                      <span className="text-2xl">🔥</span> BIZU DE MEMÓRIA (MÁXIMO IMPACTO)
                    </p>
                    <div className="markdown-body text-xl md:text-2xl font-bold text-white italic leading-relaxed prose prose-invert prose-blue prose-xl max-w-none">
                      <ReactMarkdown>{currentQ.memoryHint}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => setSelectedAnswer(null)}
                className="text-white/30 hover:text-blue-500 font-black text-[10px] uppercase tracking-[0.4em] transition-all flex items-center gap-3 mb-8 active:scale-95"
              >
                <ChevronLeft className="w-5 h-5" /> REANALISAR CAMINHOS
              </button>
            </div>
          )}

          {selectedAnswer !== null && (
            <div className="mt-12 space-y-6 animate-in fade-in slide-in-from-top-6 duration-700">
               <button 
                onClick={nextQuestion}
                className="w-full bg-blue-600 text-white py-10 rounded-[40px] font-black text-2xl hover:bg-blue-500 transition-all flex items-baseline justify-center gap-4 shadow-3xl shadow-blue-900/40 active:scale-95 group uppercase tracking-widest"
              >
                PRÓXIMO PASSO
                <ChevronRight className="w-8 h-8 group-hover:translate-x-3 transition-transform self-center" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizPlayer;
