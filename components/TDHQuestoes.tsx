
import React, { useState } from 'react';
import { Scissors, Trash2, ChevronLeft, ChevronRight, Save, HelpCircle, FileText, CheckCircle2, RotateCcw, Brain, Copy, Maximize2, Minimize2 } from 'lucide-react';
import { generateExamQuestions, parsePastedQuestions, identifyQuestionCount } from '../services/geminiService';
import { QuizQuestion, QuizFolder, StudyProfile, EditalConfig } from '../types';
import LoadingFish from './LoadingFish';
import SaveToFolderModal from './SaveToFolderModal';
import ReactMarkdown from 'react-markdown';
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
  onBatchComplete?: (topic: string, subject: string, total: number, correct: number, questions?: QuizQuestion[]) => void;
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
  onBatchComplete
}) => {
  const [inputMode, setInputMode] = useState<'AUTO' | 'PASTE'>('AUTO');
  const [pastedText, setPastedText] = useState('');
  const [pastedGabarito, setPastedGabarito] = useState('');
  const [batchStatus, setBatchStatus] = useState<{ current: number, total: number } | null>(null);
  const [topic, setTopic] = useState(prefill || '');
  const [banca, setBanca] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [showCommentary, setShowCommentary] = useState(false);
  const [saved, setSaved] = useState(false);
  const [numQuestions, setNumQuestions] = useState(10);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [crossedOut, setCrossedOut] = useState<number[]>([]);
  const [userCommentaryInput, setUserCommentaryInput] = useState('');
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
      setSelectedOpt(userAnswers[nextIdx] ?? null);
      setShowCommentary(false);
      setCrossedOut([]);
    }
  };

  const handlePrev = () => {
    handleSaveUserCommentary();
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setCurrentIdx(prevIdx);
      setSelectedOpt(userAnswers[prevIdx] ?? null);
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
      const result = await generateExamQuestions(finalTopic, numQuestions, studyProfile, banca);
      const formatted = result.questions.map((q: any) => ({
        ...q,
        id: Math.random().toString(36).substr(2, 9)
      }));
      setQuestions(formatted);
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
      // Step 1: Detect how many questions
      const estimatedCount = await identifyQuestionCount(pastedText);
      const batchSize = 10;
      const totalBatches = Math.ceil((estimatedCount || 1) / batchSize) || 1;
      
      let allQuestions: any[] = [];
      
      // Step 2: Extract in blocks
      for (let i = 0; i < totalBatches; i++) {
        setBatchStatus({ current: i + 1, total: totalBatches });
        console.log(`Processando bloco ${i + 1} de ${totalBatches}...`);
        
        const result = await parsePastedQuestions(pastedText, studyProfile, { current: i + 1, total: totalBatches }, pastedGabarito);
        
        if (result.questions && Array.isArray(result.questions)) {
          const formatted = result.questions.map((q: any) => ({
            ...q,
            id: Math.random().toString(36).substr(2, 9)
          }));
          allQuestions = [...allQuestions, ...formatted];
          console.log(`Bloco ${i + 1} concluído. Total de questões extraídas até agora: ${allQuestions.length}`);
          // Show progress incrementally
          setQuestions([...allQuestions]);
        } else {
          console.warn(`Bloco ${i + 1} retornou 0 questões.`);
        }

        // Breve pausa para não sobrecarregar a cota da API (rate limit)
        if (i < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
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
    setSelectedOpt(idx);
    setUserAnswers(prev => ({ ...prev, [currentIdx]: idx }));
  };

  const handleDoubleClick = (idx: number) => {
    if (selectedOpt !== null) return;
    setCrossedOut(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
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

  const handleConfirmSave = (folderId: string, notebookName: string) => {
    onSaveToNotebook(folderId, notebookName, questions);
    setSaved(true);
    setShowSaveModal(false);
  };

  const currentQ = questions[currentIdx];

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0A0F1E] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-[50px] p-12 md:p-20 shadow-2xl flex flex-col items-center max-w-xl w-full">
          <LoadingFish 
            message={batchStatus ? `Bloco ${batchStatus.current} de ${batchStatus.total}` : "Arquitetando Simulado..."} 
            submessage={batchStatus 
              ? `Extraindo questões via IA de alta performance`
              : `IA preparando questões focadas em ${studyProfile === 'CONCURSO' ? 'Concursos de Elite' : 'ENEM/Vestibular'}`
            }
          />
          
          {batchStatus && (
            <div className="mt-8 w-full">
              <div className="flex justify-between mb-2">
                <span className="text-[#0A0F1E] font-black text-[10px] tracking-widest uppercase">Progresso da Extração</span>
                <span className="text-[#0A0F1E] font-black text-[10px]">{Math.round((batchStatus.current / batchStatus.total) * 100)}%</span>
              </div>
              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 transition-all duration-1000 ease-out" 
                  style={{ width: `${(batchStatus.current / batchStatus.total) * 100}%` }}
                ></div>
              </div>
              <p className="mt-4 text-center text-gray-400 font-bold text-[8px] uppercase tracking-widest leading-relaxed">
                Estamos processando em blocos de 10 para garantir o máximo de <br/>
                profundidade técnica e não perder nenhuma questão do texto colado.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#0A0F1E] text-white selection:bg-orange-500/30 overflow-y-auto font-sans">
      <div className="w-full max-w-5xl mx-auto px-6 py-12 animate-in fade-in slide-in-from-bottom-10 duration-700">
        {!questions.length ? (
          <div className="py-10">
            <button onClick={onBack} className="mb-12 text-gray-500 font-black uppercase text-[10px] tracking-[0.3em] flex items-center gap-2 hover:text-white transition-all group">
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              ABANDONAR SIMULADO
            </button>
            
            <div className="bg-white/5 backdrop-blur-2xl rounded-[50px] p-12 md:p-20 border border-white/10 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                 <FileText className="w-64 h-64" />
              </div>
              
              <div className="relative z-10 text-center max-w-2xl mx-auto">
                <div className="w-24 h-24 bg-orange-500/10 text-orange-500 border border-orange-500/30 rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-lg">
                  <Scissors className="w-10 h-10" />
                </div>
                <h1 className="text-6xl font-black mb-4 tracking-tighter leading-none italic uppercase">TDH<span className="text-orange-500">{strategicMode ? 'estratégico' : 'questões'}</span></h1>
                <p className="text-slate-400 text-lg mb-12 font-bold uppercase tracking-widest text-[10px] opacity-60">
                  {strategicMode ? 'Alinhamento Automático ao Edital' : `Simulados ${studyProfile === 'CONCURSO' ? 'Elite' : 'Vestibular'} • Gabarito Comentado`}
                </p>
                
                <div className="space-y-8">
                  {!strategicMode && (
                    <div className="flex bg-white/5 p-2 rounded-[30px] mx-auto max-w-md mb-8 relative z-20">
                      <button 
                        onClick={() => setInputMode('AUTO')}
                        className={`flex-1 py-3 px-6 rounded-[24px] font-black text-xs uppercase tracking-widest transition-all ${inputMode === 'AUTO' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                      >
                        Gerar com IA
                      </button>
                      <button 
                        onClick={() => setInputMode('PASTE')}
                        className={`flex-1 py-3 px-6 rounded-[24px] font-black text-xs uppercase tracking-widest transition-all gap-2 flex items-center justify-center ${inputMode === 'PASTE' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                      >
                        <Copy className="w-4 h-4" /> COLAR TEXTO
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
                      ) : (
                        <div className="space-y-3 text-left">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-6">O que vamos treinar hoje?</label>
                          <input 
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder={studyProfile === 'CONCURSO' ? "Ex: Atos Administrativos" : "Ex: Genética Mendeliana"}
                            className="w-full bg-white/5 border-2 border-white/10 rounded-[40px] px-10 py-8 text-2xl focus:outline-none focus:border-orange-500 transition-all font-black text-center text-white placeholder:text-white/10"
                            onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white/5 p-8 rounded-[35px] text-left border-2 border-white/5 focus-within:border-orange-500/50 transition-all">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-3">Banca Examinadora</label>
                          <input 
                            value={banca}
                            onChange={(e) => setBanca(e.target.value)}
                            placeholder="Ex: FCC, FGV, CESPE..."
                            className="w-full bg-transparent border-none text-xl focus:outline-none font-black text-white placeholder:text-white/10"
                          />
                        </div>
                        <div className="bg-white/5 p-8 rounded-[35px] text-left">
                          <div className="flex justify-between items-center mb-6">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Qtd. Questões</label>
                            <span className="text-orange-500 font-black text-2xl">{numQuestions}</span>
                          </div>
                          <input 
                            type="range" min="1" max="50" 
                            value={numQuestions}
                            onChange={(e) => setNumQuestions(Number(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-full accent-orange-500 cursor-pointer"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={() => handleGenerate()}
                        className="w-full bg-orange-500 text-white py-8 rounded-[40px] font-black text-2xl hover:bg-orange-400 transition-all shadow-2xl shadow-orange-900/40 flex items-center justify-center gap-4 active:scale-95 group mt-8 relative z-20"
                      >
                        CONFIGURAR SIMULADO
                        <ChevronRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
                      </button>
                    </>
                  ) : (
                    <div className="space-y-6 text-left relative z-20 animate-in fade-in slide-in-from-bottom-4">
                      <div className="bg-orange-500/10 p-6 rounded-3xl border border-orange-500/20 mb-6">
                        <p className="text-orange-500 text-sm font-bold flex items-center gap-2">
                          <Brain className="w-5 h-5" /> A IA vai ler as questões, identificar a resposta certa (se não tiver gabarito) e criar a explicação detalhada para você!
                        </p>
                      </div>
                      <div className="space-y-6">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-6">Cole as questões aqui</label>
                        <textarea
                          value={pastedText}
                          onChange={(e) => setPastedText(e.target.value)}
                          placeholder="Cole aqui o texto de uma prova, pdf ou site contendo as questões e alternativas..."
                          className="w-full bg-white/5 border-2 border-white/10 rounded-[30px] p-8 text-lg focus:outline-none focus:border-orange-500 transition-all font-medium text-white placeholder:text-white/20 min-h-[300px] resize-y"
                        />
                      </div>
                      
                      <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center justify-between px-6">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Gabarito das Questões (Opcional)</label>
                          <span className="text-[8px] font-black text-orange-500/50 uppercase tracking-widest">Aumenta a precisão da IA</span>
                        </div>
                        <textarea
                          value={pastedGabarito}
                          onChange={(e) => setPastedGabarito(e.target.value)}
                          placeholder="Ex: 1-A, 2-C, 3-E... ou cole o gabarito oficial completo aqui."
                          className="w-full bg-white/5 border-2 border-white/10 rounded-[30px] p-8 text-lg focus:outline-none focus:border-orange-500 transition-all font-medium text-white placeholder:text-white/20 min-h-[150px] resize-y"
                        />
                      </div>

                      <button 
                        onClick={() => handleParsePasted()}
                        disabled={!pastedText.trim()}
                        className="w-full bg-orange-500 text-white py-8 rounded-[40px] font-black text-2xl hover:bg-orange-400 transition-all shadow-2xl shadow-orange-900/40 flex items-center justify-center gap-4 active:scale-95 group mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        PROCESSAR QUESTÕES
                        <ChevronRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-10 pb-32">
            {/* Header Mini Imersivo */}
            <div className="flex justify-between items-center bg-black/40 backdrop-blur-2xl p-8 rounded-[40px] border border-white/5 shadow-2xl sticky top-0 z-30">
              <div className="flex items-center gap-6">
                <button onClick={() => { handleFinish(); setQuestions([]); }} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group active:scale-90">
                  <ChevronLeft className="w-6 h-6 text-white/50 group-hover:text-white" />
                </button>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                    <h4 className="font-black text-sm tracking-widest uppercase italic text-white/80">{topic}</h4>
                  </div>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Questão {currentIdx + 1} de {questions.length} • DESEMPENHO ATIVO</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => { handleSaveUserCommentary(); setShowSaveModal(true); }}
                  disabled={saved}
                  className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all active:scale-90 shadow-lg ${saved ? 'bg-green-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white hover:text-black border border-white/10'}`}
                >
                  {saved ? 'CONSOLIDADO!' : 'SALVAR CADERNO'}
                  {!saved && <Save className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-2xl rounded-[60px] p-12 md:p-16 border border-white/10 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-2 h-full bg-orange-500 opacity-50"></div>
              
              <div className="flex justify-between items-start mb-12">
                <h3 className="text-xl font-bold text-white leading-tight flex-1 italic tracking-tight">
                  {currentQ.question}
                </h3>
              </div>

              {selectedOpt === null ? (
                <div className="grid grid-cols-1 gap-5 mb-12">
                    {currentQ.options.map((opt, idx) => {
                      const isCorrect = idx === currentQ.correctAnswer;
                      const isSelected = selectedOpt === idx;
                      const isCrossedOut = crossedOut.includes(idx);
                      
                      let btnClass = "border border-white/10 bg-white/5 hover:bg-white/10 hover:border-orange-500/50 text-slate-300";
                      
                      if (isCrossedOut && selectedOpt === null) {
                        btnClass = "border border-white/5 text-white/10 bg-black/20 line-through grayscale";
                      }
  
                      if (selectedOpt !== null) {
                        if (isCorrect) btnClass = "border-green-500 bg-green-500/10 text-green-400 ring-1 ring-green-500/20";
                        else if (isSelected) btnClass = "border-red-500 bg-red-500/10 text-red-400 ring-1 ring-red-500/20";
                        else btnClass = "opacity-20 border-white/5 text-white/50";
                      }
  
                      return (
                        <div 
                          key={idx}
                          onClick={() => handleAnswerSelection(idx)}
                          onDoubleClick={() => handleDoubleClick(idx)}
                          className={`w-full text-left p-6 rounded-2xl font-medium text-sm transition-all flex items-center gap-4 select-none cursor-pointer group ${btnClass}`}
                          role="button"
                          aria-disabled={selectedOpt !== null}
                          tabIndex={0}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <span className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black flex-shrink-0 transition-colors ${selectedOpt !== null && isCorrect ? 'bg-green-500 border-green-500 text-white' : 'border-white/10 text-white/30 group-hover:border-orange-500/50 group-hover:text-orange-500'}`}>
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="leading-snug">{opt}</span>
                          </div>
  
                          {selectedOpt === null && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDoubleClick(idx);
                              }}
                              className={`p-2 rounded-lg transition-all active:scale-90 ${isCrossedOut ? 'bg-orange-600 text-white' : 'bg-white/5 text-white/20 hover:text-white hover:bg-white/10'}`}
                              title="Descartar alternativa"
                            >
                              <Scissors className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="animate-in fade-in zoom-in-95 duration-500 mb-12">
                  <div className={`p-8 rounded-[40px] mb-8 border backdrop-blur-xl ${selectedOpt === currentQ.correctAnswer ? 'bg-green-500/10 border-green-500/30 shadow-2xl shadow-green-900/20' : 'bg-red-500/10 border-red-500/30 shadow-2xl shadow-red-900/20'}`}>
                    <div className="flex items-center gap-3 mb-2">
                       {selectedOpt === currentQ.correctAnswer ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <RotateCcw className="w-6 h-6 text-red-500" />}
                       <p className={`text-xs font-black uppercase tracking-[0.3em] ${selectedOpt === currentQ.correctAnswer ? 'text-green-500' : 'text-red-500'}`}>
                        {selectedOpt === currentQ.correctAnswer ? 'ALVO ATINGIDO' : 'DESVIO DE ROTA'}
                      </p>
                    </div>
                    <p className="text-white text-xl font-black italic">
                      Gabarito: <span className="text-orange-500">{currentQ.options[currentQ.correctAnswer]}</span>
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-[50px] p-10 border border-white/10 leading-relaxed shadow-3xl">
                    <div className="flex items-center gap-3 mb-6 text-orange-500">
                      <HelpCircle className="w-6 h-6" />
                      <span className="font-black text-xs uppercase tracking-[0.3em]">Mapeamento de Resposta</span>
                    </div>
                    <div className="text-slate-300 text-xl font-medium space-y-6 mb-10 markdown-body prose prose-invert prose-xl max-w-none">
                      <ReactMarkdown>{currentQ.explanation}</ReactMarkdown>
                    </div>

                    <div className="bg-[#0A0F1E] border border-white/5 p-8 rounded-[40px] mt-10 relative">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3 text-xs font-black text-orange-500 uppercase tracking-[0.3em]">
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
                      
                      {userCommentaryInput ? (
                      <div className="text-slate-300 text-lg font-medium space-y-4 markdown-body prose prose-invert prose-orange max-w-none" dangerouslySetInnerHTML={{ __html: userCommentaryInput }} />
                    ) : (
                      <p className="text-white/30 font-bold text-sm italic">Nenhuma anotação adicionada ainda.</p>
                    )}
                    </div>

                    {isNoteExpanded && (
                      <div className="fixed inset-0 z-[1000] bg-[#0A0F1E]/95 backdrop-blur-2xl animate-in fade-in duration-300 p-6 md:p-12 flex flex-col">
                        <div className="flex items-center justify-between mb-8 max-w-6xl mx-auto w-full">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center text-orange-500">
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
                          <RichTextEditor
                            content={userCommentaryInput}
                            onChange={setUserCommentaryInput}
                          />
                        </div>

                        <div className="max-w-6xl mx-auto w-full mt-8 flex justify-between items-center">
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">TDAH ORA • MODO FOCO EDITOR</p>
                          <button 
                            onClick={() => { handleSaveUserCommentary(); setIsNoteExpanded(false); }}
                            className="px-12 py-6 bg-orange-500 text-black font-black uppercase tracking-[0.3em] text-xs rounded-full hover:scale-105 transition-all shadow-2xl shadow-orange-500/20 active:scale-95 cursor-pointer"
                          >
                            SALVAR E RECOLHER
                          </button>
                        </div>
                      </div>
                    )}

                    {currentQ.memoryHint && (
                      <div className="bg-orange-500/5 p-10 rounded-[40px] border-2 border-orange-500/20 shadow-2xl shadow-orange-900/10 animate-in slide-in-from-top-4">
                         <div className="flex items-center gap-3 mb-4">
                           <span className="text-2xl">🧠</span>
                           <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.4em]">MENTALIZAÇÃO ACELERADA</p>
                         </div>
                         <div className="text-xl font-bold text-white italic markdown-body prose prose-invert prose-orange prose-xl max-w-none">
                           <ReactMarkdown>{currentQ.memoryHint}</ReactMarkdown>
                         </div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setSelectedOpt(null)}
                    className="mt-8 text-white/30 hover:text-orange-500 font-black text-[10px] uppercase tracking-[0.4em] transition-all flex items-center gap-3 active:scale-95"
                  >
                    <ChevronLeft className="w-5 h-5" /> REANALISAR CAMINHOS
                  </button>
                </div>
              )}

              {selectedOpt !== null && (
                <div className="animate-in fade-in slide-in-from-top-6 duration-500 space-y-6">
                  <button 
                    onClick={() => setShowCommentary(!showCommentary)}
                    className="w-full bg-white/5 text-white/50 py-5 rounded-3xl font-black text-[10px] tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-white/10 hover:text-white transition-all active:scale-95 border border-white/5 uppercase"
                  >
                    <FileText className="w-5 h-5" />
                    {showCommentary ? 'FECHAR ANÁLISE PROFUNDA' : 'ABRIR ANÁLISE PROFUNDA'}
                  </button>

                  {showCommentary && (
                    <div className="bg-[#0A0F1E] border-2 border-orange-500/10 rounded-[50px] p-12 text-xl leading-relaxed text-slate-300 animate-in zoom-in-95 duration-500 markdown-body prose prose-invert prose-orange prose-xl max-w-none shadow-inner">
                      <div className="flex items-center gap-3 text-orange-500 font-black mb-8 uppercase tracking-[0.4em] text-[10px]">
                        <span className="w-6 h-6 bg-orange-500 rounded-lg flex items-center justify-center text-white text-[10px] tracking-tight">IA</span>
                        LÓGICA DO CONSTRUTOR
                      </div>
                      <ReactMarkdown>{currentQ.explanation}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center px-4">
              <button 
                onClick={handlePrev}
                disabled={currentIdx === 0}
                className="px-10 py-5 bg-white/5 border border-white/5 rounded-3xl font-black text-[10px] tracking-[0.3em] text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-5 transition-all flex items-center gap-3 uppercase cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" /> ANTERIOR
              </button>
              <button 
                onClick={handleNext}
                disabled={currentIdx === questions.length - 1}
                className="px-10 py-5 bg-white/5 border border-white/5 rounded-3xl font-black text-[10px] tracking-[0.3em] text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-5 transition-all flex items-center gap-3 uppercase cursor-pointer"
              >
                PRÓXIMA <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Progresso Inferior Estilo Guided Lesson */}
      {questions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-8 bg-black/60 backdrop-blur-2xl border-t border-white/5 z-[210]">
          <div className="max-w-3xl mx-auto space-y-4">
             <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
               <span>PROGRESSO DO SIMULADO</span>
               <span className="text-orange-500">{Math.round(((currentIdx + 1) / questions.length) * 100)}%</span>
             </div>
             <div className="h-2.5 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5 shadow-inner">
               <div 
                 className="h-full bg-gradient-to-r from-orange-600 to-red-600 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all duration-700"
                 style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
               />
             </div>
          </div>
        </div>
      )}

      {showSaveModal && (
        <SaveToFolderModal 
          folders={folders}
          suggestedName={topic}
          onConfirm={handleConfirmSave}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );

};

export default TDHQuestoes;
