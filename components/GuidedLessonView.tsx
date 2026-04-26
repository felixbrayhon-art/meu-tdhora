
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Play, Pause, RotateCcw, Brain, CheckCircle2, ChevronRight, BookOpen } from 'lucide-react';
import { GuidedLesson, GuidedLessonStep, StudyProfile, QuizQuestion } from '../types';
import { generateGuidedLesson } from '../services/geminiService';
import LoadingFish from './LoadingFish';
import QuizPlayer from './QuizPlayer';

interface GuidedLessonViewProps {
  subject: string;
  topic: string;
  profile: StudyProfile;
  onBack: () => void;
  onComplete: (score: number) => void;
}

const GuidedLessonView: React.FC<GuidedLessonViewProps> = ({ subject, topic, profile, onBack, onComplete }) => {
  const [lesson, setLesson] = useState<GuidedLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [displayedSteps, setDisplayedSteps] = useState<GuidedLessonStep[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        setLoading(true);
        const data = await generateGuidedLesson(subject, topic, profile);
        setLesson(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar a aula guiada.");
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();
  }, [subject, topic, profile]);

  useEffect(() => {
    if (!lesson || isPaused || showQuiz) return;

    if (currentStepIndex < lesson.steps.length) {
      const step = lesson.steps[currentStepIndex];
      
      setDisplayedSteps(prev => [...prev, step]);

      const words = step.content.split(' ').length;
      const baseDelay = Math.max(words * 120 + 2500, 4000); // TDAH friendly delay
      const typePause = step.type === 'QUESTION_PAUSE' ? 4000 : 1500;
      
      const timer = setTimeout(() => {
        if (!isPaused) {
          setCurrentStepIndex(prev => prev + 1);
        }
      }, baseDelay + typePause);

      return () => clearTimeout(timer);
    } else if (currentStepIndex === lesson.steps.length && lesson.steps.length > 0) {
      const timer = setTimeout(() => setShowQuiz(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [currentStepIndex, lesson, isPaused, showQuiz]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [displayedSteps]);

  if (loading) return (
    <div className="fixed inset-0 z-[200] bg-[#0A0F1E] flex items-center justify-center">
      <LoadingFish message={`Preparando aula sobre ${topic}...`} />
    </div>
  );
  
  if (error) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0A0F1E] flex flex-col items-center justify-center p-8 text-center h-full space-y-4">
        <div className="bg-red-900/20 p-8 rounded-[40px] border border-red-500/30 max-w-md backdrop-blur-xl">
          <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <RotateCcw className="w-8 h-8 text-white" />
          </div>
          <p className="text-red-200 font-bold mb-8 text-lg">{error}</p>
          <button 
            onClick={onBack}
            className="flex items-center gap-3 bg-white text-black px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all mx-auto shadow-xl"
          >
            <ChevronLeft className="w-5 h-5" /> Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (showQuiz && lesson?.quiz) {
    return (
      <QuizPlayer 
        folder={{ 
          id: 'guided', 
          name: 'Aula Guiada', 
          topic: lesson.topic, 
          notebooks: [], 
          createdAt: Date.now() 
        }} 
        notebook={{ 
          id: 'guided-nb', 
          name: lesson.topic, 
          questions: lesson.quiz.map(q => ({ ...q, id: Math.random().toString(36).substr(2,9) })), 
          createdAt: Date.now() 
        }}
        onComplete={(score) => onComplete(score)}
        onBack={() => setShowQuiz(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col h-full bg-[#0A0F1E] text-slate-100 font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Header Imersivo */}
      <header className="p-6 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-20">
        <button onClick={onBack} className="p-3 hover:bg-white/10 rounded-2xl transition-colors active:scale-95 group">
          <ChevronLeft className="w-7 h-7 text-white/50 group-hover:text-white" />
        </button>
        <div className="text-center flex-1">
          <div className="flex items-center justify-center gap-2 mb-1">
             <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">IMERSÃO ATIVA</span>
          </div>
          <h1 className="text-lg font-black uppercase italic tracking-tighter text-white">{subject} • {topic}</h1>
        </div>
        <button 
          onClick={() => setIsPaused(!isPaused)}
          className={`p-3 rounded-2xl transition-all shadow-xl active:scale-90 ${isPaused ? 'bg-orange-500 text-white animate-pulse' : 'bg-white/10 text-white/50 hover:text-white'}`}
        >
          {isPaused ? <Play className="w-7 h-7" /> : <Pause className="w-7 h-7" />}
        </button>
      </header>

      {/* Área de Texto Autoscroll */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-20 space-y-20 scrollbar-none"
        style={{ scrollBehavior: 'smooth' }}
      >
        <AnimatePresence initial={false}>
          {displayedSteps.map((step, idx) => (
            <motion.div
              key={`${step.type}-${idx}`}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className={`max-w-2xl mx-auto relative ${
                step.type === 'QUESTION_PAUSE' 
                ? 'bg-blue-500/5 border-2 border-blue-500/20 p-10 rounded-[40px] shadow-2xl shadow-blue-900/20' 
                : step.type === 'ANALOGY' 
                ? 'bg-orange-500/5 border-2 border-orange-500/20 p-10 rounded-[40px] italic shadow-2xl shadow-orange-900/20'
                : ''
              }`}
            >
              {step.type === 'QUESTION_PAUSE' && (
                <div className="absolute -top-4 left-10 bg-blue-600 text-white px-4 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg">
                  <Brain className="w-4 h-4" /> MOMENTO DE REFLEXÃO
                </div>
              )}
              {step.type === 'ANALOGY' && (
                <div className="absolute -top-4 left-10 bg-orange-600 text-white px-4 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg">
                  <RotateCcw className="w-4 h-4" /> BIZU DE MEMÓRIA
                </div>
              )}

              <p className={`
                ${step.type === 'OPENING' ? 'text-4xl font-black leading-none text-white italic tracking-tighter' : ''}
                ${step.type === 'OVERVIEW' ? 'text-2xl font-bold text-slate-400 leading-tight' : ''}
                ${step.type === 'QUESTION_PAUSE' ? 'text-2xl font-black text-blue-100 italic' : ''}
                ${step.type === 'CONCEPT' ? 'text-xl leading-relaxed text-slate-200 border-l-4 border-blue-500/30 pl-8' : ''}
                ${step.type === 'REINFORCEMENT' ? 'text-2xl font-black text-green-400 uppercase italic' : ''}
                ${!['OPENING', 'OVERVIEW', 'QUESTION_PAUSE', 'CONCEPT', 'REINFORCEMENT'].includes(step.type) ? 'text-xl leading-relaxed text-slate-300' : ''}
              `}>
                {step.content}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>

        {currentStepIndex < (lesson?.steps.length || 0) && !isPaused && (
          <div className="flex justify-center py-12">
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.7, 0.3]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex gap-2"
            >
              <div className="w-3 h-3 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50" />
              <div className="w-3 h-3 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50" />
              <div className="w-3 h-3 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50" />
            </motion.div>
          </div>
        )}

        {currentStepIndex === (lesson?.steps.length || 0) && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="max-w-sm mx-auto text-center space-y-8 pt-20 pb-32"
          >
            <div className="w-24 h-24 bg-green-500/10 border-4 border-green-500/30 p-4 rounded-full mx-auto flex items-center justify-center shadow-2xl shadow-green-900/20">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <div>
              <h3 className="text-4xl font-black uppercase italic tracking-tighter leading-none mb-4">Ciclo de Explicação Concluído</h3>
              <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Prepare seu cérebro para o desafio final.</p>
            </div>
            <button
              onClick={() => setShowQuiz(true)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/40 flex items-center justify-center gap-4 transition-all hover:scale-105 active:scale-95 group"
            >
              INICIAR DESAFIO <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </button>
          </motion.div>
        )}
      </div>

      {/* Indicador de Progresso Inferior */}
      <div className="p-8 bg-black/60 backdrop-blur-2xl border-t border-white/5">
        <div className="max-w-2xl mx-auto space-y-4">
           <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
             <span>PROGRESSO DA JORNADA</span>
             <span className="text-blue-500">{Math.round((currentStepIndex / (lesson?.steps.length || 1)) * 100)}%</span>
           </div>
           <div className="h-2 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
             <motion.div 
               className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)]"
               initial={{ width: 0 }}
               animate={{ width: `${(currentStepIndex / (lesson?.steps.length || 1)) * 100}%` }}
               transition={{ duration: 0.5 }}
             />
           </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedLessonView;
