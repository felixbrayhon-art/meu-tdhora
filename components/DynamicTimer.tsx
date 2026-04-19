
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && seconds > 0) {
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev - 1);
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

  const handlePhaseTransition = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (phase === 'EVOCATION') {
      setIsGeneratingQuestions(true);
      setPhase('PRACTICE');
      setSeconds(1200); // 20 min
      setIsActive(true);
      
      try {
        const questions = await generateQuestionsFromAnalysis(evocationAnalysis, studyProfile);
        setPracticeQuestions(questions);
      } catch (error) {
        console.error("Erro ao gerar questões:", error);
      } finally {
        setIsGeneratingQuestions(false);
      }
    } else if (phase === 'PRACTICE') {
      setPhase('DETECTIVE');
      setSeconds(900); // 15 min
      setIsActive(true);
      // Initialize analyses based on errorsCount
      const initialAnalyses = Array.from({ length: errorsCount }, () => ({
        id: Math.random().toString(36).substr(2, 9),
        field1: '',
        field2: '',
        field3: ''
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
    setAnalyses(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const isDetectiveWorkDone = analyses.every(a => a.field1.trim() && a.field2.trim() && a.field3.trim());

  const finishSession = () => {
    onComplete(40); // 5 + 20 + 15
    setSessionCompleted(true);
  };

  const getPhaseStyles = () => {
    switch (phase) {
      case 'EVOCATION': return { bg: 'bg-orange-500', text: 'text-orange-500', light: 'bg-orange-50', label: 'FASE 1: EVOCAÇÃO' };
      case 'PRACTICE': return { bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-50', label: 'FASE 2: PRÁTICA' };
      case 'DETECTIVE': return { bg: 'bg-green-600', text: 'text-green-600', light: 'bg-green-50', label: 'FASE 3: DETETIVE' };
    }
  };

  const styles = getPhaseStyles();

  if (sessionCompleted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-[40px] flex items-center justify-center shadow-xl">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-4xl font-black italic uppercase italic tracking-tighter">Bloco Imutável <span className="text-green-600">Concluído!</span></h2>
        <p className="text-gray-400 font-bold max-w-sm">Dossiê processado, questões resolvidas e erros analisados. Você está em outro nível.</p>
        <button onClick={onBack} className="bg-[#0A0F1E] text-white px-10 py-5 rounded-[25px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
          Voltar ao Hub
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-12">
        <button onClick={onBack} className="text-gray-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 hover:text-black transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
          Sair do Bloco
        </button>
        <div className="flex flex-col items-end">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">Timer <span className="text-blue-500">Dinâmico</span></h1>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Blocos Imutáveis</span>
        </div>
      </div>

      <div className={`rounded-[60px] p-12 shadow-2xl transition-colors duration-1000 ${styles.light} relative overflow-hidden min-h-[500px] flex flex-col items-center justify-center`}>
        {/* Phase Indicator */}
        <div className="absolute top-10 left-12">
          <span className={`px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest text-white ${styles.bg}`}>
            {styles.label}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {isAnalyzing ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingFish message="O Peixe está analisando sua memória..." submessage="Identificando acertos e pontos de melhoria" />
            </motion.div>
          ) : phase === 'EVOCATION' && evocationAnalysis ? (
            <motion.div 
              key="evocation-result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-2xl space-y-6"
            >
              <div className="bg-white/80 backdrop-blur-md rounded-[40px] p-10 border border-orange-200 shadow-xl space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">Feedback da <span className="text-orange-500">Evocação</span></h3>
                </div>

                <div className="space-y-4 text-left">
                  <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100">
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">Pontos Identificados</p>
                    <ul className="list-disc list-inside text-sm font-bold text-green-800 space-y-1">
                      {evocationAnalysis.pointsIdentified.map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>

                  {evocationAnalysis.errorsFound.length > 0 && (
                    <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100">
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2">Possíveis Erros/Confusões</p>
                      <ul className="list-disc list-inside text-sm font-bold text-red-800 space-y-1">
                        {evocationAnalysis.errorsFound.map((p: string, i: number) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Ficou de fora</p>
                    <ul className="list-disc list-inside text-sm font-bold text-blue-800 space-y-1">
                      {evocationAnalysis.missedPoints.map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                </div>

                <p className="text-gray-600 font-bold italic text-sm text-left border-l-4 border-orange-400 pl-4 py-2 bg-orange-50/30 rounded-r-xl">
                  {evocationAnalysis.feedback}
                </p>

                <button 
                  onClick={() => { setEvocationAnalysis(null); handlePhaseTransition(); }}
                  className="w-full bg-orange-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-orange-200 hover:scale-105 transition-all"
                >
                  Continuar para Prática
                </button>
              </div>
            </motion.div>
          ) : phase === 'EVOCATION' ? (
            <motion.div 
              key="evocation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8"
            >
              <h2 className="text-4xl font-black uppercase italic tracking-tighter max-w-xl mx-auto leading-tight">
                FECHE TUDO. O QUE VOCÊ LEMBRA DO ESTUDO DE {strategicMode && selectedTopic ? <span className="text-orange-600 block mt-2 underline">{selectedTopic}</span> : <span className={styles.text}>ONTEM?</span>}
              </h2>

              {strategicMode && editalConfig && !isActive && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto w-full mb-8">
                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-3">Matéria do Edital</label>
                    <select 
                      value={selectedSubject}
                      onChange={(e) => { setSelectedSubject(e.target.value); setSelectedTopic(''); }}
                      className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-orange-500 font-bold appearance-none cursor-pointer"
                    >
                      <option value="">Escolher Matéria...</option>
                      {editalConfig.subjects.map((s, i) => (
                        <option key={i} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-3">Assunto Específico</label>
                    <select 
                      value={selectedTopic}
                      onChange={(e) => setSelectedTopic(e.target.value)}
                      disabled={!selectedSubject}
                      className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-orange-500 font-bold appearance-none cursor-pointer disabled:opacity-30"
                    >
                      <option value="">Escolher Assunto...</option>
                      {editalConfig.subjects.find(s => s.name === selectedSubject)?.topics.map((t, i) => (
                        <option key={i} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              
              <div className="w-full max-w-xl mx-auto">
                <textarea 
                  value={evocationText}
                  onChange={(e) => setEvocationText(e.target.value)}
                  placeholder="Escreva livremente aqui tudo o que você lembra... Não consulte nada!"
                  className="w-full bg-white/50 backdrop-blur-sm border-2 border-orange-200 rounded-[30px] p-6 min-h-[150px] focus:outline-none focus:border-orange-500 font-bold transition-all text-orange-900 placeholder:text-orange-200"
                />
              </div>

              <div className="text-7xl font-black tabular-nums tracking-tighter">
                {formatTime(seconds)}
              </div>
              
              {isActive && (
                <div className="flex justify-center">
                  <button onClick={handleEvocationSubmit} className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:scale-105 transition-all">
                    Finalizar e Analisar
                  </button>
                </div>
              )}

              {!isActive && (
                <button onClick={startSession} className={`${styles.bg} text-white px-12 py-5 rounded-[25px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all`}>
                  Iniciar Evocação
                </button>
              )}
            </motion.div>
          ) : isGeneratingQuestions ? (
            <motion.div key="gen-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingFish message="O Peixe está criando questões personalizadas..." submessage="Focando nos pontos que você esqueceu ou errou" />
            </motion.div>
          ) : phase === 'PRACTICE' ? (
            <motion.div 
              key="practice"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-4xl space-y-8"
            >
              <div className="flex justify-between items-center bg-white/50 p-6 rounded-[30px] border border-blue-100">
                <div className="text-left">
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter text-blue-600">FASE DE PRÁTICA</h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mt-1">Questões baseadas na sua evocação</p>
                </div>
                <div className="text-5xl font-black tabular-nums tracking-tighter text-blue-600">
                  {formatTime(seconds)}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  {practiceQuestions.length > 0 && currentQuestionIndex < practiceQuestions.length ? (
                    <div className="bg-white rounded-[40px] p-10 shadow-xl border border-blue-50 relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-500" 
                            style={{ width: `${((currentQuestionIndex + 1) / practiceQuestions.length) * 100}%` }}
                          />
                       </div>
                       
                       <div className="mb-8 flex justify-between items-center text-left">
                          <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">
                            Questão {currentQuestionIndex + 1} de {practiceQuestions.length}
                          </span>
                       </div>

                       <h3 className="text-xl font-bold text-gray-800 leading-relaxed mb-10 text-left">
                          {practiceQuestions[currentQuestionIndex].question}
                       </h3>

                       <div className="space-y-3">
                          {practiceQuestions[currentQuestionIndex].options.map((option, idx) => (
                            <button
                              key={idx}
                              disabled={isAnswerRevealed}
                              onClick={() => setSelectedOption(idx)}
                              className={`w-full text-left p-5 rounded-2xl font-bold transition-all border-2 flex items-center gap-4 ${
                                selectedOption === idx 
                                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                  : 'border-gray-50 bg-gray-50/50 hover:border-blue-200'
                              } ${
                                isAnswerRevealed && idx === practiceQuestions[currentQuestionIndex].correctAnswer 
                                  ? 'border-green-500 bg-green-50 text-green-700' 
                                  : ''
                              } ${
                                isAnswerRevealed && selectedOption === idx && idx !== practiceQuestions[currentQuestionIndex].correctAnswer 
                                  ? 'border-red-500 bg-red-50 text-red-700' 
                                  : ''
                              }`}
                            >
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                                selectedOption === idx ? 'bg-blue-500 text-white' : 'bg-white text-gray-400'
                              }`}>
                                {String.fromCharCode(65 + idx)}
                              </span>
                              {option}
                            </button>
                          ))}
                       </div>

                       <AnimatePresence>
                          {isAnswerRevealed && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-8 p-6 bg-gray-50 rounded-3xl border border-gray-100 text-left"
                            >
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Explicação do Peixe</p>
                              <p className="text-sm font-bold text-gray-600 leading-relaxed italic">{practiceQuestions[currentQuestionIndex].commentary}</p>
                            </motion.div>
                          )}
                       </AnimatePresence>

                       <div className="mt-10 flex justify-end">
                          {!isAnswerRevealed ? (
                            <button
                              disabled={selectedOption === null}
                              onClick={() => {
                                setIsAnswerRevealed(true);
                                if (selectedOption !== practiceQuestions[currentQuestionIndex].correctAnswer) {
                                  setErrorsCount(prev => prev + 1);
                                }
                              }}
                              className={`px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${
                                selectedOption !== null ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-300'
                              }`}
                            >
                              Responder
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (currentQuestionIndex < practiceQuestions.length - 1) {
                                  setCurrentQuestionIndex(prev => prev + 1);
                                  setSelectedOption(null);
                                  setIsAnswerRevealed(false);
                                } else {
                                  setCurrentQuestionIndex(practiceQuestions.length);
                                }
                              }}
                              className="bg-black text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all"
                            >
                              {currentQuestionIndex < practiceQuestions.length - 1 ? 'Próxima Questão' : 'Concluir Prática'}
                            </button>
                          )}
                       </div>
                    </div>
                  ) : (
                    <div className="bg-white/50 backdrop-blur-sm p-12 rounded-[40px] border border-dashed border-blue-200 text-center">
                       <p className="text-gray-400 font-bold italic">
                         {currentQuestionIndex >= practiceQuestions.length && practiceQuestions.length > 0 
                           ? "Questões da IA concluídas! Continue praticando por conta própria ou encerre a fase." 
                           : "Buscando questões no oceano de dados..."}
                       </p>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-[40px] p-10 border border-red-50 shadow-xl space-y-6 text-left">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <h3 className="font-black italic uppercase italic tracking-tighter leading-none">CONTADOR DE <br/><span className="text-red-500">ERROS</span></h3>
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
                     <p className="text-[10px] font-bold text-gray-400 leading-tight uppercase tracking-widest">
                        Cada erro marcado agora exigirá uma análise no modo detetive.
                     </p>
                  </div>

                  <div className="bg-blue-600 rounded-[40px] p-8 text-white space-y-4 shadow-xl text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Dica Progressiva</p>
                      <p className="font-bold leading-relaxed text-sm italic">
                         "Não tenha medo do erro. O erro marcado aqui é a vacina para o erro na prova."
                      </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : phase === 'DETECTIVE' ? (
            <motion.div 
              key="detective"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-3xl space-y-10"
            >
              <div className="flex justify-between items-end text-left">
                <div>
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none text-green-600">MODO DETETIVE</h2>
                  <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-2">Analise cada um dos {errorsCount} erros</p>
                </div>
                <div className="text-4xl font-black tabular-nums tracking-tighter opacity-30">
                  {formatTime(seconds)}
                </div>
              </div>

              {errorsCount === 0 ? (
                <div className="bg-white/80 p-12 rounded-[40px] text-center space-y-4">
                  <div className="text-5xl">🏆</div>
                  <h3 className="text-2xl font-black uppercase italic">Nenhum erro?!</h3>
                  <p className="text-gray-400 font-bold">Você foi impecável hoje. Pode encerrar o bloco quando quiser.</p>
                </div>
              ) : (
                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                  {analyses.map((analysis, index) => (
                    <div key={analysis.id} className="bg-white/80 backdrop-blur-sm p-8 rounded-[35px] border border-green-100 shadow-sm space-y-6 text-left">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-green-600 text-white rounded-lg flex items-center justify-center font-black text-sm"># {index + 1}</span>
                        <h4 className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Análise de Erro</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-2 mb-1 block">O que eu achei que era?</label>
                          <input 
                            value={analysis.field1}
                            onChange={(e) => handleAnalysisChange(analysis.id, 'field1', e.target.value)}
                            className="w-full bg-gray-50/50 border-2 border-transparent rounded-2xl px-5 py-3 focus:outline-none focus:border-green-300 font-bold"
                            placeholder="Anote seu raciocínio errado..."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-2 mb-1 block">Por que eu errei?</label>
                          <input 
                            value={analysis.field2}
                            onChange={(e) => handleAnalysisChange(analysis.id, 'field2', e.target.value)}
                            className="w-full bg-gray-50/50 border-2 border-transparent rounded-2xl px-5 py-3 focus:outline-none focus:border-green-300 font-bold"
                            placeholder="Identifique a falha..."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-2 mb-1 block">Como não errar de novo?</label>
                          <input 
                            value={analysis.field3}
                            onChange={(e) => handleAnalysisChange(analysis.id, 'field3', e.target.value)}
                            className="w-full bg-gray-50/50 border-2 border-transparent rounded-2xl px-5 py-3 focus:outline-none focus:border-green-300 font-bold"
                            placeholder="Defina a estratégia de prevenção..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-center pt-8">
                <button 
                  disabled={!isDetectiveWorkDone && errorsCount > 0}
                  onClick={finishSession}
                  className={`px-16 py-6 rounded-[30px] font-black uppercase tracking-widest shadow-2xl transition-all ${isDetectiveWorkDone || errorsCount === 0 ? 'bg-green-600 text-white hover:scale-105 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  {isDetectiveWorkDone || errorsCount === 0 ? 'Encerrar Bloco Imutável' : 'Complete as Análises First'}
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="mt-12 grid grid-cols-3 gap-8">
        {[
          { icon: '🧠', label: 'Efeito Testagem', desc: 'Evocação ativa fortalece sinapses.' },
          { icon: '📊', label: 'Métrica Real', desc: 'Contar erros traz consciência.' },
          { icon: '🕵️', label: 'Metacognição', desc: 'Analisar o erro impede a repetição.' }
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-6 rounded-[30px] border border-gray-100 shadow-sm text-center">
            <span className="text-3xl block mb-2">{item.icon}</span>
            <p className="font-black text-[10px] uppercase tracking-widest text-blue-500 mb-1">{item.label}</p>
            <p className="text-gray-400 text-[10px] font-medium leading-tight">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DynamicTimer;
