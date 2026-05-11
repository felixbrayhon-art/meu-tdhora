
import React, { useState, useRef } from 'react';
import { Scissors, Trash2, ChevronLeft, ChevronRight, Save, HelpCircle, FileText, CheckCircle2, RotateCcw, Brain, Copy, Maximize2, Minimize2, Flag, Bookmark, Share2, Shuffle, LogOut, Highlighter, PenLine, Eraser, Undo2, Image as ImageIcon, X, MessageSquarePlus, BookOpen } from 'lucide-react';
import { generateExamQuestions, parsePastedQuestions, identifyQuestionCount } from '../services/geminiService';
import { QuizQuestion, QuizFolder, StudyProfile, EditalConfig, ExplanationStyle } from '../types';
import LoadingFish from './LoadingFish';
import SaveToFolderModal from './SaveToFolderModal';
import MarkdownContent from './MarkdownContent';
import { RichTextEditor } from './RichTextEditor';

interface TDHQuestoesProps {
  onBack: () => void;
  folders: QuizFolder[];
  onSaveToNotebook: (folderId: string, notebookName: string, questions: QuizQuestion[]) => void;
  studyProfile: StudyProfile;
  prefill?: string | null;
  onConsumedPrefill?: () => void;
  strategicMode?: boolean;
  editalConfig?: EditalConfig;
  explanationStyle?: ExplanationStyle;
  onBatchComplete?: (topic: string, subject: string, total: number, correct: number, questions?: QuizQuestion[]) => void;
  onTriggerGuidedLesson?: (subject: string, topic: string) => void;
}

const TDHQuestoes: React.FC<TDHQuestoesProps> = ({ 
  onBack, 
  onSaveToNotebook, 
  folders, 
  studyProfile, 
  prefill, 
  onConsumedPrefill,
  strategicMode,
  editalConfig,
  explanationStyle: initialStyle,
  onBatchComplete,
  onTriggerGuidedLesson
}) => {
  const [topic, setTopic] = useState(prefill || '');
  const [inputMode, setInputMode] = useState<'AUTO' | 'PASTE' | 'MANUAL'>('AUTO');
  const [manualInputType, setManualInputType] = useState<'FULL' | 'QUICK'>('FULL');
  const createEmptyManualQuestion = () => ({
    id: Math.random().toString(36).substr(2, 9),
    question: '',
    options: ['', '', '', '', ''],
    correctAnswer: 0,
    explanation: '',
    topic: topic || 'Questões Manuais'
  });

  const [manualQuestionsList, setManualQuestionsList] = useState<QuizQuestion[]>([
    {
      id: Math.random().toString(36).substr(2, 9),
      question: '',
      options: ['', '', '', '', ''],
      correctAnswer: 0,
      explanation: '',
      topic: topic || 'Questões Manuais'
    }
  ]);
  const [pastedText, setPastedText] = useState('');
  const [pastedGabarito, setPastedGabarito] = useState('');
  const [batchStatus, setBatchStatus] = useState<{ current: number, total: number } | null>(null);
  const [banca, setBanca] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flagged, setFlagged] = useState<number[]>([]);
  const [questionScratched, setQuestionScratched] = useState<number[]>([]);
  const [questionHighlighted, setQuestionHighlighted] = useState<number[]>([]);
  const [undoStack, setUndoStack] = useState<Record<number, string[]>>({});
  const questionTextRef = useRef<HTMLDivElement>(null);
  const noteSectionRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const saveToUndo = (idx: number, content: string) => {
    setUndoStack(prev => ({
      ...prev,
      [idx]: [...(prev[idx] || []), content].slice(-10)
    }));
  };

  const handleUndo = () => {
    const qHistory = undoStack[currentIdx] || [];
    if (qHistory.length === 0) return;

    const previousContent = qHistory[qHistory.length - 1];
    const newHistory = qHistory.slice(0, -1);

    setUndoStack(prev => ({
      ...prev,
      [currentIdx]: newHistory
    }));

    const newQuestions = [...questions];
    newQuestions[currentIdx].question = previousContent;
    setQuestions(newQuestions);
    
    if (questionTextRef.current) {
      questionTextRef.current.innerHTML = previousContent;
    }
  };

  const [tempSelectedOpt, setTempSelectedOpt] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [showCommentary, setShowCommentary] = useState(false);
  const [saved, setSaved] = useState(false);
  const [numQuestions, setNumQuestions] = useState(10);
  const [explanationStyle, setExplanationStyle] = useState<ExplanationStyle>(initialStyle || 'TECNICA');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveMode, setSaveMode] = useState<'ALL' | 'SINGLE'>('ALL');
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [crossedOut, setCrossedOut] = useState<number[]>([]);
  const [userCommentaryInput, setUserCommentaryInput] = useState('');
  const [showNoteSection, setShowNoteSection] = useState(false);
  const [showImageArea, setShowImageArea] = useState(false);
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);

  React.useEffect(() => {
    if (questions[currentIdx]) {
      setUserCommentaryInput(questions[currentIdx].userCommentary || '');
    }
  }, [currentIdx, questions]);

  const handleSaveUserCommentary = (overrideValue?: string) => {
    if (!questions[currentIdx]) return;
    const valueToSave = overrideValue !== undefined ? overrideValue : userCommentaryInput;
    const newQuestions = [...questions];
    newQuestions[currentIdx] = {
      ...newQuestions[currentIdx],
      userCommentary: valueToSave
    };
    setQuestions(newQuestions);
  };

  const handleNext = () => {
    handleSaveUserCommentary();
    if (currentIdx < questions.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      const prevAnswer = userAnswers[nextIdx];
      setTempSelectedOpt(prevAnswer ?? null);
      setSelectedOpt(prevAnswer ?? null);
      setIsSubmitted(prevAnswer !== undefined);
      setShowCommentary(false);
      setCrossedOut([]);
    }
  };

  const handlePrev = () => {
    handleSaveUserCommentary();
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setCurrentIdx(prevIdx);
      const prevAnswer = userAnswers[prevIdx];
      setTempSelectedOpt(prevAnswer ?? null);
      setSelectedOpt(prevAnswer ?? null);
      setIsSubmitted(prevAnswer !== undefined);
      setShowCommentary(false);
      setCrossedOut([]);
    }
  };

  React.useEffect(() => {
    if (prefill) {
      handleGenerate(prefill);
      onConsumedPrefill?.();
    }
  }, [prefill]);

  const handleGenerate = async (targetTopic?: string) => {
    const finalTopic = targetTopic || (strategicMode ? (selectedTopic ? `${selectedSubject}: ${selectedTopic}` : '') : topic);
    if (!finalTopic.trim()) return;
    setLoading(true);
    setQuestions([]);
    setCurrentIdx(0);
    setShowCommentary(false);
    setSaved(false);
    setUserAnswers({});
    if (!targetTopic) setTopic(finalTopic);
    
    try {
      const result = await generateExamQuestions(finalTopic, numQuestions, studyProfile, banca, explanationStyle);
      const formatted = result.questions.map((q: any) => ({
        ...q,
        id: Math.random().toString(36).substr(2, 9)
      }));
      setQuestions(formatted);
      setTempSelectedOpt(null);
      setIsSubmitted(false);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Erro desconhecido ao gerar simulado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleParsePasted = async () => {
    if (!pastedText.trim()) return;
    setLoading(true);
    setQuestions([]);
    setCurrentIdx(0);
    setShowCommentary(false);
    setSaved(false);
    setUserAnswers({});
    
    try {
      // Step 1: Split text into physical chunks to avoid context window issues and improve precision
      // We aim for larger chunks for Pro model (~40,000 characters)
      const chunkSize = 40000;
      const chunks: string[] = [];
      let remainingText = pastedText;
      
      while (remainingText.length > 0) {
        if (remainingText.length <= chunkSize) {
          chunks.push(remainingText);
          break;
        }
        
        let splitPoint = remainingText.lastIndexOf('\n\n', chunkSize);
        if (splitPoint === -1) splitPoint = remainingText.lastIndexOf('\n', chunkSize);
        if (splitPoint === -1) splitPoint = chunkSize;
        
        chunks.push(remainingText.substring(0, splitPoint));
        remainingText = remainingText.substring(splitPoint).trim();
      }

      const totalBatches = chunks.length;
      let allQuestions: any[] = [];
      
      // Step 2: Extract in blocks
      for (let i = 0; i < totalBatches; i++) {
        setBatchStatus({ current: i + 1, total: totalBatches });
        console.log(`Processando bloco ${i + 1} de ${totalBatches}...`);
        
        // Delay estratégico para não estourar a cota
        if (i > 0) {
          console.log(`Aguardando 1.5s para evitar bloqueio de cota...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        const result = await parsePastedQuestions(chunks[i], studyProfile, { current: i + 1, total: totalBatches }, pastedGabarito, explanationStyle);
        
        if (result.questions && Array.isArray(result.questions)) {
          const formatted = result.questions.map((q: any) => ({
            ...q,
            id: Math.random().toString(36).substr(2, 9)
          }));
          allQuestions = [...allQuestions, ...formatted];
          console.log(`Bloco ${i + 1} concluído. Total de questões extraídas até agora: ${allQuestions.length}`);
          // Show progress incrementally
          setQuestions([...allQuestions]);
          setTempSelectedOpt(null);
          setIsSubmitted(false);
        } else {
          console.warn(`Bloco ${i + 1} retornou 0 questões.`);
        }
      }
      
      if (allQuestions.length === 0) throw new Error("Não conseguimos extrair nenhuma questão do texto.");
      
      setTopic("Questões do Texto Colado");
      setBatchStatus(null);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Erro ao processar texto. Verifique o formato e tente novamente.");
    } finally {
      setLoading(false);
      setBatchStatus(null);
    }
  };

  const handleAnswerSelection = (idx: number) => {
    if (isSubmitted) return;
    setTempSelectedOpt(idx);
    setCrossedOut(prev => prev.filter(i => i !== idx)); // Un-cross if selected
  };

  const handleSubmitAnswer = () => {
    if (tempSelectedOpt === null || isSubmitted) return;
    setSelectedOpt(tempSelectedOpt);
    setIsSubmitted(true);
    setUserAnswers(prev => ({ ...prev, [currentIdx]: tempSelectedOpt }));
  };

  const handleDoubleClick = (idx: number) => {
    if (isSubmitted) return;
    if (tempSelectedOpt === idx) setTempSelectedOpt(null);
    setCrossedOut(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const toggleFlag = () => {
    setFlagged(prev => 
      prev.includes(currentIdx) ? prev.filter(i => i !== currentIdx) : [...prev, currentIdx]
    );
  };

  const addManualQuestion = () => {
    setManualQuestionsList(prev => [...prev, createEmptyManualQuestion()]);
  };

  const updateManualQuestion = (idx: number, field: string, value: any) => {
    setManualQuestionsList(prev => {
        const newList = [...prev];
        newList[idx] = { ...newList[idx], [field]: value };
        return newList;
    });
  };

  const startManualSimulado = () => {
    const finalQuestions = manualQuestionsList.filter(q => q.question.trim().length > 0);
    
    if (finalQuestions.length === 0) {
        alert("Preencha pelo menos uma questão.");
        return;
    }

    setQuestions(finalQuestions);
    setTopic(topic || "Simulado Manual");
    setCurrentIdx(0);
    setTempSelectedOpt(null);
    setIsSubmitted(false);
  };

  const handleDeleteQuestion = () => {
    if (confirm("Tem certeza que deseja excluir esta questão? Ela será removida apenas desta sessão.")) {
      const newQuestions = questions.filter((_, idx) => idx !== currentIdx);
      if (newQuestions.length === 0) {
        setQuestions([]);
        return;
      }
      setQuestions(newQuestions);
      if (currentIdx >= newQuestions.length) {
        setCurrentIdx(newQuestions.length - 1);
      }
      setSelectedOpt(null);
      setShowCommentary(false);
      setCrossedOut([]);
    }
  };

  const handleFinish = () => {
    const total = questions.length;
    const correct = questions.filter((q, i) => userAnswers[i] === q.correctAnswer).length;
    onBatchComplete?.(topic, selectedSubject, total, correct, questions.map((q, i) => ({ ...q, userAnswer: userAnswers[i] })));
    onBack();
  };

  const handleShuffle = () => {
    if (confirm("Deseja embaralhar as questões deste simulado?")) {
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setCurrentIdx(0);
      setTempSelectedOpt(null);
      setSelectedOpt(null);
      setIsSubmitted(false);
      setCrossedOut([]);
    }
  };

  const handleSelectiveMark = (type: 'strike' | 'highlight') => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
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
        saveToUndo(currentIdx, container.innerHTML);
        if (range.startContainer === range.endContainer) {
          range.surroundContents(span);
        } else {
          const content = range.extractContents();
          span.appendChild(content);
          range.insertNode(span);
        }
        const newQuestions = [...questions];
        newQuestions[currentIdx].question = container.innerHTML;
        setQuestions(newQuestions);
      } catch (e) {
        console.warn("Selection failed", e);
      }
      selection.removeAllRanges();
    }
  };

  const toggleQuestionScratch = () => {
    if (questionScratched.includes(currentIdx)) {
      setQuestionScratched(questionScratched.filter(i => i !== currentIdx));
    } else {
      setQuestionScratched([...questionScratched, currentIdx]);
      setQuestionHighlighted(questionHighlighted.filter(i => i !== currentIdx));
    }
  };

  const toggleQuestionHighlight = () => {
    if (questionHighlighted.includes(currentIdx)) {
      setQuestionHighlighted(questionHighlighted.filter(i => i !== currentIdx));
    } else {
      setQuestionHighlighted([...questionHighlighted, currentIdx]);
      setQuestionScratched(questionScratched.filter(i => i !== currentIdx));
    }
  };

  const handleAddExplanationImage = (imageUrl: string) => {
    if (!questions[currentIdx]) return;
    const newQuestions = [...questions];
    const currentImages = newQuestions[currentIdx].explanationImages || [];
    newQuestions[currentIdx] = {
      ...newQuestions[currentIdx],
      explanationImages: [...currentImages, imageUrl]
    };
    setQuestions(newQuestions);
  };

  const handleRemoveExplanationImage = (imgIdx: number) => {
    if (!questions[currentIdx]) return;
    const newQuestions = [...questions];
    const currentImages = [...(newQuestions[currentIdx].explanationImages || [])];
    currentImages.splice(imgIdx, 1);
    newQuestions[currentIdx] = {
      ...newQuestions[currentIdx],
      explanationImages: currentImages
    };
    setQuestions(newQuestions);
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

  const handleUpdateImageSize = (imgIdx: number, size: string) => {
    if (!questions[currentIdx]) return;
    const newQuestions = [...questions];
    const currentSizes = [...(newQuestions[currentIdx].explanationImageSizes || [])];
    // Pad array if needed
    while (currentSizes.length <= imgIdx) currentSizes.push('md');
    currentSizes[imgIdx] = size;
    newQuestions[currentIdx] = {
      ...newQuestions[currentIdx],
      explanationImageSizes: currentSizes
    };
    setQuestions(newQuestions);
  };

  const handleSaveSingleQuestion = () => {
    setSaveMode('SINGLE');
    setShowSaveModal(true);
  };

  const handleConfirmSave = (folderId: string, notebookName: string) => {
    const questionsToSave = saveMode === 'SINGLE' ? [questions[currentIdx]] : questions;
    onSaveToNotebook(folderId, notebookName, questionsToSave);
    if (saveMode === 'ALL') setSaved(true);
    setShowSaveModal(false);
  };

  const currentQ = questions[currentIdx];

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0A0F1E] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-[50px] p-12 md:p-20 shadow-2xl flex flex-col items-center max-w-xl w-full">
          <LoadingFish 
            message={batchStatus ? `Extraindo Bloco ${batchStatus.current} de ${batchStatus.total}` : "Arquitetando Simulado..."} 
            submessage={batchStatus 
              ? `A IA está processando seu texto em partes para não pular nenhuma questão.`
              : `IA preparando questões focadas em ${studyProfile === 'CONCURSO' ? 'Concursos de Elite' : 'ENEM/Vestibular'}`
            }
          />
          
          {batchStatus && (
            <div className="mt-8 w-full">
              <div className="flex justify-between mb-2">
                <span className="text-[#0A0F1E] font-black text-[10px] tracking-widest uppercase">Análise de Conteúdo</span>
                <span className="text-[#0A0F1E] font-black text-[10px]">{Math.round((batchStatus.current / batchStatus.total) * 100)}%</span>
              </div>
              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 transition-all duration-1000 ease-out" 
                  style={{ width: `${(batchStatus.current / batchStatus.total) * 100}%` }}
                ></div>
              </div>
              <p className="mt-6 text-center text-gray-400 font-bold text-[9px] uppercase tracking-[0.2em] leading-relaxed max-w-xs mx-auto">
                Estamos processando em lotes de segurança.<br/>
                Isso evita erros de memória da IA e garante a extração de 100% das perguntas coladas.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#f8fafc] text-[#1e293b] selection:bg-blue-500/30 overflow-y-auto font-sans">
      <div className="w-full max-w-5xl mx-auto px-6 py-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
        {!questions.length ? (
          <div className="py-10">
            <button onClick={onBack} className="mb-12 text-gray-500 font-black uppercase text-[10px] tracking-[0.3em] flex items-center gap-2 hover:text-white transition-all group">
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              ABANDONAR SIMULADO
            </button>
            
            <div className="bg-white rounded-[50px] p-12 md:p-20 border border-slate-200 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none text-blue-500">
                 <FileText className="w-64 h-64" />
              </div>
              
              <div className="relative z-10 text-center max-w-2xl mx-auto">
                <div className="w-20 h-20 bg-blue-50 text-blue-500 border border-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-sm">
                  <Scissors className="w-8 h-8" />
                </div>
                <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tighter leading-none italic uppercase text-slate-800">TDH<span className="text-blue-600">{strategicMode ? 'estratégico' : 'questões'}</span></h1>
                <p className="text-slate-400 text-lg mb-12 font-black uppercase tracking-widest text-[10px]">
                  {strategicMode ? 'Alinhamento Automático ao Edital' : `Simulados ${studyProfile === 'CONCURSO' ? 'Elite' : 'Vestibular'} • Gabarito Comentado`}
                </p>
                
                <div className="space-y-8">
                  <div className="space-y-3 text-left max-w-2xl mx-auto">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6 italic">O que vamos treinar hoje?</label>
                    <input 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder={studyProfile === 'CONCURSO' ? "Ex: Atos Administrativos" : "Ex: Genética Mendeliana"}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-[40px] px-10 py-6 text-xl focus:outline-none focus:border-blue-500 transition-all font-black text-center text-slate-700 placeholder:text-slate-300"
                    />
                  </div>

                  {!strategicMode && (
                    <div className="flex bg-slate-50 p-1.5 rounded-[24px] mx-auto max-w-sm mb-8 border border-slate-100">
                      <button 
                        onClick={() => setInputMode('AUTO')}
                        className={`flex-1 py-3 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${inputMode === 'AUTO' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        IA
                      </button>
                      <button 
                        onClick={() => setInputMode('PASTE')}
                        className={`flex-1 py-3 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all gap-2 flex items-center justify-center ${inputMode === 'PASTE' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        COLAR
                      </button>
                      <button 
                        onClick={() => setInputMode('MANUAL')}
                        className={`flex-1 py-3 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all gap-2 flex items-center justify-center ${inputMode === 'MANUAL' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        MANUAL
                      </button>
                    </div>
                  )}

                  {inputMode === 'AUTO' ? (
                    <>
                      {strategicMode && editalConfig ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3 text-left">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Matéria do Edital</label>
                            <select 
                              value={selectedSubject}
                              onChange={(e) => { setSelectedSubject(e.target.value); setSelectedTopic(''); }}
                              className="w-full bg-white/5 border-2 border-white/10 rounded-3xl px-6 py-5 text-lg focus:outline-none focus:border-orange-500 transition-all font-bold appearance-none cursor-pointer text-white"
                            >
                              <option value="" className="bg-[#0A0F1E]">Selecionar Matéria...</option>
                              {editalConfig.subjects.map((s, i) => (
                                 <option key={i} value={s.name} className="bg-[#0A0F1E]">{s.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-3 text-left">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Assunto Específico</label>
                            <select 
                              value={selectedTopic}
                              onChange={(e) => setSelectedTopic(e.target.value)}
                              disabled={!selectedSubject}
                              className="w-full bg-white/5 border-2 border-white/10 rounded-3xl px-6 py-5 text-lg focus:outline-none focus:border-orange-500 transition-all font-bold appearance-none cursor-pointer disabled:opacity-20 text-white"
                            >
                              <option value="" className="bg-[#0A0F1E]">Selecionar Assunto...</option>
                              {editalConfig.subjects.find(s => s.name === selectedSubject)?.topics.map((t, i) => (
                                <option key={i} value={t} className="bg-[#0A0F1E]">{t}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-50 p-8 rounded-[35px] text-left border border-slate-100 focus-within:border-blue-500/50 transition-all">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 italic">Banca Examinadora</label>
                          <input 
                            value={banca}
                            onChange={(e) => setBanca(e.target.value)}
                            placeholder="Ex: FCC, FGV, CESPE..."
                            className="w-full bg-transparent border-none text-xl focus:outline-none font-black text-slate-700 placeholder:text-slate-300"
                          />
                        </div>
                        <div className="bg-slate-50 p-8 rounded-[35px] text-left border border-slate-100">
                          <div className="flex justify-between items-center mb-6">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Qtd. Questões</label>
                            <span className="text-blue-600 font-black text-2xl tabular-nums">{numQuestions}</span>
                          </div>
                          <input 
                            type="range" min="1" max="50" 
                            value={numQuestions}
                            onChange={(e) => setNumQuestions(Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-full accent-blue-600 cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-8 rounded-[35px] text-left border border-slate-100 mb-4 group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4 italic text-center md:text-left group-hover:text-blue-600 transition-colors">ESTILO DO mapeamento da lógica (PROMPT)</label>
                        <div className="relative">
                          <textarea
                            value={explanationStyle}
                            onChange={(e) => setExplanationStyle(e.target.value)}
                            placeholder="Ex: Use mnemônicos engraçados, explique de forma simples e termine com um desafio mental."
                            className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-[25px] p-6 text-sm font-medium text-slate-600 outline-none transition-all min-h-[100px] resize-none shadow-sm"
                          />
                          <div className="absolute top-4 right-6 text-lg opacity-20">✍️</div>
                        </div>
                        <p className="text-[9px] font-bold text-slate-300 mt-4 italic text-center md:text-left">Dica: Quanto mais curto o comando, mais rápido a IA responde.</p>
                      </div>

                      <button 
                        onClick={() => handleGenerate()}
                        className="w-full bg-blue-600 text-white py-8 rounded-[40px] font-black text-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/10 flex items-center justify-center gap-4 active:scale-95 group mt-8"
                      >
                        CONFIGURAR SIMULADO
                        <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                      </button>
                    </>
                  ) : inputMode === 'PASTE' ? (
                    <div className="space-y-6 text-left relative z-20 animate-in fade-in slide-in-from-bottom-4">
                      <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 mb-6 font-medium text-blue-700 text-sm flex items-center gap-3">
                        <Brain className="w-5 h-5 flex-shrink-0" /> 
                        <span>A IA vai ler as questões, identificar a resposta certa (se não tiver gabarito) e criar a explicação detalhada para você!</span>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Cole as questões aqui</label>
                        <textarea
                          value={pastedText}
                          onChange={(e) => setPastedText(e.target.value)}
                          placeholder="Cole aqui o texto de uma prova, pdf ou site contendo as questões e alternativas..."
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[30px] p-8 text-lg focus:outline-none focus:border-blue-500 transition-all font-medium text-slate-700 placeholder:text-slate-300 min-h-[300px] resize-y shadow-inner"
                        />
                      </div>
                      
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center justify-between px-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Gabarito (Opcional)</label>
                        </div>
                        <textarea
                          value={pastedGabarito}
                          onChange={(e) => setPastedGabarito(e.target.value)}
                          placeholder="Ex: 1-A, 2-C, 3-E... ou cole o gabarito oficial completo aqui."
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[30px] p-8 text-lg focus:outline-none focus:border-blue-500 transition-all font-medium text-slate-700 placeholder:text-slate-300 min-h-[150px] resize-y shadow-inner"
                        />
                      </div>

                      <button 
                        onClick={() => handleParsePasted()}
                        disabled={!pastedText.trim()}
                        className="w-full bg-blue-600 text-white py-8 rounded-[40px] font-black text-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/10 flex items-center justify-center gap-4 active:scale-95 group mt-8 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        PROCESSAR QUESTÕES
                        <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-12 text-left relative z-20 animate-in fade-in slide-in-from-bottom-4">
                       <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mb-4 border border-slate-200 shadow-inner">
                          <button 
                            onClick={() => setManualInputType('FULL')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${manualInputType === 'FULL' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            Completo
                          </button>
                          <button 
                            onClick={() => setManualInputType('QUICK')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${manualInputType === 'QUICK' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            Modo Rápido
                          </button>
                       </div>

                       <div className="space-y-16">
                          {manualQuestionsList.map((mq, qIdx) => (
                            <div key={mq.id} className="bg-white p-8 md:p-12 rounded-[45px] border border-slate-100 shadow-sm relative group animate-in zoom-in-95 duration-300">
                               <div className="absolute -top-4 -left-4 w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black italic shadow-lg z-10">
                                 {qIdx + 1}
                               </div>
                               
                               {manualQuestionsList.length > 1 && (
                                 <button 
                                   onClick={() => setManualQuestionsList(prev => prev.filter((_, i) => i !== qIdx))}
                                   className="absolute top-8 right-8 p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                 >
                                   <Trash2 className="w-5 h-5" />
                                 </button>
                               )}

                               <div className="space-y-8">
                                 <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                                      {manualInputType === 'QUICK' ? 'Pergunta + Alternativas (Tudo aqui)' : 'Enunciado da Questão'}
                                    </label>
                                    <div className="bg-slate-50 rounded-[30px] border-2 border-slate-100 focus-within:border-blue-500 transition-all overflow-hidden shadow-inner">
                                      <RichTextEditor 
                                        content={mq.question}
                                        onChange={html => updateManualQuestion(qIdx, 'question', html)}
                                      />
                                    </div>
                                 </div>

                                 <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Gabarito</label>
                                    {manualInputType === 'QUICK' ? (
                                      <div className="flex gap-4 items-center bg-slate-50 p-6 rounded-[30px] border border-slate-100 justify-between shadow-inner">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qual a letra correta?</span>
                                        <div className="flex gap-3">
                                          {[0, 1, 2, 3, 4].map(idx => (
                                            <button
                                              key={idx}
                                              onClick={() => updateManualQuestion(qIdx, 'correctAnswer', idx)}
                                              className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center font-black transition-all active:scale-90 ${mq.correctAnswer === idx ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'border-slate-200 text-slate-300 hover:border-slate-300 shadow-sm bg-white'}`}
                                            >
                                              {String.fromCharCode(65 + idx)}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        {mq.options.map((opt, i) => (
                                            <div key={i} className="flex gap-4 items-center group/opt">
                                                <div 
                                                  onClick={() => updateManualQuestion(qIdx, 'correctAnswer', i)}
                                                  className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center font-black transition-all cursor-pointer select-none ${mq.correctAnswer === i ? 'bg-green-500 border-green-500 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-300 group-hover/opt:border-slate-200'}`}
                                                >
                                                  {String.fromCharCode(65 + i)}
                                                </div>
                                                <input 
                                                  value={opt}
                                                  onChange={e => {
                                                      const newOptions = [...mq.options];
                                                      newOptions[i] = e.target.value;
                                                      updateManualQuestion(qIdx, 'options', newOptions);
                                                  }}
                                                  className="flex-1 bg-white border border-slate-100 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500 transition-all font-bold text-sm text-slate-700 shadow-sm"
                                                  placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                                                />
                                            </div>
                                        ))}
                                      </div>
                                    )}
                                 </div>

                                 <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Explicação / Resolução (Opcional)</label>
                                    <div className="bg-slate-50 rounded-[30px] border-2 border-slate-100 focus-within:border-blue-500 transition-all overflow-hidden shadow-inner">
                                      <RichTextEditor 
                                        content={mq.explanation}
                                        onChange={html => updateManualQuestion(qIdx, 'explanation', html)}
                                      />
                                    </div>
                                 </div>
                               </div>
                            </div>
                          ))}
                       </div>

                       <div className="flex flex-col md:flex-row gap-6 pt-10 sticky bottom-0 bg-[#f8fafc]/90 backdrop-blur-md p-6 border-t border-slate-100 rounded-t-[40px] z-30">
                          <button 
                            onClick={addManualQuestion}
                            className="flex-1 bg-white border-2 border-blue-100 text-blue-600 py-6 rounded-[30px] font-black uppercase tracking-widest text-xs hover:bg-blue-50 active:scale-95 transition-all shadow-xl shadow-blue-500/5 flex items-center justify-center gap-3"
                          >
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                             ADICIONAR NOVA CAIXA
                          </button>
                          <button 
                            onClick={startManualSimulado}
                            className="flex-[2] bg-[#0A0F1E] text-white py-6 rounded-[30px] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                          >
                             INICIAR SIMULADO ({manualQuestionsList.filter(q => q.question.trim().length > 0).length} PRONTAS)
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                          </button>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-8 pb-32">
            {/* Header Mini Imersivo */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm sticky top-0 z-30">
              <div className="flex items-center gap-6">
                <button onClick={() => { handleFinish(); setQuestions([]); }} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all group active:scale-90">
                  <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                </button>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <h4 className="font-black text-sm tracking-widest uppercase italic text-slate-800">{topic}</h4>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Questão {currentIdx + 1} de {questions.length} • EM ANDAMENTO</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 mr-4">
                   <button className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all border border-slate-100">
                     <Share2 className="w-4 h-4" />
                   </button>
                   <button 
                     onClick={handlePrev}
                     disabled={currentIdx === 0}
                     className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all border border-slate-100 disabled:opacity-30"
                   >
                     <ChevronLeft className="w-4 h-4" />
                   </button>
                   <button 
                     onClick={handleNext}
                     disabled={currentIdx === questions.length - 1}
                     className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all border border-slate-100 disabled:opacity-30"
                   >
                     <ChevronRight className="w-4 h-4" />
                   </button>
                </div>
                <button 
                  onClick={() => { handleSaveUserCommentary(); setShowSaveModal(true); }}
                  disabled={saved}
                  className={`px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all active:scale-90 shadow-sm ${saved ? 'bg-green-500 text-white' : 'bg-slate-50 text-slate-400 hover:text-blue-500 border border-slate-100'}`}
                >
                  {saved ? 'CONSOLIDADO!' : 'SALVAR CADERNO'}
                  {!saved && <Save className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[40px] p-8 md:p-16 shadow-sm border border-slate-200/60 relative overflow-hidden transition-all hover:shadow-md">
              <div className="mb-10 text-center md:text-left">
                <div className="flex items-center justify-between mb-6">
                   <span className="text-[11px] font-black text-blue-500/50 uppercase tracking-[0.3em]">Questão {currentIdx + 1}</span>
                   
                   <div className="flex items-center gap-2">
                     <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 shadow-inner mr-2">
                        <button 
                          onClick={() => handleSelectiveMark('highlight')}
                          className={`p-2 rounded-lg transition-all active:scale-90 ${questionHighlighted.includes(currentIdx) ? 'bg-yellow-100 text-yellow-600 shadow-sm border border-yellow-200' : 'text-slate-300 hover:text-blue-500'}`}
                          title="Destacar (Selecione texto ou clique para todo enunciado)"
                        >
                          <Highlighter className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleSelectiveMark('strike')}
                          className={`p-2 rounded-lg transition-all active:scale-90 ${questionScratched.includes(currentIdx) ? 'bg-slate-200 text-slate-600 shadow-sm' : 'text-slate-300 hover:text-blue-500'}`}
                          title="Taxar (Selecione texto ou clique para todo enunciado)"
                        >
                          <PenLine className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setQuestionScratched(questionScratched.filter(i => i !== currentIdx));
                            setQuestionHighlighted(questionHighlighted.filter(i => i !== currentIdx));
                          }}
                          className="p-2 text-slate-300 hover:text-red-500 transition-all active:scale-90"
                          title="Limpar Marcações"
                        >
                          <Eraser className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={handleUndo}
                          disabled={!(undoStack[currentIdx] && undoStack[currentIdx].length > 0)}
                          className="p-2 text-slate-300 hover:text-orange-500 disabled:opacity-20 transition-all active:scale-90"
                          title="Desfazer Marcação"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                     </div>

                     <button 
                        onClick={toggleFlag}
                        className={`p-2.5 rounded-xl transition-all active:scale-95 flex-shrink-0 ${flagged.includes(currentIdx) ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-50 text-slate-300 hover:text-blue-500 hover:bg-blue-50'}`}
                        title="Marcar para análise"
                      >
                        <Flag className={`w-4 h-4 ${flagged.includes(currentIdx) ? 'fill-current' : ''}`} />
                      </button>
                   </div>
                </div>
                <div 
                  ref={questionTextRef}
                  className={`text-[17px] md:text-[20px] font-semibold leading-[1.6] tracking-tight markdown-body transition-all duration-500 ${
                    questionScratched.includes(currentIdx) ? 'text-slate-300 line-through grayscale blur-[0.5px] opacity-40 italic' : 
                    questionHighlighted.includes(currentIdx) ? 'text-slate-800 bg-yellow-100/50 p-6 rounded-2xl border-l-[6px] border-l-yellow-400' : 
                    'text-slate-700'
                  }`} 
                  dangerouslySetInnerHTML={{ __html: currentQ.question }} 
                />
              </div>

              <div className={currentQ.options.every(o => !o.trim()) ? "flex flex-wrap justify-center gap-4 mb-10" : "grid grid-cols-1 gap-4 mb-10"}>
                  {currentQ.options.map((opt, idx) => {
                    const isCorrect = idx === currentQ.correctAnswer;
                    const isSelected = tempSelectedOpt === idx;
                    const isCrossedOut = crossedOut.includes(idx);
                    const isFinalSelected = selectedOpt === idx;
                    const isQuickMode = currentQ.options.every(o => !o.trim());
                    
                    let cardClass = "bg-white border border-slate-100 hover:border-blue-200 hover:bg-slate-50/50 text-slate-600 shadow-sm";
                    let circleClass = "border-slate-100 text-slate-300 group-hover:border-blue-500/50 group-hover:text-blue-500";
                    let textClass = "text-slate-600";
                    
                    if (isSelected && !isSubmitted) {
                      cardClass = "border-blue-200 bg-blue-50/20 text-slate-900 shadow-md border-l-[4px] border-l-blue-500 ring-4 ring-blue-500/5";
                      circleClass = "bg-blue-100 border-blue-500 text-blue-600";
                    }

                    if (isCrossedOut && !isSubmitted) {
                      cardClass = "border-transparent bg-slate-50/50 opacity-40";
                      textClass = "text-slate-300 line-through grayscale";
                    }

                    if (isSubmitted) {
                      if (isCorrect) {
                        cardClass = "bg-green-50 border-green-200 text-green-700 border-l-[4px] border-l-green-500";
                        circleClass = "bg-green-500 border-green-500 text-white";
                        textClass = "text-green-700 font-bold";
                      } else if (isFinalSelected) {
                        cardClass = "bg-red-50 border-red-200 text-red-700 border-l-[4px] border-l-red-500";
                        circleClass = "bg-red-500 border-red-500 text-white";
                        textClass = "text-red-700 font-bold";
                      } else {
                        cardClass = "opacity-40 bg-slate-50 border-transparent grayscale";
                      }
                    }

                    return (
                      <div key={idx} className="relative group">
                        <div 
                          onClick={() => handleAnswerSelection(idx)}
                          onDoubleClick={() => handleDoubleClick(idx)}
                          className={`${isQuickMode ? 'w-14 h-14 rounded-2xl flex items-center justify-center' : 'w-full text-left p-6 rounded-[25px] flex items-center gap-6'} font-bold transition-all duration-300 select-none cursor-pointer group active:scale-[0.98] ${cardClass} relative overflow-hidden`}
                          role="button"
                          aria-disabled={isSubmitted}
                          tabIndex={0}
                        >
                          <div className={`flex items-center flex-1 ${isQuickMode ? 'justify-center' : 'gap-6'}`}>
                            <span className={`${isQuickMode ? 'w-10 h-10 rounded-xl' : 'w-12 h-12 rounded-full'} border flex items-center justify-center text-[12px] font-black flex-shrink-0 transition-all ${circleClass}`}>
                              {String.fromCharCode(65 + idx)}
                            </span>
                            {!isQuickMode && <span className={`text-[16px] leading-snug transition-colors ${textClass}`}>{opt}</span>}
                          </div>

                          {!isSubmitted && !isQuickMode && (
                             <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-200'}`}>
                               {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}
                             </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {!isSubmitted ? (
                <div className="flex justify-center md:justify-start">
                  <button 
                    onClick={handleSubmitAnswer}
                    disabled={tempSelectedOpt === null}
                    className="bg-[#2ecc71] hover:bg-[#27ae60] disabled:bg-white/5 disabled:text-white/20 disabled:cursor-not-allowed text-white font-bold px-10 py-3.5 rounded-xl uppercase text-[11px] tracking-wider transition-all active:scale-95 shadow-lg shadow-green-900/10"
                  >
                    CONFERIR RESPOSTA
                  </button>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
                  <div className={`p-8 rounded-[40px] mb-10 border ${selectedOpt === currentQ.correctAnswer ? 'bg-green-50 border-green-100 shadow-sm' : 'bg-red-50 border-red-100 shadow-sm'}`}>
                    <div className="flex items-center gap-6">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg ${selectedOpt === currentQ.correctAnswer ? 'bg-green-500' : 'bg-red-500'}`}>
                        {selectedOpt === currentQ.correctAnswer ? '✓' : '✗'}
                      </div>
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-[0.4em] mb-1 ${selectedOpt === currentQ.correctAnswer ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedOpt === currentQ.correctAnswer ? 'TARGET ACQUIRED' : 'ROUTE ERROR'}
                        </p>
                        <p className="text-slate-800 text-[17px] font-bold">
                          Gabarito: <span className="text-blue-600">{String.fromCharCode(65 + currentQ.correctAnswer)}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-[40px] p-8 md:p-12 border border-slate-100 shadow-inner leading-relaxed mb-10">
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

                    <div className="flex items-center gap-3 mb-6 font-black italic text-blue-500">
                       <span className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-sm shadow-sm">A</span>
                       <h4 className="text-[10px] uppercase tracking-widest">MAPEAMENTO DA LÓGICA</h4>
                    </div>

                    {onTriggerGuidedLesson && (
                      <button 
                        onClick={() => onTriggerGuidedLesson(selectedSubject || 'Geral', currentQ.topic || topic)}
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
                      <div className="mt-10 flex flex-col md:flex-row items-center justify-center gap-6">
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
                        <button 
                          onClick={handleSaveSingleQuestion}
                          className="flex items-center gap-3 px-10 py-5 bg-blue-600 text-white rounded-[30px] transition-all active:scale-95 shadow-xl shadow-blue-500/20 hover:bg-blue-700 group"
                        >
                          <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">SALVAR ESTA QUESTÃO</span>
                        </button>
                      </div>
                    )}
                    {(showImageArea || (currentQ.explanationImages && currentQ.explanationImages.length > 0)) && (
                      <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest italic text-center mt-4">Aumente sua retenção com imagens, mapas mentais ou prints.</p>
                    )}

                    {currentQ.memoryHint && (
                      <div className="bg-blue-600 p-10 rounded-[45px] border border-blue-500/10 shadow-2xl shadow-blue-900/20 relative overflow-hidden mt-12 group transition-all hover:shadow-blue-900/30">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                        <p className="text-[11px] font-black text-white uppercase tracking-[0.5em] mb-6 flex items-center gap-4">
                          <span className="text-2xl animate-bounce">⚡</span> BIZU DE MEMÓRIA (REDE NEURAL)
                        </p>
                        <MarkdownContent content={currentQ.memoryHint} isDark />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-10">
                    <button 
                      onClick={() => setIsSubmitted(false)}
                      className="text-slate-400 hover:text-blue-500 font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95"
                    >
                      <ChevronLeft className="w-4 h-4" /> REVISAR RESPOSTA
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-16 scale-110">
               <div className="flex items-center justify-center gap-3">
                <button 
                  onClick={handlePrev}
                  disabled={currentIdx === 0}
                  className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl shadow-sm transition-all disabled:opacity-20 active:scale-95"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                  onClick={handleNext}
                  disabled={currentIdx === questions.length - 1}
                  className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl shadow-sm transition-all disabled:opacity-20 active:scale-95"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                <button 
                  onClick={handleShuffle}
                  className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl shadow-sm transition-all active:scale-95"
                >
                  <Shuffle className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => { handleFinish(); setQuestions([]); }}
                  className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-red-500 rounded-xl shadow-sm transition-all active:scale-95"
                >
                  <LogOut className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Progresso Inferior */}
      {questions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 z-[210] shadow-2xl">
          <div className="max-w-3xl mx-auto space-y-3">
             <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
               <span>PROGRESSO ATUAL</span>
               <span className="text-blue-600">{Math.round(((currentIdx + 1) / questions.length) * 100)}%</span>
             </div>
             <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-blue-500 transition-all duration-700"
                 style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
               />
             </div>
          </div>
        </div>
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
              <Minimize2 className="w-4 h-4" />
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

      {showSaveModal && (
        <SaveToFolderModal 
          folders={folders}
          suggestedName={saveMode === 'SINGLE' ? (currentQ.topic || topic) : topic}
          onConfirm={handleConfirmSave}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {/* Floating Action Buttons Sidebar */}
      {questions.length > 0 && isSubmitted && (
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
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-90 transition-all group relative ${showImageArea ? 'bg-blue-600 text-white border-transparent' : 'bg-white border border-slate-100 text-slate-600 hover:border-blue-200'}`}
              title="Alternar Anexo de Imagem"
            >
              <ImageIcon className="w-6 h-6" />
              <div className="absolute right-full mr-4 px-3 py-1.5 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap">
                {showImageArea ? 'Ocultar Imagem' : 'Anexar Imagem'}
              </div>
            </button>
            {onTriggerGuidedLesson && (
              <button 
                onClick={() => onTriggerGuidedLesson(selectedSubject || 'Geral', currentQ.topic || topic)}
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
    </div>
  );

};

export default TDHQuestoes;
