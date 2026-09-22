
import React, { useState, useEffect } from 'react';
import { AppView, TimerMode, UserStats, HubCategory, EditalConfig, SmartRevisionItem, StudyProfile, QuizAttempt, QuizFolder, SmartRevisionSystem } from '../types';
import MemoryHeatmap from './MemoryHeatmap';
import { getProactiveAdvice } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, BarChart3, Bookmark, Settings, Users, Newspaper, Layers, ClipboardList, Zap, FileText, Smile, Heart, Cloud, ArrowRight, PenLine, RotateCcw, Copy, Briefcase, Folder, Clock, Calendar, Bell, AlertTriangle, Scale } from './icons';
import MotivationView from './MotivationView';
import PerformanceView from './PerformanceView';
import AvatarDisplay from './AvatarDisplay';
import { getCharacterSrc } from '../services/avatarService';

const hexToRgba = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface HeroIconButtonProps {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  badge?: number;
  align?: 'left' | 'right';
}

const HeroIconButton: React.FC<HeroIconButtonProps> = ({ label, icon: Icon, onClick, badge, align = 'left' }) => (
  <button onClick={onClick} className={`flex items-center gap-2 group ${align === 'right' ? 'flex-row-reverse' : ''}`}>
    <div className="relative w-11 h-11 md:w-12 md:h-12 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-white group-hover:scale-105 transition-all shrink-0">
      <Icon className="w-5 h-5 md:w-6 md:h-6 text-[#0A0F1E]" />
      {!!badge && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </div>
    <span className="hidden lg:block text-[9px] font-black text-[#0A0F1E]/70 uppercase tracking-widest">{label}</span>
  </button>
);

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
  setGuidedLessonData: (data: { subject: string, topic: string }) => void;
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

const Hub: React.FC<HubProps> = ({ 
  setView, 
  setTimerMode, 
  flashcardCount, 
  stats, 
  activeChannel, 
  setActiveChannel, 
  isPlayingRain, 
  setIsPlayingRain, 
  editalConfig, 
  setStrategicMode,
  setGuidedLessonData,
  smartRevisionItems,
  isAIEnabled,
  user,
  onLogin,
  isSyncing,
  attempts,
  folders,
  smartSystem,
  isAdmin
}) => {
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

  const profileLabel = stats.studyProfile === 'CONCURSO' 
    ? 'Foco: Concursos' 
    : stats.studyProfile === 'FACULDADE' 
    ? 'Foco: Faculdade' 
    : 'Foco: Vestibulares';
  
  const pendingRevisions = smartRevisionItems.filter(i => i.status === 'PENDING').length;

  const characterSrc = getCharacterSrc(stats.characterId, 'frente');
  const xpProgress = (stats.xp % 1000) / 10;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Hero: game-hub style header */}
      <div className="relative rounded-[40px] p-5 md:p-7 shadow-xl overflow-hidden">
        {stats.heroScenario === 'solido' ? (
          <div
            className="absolute inset-0"
            style={{
              background: stats.heroTintColor
                ? `linear-gradient(135deg, ${hexToRgba(stats.heroTintColor, 1)}, ${hexToRgba(stats.heroTintColor, 0.75)})`
                : 'linear-gradient(135deg, #FDE68A, #FB923C)',
            }}
          />
        ) : (
          <>
            <img src={`/hero-scenarios/${stats.heroScenario || 'quarto'}.png`} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div
              className="absolute inset-0"
              style={{
                background: stats.heroTintColor
                  ? `linear-gradient(to top, ${hexToRgba(stats.heroTintColor, 0.4)}, ${hexToRgba(stats.heroTintColor, 0.05)} 60%, ${hexToRgba(stats.heroTintColor, 0.15)})`
                  : 'linear-gradient(to top, rgba(0,0,0,0.1), transparent 60%, rgba(0,0,0,0.05))',
              }}
            />
          </>
        )}
        {/* Top row: profile / level / coins+settings */}
        <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
          <button onClick={() => setView('PROFILE')} className="flex items-center gap-2.5 bg-white/80 backdrop-blur-sm rounded-full pl-1.5 pr-4 py-1.5 shadow-sm hover:bg-white transition-colors max-w-[45%]">
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shrink-0 bg-white">
              <AvatarDisplay characterId={stats.characterId} className="w-full h-full" />
            </div>
            <div className="text-left overflow-hidden">
              <p className="text-[11px] font-black text-[#0A0F1E] leading-none truncate">{stats.name}</p>
              <div className="w-16 md:w-20 h-1.5 bg-black/10 rounded-full overflow-hidden mt-1.5">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${xpProgress}%` }} />
              </div>
            </div>
          </button>

          <div className="hidden sm:flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full pl-1.5 pr-4 py-1.5 shadow-sm">
            <div className="w-7 h-7 rounded-full bg-purple-500 text-white text-[11px] font-black flex items-center justify-center shrink-0">{stats.level}</div>
            <div className="w-16 md:w-20 h-1.5 bg-black/10 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${xpProgress}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-full px-3 py-2 shadow-sm">
              <span className="text-sm leading-none">🪙</span>
              <span className="text-xs font-black text-[#0A0F1E]">{stats.coins}</span>
            </div>
            <button onClick={() => setView('PROFILE')} className="w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors">
              <Settings className="w-4 h-4 text-[#0A0F1E]" />
            </button>
          </div>
        </div>

        <p className="text-[9px] font-black text-[#0A0F1E]/50 uppercase tracking-[0.2em] mb-3 relative z-10 px-1">{profileLabel}</p>

        {/* Middle row: shortcuts | character | shortcuts */}
        <div className="flex items-end justify-between gap-1 md:gap-4 relative z-10">
          <div className="flex flex-col gap-3 md:gap-4">
            <HeroIconButton label="Materiais" icon={ClipboardList} onClick={() => setView('MATERIALS')} />
            <HeroIconButton label="Edital" icon={BookOpen} onClick={() => setView(editalConfig.isActive ? 'EDITAL_VIEW' : 'EDITAL_SETUP')} />
            <HeroIconButton label="Flashcards" icon={Layers} onClick={() => setView('FLASHCARDS')} badge={flashcardCount} />
          </div>

          <div className="flex-1 flex flex-col items-center justify-end relative py-2 min-w-0">
            <button onClick={() => setView('PROFILE')} className="relative z-10 group" aria-label="Trocar personagem">
              {characterSrc && (
                <img src={characterSrc} alt={stats.name} className="h-44 sm:h-56 md:h-72 object-contain object-bottom drop-shadow-2xl group-hover:scale-105 transition-transform" />
              )}
              <span className="absolute -right-1 bottom-3 w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center text-orange-600 font-black text-lg leading-none group-hover:scale-110 transition-transform">+</span>
            </button>
          </div>

          <div className="flex flex-col gap-3 md:gap-4 items-end">
            <HeroIconButton label="Notícias" icon={Newspaper} onClick={() => setView('COMMUNITY')} align="right" />
            <HeroIconButton label="Amigos" icon={Users} onClick={() => setView('SOCIAL_MODULE')} align="right" />
          </div>
        </div>

        {/* Bottom row: event banner + play */}
        <div className="flex flex-col sm:flex-row items-stretch gap-3 mt-4 relative z-10">
          {!user ? (
            <button onClick={onLogin} className="flex-1 bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center gap-3 text-left shadow-sm hover:bg-white transition-colors">
              <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center text-white shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-[#0A0F1E] uppercase leading-tight">Salvar na nuvem</p>
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">Grátis, não perca seu progresso</p>
              </div>
            </button>
          ) : pendingRevisions > 0 ? (
            <button onClick={() => setView('SMART_REVISION')} className="flex-1 bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center gap-3 text-left shadow-sm hover:bg-white transition-colors">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-[#0A0F1E] uppercase leading-tight">Validação pendente</p>
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">{pendingRevisions} temas pra revisar hoje</p>
              </div>
            </button>
          ) : (
            <button onClick={() => setView('COMMUNITY')} className="flex-1 bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center gap-3 text-left shadow-sm hover:bg-white transition-colors">
              <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center text-white shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-[#0A0F1E] uppercase leading-tight">Cardume Social</p>
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">Veja o progresso da comunidade</p>
              </div>
            </button>
          )}
          <button
            onClick={() => { setTimerMode(TimerMode.POMODORO); setView('TIMER'); }}
            className="bg-[#0A0F1E] hover:bg-black text-white font-black uppercase italic tracking-widest text-sm px-10 py-4 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 shrink-0"
          >
            Estudar
          </button>
        </div>
      </div>


      <div className="flex p-2 bg-white rounded-[30px] shadow-sm border border-gray-100 max-w-5xl overflow-x-auto no-scrollbar scroll-smooth">
        <button onClick={() => setActiveTab('ESTUDO')} className={`min-w-fit flex-1 py-4 px-6 rounded-[22px] flex items-center justify-center gap-3 font-black text-xs transition-all ${activeTab === 'ESTUDO' ? 'bg-blue-500 text-white shadow-xl shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'}`}>
          <BookOpen className="w-6 h-6" />
          ESTUDO
        </button>
        <button onClick={() => setActiveTab('EDITAL')} className={`min-w-fit flex-1 py-4 px-6 rounded-[22px] flex items-center justify-center gap-3 font-black text-xs transition-all ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white shadow-xl shadow-gray-200' : 'text-gray-400 hover:bg-gray-50'}`}>
          <FileText className="w-6 h-6" />
          {stats.studyProfile === 'FACULDADE' ? 'GRADE CURRICULAR' : 'EDITAL'}
        </button>
        <button onClick={() => setActiveTab('ORGANIZACAO')} className={`min-w-fit flex-1 py-4 px-6 rounded-[22px] flex items-center justify-center gap-3 font-black text-xs transition-all ${activeTab === 'ORGANIZACAO' ? 'bg-yellow-400 text-white shadow-xl shadow-yellow-100' : 'text-gray-400 hover:bg-gray-50'}`}>
          <ClipboardList className="w-6 h-6" />
          ORGANIZAÇÃO
        </button>
        <button onClick={() => setActiveTab('RELAXE')} className={`min-w-fit flex-1 py-4 px-6 rounded-[22px] flex items-center justify-center gap-3 font-black text-xs transition-all ${activeTab === 'RELAXE' ? 'bg-orange-500 text-white shadow-xl shadow-orange-100' : 'text-gray-400 hover:bg-gray-50'}`}>
          <Smile className="w-6 h-6" />
          RELAXE
        </button>
        <button onClick={() => setActiveTab('REVISAO')} className={`min-w-fit flex-1 py-4 px-6 rounded-[22px] flex items-center justify-center gap-3 font-black text-xs transition-all ${activeTab === 'REVISAO' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50'}`}>
          <Zap className="w-6 h-6" />
          REVISÃO IA
        </button>
        <button onClick={() => setActiveTab('MOTIVACAO')} className={`min-w-fit flex-1 py-4 px-6 rounded-[22px] flex items-center justify-center gap-3 font-black text-xs transition-all ${activeTab === 'MOTIVACAO' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-100' : 'text-gray-400 hover:bg-gray-50'}`}>
          <Heart className="w-6 h-6" />
          MOTIVAÇÃO
        </button>
        <button 
          onClick={() => setView('PERFORMANCE')} 
          className="min-w-fit flex-1 py-4 px-6 rounded-[22px] flex items-center justify-center gap-3 font-black text-xs transition-all text-gray-400 hover:bg-gray-50"
        >
          <BarChart3 className="w-6 h-6" />
          DESEMPENHO
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[400px]">
        {(activeTab === 'ESTUDO' || activeTab === 'EDITAL') && (
          <>
            {pendingRevisions > 0 && (
              <div className="lg:col-span-3">
                 <button 
                   onClick={() => setView('SMART_REVISION')}
                   className="w-full bg-gradient-to-r from-blue-700 via-blue-800 to-black p-1 text-white rounded-[40px] group transition-all hover:scale-[1.01] active:scale-95 shadow-2xl shadow-blue-900/40 relative overflow-hidden"
                 >
                    <div className="bg-[#0A0F1E] rounded-[38px] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                       <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                             <Zap className="w-10 h-10" />
                          </div>
                          <div className="text-left">
                             <h3 className="font-logo text-2xl uppercase leading-tight">VALIDAÇÃO DE ONTEM</h3>
                             <p className="text-blue-400 font-bold text-xs uppercase tracking-widest mt-1">Você tem {pendingRevisions} temas para validar hoje</p>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-4 bg-blue-600 text-white px-8 py-4 rounded-[25px] font-black uppercase italic tracking-widest group-hover:bg-white group-hover:text-blue-600 transition-all">
                          COMEÇAR AGORA
                          <ArrowRight className="w-6 h-6" />
                       </div>
                    </div>
                    
                    {/* Background glow effects */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[100px] -mr-32 -mt-32"></div>
                 </button>
              </div>
            )}

            {/* Edital-only Strategic Entry if not active */}
            {activeTab === 'EDITAL' && !editalConfig.isActive && (
              <div className="lg:col-span-3">
                <button onClick={() => setView('EDITAL_SETUP')} className="w-full bg-[#0A0F1E] text-white p-8 rounded-[35px] text-left relative overflow-hidden group transition-all hover:scale-[1.01] hover:shadow-2xl animate-in zoom-in-95 duration-300 shadow-blue-900/40">
                  <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 rotate-12 transition-transform group-hover:scale-[1.8] group-hover:rotate-0">
                    <Zap className="w-48 h-48" fill="currentColor" />
                  </div>
                  <div className="max-w-2xl relative z-10">
                    <div className="mb-10 w-16 h-16 bg-white/10 text-blue-400 rounded-3xl flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner group-hover:bg-blue-500 group-hover:text-white transition-all">
                      <FileText className="w-10 h-10" />
                    </div>
                    {stats.studyProfile === 'FACULDADE' ? (
                      <>
                        <h2 className="font-logo text-4xl mb-4 uppercase leading-none">ATIVAR GRADE <span className="text-blue-500 group-hover:text-white transition-colors">curricular</span></h2>
                        <p className="text-gray-400 font-medium text-lg leading-relaxed mb-10 max-w-lg">
                          Conecte o conteúdo das suas disciplinas e o período acadêmico atual às funções de IA do app.
                        </p>
                        <div className="inline-flex items-center gap-4 bg-blue-600 text-white px-8 py-4 rounded-[25px] font-black uppercase italic tracking-widest shadow-2xl shadow-blue-900/40 group-hover:bg-white group-hover:text-blue-600 transition-all">
                           CONFIGURAR MINHA GRADE AGORA
                           <ArrowRight className="w-6 h-6" />
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 className="font-logo text-4xl mb-4 uppercase leading-none">ATIVAR MODO <span className="text-blue-500 group-hover:text-white transition-colors">edital</span></h2>
                        <p className="text-gray-400 font-medium text-lg leading-relaxed mb-10 max-w-lg">
                          Conecte seu conteúdo programático diretamente às funções de IA do app.
                        </p>
                        <div className="inline-flex items-center gap-4 bg-blue-600 text-white px-8 py-4 rounded-[25px] font-black uppercase italic tracking-widest shadow-2xl shadow-blue-900/40 group-hover:bg-white group-hover:text-blue-600 transition-all">
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
                    <button 
                      onClick={() => setView('EDITAL_VIEW')}
                      className="w-full bg-[#0A0F1E] text-white p-6 rounded-[30px] flex items-center justify-between group transition-all hover:scale-[1.01] hover:shadow-2xl shadow-blue-900/10 border-2 border-blue-600/30"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <PenLine className="w-8 h-8" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-logo text-2xl uppercase">
                            {stats.studyProfile === 'FACULDADE' ? 'MINHA GRADE CURRICULAR - VISUALIZAR E EDITAR' : 'MEU EDITAL - VISUALIZAR E EDITAR'}
                          </h3>
                          <p className="text-blue-400 font-bold text-[10px] uppercase tracking-widest mt-1">
                            {stats.studyProfile === 'FACULDADE' ? 'Gerencie as disciplinas e o progresso do seu período' : 'Gerencie seu conteúdo programático e progresso verticalizado'}
                          </p>
                        </div>
                      </div>
                      <div className="bg-blue-600 text-white p-4 rounded-2xl group-hover:bg-white group-hover:text-blue-600 transition-all">
                        <ArrowRight className="w-6 h-6" />
                      </div>
                    </button>
                  </div>
                )}
                
                {editalConfig.isActive && (
                  <div className="lg:col-span-3">
                    						<button 
							onClick={() => setView('STUDY_CYCLE')}
							className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white p-6 rounded-[30px] flex items-center justify-between group transition-all hover:scale-[1.01] hover:shadow-2xl shadow-blue-200"
						>
							<div className="flex items-center gap-6">
								<div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform backdrop-blur-md">
									<RotateCcw className="w-8 h-8 font-black" />
								</div>
								<div className="text-left">
									<div className="flex items-center gap-2">
										<h3 className="font-logo text-2xl uppercase">MEU CICLO DE ESTUDO</h3>
										<span className="bg-white/20 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border border-white/10">INTERLIGADO</span>
									</div>
									<p className="text-blue-100 font-bold text-[10px] uppercase tracking-widest mt-1">
										{stats.studyProfile === 'FACULDADE' ? 'Intercale matérias automaticamente com base nos pesos da sua grade curricular' : 'Intercale matérias automaticamente com base nos pesos do seu edital'}
									</p>
								</div>
							</div>
							<div className="bg-white text-blue-600 p-4 rounded-2xl group-hover:bg-blue-800 group-hover:text-white transition-all shadow-lg">
								<ArrowRight className="w-6 h-6" />
							</div>
						</button>
                  </div>
                )}

                <button 
                  onClick={() => { if(activeTab === 'EDITAL') setStrategicMode(true); setView('FLASHCARDS'); }} 
                  className={`p-6 rounded-[30px] text-left transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white border-none' : 'bg-white border border-gray-100 shadow-sm'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <Copy className="w-7 h-7" />
                  </div>
                  {activeTab === 'ESTUDO' && flashcardCount > 0 && (
                    <div className="absolute top-8 right-8 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-bounce">
                      {flashcardCount} PENDENTES
                    </div>
                  )}
                  <h2 className="font-logo text-2xl mb-2 uppercase">FLASH<span className="text-blue-500">cards</span></h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-blue-400' : 'text-gray-400'}`}>
                    {activeTab === 'EDITAL' ? (stats.studyProfile === 'FACULDADE' ? 'Conectado à Grade' : 'Conectado ao Edital') : 'Revisão Espaçada'}
                  </p>
                </button>

                <button 
                  onClick={() => { if(activeTab === 'EDITAL') setStrategicMode(true); setView('MATERIALS'); }} 
                  className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white border-transparent' : 'bg-white border-gray-100 shadow-sm'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <Briefcase className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-2xl mb-2 uppercase">MEUS <span className="text-blue-500">materiais</span></h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-blue-400' : 'text-gray-400'}`}>
                    {activeTab === 'EDITAL' ? (stats.studyProfile === 'FACULDADE' ? 'Arquivo da Grade' : 'Arquivo Estratégico') : 'Resumos & Cadernos'}
                  </p>
                </button>

                <button 
                  onClick={() => setView('DRIVE_READER')} 
                  className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#0B1528] text-white border-transparent' : 'bg-gradient-to-br from-[#0c1830] to-[#040914] text-white shadow-xl shadow-blue-900/10 border-0'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white shadow-md'}`}>
                    <Folder className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-2xl mb-2 uppercase">BIBLIOTECA <span className="text-blue-400">drive</span></h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-blue-400' : 'text-blue-200'}`}>
                    Livros & PDFs do Drive
                  </p>
                </button>

                <button
                  onClick={() => setView('VADE_MECUM')}
                  className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white border-transparent' : 'bg-white border-gray-100 shadow-sm'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'}`}>
                    <Scale className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-2xl mb-2 uppercase">VADE <span className="text-amber-500">MECUM</span></h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-amber-400' : 'text-gray-400'}`}>
                    Legislação Atualizada
                  </p>
                </button>

                <button
                  onClick={() => setView('NOTES')}
                  className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white border-transparent' : 'bg-white border-gray-100 shadow-sm'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <PenLine className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-2xl mb-2 uppercase">ANOTA<span className="text-blue-500">ções</span></h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-blue-400' : 'text-gray-400'}`}>
                    Escreva à mão
                  </p>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => setView('ADMIN_QUESTION_REVIEW')}
                    className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white border-transparent' : 'bg-white border-gray-100 shadow-sm'}`}
                  >
                    <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                      <ClipboardList className="w-7 h-7" />
                    </div>
                    <h2 className="font-logo text-2xl mb-2 uppercase">REVISÃO <span className="text-emerald-500">import.</span></h2>
                    <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-emerald-400' : 'text-gray-400'}`}>
                      Banco de questões (admin)
                    </p>
                  </button>
                )}

                <button
                  onClick={() => { if(activeTab === 'EDITAL') setStrategicMode(true); setView('TDH_QUESTOES'); }}
                  className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 delay-75 ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white border-transparent' : 'bg-white border-gray-100 shadow-sm'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <FileText className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-2xl mb-2 relative z-10 uppercase">TDH<span className="text-blue-500">questoes</span></h2>
                  <p className={`text-sm mb-4 relative z-10 font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-blue-400' : 'text-gray-400'}`}>
                    {activeTab === 'EDITAL' ? (stats.studyProfile === 'FACULDADE' ? 'Foco na Grade' : 'Foco no Edital') : 'Batalha de Simulados'}
                  </p>
                </button>

                <button 
                  onClick={() => { if(activeTab === 'EDITAL') setStrategicMode(true); setView('AI_DIRECT'); }} 
                  className={`text-white p-6 rounded-[30px] text-left relative overflow-hidden group transition-all hover:scale-[1.02] hover:shadow-xl animate-in zoom-in-95 duration-300 delay-100 shadow-2xl ${activeTab === 'EDITAL' ? 'bg-gradient-to-br from-blue-900 to-black shadow-blue-900/40' : 'bg-gradient-to-br from-slate-900 to-black'}`}
                >
                  <div className="mb-8 w-12 h-12 bg-white/10 text-yellow-400 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <Zap className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-3xl mb-2 uppercase leading-none">AULA DIRETA</h2>
                  <p className="text-yellow-400/80 text-[10px] font-bold uppercase tracking-widest">{activeTab === 'EDITAL' ? (stats.studyProfile === 'FACULDADE' ? 'Conteúdo da Grade' : 'Conteúdo do Edital') : 'IA Powered Bizu'}</p>
                </button>

                <div 
                  className={`text-white p-6 rounded-[30px] text-left relative overflow-hidden group transition-all animate-in zoom-in-95 duration-300 delay-200 shadow-2xl ${activeTab === 'EDITAL' ? 'bg-gradient-to-br from-blue-600 to-blue-800 shadow-blue-900/40' : 'bg-gradient-to-br from-slate-800 to-slate-900'}`}
                >
                  <div className="mb-6 w-12 h-12 bg-white/10 text-blue-400 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10">
                    <BookOpen className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-3xl mb-2 uppercase leading-none">AULA <span className="text-blue-500">GUIADA</span></h2>
                  <p className="text-blue-400/80 text-[10px] font-bold uppercase tracking-widest mb-6">Narrativa Contínua (Active Recall)</p>
                  
                  <div className="flex flex-col gap-2 relative z-10">
                    <input 
                      type="text" 
                      placeholder="Matéria (Ex: Português)" 
                      value={guidedSubject}
                      onChange={(e) => setGuidedSubject(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-white/30"
                    />
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Assunto (Ex: Crase)" 
                        value={guidedTopic}
                        onChange={(e) => setGuidedTopic(e.target.value)}
                        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-white/30"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if(guidedSubject && guidedTopic) {
                              setGuidedLessonData({ subject: guidedSubject, topic: guidedTopic });
                              setView('GUIDED_LESSON');
                            }
                          }
                        }}
                      />
                      <button 
                        onClick={() => {
                          if(guidedSubject && guidedTopic) {
                            setGuidedLessonData({ subject: guidedSubject, topic: guidedTopic });
                            setView('GUIDED_LESSON');
                          }
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-xl transition-all"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <BookOpen className="w-32 h-32 text-white" />
                  </div>
                </div>

                <button 
                  onClick={() => setView('SAVED_GUIDED_LESSONS')} 
                  className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 delay-200 ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white border-transparent' : 'bg-white border-blue-100 shadow-sm'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <Bookmark className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-2xl mb-2 uppercase">AULAS <span className="text-blue-500">salvas</span></h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-blue-400' : 'text-gray-400'}`}>
                    Biblioteca Offline
                  </p>
                </button>

                <button 
                  onClick={() => { if(activeTab === 'EDITAL') setStrategicMode(true); setView('DYNAMIC_TIMER'); }} 
                  className={`p-6 rounded-[30px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 delay-150 ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white border-transparent' : 'bg-white border-orange-100'}`}
                >
                  <div className={`mb-6 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-500'}`}>
                    <Clock className="w-7 h-7" />
                  </div>
                  <h2 className="font-logo text-3xl mb-2 uppercase">BLOCO <span className="text-orange-500">IMUTÁVEL</span></h2>
                  <p className={`text-[10px] font-bold uppercase tracking-widest leading-tight ${activeTab === 'EDITAL' ? 'text-gray-400' : 'text-gray-400'}`}>
                    {activeTab === 'EDITAL' ? 'Foco Estratégico' : 'Timer Dinâmico 40min'}
                  </p>
                  <div className="mt-4 flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  </div>
                </button>

                {activeTab === 'EDITAL' && (
                  <div className="lg:col-span-3 pt-12 space-y-8">
                     <div className="flex justify-between items-center">
                        <h3 className="font-logo text-2xl uppercase">BARRA DE CALOR DA MEMÓRIA</h3>
                        <div className="flex gap-2">
                           <span className="flex items-center gap-1 text-[8px] font-black text-blue-500 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-blue-500"></div> VALIDADO</span>
                           <span className="flex items-center gap-1 text-[8px] font-black text-orange-500 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-orange-500"></div> REVISAR</span>
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
            <button onClick={() => { setTimerMode(TimerMode.POMODORO); setView('TIMER'); }} className="bg-white p-6 rounded-[30px] text-left border border-gray-100 transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="mb-8 w-12 h-12 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center"><Clock className="w-7 h-7" /></div>
              <h2 className="font-logo text-2xl mb-2">POMODORO</h2>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Gestão de Tempo</p>
            </button>
            <button onClick={() => setView('STUDY_PLAN')} className="bg-white p-6 rounded-[30px] text-left border border-gray-100 transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 delay-75">
              <div className="mb-8 w-12 h-12 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center"><Calendar className="w-7 h-7" /></div>
              <h2 className="font-logo text-2xl mb-2 uppercase">CRONOGRAMA</h2>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest text-[10px]">Ciclo de Estudo</p>
            </button>
            <button onClick={() => setView('FOCUS_MODE')} className="gradient-yellow text-white p-6 rounded-[30px] text-left relative overflow-hidden group transition-all hover:scale-[1.02] hover:shadow-xl animate-in zoom-in-95 duration-300 delay-150 shadow-yellow-200">
              <div className="mb-8 w-12 h-12 bg-white/20 text-white rounded-2xl flex items-center justify-center backdrop-blur-sm"><Bell className="w-7 h-7" /></div>
              <h2 className="font-logo text-2xl mb-2 uppercase">MODO FOCO</h2>
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Saúde & Blindagem</p>
            </button>
          </>
        )}

        {activeTab === 'RELAXE' && (
          <>
            <div className="bg-white rounded-[30px] p-8 border border-gray-100 flex flex-col justify-between shadow-sm relative overflow-hidden h-full animate-in zoom-in-95 duration-300 lg:col-span-2">
               <div>
                  <h2 className="font-logo text-3xl uppercase mb-2 leading-none">AMBIENTE <span className="text-yellow-400">SONORO</span></h2>
                  <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-10">Controle o Lofi e os ruídos brancos</p>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setActiveChannel(activeChannel === 'RELAX' ? null : 'RELAX')} className={`p-6 rounded-[30px] flex flex-col items-center gap-2 transition-all border-4 ${activeChannel === 'RELAX' ? 'bg-yellow-400 border-yellow-400 text-white shadow-xl shadow-yellow-100' : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'}`}>
                    <span className="text-xs font-black uppercase tracking-widest italic">LOFI RELAX</span>
                  </button>
                  <button onClick={() => setIsPlayingRain(!isPlayingRain)} className={`p-6 rounded-[30px] flex items-center justify-center gap-4 transition-all border-4 ${isPlayingRain ? 'bg-blue-500 border-blue-500 text-white shadow-xl shadow-blue-100' : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'}`}>
                    <Cloud className="w-6 h-6" />
                  </button>
               </div>
            </div>
            
            <button onClick={() => { setTimerMode(TimerMode.EMERGENCY); setView('TIMER'); }} className="gradient-orange text-white p-6 rounded-[30px] text-left relative overflow-hidden group transition-all hover:scale-[1.02] hover:shadow-xl animate-in zoom-in-95 duration-300 delay-150 h-full">
              <div className="mb-8"><AlertTriangle className="w-12 h-12" /></div>
              <h2 className="font-logo text-2xl leading-none uppercase">EMERGÊNCIA</h2>
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-2">Dê o primeiro passo agora</p>
            </button>
          </>
        )}

        {activeTab === 'REVISAO' && (
          <div className="lg:col-span-3">
             <button 
               onClick={() => setView('SMART_REVISION')}
               className="w-full bg-[#0A0F1E] text-white p-8 rounded-[35px] text-left relative overflow-hidden group transition-all hover:scale-[1.01] hover:shadow-2xl animate-in zoom-in-95 duration-300 shadow-indigo-900/40"
             >
                <div className="max-w-2xl relative z-10">
                   <div className="mb-10 w-16 h-16 bg-indigo-500 text-white rounded-3xl flex items-center justify-center shadow-xl">
                      <Zap className="w-10 h-10" />
                   </div>
                   <h2 className="font-logo text-4xl mb-4 uppercase leading-none">REVISÃO <span className="text-indigo-400">inteligente</span></h2>
                   <p className="text-gray-400 font-medium text-lg leading-relaxed mb-10 max-w-lg">
                      {stats.studyProfile === 'FACULDADE' ? 'Acesse seu motor de repetição espaçada e valide o conteúdo da sua grade curricular com a IA.' : 'Acesse seu motor de repetição espaçada e valide o conteúdo do edital com a IA.'}
                   </p>
                   <div className="inline-flex items-center gap-4 bg-indigo-600 text-white px-8 py-4 rounded-[25px] font-black uppercase italic tracking-widest shadow-2xl transition-all group-hover:bg-white group-hover:text-indigo-600">
                      ABRIR PAINEL DE REVISÃO
                      <ArrowRight className="w-6 h-6" />
                   </div>
                </div>
                <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 rotate-12 transition-transform group-hover:scale-[1.8] group-hover:rotate-0">
                  <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
             </button>
          </div>
        )}
        {activeTab === 'MOTIVACAO' && <MotivationView />}
      </div>

      <footer className="pt-12 mt-12 border-t border-gray-100 text-center animate-in fade-in duration-1000">
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-gray-500 font-medium text-sm leading-relaxed px-6">
            Olá, eu sou o <span className="text-[#0A0F1E] font-black italic">Brayhon</span>. Desenvolvi este app como um <span className="text-blue-500 font-bold">cardume seguro</span> para nossas mentes neurodivergentes. Eu também tenho <span className="text-orange-500 font-bold">TDAH</span> e sei que o nosso foco não é quebrado, ele apenas funciona em uma frequência diferente.
          </p>
          <p className="text-gray-300 font-bold text-[10px] uppercase tracking-[0.3em]">
            Criado com propósito • TDAH ORA
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Hub;
