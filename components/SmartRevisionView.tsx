import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import MarkdownContent from './MarkdownContent';
import { SmartRevisionItem, ErrorVaultItem, StudyProfile, StudyPlan, ExplanationStyle } from '../types';
import { generateMicroThemeValidation, explainStuckTopic, identifyAndProgramRecovery } from '../services/geminiService';
import LoadingFish from './LoadingFish';
import CharacterTip from './CharacterTip';
import ForgettingCurve from './ForgettingCurve';
import { toLocalDateKey } from '../utils/localDate';
import { CalendarCheck, ChevronLeft, ArrowRight, AlertTriangle, Zap } from './icons';

interface SmartRevisionViewProps {
  items: SmartRevisionItem[];
  vault: ErrorVaultItem[];
  profile: StudyProfile;
  plan: StudyPlan;
  explanationStyle?: ExplanationStyle;
  onComplete: (itemId: string, success: boolean) => void;
  onResolveVault: (vaultId: string, recoveryFlashcards?: any[]) => void;
  onBack: () => void;
}

const SmartRevisionView: React.FC<SmartRevisionViewProps> = ({ items, vault, profile, plan, explanationStyle = 'TECNICA', onComplete, onResolveVault, onBack }) => {
  const [activeItem, setActiveItem] = useState<SmartRevisionItem | null>(null);
  const [activeVault, setActiveVault] = useState<ErrorVaultItem | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [explanation, setExplanation] = useState<any>(null);
  const [recoveryPlan, setRecoveryPlan] = useState<any>(null);
  const [currentRecoveryFlashcards, setCurrentRecoveryFlashcards] = useState<any[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'LIST' | 'CALENDAR' | 'STRATEGY'>('LIST');
  const [viewDate, setViewDate] = useState(new Date());

  // Interactive Question State
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);

  const startValidation = async (item: SmartRevisionItem) => {
    setLoading(true);
    setActiveItem(item);
    setSelectedAnswer(null);
    setIsAnswerCorrect(null);
    try {
      const data = await generateMicroThemeValidation(item.topic, profile, explanationStyle);
      setQuestions(data.questions);
      setCurrentQIdx(0);
      setScore(0);
      setShowResult(false);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao carregar validação.');
      // Reset back to the non-active render instead of leaving activeItem set
      // with no questions/explanation/recoveryPlan populated, which would
      // crash the render below on `questions[currentQIdx]`.
      setActiveItem(null);
    } finally {
      setLoading(false);
    }
  };

  const startVaultResolution = async (vItem: ErrorVaultItem) => {
    setLoading(true);
    setActiveVault(vItem);
    setSelectedAnswer(null);
    setIsAnswerCorrect(null);
    try {
      if (vItem.isStuck || (vItem.missedQuestions && vItem.missedQuestions.length > 0)) {
        if (vItem.missedQuestions && vItem.missedQuestions.length > 0) {
          const data = await identifyAndProgramRecovery(vItem.topic, vItem.missedQuestions, profile, explanationStyle);
          setRecoveryPlan(data);
        } else {
          const data = await explainStuckTopic(vItem.topic, profile);
          setExplanation(data);
        }
      } else {
        const data = await generateMicroThemeValidation(vItem.topic, profile, explanationStyle);
        setQuestions(data.questions);
        setCurrentQIdx(0);
        setScore(0);
        setShowResult(false);
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao analisar ou resolver cofre de erros.');
      // Same reasoning as startValidation: don't leave activeVault set with
      // no questions/explanation/recoveryPlan populated, or the render below
      // crashes on `questions[currentQIdx]`.
      setActiveVault(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (index: number) => {
    if (selectedAnswer !== null) return;
    const currentQ = questions[currentQIdx];
    const correct = index === currentQ.correctAnswer;
    setSelectedAnswer(index);
    setIsAnswerCorrect(correct);
    if (correct) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setIsAnswerCorrect(null);
    if (currentQIdx < questions.length - 1) {
      setCurrentQIdx((prev) => prev + 1);
    } else {
      setShowResult(true);
    }
  };

  const finishValidation = () => {
    if (activeItem) {
      const success = score === questions.length;
      onComplete(activeItem.id, success);
    }
    setActiveItem(null);
    setQuestions([]);
    setShowResult(false);
    setSelectedAnswer(null);
    setIsAnswerCorrect(null);
  };

  const finishVault = () => {
    if (activeVault) {
      const success = score === questions.length;
      if (success) {
        onResolveVault(activeVault.id, currentRecoveryFlashcards);
      }
    }
    setActiveVault(null);
    setQuestions([]);
    setShowResult(false);
    setExplanation(null);
    setRecoveryPlan(null);
    setCurrentRecoveryFlashcards([]);
    setSelectedAnswer(null);
    setIsAnswerCorrect(null);
  };

  // Calendar Helpers
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const generateCalendarDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(month, year);
    const firstDay = getFirstDayOfMonth(month, year);
    const days = [];

    // Pads
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayItems = items.filter((item) => item.scheduledDate === dateStr);
      const plannedSessions = plan.schedule?.find((s) => s.date === dateStr)?.sessions || [];
      days.push({ day: i, dateStr, items: dayItems, plannedSessions });
    }
    return days;
  };

  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));

  if (loading) return <LoadingFish message="Preparando sua revisão..." />;

  if (activeItem || activeVault) {
    if (recoveryPlan) {
      return (
        <div className="max-w-4xl mx-auto py-10 px-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#473c33] rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <svg className="w-32 h-32 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <div className="relative z-10">
              <span className="bg-red-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest mb-6 inline-block ">Dificuldade Identificada pela IA</span>
              <h1 className="font-logo text-4xl mb-2 uppercase leading-none">{activeVault?.topic}</h1>
              <p className="text-gray-400 text-lg mb-10 font-medium tracking-tight">O sistema analisou seus erros e detectou um padrão.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-white/5 border border-white/10 p-8 rounded-[35px]">
                    <h3 className="text-red-400 font-bold uppercase text-[10px] tracking-widest mb-4">Diagnóstico de Falha</h3>
                    <p className="text-xl font-medium leading-relaxed ">"{recoveryPlan.diagnosis}"</p>
                  </div>

                  <div className="bg-[#fecc73]/10 border border-[#fecc73]/20 p-8 rounded-[35px]">
                    <h3 className="text-[#fed386] font-bold uppercase text-[10px] tracking-widest mb-4">Plano de Recuperação</h3>
                    <ul className="space-y-3">
                      {recoveryPlan.recoverySteps.map((step: string, i: number) => (
                        <li key={i} className="flex gap-3 text-sm font-medium text-[#fff0d5]">
                          <span className="text-[#fecc73] font-black">{i + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-[#1E293B] p-8 rounded-[35px] border border-white/5">
                    <h3 className="text-[#fed386] font-bold uppercase text-[10px] tracking-widest mb-6">Programação de Contragolpe</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-white/5 rounded-2xl flex items-center justify-between">
                        <span className="text-xs font-bold">Questões de Recuperação</span>
                        <span className="bg-[#fed386] text-[#473c33] text-[10px] font-black px-2 py-1 rounded-md">{recoveryPlan.recoveryQuestions.length}</span>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl flex items-center justify-between">
                        <span className="text-xs font-bold">Flashcards de Resgate</span>
                        <span className="bg-[#fed386] text-white text-[10px] font-black px-2 py-1 rounded-md">{recoveryPlan.recoveryFlashcards.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => {
                        setQuestions(recoveryPlan.recoveryQuestions);
                        setCurrentRecoveryFlashcards(recoveryPlan.recoveryFlashcards);
                        setCurrentQIdx(0);
                        setScore(0);
                        setShowResult(false);
                        setRecoveryPlan(null);
                      }}
                      className="w-full bg-red-500 text-white py-6 rounded-2xl font-black hover:bg-red-600 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-red-500/20"
                    >
                      INICIAR SESSÃO DE RESGATE
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setRecoveryPlan(null);
                        setActiveVault(null);
                      }}
                      className="w-full bg-white/5 text-gray-400 py-4 rounded-2xl font-bold text-xs hover:bg-white/10 transition-colors"
                    >
                      REVISAR DEPOIS
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      );
    }

    if (explanation) {
      return (
        <div className="max-w-4xl mx-auto py-10 px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#473c33] rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>

            <h2 className="text-[#fed386] font-black uppercase text-xs tracking-[0.3em] mb-4 ">ASSUNTO TRAVADO - NOVA ABORDAGEM</h2>
            <h1 className="font-logo text-4xl mb-8 leading-none uppercase">{activeVault?.topic}</h1>

            <div className="space-y-8 relative z-10">
              <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
                <h3 className="text-[#fed386] font-bold uppercase text-[10px] tracking-widest mb-4">A Analogia Definitiva</h3>
                <p className="text-xl font-medium leading-relaxed ">"{explanation.analogy}"</p>
              </div>

              <div className="max-w-none">
                <h3 className="text-purple-400 font-bold uppercase text-[10px] tracking-widest mb-6 border-b border-white/10 pb-2">Explicação de Impacto</h3>
                <MarkdownContent content={explanation.newExplanation} isDark />
              </div>

              <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl flex gap-4">
                <div className="text-red-500 text-2xl">⚠️</div>
                <div>
                  <h3 className="text-red-400 font-bold uppercase text-[10px] tracking-widest mb-1">O Ponto de Confusão</h3>
                  <p className="text-red-100 font-medium">{explanation.commonMistake}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setExplanation(null);
                startVaultResolution(activeVault!);
              }}
              className="w-full bg-white text-[#473c33] py-6 rounded-2xl font-black mt-12 hover:bg-[#fed386] transition-all active:scale-95 shadow-xl shadow-[#fed386]/5 dark:shadow-black/30"
            >
              ENTENDI! AGORA QUERO TESTAR
            </button>
          </motion.div>
        </div>
      );
    }

    if (showResult) {
      const isSuccess = score === questions.length;
      return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`w-32 h-32 rounded-full flex items-center justify-center text-5xl mb-8 ${isSuccess ? 'bg-[#e9efda] text-[#abc270]' : 'bg-red-100 text-red-600'}`}>
            {isSuccess ? '🔥' : '❄️'}
          </motion.div>

          <h2 className="text-4xl font-black mb-4 tracking-tighter">{isSuccess ? 'REVISÃO CONCLUÍDA!' : 'QUASE LÁ! TENTE DE NOVO'}</h2>

          <p className="text-gray-500 text-lg max-w-md mb-12 font-medium">{isSuccess ? 'Você acertou todas as questões desta revisão.' : 'Você precisa acertar todas as questões para concluir esta revisão. O assunto voltará ao início do ciclo.'}</p>

          <button onClick={activeItem ? finishValidation : finishVault} className={`px-12 py-6 rounded-3xl font-black text-xl transition-all active:scale-95 shadow-2xl ${isSuccess ? 'bg-[#473c33] text-white hover:bg-[#473c33]' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}>
            {isSuccess ? 'CONTINUAR' : 'TENTAR NOVAMENTE'}
          </button>
        </div>
      );
    }

    const currentQ = questions[currentQIdx];
    const hasAnswered = selectedAnswer !== null;

    if (!currentQ) {
      // Defensive guard: questions can be empty/out-of-range here if the AI
      // response was malformed or partially failed. Render a safe fallback
      // instead of throwing on `currentQ.question` / `currentQ.options` below.
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center space-y-6">
          <p className="text-gray-400 font-bold">Não foi possível carregar esta questão.</p>
          <button
            onClick={() => {
              setActiveItem(null);
              setActiveVault(null);
              setQuestions([]);
            }}
            className="px-8 py-4 bg-[#473c33] text-white rounded-2xl font-black uppercase text-xs tracking-widest"
          >
            Voltar
          </button>
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto py-12 px-6">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <span className="bg-[#fec868] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase ">Método: Revisão por Questões</span>
            <h4 className="font-black text-gray-400 uppercase text-xs tracking-widest">{activeItem?.topic || activeVault?.topic}</h4>
          </div>
          <div className="text-gray-300 font-black ">
            {currentQIdx + 1}/{questions.length}
          </div>
        </div>

        <motion.div key={currentQIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white rounded-[40px] p-10 md:p-14 shadow-2xl border border-gray-50 space-y-8">
          <h2 className="text-2xl font-black text-[#473c33] leading-tight">{currentQ.question}</h2>

          <div className="grid grid-cols-1 gap-4">
            {currentQ.options.map((opt: string, idx: number) => {
              const isCorrect = idx === currentQ.correctAnswer;
              const isSelected = idx === selectedAnswer;

              let btnClass = 'w-full text-left p-6 rounded-[25px] border-2 border-gray-50 bg-gray-50/30 font-bold text-lg transition-all text-gray-700 hover:bg-white hover:border-[#fecc73] hover:shadow-xl hover:shadow-[#fecc73]/5 dark:hover:shadow-black/30';

              if (hasAnswered) {
                if (isCorrect) {
                  btnClass = 'w-full text-left p-6 rounded-[25px] border-2 border-[#b1c77b] bg-[#f4f7ec]/60 font-bold text-lg text-[#596b2a] shadow-md flex items-center justify-between';
                } else if (isSelected) {
                  btnClass = 'w-full text-left p-6 rounded-[25px] border-2 border-red-500 bg-red-50/60 font-bold text-lg text-red-900 shadow-md flex items-center justify-between';
                } else {
                  btnClass = 'w-full text-left p-6 rounded-[25px] border-2 border-gray-100 bg-gray-50/10 font-bold text-lg text-gray-300 opacity-45 cursor-not-allowed flex items-center justify-between';
                }
              }

              return (
                <button key={idx} disabled={hasAnswered} onClick={() => handleSelectOption(idx)} className={btnClass}>
                  <span className="flex-1">{opt}</span>
                  {hasAnswered && isCorrect && <span className="text-[#abc270] font-black text-xl ml-3">✓</span>}
                  {hasAnswered && isSelected && !isCorrect && <span className="text-red-600 font-black text-xl ml-3">✗</span>}
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {hasAnswered && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-6 border-t border-gray-100">
                <div className={`p-6 rounded-[30px] border ${isAnswerCorrect ? 'bg-[#f4f7ec]/40 border-[#e9efda] text-[#596b2a]' : 'bg-red-50/40 border-red-100 text-red-900'}`}>
                  <h4 className="font-black text-sm uppercase tracking-wider mb-2 flex items-center gap-2">{isAnswerCorrect ? '🎉 Resposta Correta!' : '💡 Resposta Incorreta! Faz Parte do Aprendizado.'}</h4>
                  <div className="text-sm font-semibold text-gray-600 leading-relaxed max-w-none">
                    <MarkdownContent content={currentQ.explanation} />
                  </div>
                </div>

                {currentQ.memoryHint && (
                  <div className="bg-[#fff1e8]/60 border border-[#fee6d5] p-6 rounded-[30px] text-[#733000]">
                    <h5 className="font-black text-xs uppercase tracking-wider mb-2 flex items-center gap-2 text-[#ff832a]">⚡ Dica para lembrar:</h5>
                    <p className="text-xs font-bold leading-relaxed">{currentQ.memoryHint}</p>
                  </div>
                )}

                <button onClick={handleNextQuestion} className="w-full bg-[#473c33] hover:bg-[#473c33] text-white py-5 rounded-[22px] font-black text-xs uppercase tracking-wider shadow-lg transition-transform hover:scale-[1.01] active:scale-95 text-center flex items-center justify-center gap-2">
                  {currentQIdx < questions.length - 1 ? 'Próxima Questão →' : 'Ver Resultado →'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  const itemsToday = items.filter((i) => i.status === 'PENDING');
  const vaultPending = vault.filter((v) => !v.resolved);

  return (
    <div className="max-w-6xl mx-auto py-12 px-6 pb-32">
      <button onClick={onBack} className="min-h-[44px] mb-6 text-[#725442] dark:text-[#c8c5a9] font-black uppercase text-xs tracking-widest flex items-center gap-2 hover:text-[#473c33] dark:hover:text-[#f2efd2] transition-colors">
        <ChevronLeft className="w-4 h-4" />
        VOLTAR AO HUB
      </button>

      <CharacterTip id="smart-revision" message="Revise cada assunto em três momentos: 24 horas, 7 dias e 30 dias depois de estudá-lo. As questões que você errar ficam no Cofre de Erros para revisar depois." />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-8 space-y-12">
          <header className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <div
                className="mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#e96f34]/15 text-[#e96f34]"
                style={{ ['--icon-shadow' as string]: '#7d3a1b' }}
              >
                <CalendarCheck className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <h1 className="font-logo text-3xl sm:text-4xl uppercase leading-none tracking-wide text-[#473c33] dark:text-[#f2efd2]">
                  Revisão <span className="text-[#e96f34] dark:text-[#f08a52]">espaçada</span>
                </h1>
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#e96f34]/15 px-3 py-1 text-xs font-black uppercase tracking-widest text-[#bf4f1b] dark:text-[#f08a52]">
                  Regra 24h · 7 dias · 30 dias
                </p>
                <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-[#725442] dark:text-[#c8c5a9]">
                  Ciclo neurocientífico para fixar o conteúdo: cada assunto volta no momento em que o cérebro mais esquece.
                </p>
              </div>
            </div>

            <div role="tablist" aria-label="Visão da revisão" className="flex w-full gap-1 rounded-[22px] border border-[#e8dcc8] bg-[#f4ebdd] p-1.5 dark:border-white/10 dark:bg-[#2d2e27] sm:w-fit">
              {([['LIST', 'Lista'], ['CALENDAR', 'Calendário'], ['STRATEGY', 'Estratégia']] as const).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={activeSubTab === key}
                  onClick={() => setActiveSubTab(key)}
                  className={`min-h-[44px] flex-1 rounded-[18px] px-5 text-xs font-black uppercase tracking-widest transition-all sm:flex-none ${activeSubTab === key ? 'bg-[#bf4f1b] text-white shadow-sm' : 'text-[#725442] hover:bg-black/5 dark:text-[#c8c5a9] dark:hover:bg-white/5'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>

          <AnimatePresence mode="wait">
            {activeSubTab === 'LIST' ? (
              <motion.section key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <h3 className="font-logo text-xl uppercase tracking-wide text-[#473c33] dark:text-[#f2efd2] flex items-center gap-3">
                  Validações de hoje
                  <span className="rounded-full bg-[#e96f34] px-3 py-1 text-xs font-black tabular-nums text-white">{itemsToday.length}</span>
                </h3>

                {itemsToday.length === 0 ? (
                  <div className="rounded-[32px] border-2 border-dashed border-[#d9ccb4] bg-[#fdfbf7] p-12 text-center dark:border-white/15 dark:bg-white/[0.03]">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#e96f34]/15 text-[#e96f34]" style={{ ['--icon-shadow' as string]: '#7d3a1b' }}>
                      <CalendarCheck className="h-7 w-7" />
                    </div>
                    <p className="font-logo text-lg uppercase tracking-wide text-[#473c33] dark:text-[#f2efd2]">Tudo em dia</p>
                    <p className="mt-2 text-sm font-medium text-[#725442] dark:text-[#c8c5a9]">Nenhuma validação pendente por agora.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {itemsToday.map((item) => (
                      <button key={item.id} onClick={() => startValidation(item)} className="group bg-white dark:bg-[#2d2e27] p-6 rounded-[28px] border border-[#efe6d6] dark:border-white/[0.07] shadow-sm hover:shadow-xl hover:border-[#e96f34]/40 transition-all text-left relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-xs font-black text-[#bf4f1b] dark:text-[#f08a52] bg-[#e96f34]/12 px-3 py-1 rounded-full uppercase ">{item.intervalLevel === 1 ? '⚡ 1ª REVISÃO (24h)' : item.intervalLevel === 7 ? '📅 2ª REVISÃO (7 dias)' : item.intervalLevel === 30 ? '🧠 3ª REVISÃO (30 dias)' : `REVISÃO DIA ${item.intervalLevel}`}</span>
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e96f34]/12 text-[#e96f34] transition-colors group-hover:bg-[#bf4f1b] group-hover:text-white">
                            <Zap className="w-5 h-5" />
                          </div>
                        </div>
                        <h4 className="font-logo text-lg text-[#473c33] dark:text-[#f2efd2] mb-1 leading-tight group-hover:translate-x-1 transition-transform">{item.topic}</h4>
                        <p className="text-xs font-bold text-[#725442] dark:text-[#c8c5a9] uppercase tracking-widest">{item.subjectName}</p>

                        <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-[#fec868]/5 blur-2xl rounded-full group-hover:bg-[#fec868]/10 transition-all"></div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.section>
            ) : activeSubTab === 'CALENDAR' ? (
              <motion.section key="calendar" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white rounded-[40px] p-8 md:p-10 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-black uppercase tracking-tighter">
                    {viewDate.toLocaleString('pt-BR', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button onClick={nextMonth} className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] py-2">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {generateCalendarDays().map((d, i) => (
                    <div key={i} className={`min-h-[90px] rounded-2xl border p-2 transition-all flex flex-col ${!d ? 'bg-gray-50/20 border-transparent' : 'bg-white border-gray-100 hover:border-[#ffe6b9]'}`}>
                      {d && (
                        <>
                          <span className={`text-[10px] font-black mb-1 ${d.dateStr === toLocalDateKey() ? 'text-[#fec868]' : 'text-gray-300'}`}>{d.day}</span>
                          <div className="space-y-1 overflow-y-auto max-h-[50px] scrollbar-hide">
                            {d.items.map((it) => (
                              <div key={it.id} className="text-[7px] font-black bg-[#473c33] text-white p-1 rounded-md px-1.5 truncate leading-none uppercase border-l-2 border-[#fecc73]" title={`REVISÃO: ${it.topic}`}>
                                {it.topic}
                              </div>
                            ))}
                            {d.plannedSessions?.map((ps: any, pidx: number) => (
                              <div key={pidx} className="text-[7px] font-black bg-[#fff6e8] text-[#fec868] p-1 rounded-md px-1.5 truncate leading-none uppercase border-l-2 border-[#fec868]" title={`ESTUDO: ${ps.subjectName}`}>
                                {ps.subjectName} ({ps.minutes}m)
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </motion.section>
            ) : (
              <motion.div key="strategy">
                <ForgettingCurve />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="rounded-[32px] border border-[#a94432]/25 bg-[#fbeee9] p-8 dark:border-[#a94432]/40 dark:bg-[#2d2e27]">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#a94432]/15 text-[#a94432] dark:text-[#e58a76]" style={{ ['--icon-shadow' as string]: 'rgba(125,58,27,0.45)' }}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-logo text-xl uppercase tracking-wide text-[#a94432] dark:text-[#e58a76]">Cofre de erros</h3>
            </div>

            <p className="mb-6 text-sm font-medium leading-relaxed text-[#725442] dark:text-[#c8c5a9]">Assuntos com falhas recentes. A validação tripla limpa o cofre.</p>

            <div className="space-y-3">
              {vaultPending.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#a94432]/30 py-6 text-center text-xs font-black uppercase tracking-widest text-[#a94432] dark:text-[#e58a76]">Cofre vazio. Foco total!</p>
              ) : (
                vaultPending.map((v) => (
                  <button key={v.id} onClick={() => startVaultResolution(v)} className={`w-full min-h-[44px] text-left p-5 rounded-3xl border transition-all flex justify-between items-center ${v.isStuck ? 'bg-[#473c33] border-transparent text-white' : 'bg-white dark:bg-[#34352d] border-[#a94432]/20 text-[#473c33] dark:text-[#f2efd2] hover:border-[#a94432]/50'}`}>
                    <div>
                      <h5 className="font-bold text-sm leading-tight">{v.topic}</h5>
                      <p className={`text-xs font-black uppercase tracking-widest ${v.isStuck ? 'text-[#fed386]' : 'text-[#a94432] dark:text-[#e58a76]'}`}>{v.isStuck ? '🎯 TRAVADO - VER EXPLICAÇÃO' : `${v.errorCount} FALHAS`}</p>
                    </div>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${v.isStuck ? 'bg-[#fed386] text-[#473c33]' : 'bg-[#a94432]/12 text-[#a94432] dark:text-[#e58a76]'}`}>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartRevisionView;
