
import React, { useState, useRef, useEffect } from 'react';
import { 
  Scissors, Trash2, ChevronLeft, ChevronRight, Brain, FileText, 
  Maximize2, Minimize2, Move, Share2, Shuffle, LogOut,
  Highlighter, PenLine, Eraser, Undo2, Image as ImageIcon, X, MessageSquarePlus, HelpCircle, BookOpen
} from 'lucide-react';
import { QuizFolder, Notebook, QuizQuestion } from '../types';
import MarkdownContent from './MarkdownContent';
import { RichTextEditor } from './RichTextEditor';
import { MoveToNotebookModal } from './MoveToNotebookModal';

interface QuizPlayerProps {
  folder: QuizFolder;
  notebook: Notebook;
  folders: QuizFolder[];
  onBack: () => void;
  onComplete: (score: number, total: number) => void;
  onUpdateQuestions?: (questions: QuizQuestion[]) => void;
  onMoveQuestion: (questionId: string, sourceFolderId: string, sourceNotebookId: string, targetFolderId: string, targetNotebookId: string) => void;
  onTriggerGuidedLesson?: (subject: string, topic: string) => void;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ folder, notebook, folders, onBack, onComplete, onUpdateQuestions, onMoveQuestion, onTriggerGuidedLesson }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>(notebook.questions);
  const initialQuestions = useRef([...notebook.questions]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionScratched, setQuestionScratched] = useState<string[]>([]);
  const [questionHighlighted, setQuestionHighlighted] = useState<string[]>([]);
  const [tempSelectedAnswer, setTempSelectedAnswer] = useState<number | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);
  const [crossedOut, setCrossedOut] = useState<number[]>([]);
  const [userCommentaryInput, setUserCommentaryInput] = useState('');
  const [showNoteSection, setShowNoteSection] = useState(false);
  const [showImageArea, setShowImageArea] = useState(false);
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [undoStack, setUndoStack] = useState<Record<string, string[]>>({});
  const questionTextRef = useRef<HTMLDivElement>(null);
  const noteSectionRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const saveToUndo = (qId: string, content: string) => {
    setUndoStack(prev => ({
      ...prev,
      [qId]: [...(prev[qId] || []), content].slice(-10) // Keep last 10 steps
    }));
  };

  const handleUndo = () => {
    const qHistory = undoStack[currentQ.id] || [];
    if (qHistory.length === 0) return;

    const previousContent = qHistory[qHistory.length - 1];
    const newHistory = qHistory.slice(0, -1);

    setUndoStack(prev => ({
      ...prev,
      [currentQ.id]: newHistory
    }));

    // Update state
    const qIdx = questions.findIndex(q => q.id === currentQ.id);
    if (qIdx !== -1) {
      const newQuestions = [...questions];
      newQuestions[qIdx] = {
        ...newQuestions[qIdx],
        question: previousContent
      };
      setQuestions(newQuestions);
      onUpdateQuestions?.(newQuestions);
    }
  };

  const handleSelectiveMark = (type: 'strike' | 'highlight') => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
      // Fallback to whole-question toggle if no selection
      if (type === 'strike') toggleQuestionScratch();
      else toggleQuestionHighlight();
      return;
    }

    const range = selection.getRangeAt(0);
    const container = questionTextRef.current;
    
    if (container && (container.contains(range.commonAncestorContainer) || container === range.commonAncestorContainer)) {
      const span = document.createElement('span');
      if (type === 'strike') {
        span.className = 'line-through decoration-red-500/30 decoration-2 text-slate-400 opacity-80';
      } else {
        span.className = 'bg-yellow-200/60 rounded-sm px-0.5 text-slate-900 border-b border-yellow-300';
      }
      
      try {
        saveToUndo(currentQ.id, container.innerHTML);
        if (range.startContainer === range.endContainer) {
          range.surroundContents(span);
        } else {
          // Complex selection spanning multiple nodes
          const content = range.extractContents();
          span.appendChild(content);
          range.insertNode(span);
        }

        // Persist to state
        const qIdx = questions.findIndex(q => q.id === currentQ.id);
        if (qIdx !== -1) {
          const newQuestions = [...questions];
          newQuestions[qIdx] = {
            ...newQuestions[qIdx],
            question: container.innerHTML
          };
          setQuestions(newQuestions);
          onUpdateQuestions?.(newQuestions);
        }
      } catch (e) {
        console.warn("Selection failed", e);
      }
      selection.removeAllRanges();
    }
  };

  const handleAddExplanationImage = (imageUrl: string) => {
    const qIdx = questions.findIndex(q => q.id === currentQ.id);
    if (qIdx === -1) return;
    const newQuestions = [...questions];
    const currentImages = newQuestions[qIdx].explanationImages || [];
    newQuestions[qIdx] = {
      ...newQuestions[qIdx],
      explanationImages: [...currentImages, imageUrl]
    };
    setQuestions(newQuestions);
    onUpdateQuestions?.(newQuestions);
  };

  const handleRemoveExplanationImage = (imgIdx: number) => {
    const qIdx = questions.findIndex(q => q.id === currentQ.id);
    if (qIdx === -1) return;
    const newQuestions = [...questions];
    const currentImages = [...(newQuestions[qIdx].explanationImages || [])];
    currentImages.splice(imgIdx, 1);
    newQuestions[qIdx] = {
      ...newQuestions[qIdx],
      explanationImages: currentImages
    };
    setQuestions(newQuestions);
    onUpdateQuestions?.(newQuestions);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        handleAddExplanationImage(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const currentQ = questions[currentIndex];

  const handleUpdateImageSize = (imgIdx: number, size: string) => {
    const qIdx = questions.findIndex(q => q.id === currentQ.id);
    if (qIdx === -1) return;
    const newQuestions = [...questions];
    const currentSizes = [...(newQuestions[qIdx].explanationImageSizes || [])];
    while (currentSizes.length <= imgIdx) currentSizes.push('md');
    currentSizes[imgIdx] = size;
    newQuestions[qIdx] = {
      ...newQuestions[qIdx],
      explanationImageSizes: currentSizes
    };
    setQuestions(newQuestions);
    onUpdateQuestions?.(newQuestions);
  };

  const toggleQuestionScratch = () => {
    if (questionScratched.includes(currentQ.id)) {
      setQuestionScratched(questionScratched.filter(id => id !== currentQ.id));
    } else {
      setQuestionScratched([...questionScratched, currentQ.id]);
      setQuestionHighlighted(questionHighlighted.filter(id => id !== currentQ.id));
    }
  };

  const toggleQuestionHighlight = () => {
    if (questionHighlighted.includes(currentQ.id)) {
      setQuestionHighlighted(questionHighlighted.filter(id => id !== currentQ.id));
    } else {
      setQuestionHighlighted([...questionHighlighted, currentQ.id]);
      setQuestionScratched(questionScratched.filter(id => id !== currentQ.id));
    }
  };

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

  const shuffleQuestions = () => {
    if (confirm("Deseja embaralhar as questões desta sessão?")) {
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setCurrentIndex(0);
      setTempSelectedAnswer(null);
      setSelectedAnswer(null);
      setShowCommentary(false);
      setCrossedOut([]);
    }
  };

  const handleSelect = (optionIndex: number) => {
    if (selectedAnswer !== null) return; 
    setTempSelectedAnswer(optionIndex);
    setCrossedOut(prev => prev.filter(i => i !== optionIndex));
  };

  const handleConfirmAnswer = () => {
    if (tempSelectedAnswer === null || selectedAnswer !== null) return;
    
    setSelectedAnswer(tempSelectedAnswer);
    const isCorrect = tempSelectedAnswer === questions[currentIndex].correctAnswer;
    
    if (isCorrect) setScore(s => s + 1);
    setShowCommentary(true);
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
      setTempSelectedAnswer(null);
      setSelectedAnswer(null);
      setShowCommentary(false);
      setCrossedOut([]);
    }
  };

  const nextQuestion = () => {
    handleSaveUserCommentary();
    
    // Restore original question content (removes selective markings) before moving
    const original = initialQuestions.current.find(q => q.id === currentQ.id);
    if (original) {
      const newQuestions = [...questions];
      newQuestions[currentIndex] = { ...newQuestions[currentIndex], question: original.question };
      setQuestions(newQuestions);
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setTempSelectedAnswer(null);
      setSelectedAnswer(null);
      setShowCommentary(false);
      setCrossedOut([]);
      setQuestionScratched([]);
      setQuestionHighlighted([]);
    } else {
      setShowResult(true);
    }
  };

  const prevQuestion = () => {
    handleSaveUserCommentary();

    // Restore original question content (removes selective markings) before moving
    const original = initialQuestions.current.find(q => q.id === currentQ.id);
    if (original) {
      const newQuestions = [...questions];
      newQuestions[currentIndex] = { ...newQuestions[currentIndex], question: original.question };
      setQuestions(newQuestions);
    }

    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setTempSelectedAnswer(null);
      setSelectedAnswer(null);
      setShowCommentary(false);
      setCrossedOut([]);
      setQuestionScratched([]);
      setQuestionHighlighted([]);
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
    <div className="fixed inset-0 z-[200] bg-[#f8fafc] text-[#1e293b] selection:bg-blue-500/30 overflow-y-auto font-sans">
      <div className="w-full max-w-5xl mx-auto px-6 py-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
        
        {/* HEADER: PROGRESS & TITLE */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between gap-8 mb-8 sticky top-0 z-50">
          <div className="flex flex-col shrink-0">
            <h1 className="text-sm font-black text-blue-600 tracking-tight uppercase italic">{notebook.name}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Sessão {folder.name}</p>
          </div>

          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="flex justify-center items-center gap-2 mb-1">
               <span className="text-[11px] font-black text-blue-500 tracking-wider">
                 {Math.round(((currentIndex + 1) / questions.length) * 100)}%
               </span>
            </div>
            <div className="w-full max-w-sm h-1.5 bg-blue-50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-700 ease-out" 
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
             <div className="flex items-center gap-1.5 mr-4">
               <button className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all border border-slate-100">
                 <Share2 className="w-4 h-4" />
               </button>
               <button 
                 onClick={prevQuestion}
                 disabled={currentIndex === 0}
                 className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all border border-slate-100 disabled:opacity-30"
               >
                 <ChevronLeft className="w-4 h-4" />
               </button>
               <button 
                 onClick={nextQuestion}
                 disabled={currentIndex === questions.length - 1}
                 className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all border border-slate-100 disabled:opacity-30"
               >
                 <ChevronRight className="w-4 h-4" />
               </button>
             </div>
             <div className="w-px h-8 bg-slate-100 mr-2"></div>
             <div className="flex items-center gap-2 bg-blue-50/50 px-4 py-2 rounded-xl text-blue-600 border border-blue-100/50">
               <span className="text-[11px] font-black tracking-widest tabular-nums">00:00 MIN</span>
             </div>
          </div>
        </div>
        {/* QUIZ MAIN CARD */}
        <div className="bg-white rounded-[40px] p-8 md:p-16 border border-slate-200/60 shadow-[0_20px_50px_rgba(0,0,0,0.03)] relative overflow-hidden mb-10 transition-all hover:shadow-[0_25px_60px_rgba(0,0,0,0.05)]">
          <div className="mb-10 text-center md:text-left">
            <div className="flex items-center justify-between mb-6">
               <span className="text-[11px] font-black text-blue-500/50 uppercase tracking-[0.3em]">Questão {currentIndex + 1}</span>
               
               <div className="flex items-center gap-2">
                 <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 shadow-inner mr-2">
                    <button 
                      onClick={() => handleSelectiveMark('highlight')}
                      className={`p-2 rounded-lg transition-all active:scale-90 ${questionHighlighted.includes(currentQ.id) ? 'bg-yellow-100 text-yellow-600 shadow-sm border border-yellow-200' : 'text-slate-300 hover:text-blue-500'}`}
                      title="Destacar (Selecione texto ou clique para todo enunciado)"
                    >
                      <Highlighter className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleSelectiveMark('strike')}
                      className={`p-2 rounded-lg transition-all active:scale-90 ${questionScratched.includes(currentQ.id) ? 'bg-slate-200 text-slate-600 shadow-sm' : 'text-slate-300 hover:text-blue-500'}`}
                      title="Taxar (Selecione texto ou clique para todo enunciado)"
                    >
                      <PenLine className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setQuestionScratched(questionScratched.filter(id => id !== currentQ.id));
                        setQuestionHighlighted(questionHighlighted.filter(id => id !== currentQ.id));
                      }}
                      className="p-2 text-slate-300 hover:text-red-500 transition-all active:scale-90"
                      title="Limpar Marcações"
                    >
                      <Eraser className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleUndo}
                      disabled={!(undoStack[currentQ.id] && undoStack[currentQ.id].length > 0)}
                      className="p-2 text-slate-300 hover:text-orange-500 disabled:opacity-20 transition-all active:scale-90"
                      title="Desfazer Marcação"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                 </div>
               </div>
            </div>
            <div 
              ref={questionTextRef}
              className={`text-[17px] md:text-[20px] font-semibold leading-[1.6] tracking-tight markdown-body transition-all duration-500 p-8 md:p-12 rounded-[40px] shadow-inner relative z-10 ${
                questionScratched.includes(currentQ.id) ? 'text-slate-300 bg-slate-100/50 grayscale blur-[0.5px] opacity-40 italic line-through' : 
                questionHighlighted.includes(currentQ.id) ? 'text-slate-900 bg-yellow-50/80 border-l-[12px] border-l-yellow-400 border border-yellow-200/50' : 
                'text-slate-800 bg-slate-50 border border-slate-100'
              }`} 
              dangerouslySetInnerHTML={{ __html: currentQ.question }} 
            />
          </div>
          
          <div className="flex gap-1.5 absolute top-8 right-8">
            <button 
              onClick={() => setShowMoveModal(true)}
              className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
              title="Mover questão"
            >
              <Move className="w-4 h-4" />
            </button>
            <button 
              onClick={handleDeleteQuestion}
              className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              title="Excluir questão"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* We keep the options grid visible regardless of selectedAnswer being null or not */}
          <div className={`grid ${currentQ.options.every(o => !o.trim()) ? 'grid-cols-5' : 'grid-cols-1'} gap-4 mb-10`}>
            {questions[currentIndex].options.map((opt, idx) => {
              const isConfirmed = selectedAnswer !== null;
              const isCorrectAnswer = idx === currentQ.correctAnswer;
              const isUserSelection = (isConfirmed ? selectedAnswer : tempSelectedAnswer) === idx;
              const isCrossedOut = crossedOut.includes(idx);
              const isQuickMode = currentQ.options.every(o => !o.trim());
              
              let btnClass = "border border-slate-100 bg-white hover:bg-slate-50 text-slate-600 shadow-sm";
              let circleClass = "border-slate-200 text-slate-300 group-hover:border-blue-500/50 group-hover:text-blue-500";
              
              if (isConfirmed) {
                if (isCorrectAnswer) {
                  // The correct answer is always highlighted in green after confirmation
                  btnClass = "border-green-500 bg-green-50/30 text-green-700 shadow-md border-l-[6px] border-l-green-500 ring-4 ring-green-500/5";
                  circleClass = "bg-green-500 border-green-500 text-white";
                } else if (isUserSelection) {
                  // User selected the wrong answer: highlight in red
                  btnClass = "border-red-300 bg-red-50/50 text-red-700 shadow-md border-l-[6px] border-l-red-500 ring-4 ring-red-500/5";
                  circleClass = "bg-red-500 border-red-500 text-white";
                } else {
                  // Other unselected, incorrect options
                  btnClass = "border-slate-100 bg-slate-50/30 text-slate-400 opacity-60";
                  circleClass = "border-slate-200 text-slate-300";
                }
              } else if (isUserSelection) {
                // Pre-confirmation selection (blue)
                btnClass = "border border-blue-200 bg-blue-50/20 text-slate-900 shadow-md border-l-[4px] border-l-blue-500 ring-4 ring-blue-500/5";
                circleClass = "bg-blue-100 border-blue-500 text-blue-600";
              }

              if (isCrossedOut && !isConfirmed) {
                btnClass = "border-slate-50 bg-slate-50/50 text-slate-200 line-through grayscale opacity-40";
              }
              
              return (
                <div key={idx} className="relative group">
                  <div 
                    onClick={() => handleSelect(idx)}
                    onDoubleClick={() => handleDoubleClick(idx)}
                    className={`${isQuickMode ? 'w-14 h-14 rounded-2xl flex items-center justify-center' : 'w-full text-left p-6 rounded-[25px] flex items-center gap-6'} font-bold transition-all duration-300 select-none cursor-pointer group active:scale-[0.98] ${btnClass} relative overflow-hidden`}
                    role="button"
                    aria-disabled={isConfirmed}
                    tabIndex={0}
                  >
                    <div className={`flex items-center flex-1 ${isQuickMode ? 'justify-center' : 'gap-6'}`}>
                      <span className={`${isQuickMode ? 'w-10 h-10 rounded-xl' : 'w-12 h-12 rounded-full'} border flex items-center justify-center text-[12px] font-black flex-shrink-0 transition-all ${circleClass}`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      {!isQuickMode && <span className="text-[16px] leading-snug">{opt}</span>}
                    </div>
                    
                    {!isQuickMode && isConfirmed && isCorrectAnswer && (
                       <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg animate-in zoom-in-50">
                          <span className="text-sm">✓</span>
                       </div>
                    )}
                    {!isQuickMode && isConfirmed && isUserSelection && !isCorrectAnswer && (
                       <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg animate-in zoom-in-50">
                          <span className="text-sm">✗</span>
                       </div>
                    )}
                    {!isQuickMode && !isConfirmed && (
                       <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isUserSelection ? 'border-blue-500 bg-blue-500' : 'border-slate-200'}`}>
                          {isUserSelection && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}
                       </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedAnswer === null ? (
            <>
              <div className="flex justify-center md:justify-start mb-10">
                <button 
                  onClick={handleConfirmAnswer}
                  disabled={tempSelectedAnswer === null}
                  className="bg-[#2ecc71] hover:bg-[#27ae60] disabled:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed text-white font-bold px-10 py-3.5 rounded-xl uppercase text-[11px] tracking-wider transition-all active:scale-95 shadow-lg shadow-green-900/10"
                >
                  CONFERIR RESPOSTA
                </button>
              </div>
              
              <div className="flex items-center justify-center gap-3 mt-16 scale-110">
                <button 
                  onClick={prevQuestion}
                  disabled={currentIndex === 0}
                  className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl shadow-sm transition-all disabled:opacity-20 active:scale-95"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                  onClick={nextQuestion}
                  disabled={currentIndex === questions.length - 1}
                  className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl shadow-sm transition-all disabled:opacity-20 active:scale-95"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                <button 
                  onClick={shuffleQuestions}
                  className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl shadow-sm transition-all active:scale-95"
                >
                  <Shuffle className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => { handleSaveUserCommentary(); onBack(); }}
                  className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-red-500 rounded-xl shadow-sm transition-all active:scale-95"
                >
                  <LogOut className="w-6 h-6" />
                </button>
              </div>
            </>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
              <div className={`p-8 rounded-[40px] mb-8 border ${selectedAnswer === currentQ.correctAnswer ? 'bg-green-50 border-green-100 shadow-sm' : 'bg-red-50 border-red-100 shadow-sm'}`}>
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl ${selectedAnswer === currentQ.correctAnswer ? 'bg-green-500' : 'bg-red-500'}`}>
                    {selectedAnswer === currentQ.correctAnswer ? '✓' : '✗'}
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.4em] mb-1 ${selectedAnswer === currentQ.correctAnswer ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedAnswer === currentQ.correctAnswer ? 'TARGET ACQUIRED' : 'ROUTE ERROR'}
                    </p>
                    <p className="text-slate-800 text-[17px] font-bold">
                      {selectedAnswer === currentQ.correctAnswer 
                         ? 'Resposta correta! Você consolidou este conhecimento.' 
                         : `A resposta correta é a alternativa ${String.fromCharCode(65 + currentQ.correctAnswer)}.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-[40px] p-8 md:p-12 border border-slate-100 shadow-inner mb-8 transition-all">
                {showNoteSection && (
                  <div ref={noteSectionRef} className="bg-white border border-slate-100 p-6 md:p-8 rounded-[35px] mb-8 relative shadow-sm group hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">SUA NOTA ESTRATÉGICA</h4>
                          <p className="text-[9px] font-bold text-blue-500/60 uppercase tracking-tight">Refine seu conhecimento aqui</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsNoteExpanded(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all active:scale-95 shadow-sm"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        ABRIR EDITOR
                      </button>
                    </div>
                    
                    {userCommentaryInput ? (
                      <div className="text-slate-600 text-[15px] font-medium space-y-4 markdown-body prose prose-slate max-w-none border-l-4 border-slate-100 pl-6 py-2" dangerouslySetInnerHTML={{ __html: userCommentaryInput }} />
                    ) : (
                      <div 
                        onClick={() => setIsNoteExpanded(true)}
                        className="cursor-pointer py-10 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-300 hover:text-blue-500 hover:border-blue-200 transition-all"
                      >
                         <Brain className="w-8 h-8 opacity-20" />
                         <p className="font-bold text-xs italic tracking-tight">Nenhuma anotação estratégica ainda. Clique para adicionar.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center font-black text-sm italic shadow-lg shadow-blue-500/20">A</div>
                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">MAPEAMENTO DA LÓGICA DA QUESTÃO</h4>
                </div>

                {onTriggerGuidedLesson && (
                  <button 
                    onClick={() => onTriggerGuidedLesson(currentQ.topic?.includes(':') ? currentQ.topic.split(':')[0] : folder.name, currentQ.topic?.includes(':') ? currentQ.topic.split(':')[1] : (currentQ.topic || notebook.name))}
                    className="w-full mb-8 bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-[30px] flex items-center justify-between group transition-all hover:scale-[1.01] hover:shadow-xl shadow-blue-500/20 active:scale-95"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Sentiu dificuldade?</p>
                        <h4 className="font-black text-sm uppercase italic">ACIONAR AULA GUIADA SOBRE ESSE ASSUNTO</h4>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}

                <MarkdownContent content={currentQ.explanation} />

                {/* Imagens Adicionais do Usuário */}
                {(currentQ.explanationImages && currentQ.explanationImages.length > 0) && (
                  <div className="flex flex-col gap-8 mt-10">
                    {currentQ.explanationImages.map((img, i) => {
                      const currentSize = currentQ.explanationImageSizes?.[i] || 'md';
                      const sizeClasses = {
                        'sm': 'max-w-[200px]',
                        'md': 'max-w-md',
                        'lg': 'max-w-2xl',
                        'full': 'max-w-full'
                      }[currentSize as 'sm' | 'md' | 'lg' | 'full'] || 'max-w-md';

                      return (
                        <div key={i} className={`relative group rounded-[35px] overflow-hidden border-2 border-slate-100 shadow-sm transition-all hover:shadow-xl hover:border-blue-200 mx-auto ${sizeClasses}`}>
                           <img src={img} alt={`Complemento Visual ${i}`} className="w-full h-auto object-contain bg-white min-h-[100px]" />
                           
                           {/* Overlay de Ações */}
                           <div className="absolute inset-x-0 bottom-0 bg-slate-900/60 backdrop-blur-sm p-4 translate-y-full group-hover:translate-y-0 transition-all flex items-center justify-between">
                             <div className="flex gap-2">
                               {['sm', 'md', 'lg', 'full'].map(s => (
                                 <button
                                   key={s}
                                   onClick={() => handleUpdateImageSize(i, s)}
                                   className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${currentSize === s ? 'bg-blue-500 text-white shadow-lg' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                                 >
                                   {s}
                                 </button>
                               ))}
                             </div>
                             <button 
                               onClick={() => handleRemoveExplanationImage(i)}
                               className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-xl transition-all active:scale-90"
                             >
                               <X className="w-4 h-4" />
                             </button>
                           </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Botão de Adição de Mídia */}
                {showImageArea && (
                  <div className="mt-10 flex flex-col items-center gap-4">
                    <label className="flex items-center gap-3 px-10 py-5 bg-white border-2 border-dashed border-blue-100 hover:border-blue-300 text-blue-400 hover:text-blue-600 rounded-[30px] cursor-pointer transition-all active:scale-95 shadow-sm group">
                      <ImageIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">ANEXAR COMPLEMENTO VISUAL</span>
                      <input 
                        ref={imageInputRef}
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                )}
                {(showImageArea || (currentQ.explanationImages && currentQ.explanationImages.length > 0)) && (
                  <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest italic text-center mt-4">Aumente sua retenção com imagens, mapas mentais ou prints.</p>
                )}

                {currentQ.memoryHint && (
                  <div className="bg-blue-600 p-10 rounded-[45px] border border-blue-500/10 shadow-2xl shadow-blue-900/20 relative overflow-hidden mt-12 group transition-all hover:shadow-blue-900/30">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                    <p className="text-[11px] font-black text-white uppercase tracking-[0.5em] mb-6 flex items-center gap-4">
                      <span className="text-2xl animate-bounce">⚡</span> BIZU DE MEMÓRIA (TDAH FOCUS)
                    </p>
                    <MarkdownContent content={currentQ.memoryHint} isDark />
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between mt-12">
                <button 
                  onClick={() => setSelectedAnswer(null)}
                  className="text-slate-400 hover:text-blue-500 font-bold text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" /> REVISAR RESPOSTA
                </button>
                
                <div className="flex gap-4">
                  <button 
                    onClick={prevQuestion}
                    disabled={currentIndex === 0}
                    className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-20 active:scale-95 flex items-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" /> ANTERIOR
                  </button>
                  <button 
                    onClick={nextQuestion}
                    className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/10 active:scale-95 flex items-center gap-2"
                  >
                    {currentIndex < questions.length - 1 ? 'PRÓXIMA' : 'FINALIZAR'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODALS OUTSIDE MAIN CARD BUT INSIDE INNER CONTAINER */}
        {showMoveModal && (
          <MoveToNotebookModal
            folders={folders}
            currentFolderId={folder.id}
            currentNotebookId={notebook.id}
            onConfirm={(targetFolderId, targetNotebookId) => {
              onMoveQuestion(currentQ.id, folder.id, notebook.id, targetFolderId, targetNotebookId);
              setShowMoveModal(false);
              if (questions.length === 1) {
                  onBack();
              } else {
                  const newQuestions = questions.filter((_, idx) => idx !== currentIndex);
                  setQuestions(newQuestions);
                  if (currentIndex >= newQuestions.length) setCurrentIndex(newQuestions.length - 1);
              }
            }}
            onClose={() => setShowMoveModal(false)}
          />
        )}

        {isNoteExpanded && (
          <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-md p-6 md:p-12 flex flex-col">
            <div className="flex items-center justify-between mb-8 max-w-5xl mx-auto w-full">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">MODO EDIÇÃO</h2>
                  <p className="text-white/40 text-[10px] font-black tracking-[0.3em] uppercase">Refine sua anotação estratégica</p>
                </div>
              </div>
              <button 
                onClick={() => { handleSaveUserCommentary(); setIsNoteExpanded(false); }}
                className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all active:scale-90"
              >
                <Minimize2 className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 max-w-5xl mx-auto w-full bg-white rounded-[40px] p-8 md:p-12 shadow-2xl overflow-hidden">
              <RichTextEditor
                content={userCommentaryInput}
                onChange={setUserCommentaryInput}
              />
            </div>
            
            <div className="mt-8 flex justify-center">
               <button 
                 onClick={() => { handleSaveUserCommentary(); setIsNoteExpanded(false); }}
                 className="px-12 py-5 bg-blue-600 text-white font-black uppercase text-[11px] tracking-widest rounded-full hover:bg-blue-700 transition-all shadow-2xl active:scale-95"
               >
                 CONCLUIR E SALVAR
               </button>
            </div>
          </div>
        )}

        {/* Floating Action Buttons Sidebar */}
        {questions.length > 0 && selectedAnswer !== null && (
          <div className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-[250] items-center">
            <div className="flex flex-col bg-white/100 backdrop-blur-xl p-2.5 rounded-full border border-slate-200 shadow-2xl gap-3">
              <button 
                onClick={() => {
                  setShowNoteSection(!showNoteSection);
                  if (!showNoteSection) {
                    setTimeout(() => {
                      noteSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      setIsNoteExpanded(true);
                    }, 100);
                  }
                }}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-90 transition-all group relative ${showNoteSection ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-100 hover:border-blue-200'}`}
                title="Alternar Nota Estratégica"
              >
                <MessageSquarePlus className="w-6 h-6" />
                <div className="absolute right-full mr-4 px-3 py-1.5 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap">
                  {showNoteSection ? 'Ocultar Nota' : 'Nota Estratégica'}
                </div>
              </button>
              <button 
                onClick={() => {
                  setShowImageArea(!showImageArea);
                  if (!showImageArea) {
                    setTimeout(() => {
                      imageInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                  }
                }}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-90 transition-all group relative ${showImageArea ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-100 hover:border-blue-200'}`}
                title="Alternar Anexo de Imagem"
              >
                <ImageIcon className="w-6 h-6" />
                <div className="absolute right-full mr-4 px-3 py-1.5 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap">
                  {showImageArea ? 'Ocultar Imagem' : 'Anexar Imagem'}
                </div>
              </button>
              {onTriggerGuidedLesson && (
                <button 
                  onClick={() => onTriggerGuidedLesson(currentQ.topic?.includes(':') ? currentQ.topic.split(':')[0] : folder.name, currentQ.topic?.includes(':') ? currentQ.topic.split(':')[1] : (currentQ.topic || notebook.name))}
                  className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-90 transition-all group relative border border-white/20"
                  title="Aula Guiada sobre este assunto"
                >
                  <BookOpen className="w-6 h-6" />
                  <div className="absolute right-full mr-4 px-3 py-1.5 bg-indigo-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap">
                    Aula Guiada
                  </div>
                </button>
              )}
              <div className="w-full h-px bg-slate-100 my-1"></div>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-200 transition-all"
                title="Voltar ao Topo"
              >
                <HelpCircle className="w-5 h-5 rotate-180" />
              </button>
            </div>
          </div>
        )}

        {/* FOOTER: ABANDON */}
        <div className="flex justify-center mt-12 pb-12">
          <button 
            onClick={() => { handleSaveUserCommentary(); onBack(); }} 
            className="text-slate-400 font-black text-[10px] tracking-[0.3em] flex items-center gap-3 hover:text-blue-500 transition-all group active:scale-90"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1" />
            ABANDONAR SIMULADO
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizPlayer;
