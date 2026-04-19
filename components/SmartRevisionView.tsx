
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SmartRevisionItem, ErrorVaultItem, StudyProfile, StudyPlan } from '../types';
import { generateMicroThemeValidation, explainStuckTopic, identifyAndProgramRecovery } from '../services/geminiService';
import LoadingFish from './LoadingFish';
import ForgettingCurve from './ForgettingCurve';

interface SmartRevisionViewProps {
  items: SmartRevisionItem[];
  vault: ErrorVaultItem[];
  profile: StudyProfile;
  plan: StudyPlan;
  onComplete: (itemId: string, success: boolean) => void;
  onResolveVault: (vaultId: string, recoveryFlashcards?: any[]) => void;
  onBack: () => void;
}

const SmartRevisionView: React.FC<SmartRevisionViewProps> = ({ 
  items, 
  vault, 
  profile, 
  plan,
  onComplete, 
  onResolveVault,
  onBack 
}) => {
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

  const startValidation = async (item: SmartRevisionItem) => {
    setLoading(true);
    setActiveItem(item);
    try {
      const data = await generateMicroThemeValidation(item.topic, profile);
      setQuestions(data.questions);
      setCurrentQIdx(0);
      setScore(0);
      setShowResult(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar validação.");
    } finally {
      setLoading(false);
    }
  };

  const startVaultResolution = async (vItem: ErrorVaultItem) => {
    setLoading(true);
    setActiveVault(vItem);
    try {
      if (vItem.isStuck || (vItem.missedQuestions && vItem.missedQuestions.length > 0)) {
        if (vItem.missedQuestions && vItem.missedQuestions.length > 0) {
          const data = await identifyAndProgramRecovery(vItem.topic, vItem.missedQuestions, profile);
          setRecoveryPlan(data);
        } else {
          const data = await explainStuckTopic(vItem.topic, profile);
          setExplanation(data);
        }
      } else {
        const data = await generateMicroThemeValidation(vItem.topic, profile);
        setQuestions(data.questions);
        setCurrentQIdx(0);
        setScore(0);
        setShowResult(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (correct: boolean) => {
    if (correct) setScore(prev => prev + 1);
    
    if (currentQIdx < questions.length - 1) {
      setCurrentQIdx(prev => prev + 1);
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
        const dayItems = items.filter(item => item.scheduledDate === dateStr);
        const plannedSessions = plan.schedule?.find(s => s.date === dateStr)?.sessions || [];
        days.push({ day: i, dateStr, items: dayItems, plannedSessions });
    }
    return days;
  };

  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));

  if (loading) return <LoadingFish message="A IA está preparando sua micro-validação de elite..." />;

  if (activeItem || activeVault) {
    if (recoveryPlan) {
      return (
        <div className="max-w-4xl mx-auto py-10 px-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0A0F1E] rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
               <svg className="w-32 h-32 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            
            <div className="relative z-10">
              <span className="bg-red-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest mb-6 inline-block italic">Dificuldade Identificada pela IA</span>
              <h1 className="text-4xl font-black mb-2 uppercase italic leading-none">{activeVault?.topic}</h1>
              <p className="text-gray-400 text-lg mb-10 font-medium tracking-tight">O sistema analisou seus erros e detectou um padrão.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-white/5 border border-white/10 p-8 rounded-[35px]">
                    <h3 className="text-red-400 font-bold uppercase text-[10px] tracking-widest mb-4">Diagnóstico de Falha</h3>
                    <p className="text-xl font-medium leading-relaxed italic">"{recoveryPlan.diagnosis}"</p>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 p-8 rounded-[35px]">
                    <h3 className="text-blue-400 font-bold uppercase text-[10px] tracking-widest mb-4">Plano de Recuperação</h3>
                    <ul className="space-y-3">
                      {recoveryPlan.recoverySteps.map((step: string, i: number) => (
                        <li key={i} className="flex gap-3 text-sm font-medium text-blue-100">
                          <span className="text-blue-500 font-black">{i + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-6">
                   <div className="bg-[#1E293B] p-8 rounded-[35px] border border-white/5">
                      <h3 className="text-yellow-400 font-bold uppercase text-[10px] tracking-widest mb-6">Programação de Contragolpe</h3>
                      <div className="space-y-4">
                         <div className="p-4 bg-white/5 rounded-2xl flex items-center justify-between">
                            <span className="text-xs font-bold">Questões de Recuperação</span>
                            <span className="bg-yellow-400 text-black text-[10px] font-black px-2 py-1 rounded-md">{recoveryPlan.recoveryQuestions.length}</span>
                         </div>
                         <div className="p-4 bg-white/5 rounded-2xl flex items-center justify-between">
                            <span className="text-xs font-bold">Flashcards de Resgate</span>
                            <span className="bg-blue-400 text-white text-[10px] font-black px-2 py-1 rounded-md">{recoveryPlan.recoveryFlashcards.length}</span>
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
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      </button>
                      <button 
                         onClick={() => { setRecoveryPlan(null); setActiveVault(null); }}
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
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0A0F1E] rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
               <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            
            <h2 className="text-yellow-400 font-black uppercase text-xs tracking-[0.3em] mb-4 italic">ASSUNTO TRAVADO - NOVA ABORDAGEM</h2>
            <h1 className="text-4xl font-black mb-8 leading-none uppercase italic">{activeVault?.topic}</h1>
            
            <div className="space-y-8 relative z-10">
              <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
                <h3 className="text-blue-400 font-bold uppercase text-[10px] tracking-widest mb-4">A Analogia Definitiva</h3>
                <p className="text-xl font-medium leading-relaxed italic">"{explanation.analogy}"</p>
              </div>
              
              <div className="prose prose-invert max-w-none">
                <h3 className="text-purple-400 font-bold uppercase text-[10px] tracking-widest mb-4">Explicação Filtrada</h3>
                <div className="text-gray-300 text-lg leading-relaxed whitespace-pre-wrap">
                  {explanation.newExplanation}
                </div>
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
              onClick={() => { setExplanation(null); startVaultResolution(activeVault!); }}
              className="w-full bg-white text-black py-6 rounded-2xl font-black mt-12 hover:bg-yellow-400 transition-all active:scale-95 shadow-xl shadow-yellow-400/5"
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
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className={`w-32 h-32 rounded-full flex items-center justify-center text-5xl mb-8 ${isSuccess ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}
          >
            {isSuccess ? '🔥' : '❄️'}
          </motion.div>
          
          <h2 className="text-4xl font-black mb-4 tracking-tighter">
            {isSuccess ? 'VALIDAÇÃO CONCLUÍDA!' : 'QUASE LÁ! VAMOS REPETIR?'}
          </h2>
          
          <p className="text-gray-500 text-lg max-w-md mb-12 font-medium">
            {isSuccess 
              ? `Você dominou este micro-tema. A barra de calor da matéria subiu!` 
              : `Para garantir a retenção total, precisamos acertar todas as 3 questões. O tópico voltará para o início do ciclo.`}
          </p>
          
          <button 
            onClick={activeItem ? finishValidation : finishVault}
            className={`px-12 py-6 rounded-3xl font-black text-xl transition-all active:scale-95 shadow-2xl ${isSuccess ? 'bg-[#0A0F1E] text-white hover:bg-black' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
          >
            {isSuccess ? 'CONTINUAR JORNADA' : 'VOLTAR PARA REVISÃO'}
          </button>
        </div>
      );
    }

    const currentQ = questions[currentQIdx];
    return (
      <div className="max-w-3xl mx-auto py-12 px-6">
        <div className="flex justify-between items-center mb-10">
           <div className="flex items-center gap-3">
              <span className="bg-yellow-400 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase italic">Vencendo Pequenas Batalhas</span>
              <h4 className="font-black text-gray-400 uppercase text-xs tracking-widest">{activeItem?.topic || activeVault?.topic}</h4>
           </div>
           <div className="text-gray-300 font-black italic">{currentQIdx + 1}/{questions.length}</div>
        </div>

        <motion.div 
          key={currentQIdx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-[40px] p-10 md:p-14 shadow-2xl shadow-blue-900/5 border border-gray-50"
        >
          <h2 className="text-2xl font-black text-[#0F172A] leading-tight mb-12">{currentQ.question}</h2>
          
          <div className="grid grid-cols-1 gap-4">
            {currentQ.options.map((opt: string, idx: number) => (
              <button 
                key={idx}
                onClick={() => handleAnswer(idx === currentQ.correctAnswer)}
                className="w-full text-left p-6 rounded-[25px] border-2 border-gray-50 bg-gray-50/30 hover:bg-white hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/5 transition-all text-gray-700 font-bold text-lg"
              >
                {opt}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  const itemsToday = items.filter(i => i.status === 'PENDING');
  const vaultPending = vault.filter(v => !v.resolved);

  return (
    <div className="max-w-6xl mx-auto py-12 px-6 pb-32">
       <button 
         onClick={onBack}
         className="mb-8 text-gray-400 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:text-gray-600 transition-colors"
       >
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
         VOLTAR AO HUB
       </button>

       <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-8 space-y-12">
             <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-3">
                   <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   </div>
                   <div>
                      <h1 className="text-4xl font-black italic tracking-tighter">REVISÃO INTELIGENTE</h1>
                      <p className="text-gray-400 font-medium">Cronograma de repetição espaçada por IA.</p>
                   </div>
                </div>
                
                <div className="flex bg-gray-100 p-1.5 rounded-[22px] shadow-inner">
                   <button 
                     onClick={() => setActiveSubTab('LIST')} 
                     className={`px-6 py-2.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'LIST' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                   >
                     Lista
                   </button>
                   <button 
                     onClick={() => setActiveSubTab('CALENDAR')} 
                     className={`px-6 py-2.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'CALENDAR' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                   >
                     Calendário
                   </button>
                   <button 
                     onClick={() => setActiveSubTab('STRATEGY')} 
                     className={`px-6 py-2.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'STRATEGY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                   >
                     Estratégia
                   </button>
                </div>
             </header>

             <AnimatePresence mode="wait">
               {activeSubTab === 'LIST' ? (
                 <motion.section 
                    key="list"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                 >
                    <h3 className="text-xl font-black text-[#0F172A] flex items-center gap-3">
                       VALIDAÇÕES DE HOJE
                       <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full">{itemsToday.length}</span>
                    </h3>
                    
                    {itemsToday.length === 0 ? (
                      <div className="bg-gray-50 rounded-[40px] p-12 text-center border-2 border-dashed border-gray-200">
                         <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Parabéns! Nenhuma validação pendente por agora.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {itemsToday.map(item => (
                            <button 
                              key={item.id}
                              onClick={() => startValidation(item)}
                              className="group bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl transition-all text-left relative overflow-hidden"
                            >
                               <div className="flex justify-between items-start mb-4">
                                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase italic">DIA {item.intervalLevel}</span>
                                  <div className="p-2 bg-gray-50 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                  </div>
                               </div>
                               <h4 className="font-black text-lg text-[#0F172A] mb-1 leading-tight group-hover:translate-x-1 transition-transform">{item.topic}</h4>
                               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.subjectName}</p>
                               
                               <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-blue-600/5 blur-2xl rounded-full group-hover:bg-blue-600/10 transition-all"></div>
                            </button>
                         ))}
                      </div>
                    )}
                 </motion.section>
               ) : activeSubTab === 'CALENDAR' ? (
                 <motion.section 
                    key="calendar"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white rounded-[40px] p-8 md:p-10 border border-gray-100 shadow-sm"
                 >
                    <div className="flex justify-between items-center mb-10">
                       <h3 className="text-2xl font-black italic uppercase tracking-tighter">
                          {viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                       </h3>
                       <div className="flex gap-2">
                          <button onClick={prevMonth} className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                          </button>
                          <button onClick={nextMonth} className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                          </button>
                       </div>
                    </div>

                    <div className="grid grid-cols-7 gap-2 mb-4">
                       {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                         <div key={i} className="text-center text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] py-2">{d}</div>
                       ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                       {generateCalendarDays().map((d, i) => (
                         <div 
                           key={i} 
                           className={`min-h-[90px] rounded-2xl border p-2 transition-all flex flex-col ${!d ? 'bg-gray-50/20 border-transparent' : 'bg-white border-gray-100 hover:border-blue-200'}`}
                         >
                            {d && (
                              <>
                                <span className={`text-[10px] font-black mb-1 ${d.dateStr === new Date().toISOString().split('T')[0] ? 'text-blue-600' : 'text-gray-300'}`}>
                                  {d.day}
                                </span>
                                <div className="space-y-1 overflow-y-auto max-h-[50px] scrollbar-hide">
                                   {d.items.map(it => (
                                     <div key={it.id} className="text-[7px] font-black bg-[#0A0F1E] text-white p-1 rounded-md px-1.5 truncate leading-none uppercase italic border-l-2 border-indigo-500" title={`REVISÃO: ${it.topic}`}>
                                        {it.topic}
                                     </div>
                                   ))}
                                   {d.plannedSessions?.map((ps: any, pidx: number) => (
                                      <div key={pidx} className="text-[7px] font-black bg-blue-50 text-blue-600 p-1 rounded-md px-1.5 truncate leading-none uppercase italic border-l-2 border-blue-600" title={`ESTUDO: ${ps.subjectName}`}>
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
             <div className="bg-red-50 rounded-[40px] p-8 border border-red-100">
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                   </div>
                   <h3 className="font-black text-red-600 text-xl tracking-tight">COFRE DE ERROS</h3>
                </div>
                
                <p className="text-red-900/60 text-sm font-medium mb-8 leading-relaxed">Assuntos com falhas recentes. A validação tripla limpa o cofre.</p>
                
                <div className="space-y-3">
                   {vaultPending.length === 0 ? (
                     <p className="text-center py-6 text-[10px] font-black text-red-300 uppercase tracking-widest">Cofre vázio. Foco total!</p>
                   ) : (
                     vaultPending.map(v => (
                        <button 
                           key={v.id}
                           onClick={() => startVaultResolution(v)}
                           className={`w-full text-left p-5 rounded-3xl border transition-all flex justify-between items-center ${v.isStuck ? 'bg-[#0A0F1E] border-transparent text-white' : 'bg-white border-red-100 text-[#0F172A] hover:bg-red-100/50'}`}
                        >
                           <div>
                              <h5 className="font-bold text-sm leading-tight">{v.topic}</h5>
                              <p className={`text-[9px] font-black uppercase tracking-widest ${v.isStuck ? 'text-yellow-400' : 'text-red-400'}`}>
                                {v.isStuck ? '🎯 TRAVADO - VER EXPLICAÇÃO' : `${v.errorCount} FALHAS`}
                              </p>
                           </div>
                           <div className={`p-2 rounded-xl ${v.isStuck ? 'bg-yellow-400 text-black' : 'bg-red-50 text-red-500'}`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
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
