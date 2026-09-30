import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Play, Pause, RotateCcw, Brain, CheckCircle2, ChevronRight, BookOpen, Download, Bookmark, BookmarkCheck } from './icons';
import { gsap } from 'gsap';
import { GuidedLesson, GuidedLessonStep, StudyProfile, ExplanationStyle, SavedGuidedLesson } from '../types';
import { generateGuidedLesson } from '../services/geminiService';
import BookLoader from './BookLoader';
import { jsPDF } from 'jspdf';

interface GuidedLessonViewProps {
  subject: string;
  topic: string;
  profile: StudyProfile;
  explanationStyle?: ExplanationStyle;
  onBack: () => void;
  onComplete: (score: number) => void;
  initialLesson?: GuidedLesson; // For viewing saved lessons offline
}

const GuidedLessonView: React.FC<GuidedLessonViewProps> = ({ subject, topic, profile, explanationStyle = 'TECNICA', onBack, onComplete, initialLesson }) => {
  // Entering directly (e.g. from the sidebar, with no matéria/assunto chosen yet)
  // leaves subject/topic empty — activeSubject/activeTopic hold what's actually
  // being taught, seeded from the props but filled in by the setup form below
  // when the caller didn't already collect them (e.g. Hub's own mini-form).
  const [activeSubject, setActiveSubject] = useState(subject);
  const [activeTopic, setActiveTopic] = useState(topic);
  const [setupSubject, setSetupSubject] = useState('');
  const [setupTopic, setSetupTopic] = useState('');
  const [lesson, setLesson] = useState<GuidedLesson | null>(initialLesson || null);
  const [loading, setLoading] = useState(!initialLesson && Boolean(subject && topic));
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [displayedSteps, setDisplayedSteps] = useState<GuidedLessonStep[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [studyView, setStudyView] = useState<'immersive' | 'highlights'>(() => {
    try {
      return localStorage.getItem('guidedLessonStudyView') === 'highlights' ? 'highlights' : 'immersive';
    } catch {
      return 'immersive';
    }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightViewRef = useRef<HTMLDivElement>(null);
  const [highlightProgress, setHighlightProgress] = useState(0);
  const lastPushedStepIndexRef = useRef<number>(-1);
  const stepLabels: Record<GuidedLessonStep['type'], string> = {
    OPENING: 'Abertura',
    OVERVIEW: 'Visão geral',
    NARRATIVE: 'Explicação',
    CONCEPT: 'Conceito-chave',
    QUESTION_PAUSE: 'Pausa para pensar',
    REINFORCEMENT: 'Fixação',
    ANALOGY: 'Analogia',
    CLOSING_APPLICATION: 'Aplicação prática',
  };

  useEffect(() => {
    try {
      localStorage.setItem('guidedLessonStudyView', studyView);
    } catch {
      // Keep the selected view for this session if storage is unavailable.
    }
  }, [studyView]);

  useEffect(() => {
    // Check if current lesson is already saved
    try {
      const saved = localStorage.getItem('saved_guided_lessons');
      if (saved) {
        const parsed: SavedGuidedLesson[] = JSON.parse(saved);
        const exists = parsed.some((l) => l.topic === activeTopic && l.subject === activeSubject);
        setIsSaved(exists);
      }
    } catch (e) {
      console.error('Error loading saved guided lessons:', e);
    }
  }, [activeTopic, activeSubject]);

  const toggleSaveLesson = () => {
    if (!lesson) return;

    try {
      const saved = localStorage.getItem('saved_guided_lessons');
      let parsed: SavedGuidedLesson[] = [];

      try {
        parsed = saved ? JSON.parse(saved) : [];
      } catch (e) {
        console.error('Malformed saved_guided_lessons in localStorage, resetting.');
        parsed = [];
      }

      if (isSaved) {
        // Remove
        parsed = parsed.filter((l) => !(l.topic === activeTopic && l.subject === activeSubject));
        setIsSaved(false);
      } else {
        // Add
        const newSaved: SavedGuidedLesson = {
          id: Math.random().toString(36).substr(2, 9),
          subject: activeSubject,
          topic: activeTopic,
          lesson: { ...lesson, subject: activeSubject }, // Include subject in lesson object too
          savedAt: Date.now(),
        };
        parsed.push(newSaved);
        setIsSaved(true);
      }

      localStorage.setItem('saved_guided_lessons', JSON.stringify(parsed));
    } catch (e) {
      console.error('Failed to toggle save lesson:', e);
      alert('Não foi possível salvar a aula localmente (espaço insuficiente ou erro de sistema).');
    }
  };

  const downloadPDF = () => {
    if (!lesson) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let yPosition = 30;

    // Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(`Aula Guiada: ${activeTopic}`, margin, yPosition);
    yPosition += 10;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`Assunto: ${activeSubject}`, margin, yPosition);
    yPosition += 20;

    // Content
    lesson.steps.forEach((step, index) => {
      doc.setFontSize(12);

      // Handle page overflow
      if (yPosition > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        yPosition = 20;
      }

      const typeLabel = step.type === 'CONCEPT' ? 'CONCEITO: ' : step.type === 'ANALOGY' ? 'ANALOGIA: ' : step.type === 'REINFORCEMENT' ? 'REFORÇO: ' : '';

      if (typeLabel) {
        doc.setFont('helvetica', 'bold');
        doc.text(typeLabel, margin, yPosition);
        yPosition += 7;
      }

      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(step.content, maxWidth);
      doc.text(lines, margin, yPosition);
      yPosition += lines.length * 7 + 10;
    });

    // Save PDF
    doc.save(`Aula_Guiada_${activeTopic.replace(/\s+/g, '_')}.pdf`);
  };

  const startLesson = (s: string, t: string) => {
    setCurrentStepIndex(0);
    setDisplayedSteps([]);
    lastPushedStepIndexRef.current = -1;
    setActiveSubject(s);
    setActiveTopic(t);
  };

  // Pulled out of the effect so the "Tentar Novamente" button can re-run the
  // exact same fetch in place — it used to just call onBack, which bounced
  // the user all the way out to the Hub instead of retrying the lesson.
  const fetchLesson = async (s: string, t: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await generateGuidedLesson(s, t, profile, explanationStyle);
      setLesson(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar a aula guiada.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialLesson || !activeSubject || !activeTopic) return;
    fetchLesson(activeSubject, activeTopic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubject, activeTopic, profile, explanationStyle, initialLesson]);

  useEffect(() => {
    if (!lesson || isPaused || studyView !== 'immersive') return;

    if (currentStepIndex < lesson.steps.length) {
      const step = lesson.steps[currentStepIndex];

      // Only append a step the first time we reach this index. Without this guard,
      // toggling isPaused (e.g. clicking Resume) re-runs this effect for the SAME
      // currentStepIndex and would push the current paragraph again, duplicating it.
      if (lastPushedStepIndexRef.current !== currentStepIndex) {
        setDisplayedSteps((prev) => [...prev, step]);
        lastPushedStepIndexRef.current = currentStepIndex;
      }

      const words = step.content.split(' ').length;
      const baseDelay = Math.max(words * 120 + 2500, 4000); // TDAH friendly delay
      const typePause = step.type === 'QUESTION_PAUSE' ? 4000 : 1500;

      const timer = setTimeout(() => {
        if (!isPaused) {
          setCurrentStepIndex((prev) => prev + 1);
        }
      }, baseDelay + typePause);

      return () => clearTimeout(timer);
    }
  }, [currentStepIndex, lesson, isPaused, studyView]);

  useEffect(() => {
    if (studyView === 'immersive' && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [displayedSteps, studyView]);

  const getKeyPoints = (step: GuidedLessonStep) => {
    const exactPoints = (step.keyPoints || []).filter((point) => typeof point === 'string' && point.trim() && step.content.includes(point));
    if (exactPoints.length) return exactPoints;

    // Older offline lessons predate keyPoints. For those, underline the first
    // complete sentence in concept, reinforcement, and application steps.
    if (['CONCEPT', 'REINFORCEMENT', 'CLOSING_APPLICATION'].includes(step.type)) {
      const firstSentence = step.content.match(/[^.!?]+[.!?]?/)?.[0]?.trim();
      return firstSentence ? [firstSentence] : [];
    }
    return [];
  };

  const renderStepContent = (step: GuidedLessonStep) => {
    const ranges: Array<{ start: number; end: number }> = [];
    const source = step.content.toLocaleLowerCase();
    for (const point of getKeyPoints(step).sort((a, b) => b.length - a.length)) {
      const needle = point.toLocaleLowerCase();
      let offset = 0;
      while (needle && offset < source.length) {
        const start = source.indexOf(needle, offset);
        if (start < 0) break;
        const end = start + needle.length;
        if (!ranges.some((range) => start < range.end && end > range.start)) ranges.push({ start, end });
        offset = end;
      }
    }

    if (!ranges.length) return step.content;
    ranges.sort((a, b) => a.start - b.start);
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    ranges.forEach(({ start, end }, index) => {
      if (start > cursor) parts.push(step.content.slice(cursor, start));
      parts.push(<span key={`${step.type}-key-${index}`} className="guided-key-point" data-key-point="true">{step.content.slice(start, end)}</span>);
      cursor = end;
    });
    if (cursor < step.content.length) parts.push(step.content.slice(cursor));
    return parts;
  };

  useEffect(() => {
    if (studyView !== 'highlights' || !highlightViewRef.current) return;
    const highlights = highlightViewRef.current.querySelectorAll<HTMLElement>('[data-key-point="true"]');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(highlights, { textDecorationColor: '#e86c32' });
      return;
    }
    const context = gsap.context(() => {
      gsap.fromTo(highlights, { textDecorationColor: 'transparent' }, {
        textDecorationColor: '#e86c32',
        duration: 0.7,
        stagger: 0.18,
        ease: 'power2.out',
      });
    }, highlightViewRef);
    return () => context.revert();
  }, [studyView, lesson]);

  if (!activeSubject || !activeTopic) {
    return (
      <div className="absolute inset-0 z-[200] overflow-y-auto bg-[#f7f3ed] p-4 sm:p-6 md:p-8 text-[#473c33]">
        <div className="mx-auto flex min-h-full w-full max-w-5xl items-center justify-center">
          <section className="w-full overflow-hidden rounded-[32px] border border-[#e9e0d4] bg-white shadow-[0_18px_48px_rgba(71,60,51,0.14)]">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#eee6d6] px-5 py-4 sm:px-7">
              <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#8f8375] transition-colors hover:bg-[#f7f3ed] hover:text-[#473c33]">
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </button>
              <div className="flex items-center gap-2 rounded-full bg-[#fff6e8] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#d88b2f]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#f5b84b]" />
                Aula direta
              </div>
            </header>

            <div className="grid lg:grid-cols-[1.02fr_0.98fr]">
              <div className="bg-[#473c33] px-6 py-8 sm:px-10 sm:py-12 text-white">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fecc73] text-[#473c33] shadow-lg shadow-black/10">
                  <BookOpen className="h-6 w-6" />
                </div>
                <p className="mt-8 text-[10px] font-black uppercase tracking-[0.3em] text-[#fed386]">Aprendizado guiado</p>
                <h1 className="mt-3 max-w-md text-3xl font-black uppercase leading-[0.98] tracking-tight sm:text-4xl">Sobre o que vamos aprender?</h1>
                <p className="mt-5 max-w-md text-sm font-medium leading-relaxed text-[#e7ddd1]">Escolha uma matéria e um assunto. A IA organiza uma explicação contínua, com exemplos e pausas para você acompanhar no seu ritmo.</p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#fed386]">01</p>
                    <p className="mt-2 text-sm font-bold text-white">Defina o tema</p>
                    <p className="mt-1 text-xs text-[#c8bbaa]">Comece pelo conteúdo que quer entender.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#fed386]">02</p>
                    <p className="mt-2 text-sm font-bold text-white">Acompanhe a aula</p>
                    <p className="mt-1 text-xs text-[#c8bbaa]">Avance e pause quando precisar.</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-8 sm:px-10 sm:py-12">
                <div className="mb-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#a79c8e]">Vamos começar</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-[#473c33]">Defina sua próxima aula</h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-[#8f8375]">Use termos específicos para receber uma explicação mais precisa.</p>
                </div>

                <div className="space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-[#725442]">Matéria</span>
                    <input
                      value={setupSubject}
                      onChange={(e) => setSetupSubject(e.target.value)}
                      placeholder="Ex.: Direito Constitucional"
                      autoFocus
                      className="w-full rounded-2xl border border-[#e3d9ca] bg-[#fdfbf7] px-4 py-4 text-sm font-semibold text-[#473c33] outline-none transition-all placeholder:text-[#b7ac9e] focus:border-[#f5b84b] focus:ring-4 focus:ring-[#f5b84b]/15"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-[#725442]">Assunto</span>
                    <input
                      value={setupTopic}
                      onChange={(e) => setSetupTopic(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && setupSubject.trim() && setupTopic.trim() && startLesson(setupSubject.trim(), setupTopic.trim())}
                      placeholder="Ex.: Legítima defesa"
                      className="w-full rounded-2xl border border-[#e3d9ca] bg-[#fdfbf7] px-4 py-4 text-sm font-semibold text-[#473c33] outline-none transition-all placeholder:text-[#b7ac9e] focus:border-[#f5b84b] focus:ring-4 focus:ring-[#f5b84b]/15"
                    />
                  </label>
                </div>

                <button
                  onClick={() => startLesson(setupSubject.trim(), setupTopic.trim())}
                  disabled={!setupSubject.trim() || !setupTopic.trim()}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#473c33] px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_20px_rgba(71,60,51,0.18)] transition-all hover:bg-[#5a493f] disabled:cursor-not-allowed disabled:bg-[#d9d0c4] disabled:text-[#a79c8e] disabled:shadow-none"
                >
                  Começar aula
                  <ChevronRight className="h-4 w-4" />
                </button>
                <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-wider text-[#b7ac9e]">Pressione Enter no assunto para continuar</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div className="absolute inset-0 z-[200] bg-[#473c33] p-3 sm:p-5 md:p-7 overflow-hidden">
        <div className="relative h-full w-full max-w-6xl mx-auto overflow-hidden rounded-[28px] border border-white/10 shadow-2xl flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
          <BookLoader className="scale-[2.4] sm:scale-[3]" />
          <div className="text-center px-6 mt-4">
            <p className="text-white font-black text-xl tracking-tight drop-shadow-md">Preparando aula sobre {activeTopic}...</p>
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.22em] leading-relaxed mt-2">A IA está organizando uma trilha de estudo para você</p>
          </div>
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 p-4 sm:p-5 bg-[#473c33]/55 backdrop-blur-md border-b border-white/10">
            <button onClick={onBack} className="shrink-0 p-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all" aria-label="Cancelar preparação da aula" title="Voltar">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#fed386]">AULA GUIADA</p>
              <h1 className="mt-1 text-sm sm:text-base font-black text-white truncate" title={activeTopic}>{activeTopic}</h1>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0 text-[9px] font-black uppercase tracking-widest text-white/60">
              <span className="w-2 h-2 rounded-full bg-[#fecc73] animate-pulse" />
              Preparando
            </div>
          </div>
        </div>
      </div>
    );

  if (error) {
    return (
      <div className="absolute inset-0 z-[200] bg-[#473c33] flex flex-col items-center justify-center p-4 sm:p-8 text-center h-full space-y-4 overflow-y-auto">
        <div className="bg-red-900/20 p-8 rounded-[40px] border border-red-500/30 max-w-md backdrop-blur-xl">
          <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <RotateCcw className="w-8 h-8 text-white" />
          </div>
          <p className="text-red-200 font-bold mb-8 text-lg">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => fetchLesson(activeSubject, activeTopic)} className="flex items-center gap-3 bg-white text-[#473c33] px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-xl">
              <RotateCcw className="w-5 h-5" /> Tentar Novamente
            </button>
            <button onClick={onBack} className="flex items-center gap-3 bg-white/10 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-white/20 transition-all">
              <ChevronLeft className="w-5 h-5" /> Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const lessonSteps = lesson?.steps || [];
  const lessonProgress = lessonSteps.length
    ? studyView === 'highlights'
      ? highlightProgress
      : (currentStepIndex / lessonSteps.length) * 100
    : 0;

  return (
    <div className="absolute inset-0 z-[200] flex flex-col h-full bg-[#473c33] text-slate-100 font-sans selection:bg-[#fecc73]/30 overflow-hidden">
      {/* Header Imersivo */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 bg-[#473c33]/40 px-3 py-2 backdrop-blur-2xl sm:flex-nowrap sm:px-5 sm:py-3">
        <button onClick={onBack} className="group shrink-0 rounded-xl p-2 transition-colors hover:bg-white/10 active:scale-95" aria-label="Voltar">
          <ChevronLeft className="h-5 w-5 text-white/60 group-hover:text-white" />
        </button>
        <div className="order-3 flex w-full min-w-0 flex-none items-center justify-center gap-3 sm:order-none sm:w-auto sm:flex-1">
          <div className="min-w-0 text-center sm:text-left">
            <div className="mb-0.5 flex items-center justify-center gap-2 sm:justify-start">
              <span className={`h-2 w-2 rounded-full bg-[#fecc73] ${studyView === 'immersive' ? 'animate-pulse' : ''}`}></span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#fed386] sm:text-[10px] sm:tracking-[0.3em]">{studyView === 'immersive' ? 'IMERSÃO ATIVA' : 'PONTOS-CHAVE'}</span>
            </div>
            <h1 className="max-w-full truncate text-xs font-black uppercase tracking-tight text-white sm:text-sm">{activeSubject} • {activeTopic}</h1>
          </div>
          <div className="inline-flex shrink-0 rounded-xl border border-white/10 bg-black/10 p-0.5" role="group" aria-label="Visualização da aula">
            <button type="button" aria-pressed={studyView === 'immersive'} onClick={() => setStudyView('immersive')} className={`rounded-lg px-2.5 py-1.5 text-[8px] font-black uppercase tracking-wider transition-colors sm:px-3 sm:text-[9px] ${studyView === 'immersive' ? 'bg-[#fecc73] text-[#473c33]' : 'text-white/70 hover:text-white'}`}>Imersão</button>
            <button type="button" aria-pressed={studyView === 'highlights'} onClick={() => setStudyView('highlights')} className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[8px] font-black uppercase tracking-wider transition-colors sm:px-3 sm:text-[9px] ${studyView === 'highlights' ? 'bg-[#fecc73] text-[#473c33]' : 'text-white/70 hover:text-white'}`}><BookOpen className="h-3 w-3" /> Destaques</button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button onClick={toggleSaveLesson} className={`rounded-xl p-2 transition-all active:scale-90 ${isSaved ? 'bg-[#fecc73] text-white' : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/20'}`} title={isSaved ? 'Salvo no App' : 'Salvar no App (Offline)'} aria-label={isSaved ? 'Aula salva' : 'Salvar aula'}>
            {isSaved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
          </button>
          <button onClick={downloadPDF} className="rounded-xl bg-white/10 p-2 text-white/60 transition-all hover:bg-white/20 hover:text-white active:scale-90" title="Baixar em PDF" aria-label="Baixar aula em PDF">
            <Download className="h-5 w-5" />
          </button>
          {studyView === 'immersive' && <button onClick={() => setIsPaused(!isPaused)} aria-label={isPaused ? 'Retomar aula automática' : 'Pausar aula automática'} title={isPaused ? 'Retomar aula' : 'Pausar aula'} className={`rounded-xl p-2 transition-all shadow-xl active:scale-90 ${isPaused ? 'bg-[#fdad74] text-white animate-pulse' : 'bg-white/10 text-white/60 hover:text-white'}`}>
            {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>}
        </div>
      </header>

      {studyView === 'immersive' ? <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-20 space-y-20 scrollbar-none" style={{ scrollBehavior: 'smooth' }}>
        <AnimatePresence initial={false}>
          {displayedSteps.map((step, idx) => (
            <motion.div key={`${step.type}-${idx}`} initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className={`max-w-2xl mx-auto relative ${step.type === 'QUESTION_PAUSE' ? 'bg-[#fecc73]/5 border-2 border-[#fecc73]/20 p-10 rounded-[40px] shadow-2xl' : step.type === 'ANALOGY' ? 'bg-[#fdad74]/5 border-2 border-[#fdad74]/20 p-10 rounded-[40px] shadow-2xl shadow-[#ac4800]/20' : ''}`}>
              {step.type === 'QUESTION_PAUSE' && (
                <div className="absolute -top-4 left-10 bg-[#fec868] text-white px-4 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg">
                  <Brain className="w-4 h-4" /> MOMENTO DE REFLEXÃO
                </div>
              )}
              {step.type === 'ANALOGY' && (
                <div className="absolute -top-4 left-10 bg-[#fda769] text-white px-4 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg">
                  <RotateCcw className="w-4 h-4" /> BIZU DE MEMÓRIA
                </div>
              )}

              <p
                className={`
 ${step.type === 'OPENING' ? 'text-4xl font-black leading-none text-white tracking-tighter' : ''}
 ${step.type === 'OVERVIEW' ? 'text-2xl font-bold text-slate-400 leading-tight' : ''}
 ${step.type === 'QUESTION_PAUSE' ? 'text-2xl font-black text-[#fff0d5] ' : ''}
 ${step.type === 'CONCEPT' ? 'text-xl leading-relaxed text-slate-200 border-l-4 border-[#fecc73]/30 pl-8' : ''}
 ${step.type === 'REINFORCEMENT' ? 'text-2xl font-black text-[#bcce8d] uppercase ' : ''}
 ${!['OPENING', 'OVERVIEW', 'QUESTION_PAUSE', 'CONCEPT', 'REINFORCEMENT'].includes(step.type) ? 'text-xl leading-relaxed text-slate-300' : ''}
 `}
              >
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
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex gap-2"
            >
              <div className="w-3 h-3 bg-[#fecc73] rounded-full shadow-lg shadow-[#fecc73]/50" />
              <div className="w-3 h-3 bg-[#fecc73] rounded-full shadow-lg shadow-[#fecc73]/50" />
              <div className="w-3 h-3 bg-[#fecc73] rounded-full shadow-lg shadow-[#fecc73]/50" />
            </motion.div>
          </div>
        )}

        {currentStepIndex === (lesson?.steps.length || 0) && (
          <motion.div initial={{ opacity: 0, scale: 0.8, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="max-w-sm mx-auto text-center space-y-8 pt-20 pb-32">
            <div className="w-24 h-24 bg-[#b1c77b]/10 border-4 border-[#b1c77b]/30 p-4 rounded-full mx-auto flex items-center justify-center shadow-2xl shadow-[#596b2a]/20">
              <CheckCircle2 className="w-12 h-12 text-[#b1c77b]" />
            </div>
            <div>
              <h3 className="text-4xl font-black uppercase tracking-tighter leading-none mb-4">Ciclo de Explicação Concluído</h3>
              <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Você concluiu esta jornada de aprendizado.</p>
            </div>
            <button
              onClick={() => onComplete(5)} // Give a small reward for completion
              className="w-full bg-[#fec868] hover:bg-[#fecc73] text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-4 transition-all hover:scale-105 active:scale-95 group"
            >
              CONCLUIR AULA <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </button>
          </motion.div>
        )}
      </div> : (
        <main ref={highlightViewRef} className="guided-highlight-view min-h-0 flex-1 overflow-y-auto bg-[#f5efe5] px-4 py-6 text-[#473c33] sm:px-8 sm:py-10" onScroll={(event) => {
          const element = event.currentTarget;
          const available = element.scrollHeight - element.clientHeight;
          setHighlightProgress(available > 0 ? (element.scrollTop / available) * 100 : 100);
        }}>
          <div className="mx-auto max-w-5xl">
            <div className="guided-highlight-intro mb-6 rounded-3xl border border-[#e5d9c8] bg-white p-5 shadow-[0_8px_24px_rgba(71,60,51,0.07)] sm:mb-8 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#bd5628]">Resumo visual da aula</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-[#473c33] sm:text-3xl">Pontos importantes</h2>
                  <p className="guided-highlight-description mt-2 max-w-2xl text-sm leading-relaxed text-[#76695b] sm:text-base">Acompanhe a explicação completa. Os trechos sublinhados marcam conceitos, regras e ideias para guardar.</p>
                </div>
                <span className="guided-highlight-count rounded-full border border-[#efdbb9] bg-[#fff6e7] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#80531b]">{lessonSteps.length} etapas</span>
              </div>
            </div>

            <div className="space-y-4 sm:space-y-5">
              {lessonSteps.map((step, index) => (
                <article key={`${step.type}-${index}`} className={`guided-highlight-card rounded-3xl border p-5 shadow-[0_5px_16px_rgba(71,60,51,0.06)] sm:p-7 ${step.type === 'QUESTION_PAUSE' ? 'border-[#ead5a9] bg-[#fff8e9]' : step.type === 'ANALOGY' ? 'border-[#edc9b3] bg-[#fff4ed]' : 'border-[#e6ddcf] bg-white'}`}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="guided-highlight-badge flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f4ecdf] text-xs font-black text-[#80531b]">{String(index + 1).padStart(2, '0')}</span>
                    <div className="min-w-0">
                      <p className="guided-highlight-label text-[10px] font-black uppercase tracking-[0.22em] text-[#b64f26]">{stepLabels[step.type] || 'Explicação'}</p>
                      {getKeyPoints(step).length > 0 && <p className="guided-highlight-description mt-1 text-[9px] font-bold uppercase tracking-wider text-[#867968]">{getKeyPoints(step).length} {getKeyPoints(step).length === 1 ? 'ponto-chave' : 'pontos-chave'}</p>}
                    </div>
                  </div>
                  <p className={`guided-highlight-copy whitespace-pre-line leading-[1.8] text-[#40372f] ${step.type === 'OPENING' ? 'text-xl font-bold sm:text-2xl' : step.type === 'CONCEPT' || step.type === 'REINFORCEMENT' ? 'text-lg font-medium sm:text-xl' : 'text-base sm:text-lg'}`}>
                    {renderStepContent(step)}
                  </p>
                </article>
              ))}
            </div>

            <div className="guided-highlight-finish my-8 flex flex-col items-center gap-4 rounded-3xl border border-[#cfddb5] bg-[#f1f6e9] px-6 py-8 text-center sm:my-10">
              <CheckCircle2 className="h-10 w-10 text-[#718c49]" />
              <div>
                <h3 className="text-lg font-black text-[#354326]">Fim da explicação</h3>
                <p className="mt-1 text-sm text-[#62734b]">Revise os trechos sublinhados antes de encerrar a aula.</p>
              </div>
              <button type="button" onClick={() => onComplete(5)} className="inline-flex items-center gap-2 rounded-2xl bg-[#b1c77b] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#303b1c] shadow-lg transition hover:brightness-105">Concluir aula <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </main>
      )}

      {/* Indicador de Progresso Inferior */}
      <div className="border-t border-white/5 bg-[#473c33]/60 px-5 py-3 backdrop-blur-2xl sm:px-6">
        <div className="mx-auto max-w-2xl space-y-2">
          <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
            <span>{studyView === 'immersive' ? 'PROGRESSO DA JORNADA' : 'LEITURA DOS PONTOS-CHAVE'}</span>
            <span className="text-[#fecc73]">{Math.round(lessonProgress)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full border border-white/5 bg-white/5 p-px">
            <motion.div
              className="h-full bg-gradient-to-r from-[#fec868] to-[#fec868] rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)]"
              initial={{ width: 0 }}
              animate={{
                width: `${lessonProgress}%`,
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedLessonView;
