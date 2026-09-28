import React, { useState, useEffect } from 'react';
import { AppView, TimerMode, UserStats, HubCategory, EditalConfig, SmartRevisionItem, StudyProfile, QuizAttempt, QuizFolder, SmartRevisionSystem } from '../types';
import MemoryHeatmap from './MemoryHeatmap';
import { getProactiveAdvice } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, BarChart3, Bookmark, ClipboardList, Zap, FileText, Smile, Heart, Cloud, ArrowRight, PenLine, RotateCcw, Copy, Briefcase, Folder, Clock, Calendar, Bell, AlertTriangle, Scale, Search } from './icons';
import MotivationView from './MotivationView';
import PerformanceView from './PerformanceView';

interface HubProps {
  setView: (view: AppView) => void;
  setTimerMode: (mode: TimerMode) => void;
  flashcardCount: number;
  stats: UserStats;
  activeChannel: 'RELAX' | 'MPB' | null;
  setActiveChannel: (ch: 'RELAX' | 'MPB' | null) => void;
  isPlayingRain: boolean;
  setIsPlayingRain: (p: boolean) => void;
  editalConfig: EditalConfig;
  setStrategicMode: (s: boolean) => void;
  setGuidedLessonData: (data: { subject: string; topic: string }) => void;
  smartRevisionItems: SmartRevisionItem[];
  isAIEnabled: boolean;
  user: any; // FirebaseUser
  onLogin: () => void;
  isSyncing: boolean;
  attempts: QuizAttempt[];
  folders: QuizFolder[];
  smartSystem: SmartRevisionSystem;
  isAdmin?: boolean;
}

const Hub: React.FC<HubProps> = ({ setView, setTimerMode, flashcardCount, stats, activeChannel, setActiveChannel, isPlayingRain, setIsPlayingRain, editalConfig, setStrategicMode, setGuidedLessonData, smartRevisionItems, isAIEnabled, isSyncing, attempts, folders, smartSystem, isAdmin }) => {
  const [activeTab, setActiveTab] = useState<HubCategory>('ESTUDO');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Guided Lesson Input States
  const [guidedSubject, setGuidedSubject] = useState('');
  const [guidedTopic, setGuidedTopic] = useState('');

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const pendingRevisions = smartRevisionItems.filter((i) => i.status === 'PENDING').length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <nav aria-label="Navegação do painel" role="tablist" className="sticky top-3 z-20 flex w-full max-w-full gap-1 overflow-x-auto rounded-[24px] border border-[#e9e0d4] dark:border-white/[0.06] bg-white dark:bg-[#272019] p-2 shadow-[0_8px_22px_rgba(71,60,51,0.07)] dark:shadow-none no-scrollbar scroll-smooth">
        <button role="tab" aria-selected={activeTab === 'ESTUDO'} onClick={() => setActiveTab('ESTUDO')} className={`min-w-[118px] shrink-0 flex-1 whitespace-nowrap rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-wide transition-all ${activeTab === 'ESTUDO' ? 'bg-[#473c33] dark:bg-[#d9772b] text-white shadow-md dark:shadow-none' : 'text-[#8f8375] dark:text-[#a89680] hover:bg-[#f7f3ed] dark:hover:bg-[#3a2f22] hover:text-[#473c33] dark:hover:text-[#f4ebdd]'}`}>
          <BookOpen className="w-6 h-6" />
          ESTUDO
        </button>
        <button role="tab" aria-selected={activeTab === 'EDITAL'} onClick={() => setActiveTab('EDITAL')} className={`min-w-[118px] shrink-0 flex-1 whitespace-nowrap rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-wide transition-all ${activeTab === 'EDITAL' ? 'bg-[#473c33] dark:bg-[#d9772b] text-white shadow-md dark:shadow-none' : 'text-[#8f8375] dark:text-[#a89680] hover:bg-[#f7f3ed] dark:hover:bg-[#3a2f22] hover:text-[#473c33] dark:hover:text-[#f4ebdd]'}`}>
          <FileText className="w-6 h-6" />
          {stats.studyProfile === 'FACULDADE' ? 'GRADE CURRICULAR' : 'EDITAL'}
        </button>
        <button role="tab" aria-selected={activeTab === 'ORGANIZACAO'} onClick={() => setActiveTab('ORGANIZACAO')} className={`min-w-[138px] shrink-0 flex-1 whitespace-nowrap rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-wide transition-all ${activeTab === 'ORGANIZACAO' ? 'bg-[#473c33] dark:bg-[#d9772b] text-white shadow-md dark:shadow-none' : 'text-[#8f8375] dark:text-[#a89680] hover:bg-[#f7f3ed] dark:hover:bg-[#3a2f22] hover:text-[#473c33] dark:hover:text-[#f4ebdd]'}`}>
          <ClipboardList className="w-6 h-6" />
          ORGANIZAÇÃO
        </button>
        <button role="tab" aria-selected={activeTab === 'RELAXE'} onClick={() => setActiveTab('RELAXE')} className={`min-w-[112px] shrink-0 flex-1 whitespace-nowrap rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-wide transition-all ${activeTab === 'RELAXE' ? 'bg-[#473c33] dark:bg-[#d9772b] text-white shadow-md dark:shadow-none' : 'text-[#8f8375] dark:text-[#a89680] hover:bg-[#f7f3ed] dark:hover:bg-[#3a2f22] hover:text-[#473c33] dark:hover:text-[#f4ebdd]'}`}>
          <Smile className="w-6 h-6" />
          RELAXE
        </button>
        <button role="tab" aria-selected={activeTab === 'REVISAO'} onClick={() => setActiveTab('REVISAO')} className={`min-w-[128px] shrink-0 flex-1 whitespace-nowrap rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-wide transition-all ${activeTab === 'REVISAO' ? 'bg-[#473c33] dark:bg-[#d9772b] text-white shadow-md dark:shadow-none' : 'text-[#8f8375] dark:text-[#a89680] hover:bg-[#f7f3ed] dark:hover:bg-[#3a2f22] hover:text-[#473c33] dark:hover:text-[#f4ebdd]'}`}>
          <Zap className="w-6 h-6" />
          REVISÃO IA
        </button>
        <button role="tab" aria-selected={activeTab === 'MOTIVACAO'} onClick={() => setActiveTab('MOTIVACAO')} className={`min-w-[126px] shrink-0 flex-1 whitespace-nowrap rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-wide transition-all ${activeTab === 'MOTIVACAO' ? 'bg-[#473c33] dark:bg-[#d9772b] text-white shadow-md dark:shadow-none' : 'text-[#8f8375] dark:text-[#a89680] hover:bg-[#f7f3ed] dark:hover:bg-[#3a2f22] hover:text-[#473c33] dark:hover:text-[#f4ebdd]'}`}>
          <Heart className="w-6 h-6" />
          MOTIVAÇÃO
        </button>
        <button onClick={() => setView('PERFORMANCE')} className="min-w-[130px] shrink-0 flex-1 whitespace-nowrap rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-wide text-[#8f8375] transition-all hover:bg-[#f7f3ed] hover:text-[#473c33]">
          <BarChart3 className="w-6 h-6" />
          DESEMPENHO
        </button>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[400px]">
        {(activeTab === 'ESTUDO' || activeTab === 'EDITAL') && (
          <>
            {pendingRevisions > 0 && (
              <div className="lg:col-span-3">
                <button onClick={() => setView('SMART_REVISION')} className="w-full bg-gradient-to-r from-[#ffb22a] via-[#ec9700] to-[#473c33] p-1 text-white rounded-[40px] group transition-all hover:scale-[1.01] active:scale-95 shadow-2xl relative overflow-hidden">
                  <div className="bg-[#473c33] rounded-[38px] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-[#fec868] rounded-3xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                        <Zap className="w-10 h-10" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-logo text-2xl uppercase leading-tight">VALIDAÇÃO DE ONTEM</h3>
                        <p className="text-[#fed386] font-bold text-xs uppercase tracking-widest mt-1">Você tem {pendingRevisions} temas para validar hoje</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 bg-[#fec868] text-white px-8 py-4 rounded-[25px] font-black uppercase tracking-widest group-hover:bg-white group-hover:text-[#fec868] transition-all">
                      COMEÇAR AGORA
                      <ArrowRight className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Background glow effects */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#fec868]/20 blur-[100px] -mr-32 -mt-32"></div>
                </button>
              </div>
            )}

            {/* Edital-only Strategic Entry if not active */}
            {activeTab === 'EDITAL' && !editalConfig.isActive && (
              <div className="lg:col-span-3">
                <button onClick={() => setView('EDITAL_SETUP')} className="w-full bg-[#473c33] text-white p-8 rounded-[35px] text-left relative overflow-hidden group transition-all hover:scale-[1.01] hover:shadow-2xl animate-in zoom-in-95 duration-300">
                  <div className="absolute top-0 right-0 p-8 text-black/10 scale-150 rotate-12 transition-transform group-hover:scale-[1.8] group-hover:rotate-0">
                    <Zap className="w-48 h-48" fill="currentColor" />
                  </div>
                  <div className="max-w-2xl relative z-10">
                    <div className="mb-10 w-16 h-16 bg-white/10 text-[#fed386] rounded-3xl flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner group-hover:bg-[#fecc73] group-hover:text-white transition-all">
                      <FileText className="w-10 h-10" />
                    </div>
                    {stats.studyProfile === 'FACULDADE' ? (
                      <>
                        <h2 className="font-logo text-4xl mb-4 uppercase leading-none">
                          ATIVAR GRADE <span className="text-[#fecc73] group-hover:text-white transition-colors">curricular</span>
                        </h2>
                        <p className="text-gray-400 dark:text-[#7d6f5c] font-medium text-lg leading-relaxed mb-10 max-w-lg">Conecte o conteúdo das suas disciplinas e o período acadêmico atual às funções de IA do app.</p>
                        <div className="inline-flex items-center gap-4 bg-[#fec868] text-white px-8 py-4 rounded-[25px] font-black uppercase tracking-widest shadow-2xl group-hover:bg-white group-hover:text-[#fec868] transition-all">
                          CONFIGURAR MINHA GRADE AGORA
                          <ArrowRight className="w-6 h-6" />
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 className="font-logo text-4xl mb-4 uppercase leading-none">
                          ATIVAR MODO <span className="text-[#fecc73] group-hover:text-white transition-colors">edital</span>
                        </h2>
                        <p className="text-gray-400 dark:text-[#7d6f5c] font-medium text-lg leading-relaxed mb-10 max-w-lg">Conecte seu conteúdo programático diretamente às funções de IA do app.</p>
                        <div className="inline-flex items-center gap-4 bg-[#fec868] text-white px-8 py-4 rounded-[25px] font-black uppercase tracking-widest shadow-2xl group-hover:bg-white group-hover:text-[#fec868] transition-all">
                          CONFIGURAR MEU EDITAL AGORA
                          <ArrowRight className="w-6 h-6" />
                        </div>
                      </>
                    )}
                  </div>
                </button>
              </div>
            )}

            {(activeTab === 'ESTUDO' || (activeTab === 'EDITAL' && editalConfig.isActive)) && (
              <>
                {activeTab === 'EDITAL' && editalConfig.isActive && (
                  <div className="lg:col-span-3">
                    <button onClick={() => setView('EDITAL_VIEW')} className="w-full bg-[#473c33] text-white p-6 rounded-[30px] flex items-center justify-between group transition-all hover:scale-[1.01] hover:shadow-2xl border-2 border-[#fec868]/30">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-[#fec868] rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <PenLine className="w-8 h-8" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-logo text-2xl uppercase">{stats.studyProfile === 'FACULDADE' ? 'MINHA GRADE CURRICULAR - VISUALIZAR E EDITAR' : 'MEU EDITAL - VISUALIZAR E EDITAR'}</h3>
                          <p className="text-[#fed386] font-bold text-[10px] uppercase tracking-widest mt-1">{stats.studyProfile === 'FACULDADE' ? 'Gerencie as disciplinas e o progresso do seu período' : 'Gerencie seu conteúdo programático e progresso verticalizado'}</p>
                        </div>
                      </div>
                      <div className="bg-[#fec868] text-white p-4 rounded-2xl group-hover:bg-white group-hover:text-[#fec868] transition-all">
                        <ArrowRight className="w-6 h-6" />
                      </div>
                    </button>
                  </div>
                )}

                {editalConfig.isActive && (
                  <div className="lg:col-span-3">
                    <button onClick={() => setView('STUDY_CYCLE')} className="w-full bg-gradient-to-r from-[#fecc73] to-[#ffb22a] text-white p-6 rounded-[30px] flex items-center justify-between group transition-all hover:scale-[1.01] hover:shadow-2xl shadow-[#ffe6b9]/60">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform backdrop-blur-md">
                          <RotateCcw className="w-8 h-8 font-black" />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <h3 className="font-logo text-2xl uppercase">MEU CICLO DE ESTUDO</h3>
                            <span className="bg-white/20 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border border-white/10">INTERLIGADO</span>
                          </div>
                          <p className="text-[#fff0d5] font-bold text-[10px] uppercase tracking-widest mt-1">{stats.studyProfile === 'FACULDADE' ? 'Intercale matérias automaticamente com base nos pesos da sua grade curricular' : 'Intercale matérias automaticamente com base nos pesos do seu edital'}</p>
                        </div>
                      </div>
                      <div className="bg-white text-[#fec868] p-4 rounded-2xl group-hover:bg-[#ec9700] group-hover:text-white transition-all shadow-lg">
                        <ArrowRight className="w-6 h-6" />
                      </div>
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (activeTab === 'EDITAL') setStrategicMode(true);
                    setView('FLASHCARDS');
                  }}
                  className={`p-6 rounded-[30px] text-left transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#473c33] text-white border-none' : 'bg-white dark:bg-[#272019] border border-gray-100 dark:border-white/[0.06] shadow-sm dark:shadow-none'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-[#fecc73] text-white' : 'bg-[#fff6e8] dark:bg-[#3a2f22] text-[#fec868] dark:text-[#d9772b]'}`}>
                    <Copy className="w-7 h-7" />
                  </div>
                  {activeTab === 'ESTUDO' && flashcardCount > 0 && <div className="absolute top-8 right-8 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-bounce">{flashcardCount} PENDENTES</div>}
                  <h2 className="font-logo text-2xl mb-2 uppercase">
                    FLASH<span className="text-[#fecc73]">cards</span>
                  </h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-[#fed386]' : 'text-gray-400 dark:text-[#7d6f5c]'}`}>{activeTab === 'EDITAL' ? (stats.studyProfile === 'FACULDADE' ? 'Conectado à Grade' : 'Conectado ao Edital') : 'Revisão Espaçada'}</p>
                </button>

                <button
                  onClick={() => {
                    if (activeTab === 'EDITAL') setStrategicMode(true);
                    setView('MATERIALS');
                  }}
                  className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#473c33] text-white border-transparent' : 'bg-white dark:bg-[#272019] border-gray-100 dark:border-white/[0.06] shadow-sm dark:shadow-none'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-[#fecc73] text-white' : 'bg-[#fff6e8] dark:bg-[#3a2f22] text-[#fec868] dark:text-[#d9772b]'}`}>
                    <Briefcase className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-2xl mb-2 uppercase">
                    MEUS <span className="text-[#fecc73]">materiais</span>
                  </h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-[#fed386]' : 'text-gray-400 dark:text-[#7d6f5c]'}`}>{activeTab === 'EDITAL' ? (stats.studyProfile === 'FACULDADE' ? 'Arquivo da Grade' : 'Arquivo Estratégico') : 'Resumos & Cadernos'}</p>
                </button>

                <button onClick={() => setView('DRIVE_READER')} className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#473c33] text-white border-transparent' : 'bg-gradient-to-br from-[#473c33] to-[#473c33] dark:from-[#d9772b] dark:to-[#d9772b] text-white shadow-xl dark:shadow-none border-0'}`}>
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-[#fecc73] text-white' : 'bg-[#fec868] text-white shadow-md'}`}>
                    <Folder className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-2xl mb-2 uppercase">
                    BIBLIOTECA <span className="text-[#fed386]">drive</span>
                  </h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-[#fed386]' : 'text-[#ffe6b9]'}`}>Livros & PDFs do Drive</p>
                </button>

                <button onClick={() => setView('VADE_MECUM')} className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#473c33] text-white border-transparent' : 'bg-white dark:bg-[#272019] border-gray-100 dark:border-white/[0.06] shadow-sm dark:shadow-none'}`}>
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-[#fdad74] text-white' : 'bg-[#fff1e8] text-[#fda769]'}`}>
                    <Scale className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-2xl mb-2 uppercase">
                    VADE <span className="text-[#fdad74]">MECUM</span>
                  </h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-[#fdb887]' : 'text-gray-400 dark:text-[#7d6f5c]'}`}>Legislação Atualizada</p>
                </button>

                <button onClick={() => setView('NOTES')} className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#473c33] text-white border-transparent' : 'bg-white dark:bg-[#272019] border-gray-100 dark:border-white/[0.06] shadow-sm dark:shadow-none'}`}>
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-[#fecc73] text-white' : 'bg-[#fff6e8] dark:bg-[#3a2f22] text-[#fec868] dark:text-[#d9772b]'}`}>
                    <PenLine className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-2xl mb-2 uppercase">
                    ANOTA<span className="text-[#fecc73]">ções</span>
                  </h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-[#fed386]' : 'text-gray-400 dark:text-[#7d6f5c]'}`}>Escreva à mão</p>
                </button>

                {isAdmin && (
                  <button onClick={() => setView('ADMIN_QUESTION_REVIEW')} className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#473c33] text-white border-transparent' : 'bg-white dark:bg-[#272019] border-gray-100 dark:border-white/[0.06] shadow-sm dark:shadow-none'}`}>
                    <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-[#b1c77b] text-white' : 'bg-[#f4f7ec] text-[#abc270]'}`}>
                      <ClipboardList className="w-7 h-7" />
                    </div>
                    <h2 className="font-logo text-2xl mb-2 uppercase">
                      REVISÃO <span className="text-[#b1c77b]">import.</span>
                    </h2>
                    <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-[#bcce8d]' : 'text-gray-400 dark:text-[#7d6f5c]'}`}>Banco de questões (admin)</p>
                  </button>
                )}

                <button
                  onClick={() => {
                    if (activeTab === 'EDITAL') setStrategicMode(true);
                    setView('TDH_QUESTOES');
                  }}
                  className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 delay-75 ${activeTab === 'EDITAL' ? 'bg-[#473c33] text-white border-transparent' : 'bg-white dark:bg-[#272019] border-gray-100 dark:border-white/[0.06] shadow-sm dark:shadow-none'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-[#fecc73] text-white' : 'bg-[#fff6e8] dark:bg-[#3a2f22] text-[#fec868] dark:text-[#d9772b]'}`}>
                    <FileText className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-2xl mb-2 relative z-10 uppercase">
                    TDH<span className="text-[#fecc73]">questoes</span>
                  </h2>
                  <p className={`text-sm mb-4 relative z-10 font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-[#fed386]' : 'text-gray-400 dark:text-[#7d6f5c]'}`}>{activeTab === 'EDITAL' ? (stats.studyProfile === 'FACULDADE' ? 'Foco na Grade' : 'Foco no Edital') : 'Batalha de Simulados'}</p>
                </button>

                <button onClick={() => setView('VR_METHOD')} className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 delay-75 ${activeTab === 'EDITAL' ? 'bg-[#473c33] text-white border-transparent' : 'bg-white dark:bg-[#272019] border-gray-100 dark:border-white/[0.06] shadow-sm dark:shadow-none'}`}>
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-[#fecc73] text-white' : 'bg-[#fff6e8] dark:bg-[#3a2f22] text-[#fec868] dark:text-[#d9772b]'}`}>
                    <Search className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-2xl mb-2 relative z-10 uppercase">
                    Método <span className="text-[#fecc73]">VR</span>
                  </h2>
                  <p className={`text-sm mb-4 relative z-10 font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-[#fed386]' : 'text-gray-400 dark:text-[#7d6f5c]'}`}>Aprenda desmontando cada questão e descobrindo como a banca cobra</p>
                </button>

                <button
                  onClick={() => {
                    if (activeTab === 'EDITAL') setStrategicMode(true);
                    setView('AI_DIRECT');
                  }}
                  className={`text-white p-6 rounded-[30px] text-left relative overflow-hidden group transition-all hover:scale-[1.02] hover:shadow-xl animate-in zoom-in-95 duration-300 delay-100 shadow-2xl dark:shadow-none ${activeTab === 'EDITAL' ? 'bg-gradient-to-br from-[#ac6e00] to-[#473c33]' : 'bg-gradient-to-br from-[#473c33] to-[#473c33] dark:from-[#2e2519] dark:to-[#2e2519] dark:border dark:border-white/[0.06]'}`}
                >
                  <div className="mb-8 w-12 h-12 bg-white/10 text-[#fed386] rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <Zap className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-3xl mb-2 uppercase leading-none">AULA DIRETA</h2>
                  <p className="text-[#fed386]/80 text-[10px] font-bold uppercase tracking-widest">{activeTab === 'EDITAL' ? (stats.studyProfile === 'FACULDADE' ? 'Conteúdo da Grade' : 'Conteúdo do Edital') : 'IA Powered Bizu'}</p>
                </button>

                <div className={`text-white p-6 rounded-[30px] text-left relative overflow-hidden group transition-all animate-in zoom-in-95 duration-300 delay-200 shadow-2xl dark:shadow-none ${activeTab === 'EDITAL' ? 'bg-gradient-to-br from-[#fec868] to-[#ec9700]' : 'bg-gradient-to-br from-[#473c33] to-[#473c33] dark:from-[#2e2519] dark:to-[#2e2519] dark:border dark:border-white/[0.06]'}`}>
                  <div className="mb-6 w-12 h-12 bg-white/10 text-[#fed386] rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10">
                    <BookOpen className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-3xl mb-2 uppercase leading-none">
                    AULA <span className="text-[#fecc73]">GUIADA</span>
                  </h2>
                  <p className="text-[#fed386]/80 text-[10px] font-bold uppercase tracking-widest mb-6">Narrativa Contínua (Active Recall)</p>

                  <div className="flex flex-col gap-2 relative z-10">
                    <input type="text" placeholder="Matéria (Ex: Português)" value={guidedSubject} onChange={(e) => setGuidedSubject(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fecc73] transition-all placeholder:text-white/30" />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Assunto (Ex: Crase)"
                        value={guidedTopic}
                        onChange={(e) => setGuidedTopic(e.target.value)}
                        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fecc73] transition-all placeholder:text-white/30"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (guidedSubject && guidedTopic) {
                              setGuidedLessonData({
                                subject: guidedSubject,
                                topic: guidedTopic,
                              });
                              setView('GUIDED_LESSON');
                            }
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (guidedSubject && guidedTopic) {
                            setGuidedLessonData({
                              subject: guidedSubject,
                              topic: guidedTopic,
                            });
                            setView('GUIDED_LESSON');
                          }
                        }}
                        className="bg-[#fecc73] hover:bg-[#fec868] text-white p-2 rounded-xl transition-all"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="absolute -right-4 -bottom-4 transition-opacity">
                    <BookOpen className="w-32 h-32 text-black/5 group-hover:text-black/10" />
                  </div>
                </div>

                <button onClick={() => setView('SAVED_GUIDED_LESSONS')} className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 delay-200 ${activeTab === 'EDITAL' ? 'bg-[#473c33] text-white border-transparent' : 'bg-white dark:bg-[#272019] border-[#fff0d5] dark:border-white/[0.06] shadow-sm dark:shadow-none'}`}>
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-[#fecc73] text-white' : 'bg-[#fff6e8] dark:bg-[#3a2f22] text-[#fec868] dark:text-[#d9772b]'}`}>
                    <Bookmark className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-2xl mb-2 uppercase">
                    AULAS <span className="text-[#fecc73]">salvas</span>
                  </h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-[#fed386]' : 'text-gray-400 dark:text-[#7d6f5c]'}`}>Biblioteca Offline</p>
                </button>

                <button
                  onClick={() => {
                    if (activeTab === 'EDITAL') setStrategicMode(true);
                    setView('DYNAMIC_TIMER');
                  }}
                  className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 delay-150 ${activeTab === 'EDITAL' ? 'bg-[#473c33] text-white border-transparent' : 'bg-white dark:bg-[#272019] border-[#fee6d5] dark:border-white/[0.06]'}`}
                >
                  <div className={`mb-6 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-[#fdad74] text-white' : 'bg-[#fff1e8] text-[#fdad74]'}`}>
                    <Clock className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-3xl mb-2 uppercase">
                    BLOCO <span className="text-[#fdad74]">IMUTÁVEL</span>
                  </h2>
                  <p className={`text-[10px] font-bold uppercase tracking-widest leading-tight ${activeTab === 'EDITAL' ? 'text-gray-400 dark:text-[#7d6f5c]' : 'text-gray-400 dark:text-[#7d6f5c]'}`}>{activeTab === 'EDITAL' ? 'Foco Estratégico' : 'Timer Dinâmico 40min'}</p>
                  <div className="mt-4 flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#fdb887]"></span>
                    <span className="w-2 h-2 rounded-full bg-[#fed386]"></span>
                    <span className="w-2 h-2 rounded-full bg-[#bcce8d]"></span>
                  </div>
                </button>

                {activeTab === 'EDITAL' && (
                  <div className="lg:col-span-3 pt-12 space-y-8">
                    <div className="flex justify-between items-center">
                      <h3 className="font-logo text-2xl uppercase">BARRA DE CALOR DA MEMÓRIA</h3>
                      <div className="flex gap-2">
                        <span className="flex items-center gap-1 text-[8px] font-black text-[#fecc73] uppercase tracking-widest">
                          <div className="w-2 h-2 rounded-full bg-[#fecc73]"></div> VALIDADO
                        </span>
                        <span className="flex items-center gap-1 text-[8px] font-black text-[#fdad74] uppercase tracking-widest">
                          <div className="w-2 h-2 rounded-full bg-[#fdad74]"></div> REVISAR
                        </span>
                      </div>
                    </div>
                    <MemoryHeatmap subjects={editalConfig.subjects} studyProfile={stats.studyProfile} />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'ORGANIZACAO' && (
          <>
            <button
              onClick={() => {
                setTimerMode(TimerMode.POMODORO);
                setView('TIMER');
              }}
              className="bg-white dark:bg-[#272019] p-6 rounded-[30px] text-left border border-gray-100 dark:border-white/[0.06] transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300"
            >
              <div className="mb-8 w-12 h-12 bg-[#fff6e8] text-[#fec868] rounded-2xl flex items-center justify-center">
                <Clock className="w-7 h-7" />
              </div>
              <h2 className="font-logo text-2xl mb-2">POMODORO</h2>
              <p className="text-gray-400 dark:text-[#7d6f5c] text-xs font-bold uppercase tracking-widest">Gestão de Tempo</p>
            </button>
            <button onClick={() => setView('STUDY_PLAN')} className="bg-white dark:bg-[#272019] p-6 rounded-[30px] text-left border border-gray-100 dark:border-white/[0.06] transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 delay-75">
              <div className="mb-8 w-12 h-12 bg-[#fff6e8] text-[#fec868] rounded-2xl flex items-center justify-center">
                <Calendar className="w-7 h-7" />
              </div>
              <h2 className="font-logo text-2xl mb-2 uppercase">CRONOGRAMA</h2>
              <p className="text-gray-400 dark:text-[#7d6f5c] text-xs font-bold uppercase tracking-widest text-[10px]">Ciclo de Estudo</p>
            </button>
            <button onClick={() => setView('FOCUS_MODE')} className="gradient-yellow text-white p-6 rounded-[30px] text-left relative overflow-hidden group transition-all hover:scale-[1.02] hover:shadow-xl animate-in zoom-in-95 duration-300 delay-150 shadow-[#ffe6b9]/60">
              <div className="mb-8 w-12 h-12 bg-white/20 text-white rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Bell className="w-7 h-7" />
              </div>
              <h2 className="font-logo text-2xl mb-2 uppercase">MODO FOCO</h2>
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Saúde & Blindagem</p>
            </button>
          </>
        )}

        {activeTab === 'RELAXE' && (
          <>
            <div className="bg-white dark:bg-[#272019] rounded-[30px] p-8 border border-gray-100 dark:border-white/[0.06] flex flex-col justify-between shadow-sm dark:shadow-none relative overflow-hidden h-full animate-in zoom-in-95 duration-300 lg:col-span-2">
              <div>
                <h2 className="font-logo text-3xl uppercase mb-2 leading-none">
                  AMBIENTE <span className="text-[#fed386]">SONORO</span>
                </h2>
                <p className="text-gray-400 dark:text-[#7d6f5c] font-bold text-xs uppercase tracking-widest mb-10">Controle o Lofi e os ruídos brancos</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setActiveChannel(activeChannel === 'RELAX' ? null : 'RELAX')} className={`p-6 rounded-[30px] flex flex-col items-center gap-2 transition-all border-4 ${activeChannel === 'RELAX' ? 'bg-[#fed386] border-[#fed386] text-white shadow-xl shadow-[#fff0d5]/60' : 'bg-gray-50 dark:bg-[#272019] border-transparent text-gray-400 dark:text-[#7d6f5c] hover:border-gray-200 dark:hover:border-white/[0.1]'}`}>
                  <span className="text-xs font-black uppercase tracking-widest ">LOFI RELAX</span>
                </button>
                <button onClick={() => setIsPlayingRain(!isPlayingRain)} className={`p-6 rounded-[30px] flex items-center justify-center gap-4 transition-all border-4 ${isPlayingRain ? 'bg-[#fecc73] border-[#fecc73] text-white shadow-xl shadow-[#fff0d5]/60' : 'bg-gray-50 dark:bg-[#272019] border-transparent text-gray-400 dark:text-[#7d6f5c] hover:border-gray-200 dark:hover:border-white/[0.1]'}`}>
                  <Cloud className="w-6 h-6" />
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setTimerMode(TimerMode.EMERGENCY);
                setView('TIMER');
              }}
              className="gradient-orange text-white p-6 rounded-[30px] text-left relative overflow-hidden group transition-all hover:scale-[1.02] hover:shadow-xl animate-in zoom-in-95 duration-300 delay-150 h-full"
            >
              <div className="mb-8">
                <AlertTriangle className="w-12 h-12" />
              </div>
              <h2 className="font-logo text-2xl leading-none uppercase">EMERGÊNCIA</h2>
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-2">Dê o primeiro passo agora</p>
            </button>
          </>
        )}

        {activeTab === 'REVISAO' && (
          <div className="lg:col-span-3">
            <button onClick={() => setView('SMART_REVISION')} className="w-full bg-[#473c33] text-white p-8 rounded-[35px] text-left relative overflow-hidden group transition-all hover:scale-[1.01] hover:shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="max-w-2xl relative z-10">
                <div className="mb-10 w-16 h-16 bg-[#fecc73] text-white rounded-3xl flex items-center justify-center shadow-xl">
                  <Zap className="w-10 h-10" />
                </div>
                <h2 className="font-logo text-4xl mb-4 uppercase leading-none">
                  REVISÃO <span className="text-[#fed386]">inteligente</span>
                </h2>
                <p className="text-gray-400 dark:text-[#7d6f5c] font-medium text-lg leading-relaxed mb-10 max-w-lg">{stats.studyProfile === 'FACULDADE' ? 'Acesse seu motor de repetição espaçada e valide o conteúdo da sua grade curricular com a IA.' : 'Acesse seu motor de repetição espaçada e valide o conteúdo do edital com a IA.'}</p>
                <div className="inline-flex items-center gap-4 bg-[#fec868] text-white px-8 py-4 rounded-[25px] font-black uppercase tracking-widest shadow-2xl transition-all group-hover:bg-white group-hover:text-[#fec868]">
                  ABRIR PAINEL DE REVISÃO
                  <ArrowRight className="w-6 h-6" />
                </div>
              </div>
              <div className="absolute top-0 right-0 p-8 text-black/10 scale-150 rotate-12 transition-transform group-hover:scale-[1.8] group-hover:rotate-0">
                <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </button>
          </div>
        )}
        {activeTab === 'MOTIVACAO' && <MotivationView />}
      </div>

      <footer className="pt-12 mt-12 border-t border-gray-100 dark:border-white/[0.06] text-center animate-in fade-in duration-1000">
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-gray-500 dark:text-[#a89680] font-medium text-sm leading-relaxed px-6">
            Olá, eu sou o <span className="text-[#473c33] dark:text-[#f4ebdd] font-black ">Brayhon</span>. Desenvolvi este app como um <span className="text-[#fecc73] dark:text-[#d9772b] font-bold">cardume seguro</span> para nossas mentes neurodivergentes. Eu também tenho <span className="text-[#fdad74] dark:text-[#d9772b] font-bold">TDAH</span> e sei que o nosso foco não é quebrado, ele apenas funciona em uma frequência diferente.
          </p>
          <p className="text-gray-300 dark:text-[#7d6f5c] font-bold text-[10px] uppercase tracking-[0.3em]">Criado com propósito • TDAH ORA</p>
        </div>
      </footer>
    </div>
  );
};

export default Hub;
