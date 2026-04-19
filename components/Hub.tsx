
import React, { useState, useEffect } from 'react';
import { AppView, TimerMode, UserStats, HubCategory, EditalConfig, SmartRevisionItem, StudyProfile } from '../types';
import MemoryHeatmap from './MemoryHeatmap';
import { getProactiveAdvice } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';

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
  smartRevisionItems: SmartRevisionItem[];
  isAIEnabled: boolean;
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
  smartRevisionItems,
  isAIEnabled
}) => {
  const [activeTab, setActiveTab] = useState<HubCategory>('ESTUDO');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [aiInsight, setAiInsight] = useState<{ greeting: string; insight: string; task: string; taskView: string } | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    const fetchAdvice = async () => {
      if (!isAIEnabled) return;
      setLoadingAI(true);
      try {
        const advice = await getProactiveAdvice(stats, editalConfig, stats.studyProfile!);
        setAiInsight(advice);
      } catch (e) {
        console.error("Erro ao ativar IA:", e);
      } finally {
        setLoadingAI(false);
      }
    };
    fetchAdvice();
  }, [stats.studyProfile]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const profileLabel = stats.studyProfile === 'CONCURSO' ? 'Foco: Concursos' : 'Foco: Vestibulares';
  
  const pendingRevisions = smartRevisionItems.filter(i => i.status === 'PENDING').length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-[#0A0F1E] tracking-tight uppercase italic leading-none">MEU HUB DE FOCO</h1>
          <div className="flex items-center gap-2 mt-3">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
            <p className="text-yellow-600 font-black text-xs uppercase tracking-[0.2em]">{profileLabel}</p>
          </div>
        </div>
        <button 
          onClick={() => setView('COMMUNITY')}
          className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-2xl font-black text-sm hover:shadow-xl hover:bg-gray-800 transition-all shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          CARDUME SOCIAL
        </button>
      </div>
      
      {/* MODO IA ATIVO */}
      <AnimatePresence>
        {isAIEnabled ? (
          (aiInsight || loadingAI) && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[#0A0F1E] border border-blue-500/30 rounded-[35px] p-6 text-white shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg className="w-24 h-24 text-blue-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0 animate-bounce">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                
                <div className="flex-1 space-y-1">
                  {loadingAI ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-white/10 rounded w-1/4"></div>
                      <div className="h-6 bg-white/10 rounded w-3/4"></div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-blue-400 font-bold text-[10px] uppercase tracking-widest leading-none mb-2 italic">IA Ativa • Mergulho do Mentor Peixe</h3>
                      <h4 className="text-xl font-black italic uppercase leading-tight">"{aiInsight?.greeting} {stats.name}!"</h4>
                      <p className="text-gray-400 text-sm font-medium">{aiInsight?.insight}</p>
                    </>
                  )}
                </div>
                
                {!loadingAI && aiInsight && (
                  <button 
                    onClick={() => setView(aiInsight.taskView as any)}
                    className="bg-white text-black px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all flex items-center gap-3 active:scale-95 shadow-xl"
                  >
                    {aiInsight.task}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </button>
                )}
              </div>
              
              {/* Visual indicator of "Active AI" */}
              <div className="absolute bottom-0 left-0 h-1 bg-blue-500 w-full opacity-30"></div>
            </motion.div>
          )
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-100 border border-gray-200 rounded-[35px] p-8 text-center text-gray-400"
          >
            <h3 className="font-black text-xs uppercase tracking-widest mb-2">IA Mentor Desativada</h3>
            <p className="text-xs mb-4">Ative o "Cérebro Artificial" nas configurações do seu perfil para receber orientações estratégicas.</p>
            <button onClick={() => setView('PROFILE')} className="text-[10px] font-black text-blue-500 uppercase underline tracking-widest">Ativar agora</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex p-2 bg-white rounded-[30px] shadow-sm border border-gray-100 max-w-4xl overflow-x-auto">
        <button onClick={() => setActiveTab('ESTUDO')} className={`flex-1 py-4 px-6 rounded-[22px] flex items-center justify-center gap-3 font-black text-xs transition-all ${activeTab === 'ESTUDO' ? 'bg-blue-500 text-white shadow-xl shadow-blue-100' : 'text-gray-400 hover:bg-gray-50'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          ESTUDO
        </button>
        <button onClick={() => setActiveTab('EDITAL')} className={`flex-1 py-4 px-6 rounded-[22px] flex items-center justify-center gap-3 font-black text-xs transition-all ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white shadow-xl shadow-gray-200' : 'text-gray-400 hover:bg-gray-50'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
          EDITAL
        </button>
        <button onClick={() => setActiveTab('ORGANIZACAO')} className={`flex-1 py-4 px-6 rounded-[22px] flex items-center justify-center gap-3 font-black text-xs transition-all ${activeTab === 'ORGANIZACAO' ? 'bg-yellow-400 text-white shadow-xl shadow-yellow-100' : 'text-gray-400 hover:bg-gray-50'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          ORGANIZAÇÃO
        </button>
        <button onClick={() => setActiveTab('RELAXE')} className={`flex-1 py-4 px-6 rounded-[22px] flex items-center justify-center gap-3 font-black text-xs transition-all ${activeTab === 'RELAXE' ? 'bg-orange-500 text-white shadow-xl shadow-orange-100' : 'text-gray-400 hover:bg-gray-50'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          RELAXE
        </button>
        <button onClick={() => setActiveTab('REVISAO')} className={`flex-1 py-4 px-6 rounded-[22px] flex items-center justify-center gap-3 font-black text-xs transition-all ${activeTab === 'REVISAO' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          REVISÃO IA
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
                    <div className="bg-[#0A0F1E] rounded-[38px] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                       <div className="flex items-center gap-6">
                          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                             <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          </div>
                          <div className="text-left">
                             <h3 className="text-3xl font-black italic uppercase tracking-tighter leading-tight">VALIDAÇÃO DE ONTEM</h3>
                             <p className="text-blue-400 font-bold text-xs uppercase tracking-widest mt-1">Você tem {pendingRevisions} temas para validar hoje</p>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-4 bg-blue-600 text-white px-10 py-5 rounded-[25px] font-black uppercase italic tracking-widest group-hover:bg-white group-hover:text-blue-600 transition-all">
                          COMEÇAR AGORA
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
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
                <button onClick={() => setView('EDITAL_SETUP')} className="w-full bg-[#0A0F1E] text-white p-12 rounded-[50px] text-left relative overflow-hidden group transition-all hover:scale-[1.01] hover:shadow-2xl animate-in zoom-in-95 duration-300 shadow-blue-900/40">
                  <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 rotate-12 transition-transform group-hover:scale-[1.8] group-hover:rotate-0">
                    <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div className="max-w-2xl relative z-10">
                    <div className="mb-10 w-20 h-20 bg-white/10 text-blue-400 rounded-3xl flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner group-hover:bg-blue-500 group-hover:text-white transition-all">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                    </div>
                    <h2 className="text-6xl font-black mb-4 italic uppercase tracking-tighter leading-none">ATIVAR MODO <span className="text-blue-500 group-hover:text-white transition-colors">edital</span></h2>
                    <p className="text-gray-400 font-medium text-lg leading-relaxed mb-10 max-w-lg">
                      Conecte seu conteúdo programático diretamente às funções de IA do app.
                    </p>
                    <div className="inline-flex items-center gap-4 bg-blue-600 text-white px-10 py-5 rounded-[25px] font-black uppercase italic tracking-widest shadow-2xl shadow-blue-900/40 group-hover:bg-white group-hover:text-blue-600 transition-all">
                       CONFIGURAR MEU EDITAL AGORA
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </div>
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
                      className="w-full bg-[#0A0F1E] text-white p-8 rounded-[40px] flex items-center justify-between group transition-all hover:scale-[1.01] hover:shadow-2xl shadow-blue-900/10 border-2 border-blue-600/30"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </div>
                        <div className="text-left">
                          <h3 className="text-2xl font-black italic uppercase tracking-tighter">MEU EDITAL - VISUALIZAR E EDITAR</h3>
                          <p className="text-blue-400 font-bold text-[10px] uppercase tracking-widest mt-1">Gerencie seu conteúdo programático e progresso verticalizado</p>
                        </div>
                      </div>
                      <div className="bg-blue-600 text-white p-4 rounded-2xl group-hover:bg-white group-hover:text-blue-600 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      </div>
                    </button>
                  </div>
                )}
                
                {editalConfig.isActive && (
                  <div className="lg:col-span-3">
                    <button 
                      onClick={() => setView('STUDY_CYCLE')}
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white p-8 rounded-[40px] flex items-center justify-between group transition-all hover:scale-[1.01] hover:shadow-2xl shadow-blue-200"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform backdrop-blur-md">
                          <svg className="w-8 h-8 font-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                             <h3 className="text-2xl font-black italic uppercase tracking-tighter">MEU CICLO DE ESTUDO</h3>
                             <span className="bg-white/20 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border border-white/10">INTERLIGADO</span>
                          </div>
                          <p className="text-blue-100 font-bold text-[10px] uppercase tracking-widest mt-1">Intercale matérias automaticamente com base nos pesos do seu edital</p>
                        </div>
                      </div>
                      <div className="bg-white text-blue-600 p-4 rounded-2xl group-hover:bg-blue-800 group-hover:text-white transition-all shadow-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      </div>
                    </button>
                  </div>
                )}

                <button 
                  onClick={() => { if(activeTab === 'EDITAL') setStrategicMode(true); setView('FLASHCARDS'); }} 
                  className={`p-8 rounded-[40px] text-left transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white border-none' : 'bg-white border border-gray-100'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
                  </div>
                  {activeTab === 'ESTUDO' && flashcardCount > 0 && (
                    <div className="absolute top-8 right-8 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-bounce">
                      {flashcardCount} PENDENTES
                    </div>
                  )}
                  {activeTab === 'EDITAL' && (
                    <div className="absolute top-8 right-8 bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded-full tracking-widest uppercase mb-4">MAPA DO EDITAL</div>
                  )}
                  <h2 className="text-2xl font-black mb-2 italic uppercase">FLASH<span className="text-blue-500">cards</span></h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-blue-400' : 'text-gray-400'}`}>
                    {activeTab === 'EDITAL' ? 'Conectado ao Edital' : 'Revisão Espaçada'}
                  </p>
                  
                  <div className="mt-4 flex items-center gap-2 transform translate-y-20 group-hover:translate-y-0 transition-transform">
                     <span className="bg-blue-500 text-white text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-lg">
                       {activeTab === 'EDITAL' ? 'ABRIR PELO MAPA' : 'ENTRAR NA REVISÃO'}
                     </span>
                  </div>
                </button>

                <button 
                  onClick={() => { if(activeTab === 'EDITAL') setStrategicMode(true); setView('MATERIALS'); }} 
                  className={`p-8 rounded-[40px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white border-transparent' : 'bg-white border-gray-100 shadow-sm'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </div>
                  <h2 className="text-2xl font-black mb-2 italic uppercase">MEUS <span className="text-blue-500">materiais</span></h2>
                  <p className={`text-sm font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-blue-400' : 'text-gray-400'}`}>
                    {activeTab === 'EDITAL' ? 'Arquivo Estratégico' : 'Resumos & Cadernos'}
                  </p>
                </button>

                <button 
                  onClick={() => { if(activeTab === 'EDITAL') setStrategicMode(true); setView('TDH_QUESTOES'); }} 
                  className={`p-8 rounded-[40px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 delay-75 ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white border-transparent' : 'bg-white border-gray-100'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 ${activeTab === 'EDITAL' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                  </div>
                  <h2 className="text-2xl font-black mb-2 relative z-10 uppercase italic">TDH<span className="text-blue-500">questoes</span></h2>
                  <p className={`text-sm mb-4 relative z-10 font-bold uppercase tracking-widest text-[10px] ${activeTab === 'EDITAL' ? 'text-blue-400' : 'text-gray-400'}`}>
                    {activeTab === 'EDITAL' ? 'Foco no Edital' : 'Batalha de Simulados'}
                  </p>
                </button>

                <button 
                  onClick={() => { if(activeTab === 'EDITAL') setStrategicMode(true); setView('AI_DIRECT'); }} 
                  className={`text-white p-8 rounded-[40px] text-left relative overflow-hidden group transition-all hover:scale-[1.02] hover:shadow-xl animate-in zoom-in-95 duration-300 delay-150 shadow-2xl ${activeTab === 'EDITAL' ? 'bg-gradient-to-br from-blue-900 to-black shadow-blue-900/40' : 'gradient-dark'}`}
                >
                  <div className="mb-8 w-12 h-12 bg-white/10 text-yellow-400 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <h2 className="text-3xl font-black mb-2 italic uppercase">AULA DIRETA</h2>
                  <p className="text-yellow-400/80 text-[10px] font-bold uppercase tracking-widest">{activeTab === 'EDITAL' ? 'Conteúdo do Edital' : 'IA Powered Bizu'}</p>
                </button>

                <button 
                  onClick={() => { if(activeTab === 'EDITAL') setStrategicMode(true); setView('DYNAMIC_TIMER'); }} 
                  className={`p-8 rounded-[40px] text-left border transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 delay-150 ${activeTab === 'EDITAL' ? 'bg-[#0A0F1E] text-white border-transparent' : 'bg-white border-orange-100'}`}
                >
                  <div className={`mb-8 w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 shadow-sm ${activeTab === 'EDITAL' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-500'}`}>
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h2 className="text-3xl font-black mb-2 italic uppercase">BLOCO <span className="text-orange-500">IMUTÁVEL</span></h2>
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
                        <h3 className="text-2xl font-black italic tracking-tighter uppercase">BARRA DE CALOR DA MEMÓRIA</h3>
                        <div className="flex gap-2">
                           <span className="flex items-center gap-1 text-[8px] font-black text-blue-500 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-blue-500"></div> VALIDADO</span>
                           <span className="flex items-center gap-1 text-[8px] font-black text-orange-500 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-orange-500"></div> REVISAR</span>
                        </div>
                     </div>
                     <MemoryHeatmap subjects={editalConfig.subjects} />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'ORGANIZACAO' && (
          <>
            <button onClick={() => { setTimerMode(TimerMode.POMODORO); setView('TIMER'); }} className="bg-white p-8 rounded-[40px] text-left border border-gray-100 transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="mb-8 w-12 h-12 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
              <h2 className="text-2xl font-black mb-2 italic">POMODORO</h2>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Gestão de Tempo</p>
            </button>
            <button onClick={() => setView('STUDY_PLAN')} className="bg-white p-8 rounded-[40px] text-left border border-gray-100 transition-all hover:shadow-xl hover:scale-[1.02] group relative overflow-hidden animate-in zoom-in-95 duration-300 delay-75">
              <div className="mb-8 w-12 h-12 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
              <h2 className="text-2xl font-black mb-2 italic uppercase">CRONOGRAMA</h2>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest text-[10px]">Ciclo de Estudo</p>
            </button>
            <button onClick={() => setView('FOCUS_MODE')} className="gradient-yellow text-white p-8 rounded-[40px] text-left relative overflow-hidden group transition-all hover:scale-[1.02] hover:shadow-xl animate-in zoom-in-95 duration-300 delay-150 shadow-yellow-200">
              <div className="mb-8 w-12 h-12 bg-white/20 text-white rounded-2xl flex items-center justify-center backdrop-blur-sm"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg></div>
              <h2 className="text-2xl font-black mb-2 italic uppercase">MODO FOCO</h2>
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Saúde & Blindagem</p>
            </button>
          </>
        )}

        {activeTab === 'RELAXE' && (
          <>
            <div className="bg-white rounded-[40px] p-10 border border-gray-100 flex flex-col justify-between shadow-sm relative overflow-hidden h-full animate-in zoom-in-95 duration-300 lg:col-span-2">
               <div>
                  <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2 leading-none">AMBIENTE <span className="text-yellow-400">SONORO</span></h2>
                  <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-10">Controle o Lofi e os ruídos brancos</p>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setActiveChannel(activeChannel === 'RELAX' ? null : 'RELAX')} className={`p-6 rounded-[30px] flex flex-col items-center gap-2 transition-all border-4 ${activeChannel === 'RELAX' ? 'bg-yellow-400 border-yellow-400 text-white shadow-xl shadow-yellow-100' : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'}`}>
                    <span className="text-xs font-black uppercase tracking-widest italic">LOFI RELAX</span>
                  </button>
                  <button onClick={() => setIsPlayingRain(!isPlayingRain)} className={`p-6 rounded-[30px] flex items-center justify-center gap-4 transition-all border-4 ${isPlayingRain ? 'bg-blue-500 border-blue-500 text-white shadow-xl shadow-blue-100' : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                  </button>
               </div>
            </div>
            
            <button onClick={() => { setTimerMode(TimerMode.EMERGENCY); setView('TIMER'); }} className="gradient-orange text-white p-8 rounded-[40px] text-left relative overflow-hidden group transition-all hover:scale-[1.02] hover:shadow-xl animate-in zoom-in-95 duration-300 delay-150 h-full">
              <div className="mb-12"><svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
              <h2 className="text-3xl font-black leading-none uppercase italic">EMERGÊNCIA</h2>
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-2">Dê o primeiro passo agora</p>
            </button>
          </>
        )}

        {activeTab === 'REVISAO' && (
          <div className="lg:col-span-3">
             <button 
               onClick={() => setView('SMART_REVISION')}
               className="w-full bg-[#0A0F1E] text-white p-12 rounded-[50px] text-left relative overflow-hidden group transition-all hover:scale-[1.01] hover:shadow-2xl animate-in zoom-in-95 duration-300 shadow-indigo-900/40"
             >
                <div className="max-w-2xl relative z-10">
                   <div className="mb-10 w-20 h-20 bg-indigo-500 text-white rounded-3xl flex items-center justify-center shadow-xl">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                   </div>
                   <h2 className="text-6xl font-black mb-4 italic uppercase tracking-tighter leading-none">REVISÃO <span className="text-indigo-400">inteligente</span></h2>
                   <p className="text-gray-400 font-medium text-lg leading-relaxed mb-10 max-w-lg">
                      Acesse seu motor de repetição espaçada e valide o conteúdo do edital com a IA.
                   </p>
                   <div className="inline-flex items-center gap-4 bg-indigo-600 text-white px-10 py-5 rounded-[25px] font-black uppercase italic tracking-widest shadow-2xl transition-all group-hover:bg-white group-hover:text-indigo-600">
                      ABRIR PAINEL DE REVISÃO
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                   </div>
                </div>
                <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 rotate-12 transition-transform group-hover:scale-[1.8] group-hover:rotate-0">
                  <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
             </button>
          </div>
        )}
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
