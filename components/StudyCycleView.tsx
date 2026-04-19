
import React, { useState } from 'react';
import { generateStudyCycle } from '../services/geminiService';
import { EditalConfig, StudyCycle, StudyCycleStep } from '../types';
import LoadingFish from './LoadingFish';
import { motion, AnimatePresence } from 'framer-motion';

interface StudyCycleViewProps {
  onBack: () => void;
  edital: EditalConfig;
  currentCycle: StudyCycle | null;
  onUpdateCycle: (cycle: StudyCycle) => void;
  onStartSession: (step: StudyCycleStep) => void;
}

const StudyCycleView: React.FC<StudyCycleViewProps> = ({
  onBack,
  edital,
  currentCycle,
  onUpdateCycle,
  onStartSession
}) => {
  const [loading, setLoading] = useState(false);
  const [totalHours, setTotalHours] = useState(10);
  const [isEditing, setIsEditing] = useState(false);

  const handleGenerate = async () => {
    if (!edital.subjects.length) {
      alert("Adicione matérias ao seu edital primeiro!");
      return;
    }
    setLoading(true);
    try {
      const result = await generateStudyCycle(edital, totalHours);
      const newCycle: StudyCycle = {
        id: Math.random().toString(36).substr(2, 9),
        name: `Ciclo OTIMIZADO (${totalHours}h)`,
        steps: result.steps.map((s: any) => ({
          ...s,
          id: Math.random().toString(36).substr(2, 9),
          completed: false
        })),
        currentStepIndex: 0,
        createdAt: Date.now()
      };
      onUpdateCycle(newCycle);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao arquitetar ciclo neural.");
    } finally {
      setLoading(false);
    }
  };

  const toggleStep = (index: number) => {
    if (!currentCycle) return;
    const newSteps = [...currentCycle.steps];
    newSteps[index].completed = !newSteps[index].completed;
    
    // Find next uncompleted step
    const nextIdx = newSteps.findIndex(s => !s.completed);
    
    onUpdateCycle({
      ...currentCycle,
      steps: newSteps,
      currentStepIndex: nextIdx === -1 ? 0 : nextIdx
    });
  };

  const updateStepDuration = (index: number, minutes: number) => {
    if (!currentCycle) return;
    const newSteps = [...currentCycle.steps];
    newSteps[index].durationMinutes = minutes;
    onUpdateCycle({ ...currentCycle, steps: newSteps });
  };

  const deleteStep = (index: number) => {
    if (!currentCycle) return;
    if (currentCycle.steps.length <= 1) {
      if(confirm("Deseja apagar o ciclo inteiro?")) onUpdateCycle(null as any);
      return;
    }
    const newSteps = currentCycle.steps.filter((_, i) => i !== index);
    onUpdateCycle({ ...currentCycle, steps: newSteps });
  };

  const deleteCycle = () => {
    if(confirm("Deseja excluir este ciclo de estudos permanentemente?")) {
      onUpdateCycle(null as any);
      onBack();
    }
  };

  if (loading) {
    return <LoadingFish message="Algoritmo de Ciclo Neural ATIVADO..." submessage="Equilibrando matérias e pesos do seu edital para evitar o burnout." />;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="text-gray-400 font-black text-xs tracking-widest uppercase flex items-center gap-2 hover:text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          VOLTAR
        </button>
        <div className="flex items-center gap-4">
          {currentCycle && (
            <button 
              onClick={deleteCycle}
              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
              title="Excluir Ciclo"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">Ciclo de <span className="text-blue-500">Estudo</span></h1>
        </div>
      </div>

      {!currentCycle ? (
        <div className="bg-white rounded-[40px] p-10 shadow-2xl border border-gray-100 text-center">
          <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </div>
          <h2 className="text-2xl font-black mb-4">Você ainda não tem um ciclo ativo.</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">Um ciclo de estudos intercala matérias para manter seu cérebro TDAH engajado e garante que você cubra todo o edital proporcionalmente aos pesos.</p>
          
          <div className="bg-gray-50 p-6 rounded-3xl mb-8">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Tamanho do Ciclo</span>
              <span className="text-blue-600 font-bold">{totalHours} Horas</span>
            </div>
            <input 
              type="range" min="5" max="50" step="5"
              value={totalHours}
              onChange={(e) => setTotalHours(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-full accent-blue-500 cursor-pointer"
            />
          </div>

          <button 
            onClick={handleGenerate}
            className="w-full bg-blue-500 text-white py-6 rounded-[25px] font-black text-xl hover:bg-blue-600 transition-all shadow-xl shadow-blue-100"
          >
            GERAR CICLO ESTRATÉGICO
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-[#0A0F1E] rounded-[35px] p-8 text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter">{currentCycle.name}</h3>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Progresso do Ciclo: {Math.round((currentCycle.steps.filter(s => s.completed).length / currentCycle.steps.length) * 100)}%</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className={`p-3 rounded-2xl transition-colors ${isEditing ? 'bg-orange-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    title={isEditing ? "Salvar Edições" : "Editar Passos"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button 
                    onClick={() => { if(confirm("Deseja resetar o progresso das matérias?")) onUpdateCycle({ ...currentCycle, steps: currentCycle.steps.map(s => ({ ...s, completed: false })), currentStepIndex: 0 })}}
                    className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-colors"
                    title="Resetar Progresso"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
              </div>
              
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentCycle.steps.filter(s => s.completed).length / currentCycle.steps.length) * 100}%` }}
                  className="h-full bg-blue-500"
                />
              </div>
            </div>
            
            <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
              <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {currentCycle.steps.map((step, idx) => (
              <div 
                key={step.id}
                className={`group bg-white p-5 rounded-[25px] border-2 transition-all flex items-center justify-between ${step.completed ? 'opacity-50 border-transparent grayscale' : (currentCycle.currentStepIndex === idx ? 'border-blue-500 shadow-lg shadow-blue-50 ring-4 ring-blue-50/50' : 'border-gray-50 hover:border-gray-200')}`}
              >
                <div className="flex items-center gap-5">
                  <button 
                    onClick={() => toggleStep(idx)}
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${step.completed ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}
                  >
                    {step.completed ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <span className="font-black text-sm">{idx + 1}</span>
                    )}
                  </button>
                  <div>
                    <h4 className="font-black text-lg tracking-tight uppercase italic">{step.subjectName}</h4>
                    <div className="flex items-center gap-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            value={step.durationMinutes}
                            onChange={(e) => updateStepDuration(idx, Number(e.target.value))}
                            className="w-16 bg-gray-100 border-none rounded px-2 py-1 text-[10px] font-black focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-[10px] font-black text-gray-400">MIN</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md uppercase tracking-widest">{step.durationMinutes} min</span>
                      )}
                      {currentCycle.currentStepIndex === idx && !step.completed && !isEditing && (
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse">PRÓXIMA META</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isEditing && (
                    <button 
                      onClick={() => deleteStep(idx)}
                      className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                  {!step.completed && !isEditing && (
                    <button 
                      onClick={() => onStartSession(step)}
                      className="p-4 bg-gray-50 rounded-2xl text-gray-400 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={() => { if(confirm("Deseja gerar um NOVO ciclo? O atual será perdido.")) handleGenerate(); }}
            className="w-full py-4 text-gray-400 font-bold text-xs uppercase tracking-widest hover:text-blue-500 transition-colors"
          >
            Regerar Ciclo com Novos Ajustes do Edital
          </button>
        </div>
      )}
    </div>
  );
};

export default StudyCycleView;
