
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StudyPlan, StudySubject, DailyHistory, StudySession, EditalConfig, StudyProfile } from '../types';
import { optimizeStudyPlan } from '../services/geminiService';
import LoadingFish from './LoadingFish';

interface StudyPlanViewProps {
  onBack: () => void;
  plan: StudyPlan;
  history: DailyHistory;
  onUpdatePlan: (newPlan: StudyPlan) => void;
  onStartTimer: (subject: StudySubject) => void;
  editalConfig: EditalConfig;
  studyProfile: StudyProfile;
  onTopicComplete?: (topic: string, subject: string, isCompleted: boolean) => void;
}

const StudyPlanView: React.FC<StudyPlanViewProps> = ({ 
  onBack, 
  plan, 
  history, 
  onUpdatePlan, 
  onStartTimer,
  editalConfig,
  studyProfile,
  onTopicComplete
}) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'SETUP' | 'CRONOGRAMA'>('DASHBOARD');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  
  // States for form
  const [formName, setFormName] = useState('');
  const [formWeight, setFormWeight] = useState(3);
  const [formEditalId, setFormEditalId] = useState<string>('');

  const colors = ['#FACC15', '#3B82F6', '#10B981', '#F97316', '#8B5CF6', '#EC4899'];

  const cycleStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayMinutes = plan.sessions?.filter(s => new Date(s.date).toISOString().split('T')[0] === today)
      .reduce((acc, s) => acc + s.durationMinutes, 0) || 0;
    
    return { todayMinutes };
  }, [plan.sessions]);

  const daysToExam = useMemo(() => {
    if (!editalConfig.examDate) return null;
    const diff = new Date(editalConfig.examDate).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [editalConfig.examDate]);

  const suggestedSubject = useMemo(() => {
    if (plan.subjects.length === 0) return null;
    return [...plan.subjects].sort((a, b) => 
      (a.completedMinutesTotal / a.targetMinutes) - (b.completedMinutesTotal / b.targetMinutes)
    )[0];
  }, [plan.subjects]);

  const handleAIPlan = async () => {
    setIsOptimizing(true);
    try {
      const result = await optimizeStudyPlan(editalConfig, plan.subjects, studyProfile);
      
      // Update subjects with AI weights
      const updatedSubjects = result.subjects.map(aiSub => {
          const existing = plan.subjects.find(s => s.editalSubjectId === aiSub.editalSubjectId);
          if (existing) {
              return { ...existing, weight: aiSub.weight || existing.weight, targetMinutes: aiSub.targetMinutes || existing.targetMinutes };
          }
          // If not in plan yet, maybe we should add it? 
          // For safety, let's just map existing ones for now or add missing ones.
          const editalSub = editalConfig.subjects.find(s => s.id === aiSub.editalSubjectId);
          return {
              id: Math.random().toString(36).substr(2, 9),
              name: editalSub?.name || 'Assunto',
              weight: aiSub.weight || 1,
              color: colors[Math.floor(Math.random() * colors.length)],
              targetMinutes: aiSub.targetMinutes || 60,
              completedMinutesTotal: 0,
              editalSubjectId: aiSub.editalSubjectId
          };
      });

      onUpdatePlan({ 
          ...plan, 
          subjects: updatedSubjects as StudySubject[],
          schedule: result.proposedSchedule 
      });
      alert(`IA Planejou: ${result.advice}`);
    } catch (error) {
       console.error(error);
       alert("Erro ao otimizar com IA.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSaveSubject = () => {
    if (!formName.trim()) return;

    // Pull topics from edital if linked
    let topicsFromEdital: string[] = [];
    if (formEditalId) {
      const editalSub = editalConfig.subjects.find(s => s.id === formEditalId);
      if (editalSub) {
        topicsFromEdital = editalSub.topics || [];
      }
    }

    if (editingSubjectId) {
      // Update existing
      const updatedSubjects = plan.subjects.map(s => 
        s.id === editingSubjectId 
        ? { 
            ...s, 
            name: formName, 
            weight: formWeight, 
            targetMinutes: formWeight * 30, 
            editalSubjectId: formEditalId || undefined,
            targetTopics: topicsFromEdital.length > 0 ? topicsFromEdital : (s.targetTopics || [])
          } 
        : s
      );
      onUpdatePlan({ ...plan, subjects: updatedSubjects as StudySubject[] });
    } else {
      // Add new
      const newSubject: StudySubject = {
        id: Math.random().toString(36).substr(2, 9),
        name: formName,
        weight: formWeight,
        color: colors[plan.subjects.length % colors.length],
        targetMinutes: formWeight * 30,
        completedMinutesTotal: 0,
        editalSubjectId: formEditalId || undefined,
        targetTopics: topicsFromEdital,
        completedTopics: []
      };
      onUpdatePlan({ ...plan, subjects: [...plan.subjects, newSubject] });
    }

    setFormName('');
    setFormWeight(3);
    setFormEditalId('');
    setEditingSubjectId(null);
    setIsAdding(false);
  };

  const handleTopicToggle = (subjectId: string, topic: string) => {
    const sub = plan.subjects.find(s => s.id === subjectId);
    if (!sub) return;

    const completed = sub.completedTopics || [];
    const newCompleted = completed.includes(topic)
      ? completed.filter(t => t !== topic)
      : [...completed, topic];
    
    if (onTopicComplete) {
      onTopicComplete(topic, sub.name, !completed.includes(topic));
    }
    
    onUpdatePlan({
      ...plan,
      subjects: plan.subjects.map(s => s.id === subjectId ? { ...s, completedTopics: newCompleted } : s)
    });
  };

  const syncTopicsWithEdital = (subjectId: string) => {
    const sub = plan.subjects.find(s => s.id === subjectId);
    if (!sub || !sub.editalSubjectId) return;

    const editalSub = editalConfig.subjects.find(s => s.id === sub.editalSubjectId);
    if (!editalSub) return;

    onUpdatePlan({
      ...plan,
      subjects: plan.subjects.map(s => s.id === subjectId ? { ...s, targetTopics: editalSub.topics } : s)
    });
  };

  const syncAllTopicsWithEdital = () => {
    const updatedSubjects = plan.subjects.map(sub => {
      if (!sub.editalSubjectId) return sub;
      const editalSub = editalConfig.subjects.find(s => s.id === sub.editalSubjectId);
      if (!editalSub) return sub;
      return { ...sub, targetTopics: editalSub.topics };
    });

    onUpdatePlan({ ...plan, subjects: updatedSubjects as StudySubject[] });
    alert("Todos os tópicos do edital foram vinculados às matérias do seu ciclo!");
  };

  const startEdit = (sub: StudySubject) => {
    setEditingSubjectId(sub.id);
    setFormName(sub.name);
    setFormWeight(sub.weight);
    setFormEditalId(sub.editalSubjectId || '');
    setIsAdding(true);
  };

  const removeSubject = (id: string) => {
    onUpdatePlan({ ...plan, subjects: plan.subjects.filter(s => s.id !== id) });
  };

  const updateDailyGoal = (val: number) => {
    onUpdatePlan({ ...plan, dailyGoalMinutes: val });
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-in fade-in duration-700">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-8 px-2">
        <button onClick={onBack} className="p-3 hover:bg-gray-100 rounded-2xl transition-all">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex bg-white shadow-xl shadow-gray-100/50 border border-gray-100 p-1.5 rounded-[22px]">
          <button 
            onClick={() => setActiveTab('DASHBOARD')}
            className={`px-8 py-3 rounded-2xl text-[11px] font-black tracking-widest transition-all ${activeTab === 'DASHBOARD' ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-200' : 'text-gray-400 hover:text-gray-600'}`}
          >
            DASHBOARD
          </button>
          <button 
            onClick={() => setActiveTab('CRONOGRAMA')}
            className={`px-8 py-3 rounded-2xl text-[11px] font-black tracking-widest transition-all ${activeTab === 'CRONOGRAMA' ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-200' : 'text-gray-400 hover:text-gray-600'}`}
          >
            CRONOGRAMA
          </button>
          <button 
            onClick={() => setActiveTab('SETUP')}
            className={`px-8 py-3 rounded-2xl text-[11px] font-black tracking-widest transition-all ${activeTab === 'SETUP' ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-200' : 'text-gray-400 hover:text-gray-600'}`}
          >
            AJUSTES
          </button>
        </div>
        <div className="w-12 h-12" />
      </div>

      {activeTab === 'DASHBOARD' ? (
        <div className="space-y-6">
          {isOptimizing && <LoadingFish message="IA analisando o edital e calculando seu cronograma..." />}

          {/* AI Banner */}
          <div className="bg-[#0A0F1E] p-8 rounded-[40px] text-white flex justify-between items-center group relative overflow-hidden">
             <div className="relative z-10">
                <span className="text-yellow-400 text-[10px] font-black uppercase tracking-widest italic mb-2 block">DASHBOARD ESTRATÉGICO</span>
                <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">OTIMIZAÇÃO <span className="text-blue-400">POR IA</span></h2>
                <div className="mt-4 flex gap-4">
                   <div className="bg-white/10 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                      {daysToExam !== null ? `${daysToExam} dias até a prova` : 'Sem data de prova'}
                   </div>
                   <div className="bg-white/10 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                      {editalConfig.dailyHours}h diárias
                   </div>
                </div>
             </div>
             <button 
               onClick={handleAIPlan}
               className="bg-blue-600 text-white px-8 py-5 rounded-3xl font-black uppercase italic text-xs tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all relative z-10"
             >
                AJUDA DA IA
             </button>
             <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12 transition-transform group-hover:scale-[1.8] group-hover:rotate-0">
               <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
          </div>

          {/* Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col justify-between h-44">
              <span className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">Foco Hoje</span>
              <div>
                <span className="text-5xl font-black text-gray-800">{cycleStats.todayMinutes}</span>
                <span className="text-gray-400 font-bold ml-1 text-sm">min</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-gray-400">
                   <span>Progresso Diário</span>
                   <span>{Math.round((cycleStats.todayMinutes / plan.dailyGoalMinutes) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-50 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-yellow-400 h-full transition-all duration-1000" 
                    style={{ width: `${Math.min((cycleStats.todayMinutes / plan.dailyGoalMinutes) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-[#0A0F1E] p-8 rounded-[40px] shadow-2xl flex flex-col justify-between h-44 text-white relative overflow-hidden group">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-yellow-400/10 blur-[50px] rounded-full group-hover:bg-yellow-400/20 transition-all"></div>
              <span className="text-yellow-400 text-[10px] font-black uppercase tracking-[0.2em]">Meta Diária</span>
              <div>
                <span className="text-5xl font-black">{Math.floor(plan.dailyGoalMinutes / 60)}h</span>
                <span className="text-blue-400 font-black ml-1 text-2xl">{plan.dailyGoalMinutes % 60}m</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ritmo TDAH ORA Ativo</p>
              </div>
            </div>
          </div>

          {/* Suggested Subject Banner */}
          {suggestedSubject && (
            <div className="bg-white border-2 border-yellow-400/30 rounded-[35px] p-6 flex items-center justify-between shadow-lg shadow-yellow-50 animate-in slide-in-from-top-4">
               <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xs shadow-lg uppercase" style={{ backgroundColor: suggestedSubject.color }}>
                     FOCO
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-1">Sugestão do Ciclo</p>
                    <h3 className="text-xl font-black text-gray-800 uppercase italic leading-none">{suggestedSubject.name}</h3>
                  </div>
               </div>
               <button 
                 onClick={() => onStartTimer(suggestedSubject)}
                 className="bg-yellow-400 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl shadow-yellow-100 hover:scale-105 active:scale-95 transition-all"
               >
                 ESTUDAR AGORA
               </button>
            </div>
          )}

          {/* Subject List */}
          <div className="bg-white rounded-[45px] p-10 border border-gray-100 shadow-sm">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
               <div className="w-1 h-4 bg-yellow-400 rounded-full"></div>
               Minhas Disciplinas
            </h3>

            <div className="space-y-4">
              {plan.subjects.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-gray-300 font-bold italic">Nenhuma matéria no seu ciclo ainda.</p>
                  <button onClick={() => setActiveTab('SETUP')} className="mt-4 text-yellow-500 font-black text-xs underline uppercase tracking-widest">Configurar Agora</button>
                </div>
              ) : (
                plan.subjects.map((sub, idx) => (
                  <div key={sub.id} className="group flex items-center gap-5 p-5 rounded-[28px] bg-gray-50/50 border border-transparent hover:border-yellow-100 hover:bg-white transition-all hover:shadow-md">
                    <div 
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm"
                      style={{ backgroundColor: sub.color }}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-end mb-2">
                        <h4 className="font-black text-gray-800 uppercase text-sm tracking-tight">{sub.name}</h4>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                          {sub.completedMinutesTotal} / {sub.targetMinutes} MIN
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-700" 
                          style={{ 
                            width: `${Math.min((sub.completedMinutesTotal / sub.targetMinutes) * 100, 100)}%`,
                            backgroundColor: sub.color
                          }}
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => onStartTimer(sub)}
                      className="w-12 h-12 bg-white shadow-sm border border-gray-100 rounded-xl flex items-center justify-center text-yellow-500 hover:bg-yellow-400 hover:text-white transition-all"
                    >
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'CRONOGRAMA' ? (
        <div className="space-y-6">
          <div className="bg-[#0A0F1E] rounded-[45px] p-10 shadow-2xl flex items-center justify-between text-white relative overflow-hidden group">
             <div className="relative z-10">
                <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none mb-2">PLANEJAMENTO <span className="text-yellow-400">LOGÍSTICO</span></h2>
                <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Cronograma gerado para os próximos 15 dias</p>
             </div>
             <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center text-white backdrop-blur-md relative z-10">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
             </div>
             <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 rotate-12 transition-transform group-hover:scale-[1.8] group-hover:rotate-0">
               <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
          </div>

          <div className="space-y-4">
             {(!plan.schedule || plan.schedule.length === 0) ? (
               <div className="bg-gray-50 rounded-[40px] p-20 text-center border-2 border-dashed border-gray-200">
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-6">Nenhum cronograma ativo.</p>
                  <button 
                    onClick={() => setActiveTab('DASHBOARD')}
                    className="bg-yellow-400 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-yellow-100"
                  >
                    GERAR COM IA NO DASHBOARD
                  </button>
               </div>
             ) : (
               plan.schedule.map((day, idx) => (
                 <div key={idx} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col md:flex-row gap-8 items-center justify-between transition-all hover:shadow-xl hover:scale-[1.01]">
                    <div>
                        <span className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] mb-1 block">
                          {new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                        <h4 className="text-2xl font-black italic uppercase tracking-tighter text-gray-800">Dia de Estudo {idx + 1}</h4>
                    </div>
                    <div className="flex gap-3 flex-wrap justify-center">
                       {day.sessions.map((session, sidx) => (
                         <div key={sidx} className="bg-gray-50 px-6 py-4 rounded-3xl border border-gray-100 text-center min-w-[150px] group/session relative">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 truncate max-w-[120px] mx-auto">{session.subjectName}</p>
                            <p className="text-xl font-black text-[#0A0F1E] italic uppercase leading-none mb-2">{Math.floor(session.minutes / 60)}h {session.minutes % 60}m</p>
                            
                            {session.topics && session.topics.length > 0 && (
                               <div className="flex flex-col gap-1">
                                  {session.topics.map((t, tidx) => (
                                     <span key={tidx} className="text-[8px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md uppercase tracking-tighter truncate max-w-[120px]">
                                        🎯 {t}
                                     </span>
                                  ))}
                               </div>
                            )}
                         </div>
                       ))}
                    </div>
                 </div>
               ))
             )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Daily Goal Adjuster */}
          <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-sm">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest italic">Meta de Estudo Diária</h3>
                <span className="bg-yellow-50 text-yellow-600 px-4 py-1 rounded-full text-xs font-black">
                   {Math.floor(plan.dailyGoalMinutes / 60)}h {plan.dailyGoalMinutes % 60}m
                </span>
             </div>
             <input 
                type="range" 
                min="30" 
                max="600" 
                step="15"
                value={plan.dailyGoalMinutes}
                onChange={(e) => updateDailyGoal(Number(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-full accent-yellow-400 cursor-pointer appearance-none"
             />
             <div className="flex justify-between mt-3 text-[9px] font-bold text-gray-300 uppercase tracking-widest">
                <span>30 min</span>
                <span>10 horas</span>
             </div>
          </div>

          <div className="bg-white rounded-[40px] p-10 border border-gray-100 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
              <div>
                <h3 className="text-lg font-black text-gray-800 italic uppercase tracking-tighter">GERENCIAR CICLO</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configure suas matérias e pesos</p>
              </div>
              <div className="flex gap-2">
                {plan.subjects.some(s => s.editalSubjectId) && (
                   <button 
                     onClick={syncAllTopicsWithEdital}
                     className="bg-blue-50 text-blue-600 px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-blue-100 hover:bg-blue-100 transition-all"
                   >
                     VINCULAR TÓPICOS DO EDITAL
                   </button>
                )}
                {!isAdding && (
                  <button 
                    onClick={() => { setEditingSubjectId(null); setFormName(''); setFormWeight(3); setIsAdding(true); }}
                    className="bg-yellow-400 text-white px-8 py-3 rounded-2xl text-[10px] font-black shadow-xl shadow-yellow-100 transition-all hover:bg-yellow-500"
                  >
                    + ADICIONAR NOVA
                  </button>
                )}
              </div>
            </div>

            {isAdding && (
              <div className="mb-10 p-8 bg-gray-50 rounded-[35px] border-2 border-dashed border-yellow-200 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-xs font-black text-yellow-600 uppercase tracking-widest">
                    {editingSubjectId ? 'EDITAR MATÉRIA' : 'NOVA MATÉRIA'}
                  </h4>
                  <button onClick={() => setIsAdding(false)} className="text-gray-300 hover:text-gray-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                
                <input 
                  autoFocus
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome da Disciplina..."
                  className="w-full bg-white rounded-2xl px-6 py-4 mb-6 text-base font-bold border border-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-sm"
                />
                
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Importância (Peso)</span>
                  <span className="text-yellow-600 font-black text-lg">{formWeight}x</span>
                </div>
                <input 
                  type="range" min="1" max="5" 
                  value={formWeight}
                  onChange={(e) => setFormWeight(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-full accent-yellow-400 cursor-pointer mb-8"
                />

                <div className="mb-8">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Vincular Matéria do Edital</span>
                  <select 
                    value={formEditalId} 
                    onChange={(e) => {
                       const id = e.target.value;
                       setFormEditalId(id);
                       if (id) {
                         const sub = editalConfig.subjects.find(s => s.id === id);
                         if (sub) setFormName(sub.name);
                       }
                    }}
                    className="w-full bg-white rounded-2xl px-6 py-4 text-sm font-bold border border-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-sm"
                  >
                    <option value="">(Manual - Sem Edital)</option>
                    {editalConfig.subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex gap-4">
                  <button onClick={() => setIsAdding(false)} className="flex-1 py-4 text-gray-400 text-xs font-black uppercase tracking-widest hover:text-gray-600">CANCELAR</button>
                  <button onClick={handleSaveSubject} className="flex-1 bg-gray-800 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-gray-200 hover:bg-black transition-all">
                    {editingSubjectId ? 'SALVAR ALTERAÇÕES' : 'CONFIRMAR ADIÇÃO'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {plan.subjects.map(sub => (
                <div 
                  key={sub.id} 
                  className={`bg-gray-50/50 rounded-[35px] overflow-hidden transition-all border border-transparent hover:border-gray-100 ${expandedSubjectId === sub.id ? 'bg-white shadow-xl ring-1 ring-gray-100' : 'hover:bg-white hover:shadow-lg'}`}
                >
                   <div className="flex items-center justify-between p-6">
                      <div className="flex items-center gap-5 flex-1 cursor-pointer" onClick={() => setExpandedSubjectId(expandedSubjectId === sub.id ? null : sub.id)}>
                        <div className="w-5 h-5 rounded-full shadow-inner relative flex items-center justify-center" style={{ backgroundColor: sub.color }}>
                           {expandedSubjectId === sub.id && <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />}
                        </div>
                        <div>
                           <span className="font-black text-gray-700 uppercase text-base tracking-tight">{sub.name}</span>
                           <div className="flex gap-2 mt-0.5">
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">PESO {sub.weight}</span>
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">•</span>
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">{sub.targetMinutes} MIN/CICLO</span>
                              {sub.targetTopics && sub.targetTopics.length > 0 && (
                                <>
                                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">•</span>
                                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">{sub.completedTopics?.length || 0}/{sub.targetTopics.length} TÓPICOS</span>
                                </>
                              )}
                           </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                           onClick={() => startEdit(sub)}
                           className="p-2.5 text-blue-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                           title="Editar Matéria"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button 
                           onClick={() => removeSubject(sub.id)}
                           className="p-2.5 text-red-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                           title="Remover Matéria"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <button 
                           onClick={() => setExpandedSubjectId(expandedSubjectId === sub.id ? null : sub.id)}
                           className={`p-2.5 rounded-xl transition-all ${expandedSubjectId === sub.id ? 'bg-gray-100 text-gray-800 rotate-180' : 'text-gray-300 hover:bg-gray-100'}`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                   </div>

                   <AnimatePresence>
                     {expandedSubjectId === sub.id && (
                       <motion.div 
                         initial={{ height: 0, opacity: 0 }}
                         animate={{ height: 'auto', opacity: 1 }}
                         exit={{ height: 0, opacity: 0 }}
                         className="overflow-hidden bg-white border-t border-gray-50"
                       >
                          <div className="p-8 space-y-6">
                             {sub.targetTopics && sub.targetTopics.length > 0 ? (
                               <>
                                 <div className="flex justify-between items-center">
                                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">TÓPICOS DO EDITAL</h5>
                                    {sub.editalSubjectId && (
                                       <button 
                                          onClick={() => syncTopicsWithEdital(sub.id)}
                                          className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:underline"
                                       >
                                         Sincronizar com Edital
                                       </button>
                                    )}
                                 </div>
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                   {sub.targetTopics.map((topic, tidx) => {
                                     const isDone = sub.completedTopics?.includes(topic);
                                     return (
                                       <button 
                                          key={tidx}
                                          onClick={() => handleTopicToggle(sub.id, topic)}
                                          className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${isDone ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100 hover:border-gray-200'}`}
                                       >
                                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${isDone ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-100 text-transparent'}`}>
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                                          </div>
                                          <span className={`text-xs font-bold leading-snug ${isDone ? 'text-green-800 line-through opacity-50' : 'text-gray-700'}`}>{topic}</span>
                                       </button>
                                     );
                                   })}
                                 </div>
                               </>
                             ) : (
                               <div className="text-center py-10 bg-gray-50 rounded-[30px] border-2 border-dashed border-gray-100">
                                  <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest px-10">Nenhum tópico vinculado. Edite a matéria para vincular ao edital e carregar os tópicos.</p>
                               </div>
                             )}
                          </div>
                       </motion.div>
                     )}
                   </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyPlanView;
