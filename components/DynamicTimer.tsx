import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scissors } from './icons';
import { analyzeEvocation, generateQuestionsFromAnalysis } from '../services/geminiService';
import { StudyProfile, QuizQuestion, EditalConfig } from '../types';
import LoadingFish from './LoadingFish';

interface DynamicTimerProps {
  onBack: () => void;
  onComplete: (totalMinutes: number) => void;
  studyProfile: StudyProfile;
  strategicMode?: boolean;
  editalConfig?: EditalConfig;
}

type Phase = 'EVOCATION' | 'PRACTICE' | 'DETECTIVE';

interface ErrorAnalysis {
  id: string;
  field1: string; // O que eu achei que era?
  field2: string; // Por que eu errei?
  field3: string; // Como não errar de novo?
}

const DynamicTimer: React.FC<DynamicTimerProps> = ({ onBack, onComplete, studyProfile, strategicMode, editalConfig }) => {
  const [phase, setPhase] = useState<Phase>('EVOCATION');
  const [seconds, setSeconds] = useState(300); // 5 min
  const [isActive, setIsActive] = useState(false);
  const [errorsCount, setErrorsCount] = useState(0);
  const [analyses, setAnalyses] = useState<ErrorAnalysis[]>([]);
  const [evocationText, setEvocationText] = useState('');
  const [evocationAnalysis, setEvocationAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');

  // Practice Phase States
  const [practiceQuestions, setPracticeQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [crossedOut, setCrossedOut] = useState<number[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && seconds > 0) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev - 1);
      }, 1000);
    } else if (seconds === 0) {
      handlePhaseTransition();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, seconds]);

  // Generates the PRACTICE-phase questions from the evocation analysis.
  // Used both by the normal auto-transition after EVOCATION and by the
  // manual retry button shown when generation fails.
  const generatePracticeQuestions = async () => {
    setIsGeneratingQuestions(true);
    setQuestionsError(null);

    try {
      let analysisForQuestions = evocationAnalysis;
      if (!analysisForQuestions) {
        // Auto-timeout path: the user never clicked "Finalizar e Analisar",
        // so analyzeEvocation was never run and evocationAnalysis is still
        // null. Run the same analysis flow used by the manual finish button
        // before generating questions from it.
        analysisForQuestions = await analyzeEvocation(evocationText, studyProfile);
        setEvocationAnalysis(analysisForQuestions);
      }
      const questions = await generateQuestionsFromAnalysis(analysisForQuestions, studyProfile);
      setPracticeQuestions(questions);
    } catch (error: any) {
      console.error('Erro ao gerar questões:', error);
      setQuestionsError(error?.message || 'Erro ao gerar as questões de prática. Tente novamente.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handlePhaseTransition = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (phase === 'EVOCATION') {
      setPhase('PRACTICE');
      setSeconds(1200); // 20 min
      setIsActive(true);
      await generatePracticeQuestions();
    } else if (phase === 'PRACTICE') {
      setPhase('DETECTIVE');
      setSeconds(900); // 15 min
      setIsActive(true);
      // Initialize analyses based on errorsCount
      const initialAnalyses = Array.from({ length: errorsCount }, () => ({
        id: Math.random().toString(36).substr(2, 9),
        field1: '',
        field2: '',
        field3: '',
      }));
      setAnalyses(initialAnalyses);
    } else if (phase === 'DETECTIVE') {
      setIsActive(false);
    }
  };

  const startSession = () => {
    setIsActive(true);
  };

  const handleEvocationSubmit = async () => {
    if (!evocationText.trim()) {
      handlePhaseTransition();
      return;
    }

    setIsAnalyzing(true);
    setIsActive(false);
    try {
      const result = await analyzeEvocation(evocationText, studyProfile);
      setEvocationAnalysis(result);
    } catch (error) {
      console.error(error);
      handlePhaseTransition();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  const handleAnalysisChange = (id: string, field: keyof ErrorAnalysis, value: string) => {
    setAnalyses((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const isDetectiveWorkDone = analyses.every((a) => a.field1.trim() && a.field2.trim() && a.field3.trim());

  const finishSession = () => {
    onComplete(40); // 5 + 20 + 15
    setSessionCompleted(true);
  };

  const getPhaseStyles = () => {
    switch (phase) {
      case 'EVOCATION':
        return {
          bg: 'bg-[#fdad74]',
          text: 'text-[#fdad74]',
          light: 'bg-[#fff1e8]',
          label: 'FASE 1: EVOCAÇÃO',
        };
      case 'PRACTICE':
        return {
          bg: 'bg-[#fec868]',
          text: 'text-[#fec868]',
          light: 'bg-[#fff6e8]',
          label: 'FASE 2: PRÁTICA',
        };
      case 'DETECTIVE':
        return {
          bg: 'bg-[#abc270]',
          text: 'text-[#abc270]',
          light: 'bg-[#f4f7ec]',
          label: 'FASE 3: DETETIVE',
        };
    }
  };

  const styles = getPhaseStyles();

  if (sessionCompleted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-[#e9efda] text-[#abc270] rounded-[40px] flex items-center justify-center shadow-xl">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-4xl font-black uppercase tracking-tighter">
          Bloco Imutável <span className="text-[#abc270]">Concluído!</span>
        </h2>
        <p className="text-gray-400 font-bold max-w-sm">Você concluiu o bloco, respondeu às questões e revisou os erros.</p>
        <button onClick={onBack} className="min-h-[44px] bg-[#473c33] text-white px-10 py-5 rounded-[25px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
          Voltar ao Hub
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:px-6 md:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-[#e9e0d4] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(71,60,51,0.06)]">
        <button onClick={onBack} className="min-h-[44px] inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#8f8375] transition-colors hover:bg-[#f7f3ed] hover:text-[#473c33]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
          Sair do Bloco
        </button>
        <div className="text-center sm:text-right">
          <h1 className="text-xl font-black uppercase tracking-tight text-[#473c33] md:text-2xl">
            Timer <span className="text-[#e5a83e]">Dinâmico</span>
          </h1>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a79c8e]">Blocos imutáveis</span>
        </div>
      </header>

      <section className={`relative min-h-[560px] overflow-hidden rounded-[32px] p-5 shadow-[0_18px_42px_rgba(71,60,51,0.1)] transition-colors duration-1000 md:p-8 ${styles.light}`}>
        {/* Phase Indicator */}
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <span className={`rounded-full px-4 py-2 font-black text-[10px] tracking-widest text-white shadow-sm ${styles.bg}`}>{styles.label}</span>
          <span className="rounded-full border border-black/5 bg-white/55 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#8f8375]">{isActive ? 'Em andamento' : 'Pronto para iniciar'}</span>
        </div>

        <AnimatePresence mode="wait">
          {isAnalyzing ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingFish message="Analisando suas respostas..." submessage="Separando o que você já lembra do que precisa revisar." />
            </motion.div>
          ) : phase === 'EVOCATION' && evocationAnalysis ? (
            <motion.div key="evocation-result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl space-y-6">
              <div className="bg-white/80 backdrop-blur-md rounded-[40px] p-10 border border-[#fed6ba] shadow-xl space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#fee6d5] text-[#fda769] rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">
                    Feedback da <span className="text-[#fdad74]">Evocação</span>
                  </h3>
                </div>

                <div className="space-y-4 text-left">
                  <div className="bg-[#f4f7ec]/50 p-4 rounded-2xl border border-[#e9efda]">
                    <p className="text-[10px] font-black text-[#abc270] uppercase tracking-widest mb-2">Pontos Identificados</p>
                    <ul className="list-disc list-inside text-sm font-bold text-[#799339] space-y-1">
                      {evocationAnalysis.pointsIdentified.map((p: string, i: number) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  {evocationAnalysis.errorsFound.length > 0 && (
                    <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100">
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2">Possíveis Erros/Confusões</p>
                      <ul className="list-disc list-inside text-sm font-bold text-red-800 space-y-1">
                        {evocationAnalysis.errorsFound.map((p: string, i: number) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-[#fff6e8]/50 p-4 rounded-2xl border border-[#fff0d5]">
                    <p className="text-[10px] font-black text-[#fec868] uppercase tracking-widest mb-2">Ficou de fora</p>
                    <ul className="list-disc list-inside text-sm font-bold text-[#ec9700] space-y-1">
                      {evocationAnalysis.missedPoints.map((p: string, i: number) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <p className="text-gray-600 font-bold text-sm text-left border-l-4 border-[#fdb887] pl-4 py-2 bg-[#fff1e8]/30 rounded-r-xl">{evocationAnalysis.feedback}</p>

                <button
                  onClick={() => {
                    setEvocationAnalysis(null);
                    handlePhaseTransition();
                  }}
                  className="w-full bg-[#fdad74] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-[#fed6ba]/60 hover:scale-105 transition-all"
                >
                  Continuar para Prática
                </button>
              </div>
            </motion.div>
          ) : phase === 'EVOCATION' ? (
            <motion.div key="evocation" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mx-auto w-full max-w-4xl text-center">
              <div className="mb-7">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8f8375]">Fase de evocação</p>
                <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black uppercase leading-[1.05] tracking-tight text-[#473c33] md:text-5xl">Feche tudo. O que você lembra do estudo de {strategicMode && selectedTopic ? <span className="mt-2 block text-[#b0632a] underline decoration-2 underline-offset-4">{selectedTopic}?</span> : <span className={`${styles.text} block`}>ontem?</span>}</h2>
              </div>

              {strategicMode && editalConfig && !isActive && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto w-full mb-6">
                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-3">{studyProfile === 'FACULDADE' ? 'Disciplina da Grade' : 'Matéria do Edital'}</label>
                    <select
                      value={selectedSubject}
                      onChange={(e) => {
                        setSelectedSubject(e.target.value);
                        setSelectedTopic('');
                      }}
                      className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-[#fdad74] font-bold appearance-none cursor-pointer"
                    >
                      <option value="">Escolher Matéria...</option>
                      {editalConfig.subjects.map((s, i) => (
                        <option key={i} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-3">Assunto Específico</label>
                    <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} disabled={!selectedSubject} className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-[#fdad74] font-bold appearance-none cursor-pointer disabled:opacity-30">
                      <option value="">Escolher Assunto...</option>
                      {editalConfig.subjects
                        .find((s) => s.name === selectedSubject)
                        ?.topics.map((t, i) => (
                          <option key={i} value={t}>
                            {t}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid items-end gap-5 lg:grid-cols-[1fr_220px]">
                <label className="block text-left">
                  <span className="mb-2 ml-2 block text-[10px] font-black uppercase tracking-widest text-[#8f8375]">Escreva o que já sabe</span>
                  <textarea value={evocationText} onChange={(e) => setEvocationText(e.target.value)} placeholder="Escreva livremente aqui tudo o que você lembra... Não consulte nada!" className="min-h-[148px] w-full rounded-[24px] border-2 border-[#fed6ba] bg-white/65 p-5 font-semibold text-[#ac4800] placeholder:text-[#e8bda1] backdrop-blur-sm transition-all focus:border-[#fdad74] focus:outline-none focus:ring-4 focus:ring-[#fdad74]/15" />
                </label>

                <div className="rounded-[24px] border border-black/5 bg-white/55 p-5 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#8f8375]">Tempo restante</p>
                  <div className="mt-2 text-5xl font-black tabular-nums tracking-tighter text-[#473c33]">{formatTime(seconds)}</div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
                    <div className={`h-full rounded-full transition-all ${styles.bg}`} style={{ width: `${Math.max(0, Math.min(100, (seconds / 300) * 100))}%` }} />
                  </div>
                </div>
              </div>

              {isActive && (
                <div className="mt-6 flex justify-center">
                  <button onClick={handleEvocationSubmit} className="rounded-2xl bg-[#fda769] px-10 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all hover:scale-[1.02]">
                    Finalizar e Analisar
                  </button>
                </div>
              )}

              {!isActive && (
                <button onClick={startSession} className={`mt-6 ${styles.bg} text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:scale-[1.02] transition-all`}>
                  Iniciar evocação
                </button>
              )}
            </motion.div>
          ) : isGeneratingQuestions ? (
            <motion.div key="gen-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingFish message="Preparando questões para praticar..." submessage="Vamos reforçar os pontos que você esqueceu ou errou." />
            </motion.div>
          ) : phase === 'PRACTICE' ? (
            <motion.div key="practice" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl space-y-8">
              <div className="flex justify-between items-center bg-white/50 p-6 rounded-[30px] border border-[#fff0d5]">
                <div className="text-left">
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-[#fec868]">FASE DE PRÁTICA</h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mt-1">Questões baseadas na sua evocação</p>
                </div>
                <div className="text-5xl font-black tabular-nums tracking-tighter text-[#fec868]">{formatTime(seconds)}</div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  {practiceQuestions.length > 0 && currentQuestionIndex < practiceQuestions.length ? (
                    <div className="bg-white rounded-[40px] p-10 shadow-xl border border-[#fff6e8] relative overflow-hidden text-left">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
                        <div
                          className="h-full bg-[#fecc73] transition-all duration-500"
                          style={{
                            width: `${((currentQuestionIndex + 1) / practiceQuestions.length) * 100}%`,
                          }}
                        />
                      </div>

                      <div className="mb-8 flex justify-between items-center">
                        <span className="bg-[#fff6e8] text-[#fec868] px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">
                          Questão {currentQuestionIndex + 1} de {practiceQuestions.length}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-gray-800 leading-relaxed mb-10">{practiceQuestions[currentQuestionIndex].question}</h3>

                      {!isAnswerRevealed ? (
                        <div className="space-y-3">
                          {practiceQuestions[currentQuestionIndex].options.map((option, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                if (!isAnswerRevealed) {
                                  setSelectedOption(idx);
                                }
                              }}
                              onDoubleClick={() => {
                                if (!isAnswerRevealed) {
                                  setCrossedOut((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
                                }
                              }}
                              className={`w-full text-left p-5 rounded-2xl font-bold transition-all border-2 flex items-center gap-4 select-none cursor-pointer ${selectedOption === idx ? 'border-[#fecc73] bg-[#fff6e8] text-[#ffb22a]' : crossedOut.includes(idx) && !isAnswerRevealed ? 'border-gray-100 bg-gray-50/20 text-gray-300 line-through opacity-50' : 'border-gray-50 bg-gray-50/50 hover:border-[#ffe6b9]'} ${isAnswerRevealed && idx === practiceQuestions[currentQuestionIndex].correctAnswer ? 'border-[#b1c77b] bg-[#f4f7ec] text-[#98b847]' : ''} ${isAnswerRevealed && selectedOption === idx && idx !== practiceQuestions[currentQuestionIndex].correctAnswer ? 'border-red-500 bg-red-50 text-red-700' : ''}`}
                              role="button"
                              tabIndex={0}
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${selectedOption === idx ? 'bg-[#fecc73] text-white' : 'bg-white text-gray-400'}`}>{String.fromCharCode(65 + idx)}</span>
                                {option}
                              </div>

                              {selectedOption === null && !isAnswerRevealed && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const idxNum = idx;
                                    setCrossedOut((prev) => (prev.includes(idxNum) ? prev.filter((i) => i !== idxNum) : [...prev, idxNum]));
                                  }}
                                  className={`p-2 rounded-full transition-colors ${crossedOut.includes(idx) ? 'bg-[#fff0d5] text-[#fec868]' : 'hover:bg-gray-200 text-gray-400'}`}
                                  title="Recortar alternativa"
                                >
                                  <Scissors className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="animate-in fade-in slide-in-from-right-10 duration-500">
                          <div className={`p-5 rounded-2xl mb-6 flex items-center gap-4 ${selectedOption === practiceQuestions[currentQuestionIndex].correctAnswer ? 'bg-[#f4f7ec] border border-[#dae4bf] text-[#98b847]' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black ${selectedOption === practiceQuestions[currentQuestionIndex].correctAnswer ? 'bg-[#b1c77b]' : 'bg-red-500'}`}>{selectedOption === practiceQuestions[currentQuestionIndex].correctAnswer ? '✓' : '✗'}</div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{selectedOption === practiceQuestions[currentQuestionIndex].correctAnswer ? 'Correto' : 'Incorreto'}</p>
                              <p className="text-sm font-bold">Gabarito: {practiceQuestions[currentQuestionIndex].options[practiceQuestions[currentQuestionIndex].correctAnswer]}</p>
                            </div>
                          </div>

                          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm leading-relaxed text-left">
                            <p className="text-[10px] font-black text-[#fecc73] uppercase tracking-widest mb-4">Por que essa é a resposta?</p>
                            <p className="text-sm font-medium text-gray-600 mb-6">{practiceQuestions[currentQuestionIndex].explanation}</p>

                            {practiceQuestions[currentQuestionIndex].memoryHint && (
                              <div className="bg-[#fff6e8] p-4 rounded-2xl border border-[#fff0d5] mt-4">
                                <p className="text-[10px] font-black text-[#fec868] uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <span className="text-sm">🧠</span> DICA DE MEMORIZAÇÃO
                                </p>
                                <p className="text-sm font-bold text-[#ec9700] ">{practiceQuestions[currentQuestionIndex].memoryHint}</p>
                              </div>
                            )}
                          </div>

                          <button onClick={() => setIsAnswerRevealed(false)} className="mt-6 text-gray-400 hover:text-[#fecc73] font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 mx-auto">
                            ← VER ALTERNATIVAS
                          </button>
                        </div>
                      )}

                      <div className="mt-10 flex justify-end">
                        {!isAnswerRevealed ? (
                          <button
                            disabled={selectedOption === null}
                            onClick={() => {
                              setIsAnswerRevealed(true);
                              if (selectedOption !== practiceQuestions[currentQuestionIndex].correctAnswer) {
                                setErrorsCount((prev) => prev + 1);
                              }
                            }}
                            className={`px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${selectedOption !== null ? 'bg-[#fec868] text-white shadow-lg' : 'bg-gray-100 text-gray-300'}`}
                          >
                            Responder
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (currentQuestionIndex < practiceQuestions.length - 1) {
                                setCurrentQuestionIndex((prev) => prev + 1);
                                setSelectedOption(null);
                                setIsAnswerRevealed(false);
                                setCrossedOut([]);
                              } else {
                                setCurrentQuestionIndex(practiceQuestions.length);
                              }
                            }}
                            className="bg-[#473c33] text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all"
                          >
                            {currentQuestionIndex < practiceQuestions.length - 1 ? 'Próxima Questão' : 'Concluir Prática'}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/50 backdrop-blur-sm p-12 rounded-[40px] border border-dashed border-[#ffe6b9] text-center space-y-4">
                      {questionsError ? (
                        <>
                          <p className="text-red-500 font-bold ">{questionsError}</p>
                          <button onClick={generatePracticeQuestions} className="bg-[#fec868] text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all">
                            Tentar Novamente
                          </button>
                        </>
                      ) : (
                        <p className="text-gray-400 font-bold ">{currentQuestionIndex >= practiceQuestions.length && practiceQuestions.length > 0 ? 'Questões da IA concluídas! Continue praticando por conta própria ou encerre a fase.' : 'Buscando questões no oceano de dados...'}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-[40px] p-10 border border-red-50 shadow-xl space-y-6 text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h3 className="font-black uppercase tracking-tighter leading-none">
                        CONTADOR DE <br />
                        <span className="text-red-500">ERROS</span>
                      </h3>
                    </div>

                    <div className="flex items-center justify-between bg-red-50/50 p-6 rounded-3xl border border-red-100">
                      <span className="text-5xl font-black text-red-600 tabular-nums">{errorsCount}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setErrorsCount(Math.max(0, errorsCount - 1))} className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-600 transition-all font-bold group shadow-sm">
                          -
                        </button>
                        <button onClick={() => setErrorsCount(errorsCount + 1)} className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white transition-all font-bold group shadow-sm">
                          +
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 leading-tight uppercase tracking-widest">Cada erro marcado agora exigirá uma análise no modo detetive.</p>
                  </div>

                  <div className="bg-[#fec868] rounded-[40px] p-8 text-white space-y-4 shadow-xl text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Dica Progressiva</p>
                    <p className="font-bold leading-relaxed text-sm ">"Não tenha medo do erro. O erro marcado aqui é a vacina para o erro na prova."</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : phase === 'DETECTIVE' ? (
            <motion.div key="detective" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-3xl space-y-10">
              <div className="flex justify-between items-end text-left">
                <div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter leading-none text-[#abc270]">MODO DETETIVE</h2>
                  <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-2">Analise cada um dos {errorsCount} erros</p>
                </div>
                <div className="text-4xl font-black tabular-nums tracking-tighter opacity-30">{formatTime(seconds)}</div>
              </div>

              {errorsCount === 0 ? (
                <div className="bg-white/80 p-12 rounded-[40px] text-center space-y-4">
                  <div className="text-5xl">🏆</div>
                  <h3 className="text-2xl font-black uppercase ">Nenhum erro?!</h3>
                  <p className="text-gray-400 font-bold">Você foi impecável hoje. Pode encerrar o bloco quando quiser.</p>
                </div>
              ) : (
                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                  {analyses.map((analysis, index) => (
                    <div key={analysis.id} className="bg-white/80 backdrop-blur-sm p-8 rounded-[35px] border border-[#e9efda] shadow-sm space-y-6 text-left">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-[#abc270] text-white rounded-lg flex items-center justify-center font-black text-sm"># {index + 1}</span>
                        <h4 className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Análise de Erro</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-2 mb-1 block">O que eu achei que era?</label>
                          <input value={analysis.field1} onChange={(e) => handleAnalysisChange(analysis.id, 'field1', e.target.value)} className="w-full bg-gray-50/50 border-2 border-transparent rounded-2xl px-5 py-3 focus:outline-none focus:border-[#ccdaa8] font-bold" placeholder="Anote seu raciocínio errado..." />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-2 mb-1 block">Por que eu errei?</label>
                          <input value={analysis.field2} onChange={(e) => handleAnalysisChange(analysis.id, 'field2', e.target.value)} className="w-full bg-gray-50/50 border-2 border-transparent rounded-2xl px-5 py-3 focus:outline-none focus:border-[#ccdaa8] font-bold" placeholder="Identifique a falha..." />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-2 mb-1 block">Como não errar de novo?</label>
                          <input value={analysis.field3} onChange={(e) => handleAnalysisChange(analysis.id, 'field3', e.target.value)} className="w-full bg-gray-50/50 border-2 border-transparent rounded-2xl px-5 py-3 focus:outline-none focus:border-[#ccdaa8] font-bold" placeholder="Defina a estratégia de prevenção..." />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-center pt-8">
                <button disabled={!isDetectiveWorkDone && errorsCount > 0} onClick={finishSession} className={`px-16 py-6 rounded-[30px] font-black uppercase tracking-widest shadow-2xl transition-all ${isDetectiveWorkDone || errorsCount === 0 ? 'bg-[#abc270] text-white hover:scale-105 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                  {isDetectiveWorkDone || errorsCount === 0 ? 'Encerrar Bloco Imutável' : 'Complete as Análises First'}
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            icon: '🧠',
            label: 'Efeito Testagem',
            desc: 'Evocação ativa fortalece sinapses.',
          },
          {
            icon: '📊',
            label: 'Métrica Real',
            desc: 'Contar erros traz consciência.',
          },
          {
            icon: '🕵️',
            label: 'Metacognição',
            desc: 'Analisar o erro impede a repetição.',
          },
        ].map((item, idx) => (
          <div key={idx} className="rounded-[24px] border border-[#e9e0d4] bg-white p-5 text-center shadow-[0_8px_22px_rgba(71,60,51,0.05)]">
            <span className="text-3xl block mb-2">{item.icon}</span>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#e5a83e]">{item.label}</p>
            <p className="text-[10px] font-medium leading-tight text-[#8f8375]">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DynamicTimer;
