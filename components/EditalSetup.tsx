
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EditalConfig, EditalSubject } from '../types';
import LoadingFish from './LoadingFish';

interface EditalSetupProps {
  onComplete: (config: EditalConfig) => void;
  onBack: () => void;
}

const EditalSetup: React.FC<EditalSetupProps> = ({ onComplete, onBack }) => {
  const [step, setStep] = useState(1);
  const [subjectsText, setSubjectsText] = useState('');
  const [subjects, setSubjects] = useState<EditalSubject[]>([]);
  const [currentSubjectIndex, setCurrentSubjectIndex] = useState(0);
  const [examDate, setExamDate] = useState('');
  const [dailyHours, setDailyHours] = useState(4);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStep1 = () => {
    const lines = subjectsText.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return;
    
    const initialSubjects: EditalSubject[] = lines.map((name, i) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      content: '',
      topics: [],
      heat: 50 // Start at neutral heat
    }));
    
    setSubjects(initialSubjects);
    setStep(2);
  };

  const handleStep2Next = () => {
    if (currentSubjectIndex < subjects.length - 1) {
      setCurrentSubjectIndex(currentSubjectIndex + 1);
    } else {
      setStep(3);
    }
  };

  const updateSubjectContent = (content: string) => {
    setSubjects(prev => prev.map((s, i) => i === currentSubjectIndex ? { ...s, content } : s));
  };

  const handleFinish = () => {
    onComplete({
      isActive: true,
      subjects,
      examDate,
      dailyHours
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-12">
        <button onClick={onBack} className="text-gray-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 hover:text-black transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
          Voltar
        </button>
        <div className="flex flex-col items-end text-right">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none">Configuração de <span className="text-blue-500">Edital</span></h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 italic">Conexão total estratégica</p>
        </div>
      </div>

      <div className="bg-white rounded-[50px] p-12 shadow-2xl border border-gray-100 relative overflow-hidden min-h-[500px]">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gray-50">
          <motion.div 
            className="h-full bg-blue-500"
            initial={{ width: '0%' }}
            animate={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">Passo 1: Matérias</span>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter">Liste as Matérias</h2>
                <p className="text-gray-400 font-medium">Cole aqui o nome das matérias principais do seu edital, uma por linha.</p>
              </div>

              <textarea 
                value={subjectsText}
                onChange={(e) => setSubjectsText(e.target.value)}
                placeholder="Ex: Português&#10;Matemática&#10;Direito Administrativo..."
                className="w-full h-64 bg-gray-50 border-2 border-transparent rounded-[35px] p-8 focus:outline-none focus:border-blue-500 font-bold transition-all"
              />

              <div className="flex justify-end">
                <button 
                  onClick={handleStep1}
                  disabled={!subjectsText.trim()}
                  className={`px-12 py-5 rounded-[25px] font-black uppercase tracking-widest shadow-xl transition-all ${subjectsText.trim() ? 'bg-blue-600 text-white hover:scale-105 active:scale-95' : 'bg-gray-100 text-gray-300'}`}
                >
                  Confirmar Matérias
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <div className="space-y-2">
                    <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">Passo 2: Conteúdo</span>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">{subjects[currentSubjectIndex].name}</h2>
                    <p className="text-gray-400 font-medium">Cole o conteúdo programático desta matéria conforme o edital.</p>
                  </div>
                  <div className="text-sm font-black text-gray-400 italic">
                    {currentSubjectIndex + 1} / {subjects.length}
                  </div>
                </div>
              </div>

              <textarea 
                value={subjects[currentSubjectIndex].content}
                onChange={(e) => updateSubjectContent(e.target.value)}
                placeholder={`Conteúdo de ${subjects[currentSubjectIndex].name}...`}
                className="w-full h-80 bg-gray-50 border-2 border-transparent rounded-[35px] p-8 focus:outline-none focus:border-blue-500 font-bold transition-all"
              />

              <div className="flex justify-end gap-4">
                <button 
                  onClick={() => currentSubjectIndex > 0 && setCurrentSubjectIndex(currentSubjectIndex - 1)}
                  disabled={currentSubjectIndex === 0}
                  className={`px-8 py-5 rounded-[25px] font-black uppercase tracking-widest transition-all ${currentSubjectIndex > 0 ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-100'}`}
                >
                  Anterior
                </button>
                <button 
                  onClick={handleStep2Next}
                  disabled={!subjects[currentSubjectIndex].content.trim()}
                  className={`px-12 py-5 rounded-[25px] font-black uppercase tracking-widest shadow-xl transition-all ${subjects[currentSubjectIndex].content.trim() ? 'bg-blue-600 text-white hover:scale-105 active:scale-95' : 'bg-gray-100 text-gray-300'}`}
                >
                  {currentSubjectIndex < subjects.length - 1 ? 'Próxima Matéria' : 'Definir Parâmetros'}
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="space-y-2">
                <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">Passo 3: Parâmetros</span>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter">Data & Intensidade</h2>
                <p className="text-gray-400 font-medium">Configure sua rotina para que o Peixe calcule o ritmo ideal.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Data da Prova</label>
                  <input 
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-transparent rounded-[25px] p-6 focus:outline-none focus:border-blue-500 font-bold transition-all"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Carga Horária Diária (Horas)</label>
                  <div className="flex items-center gap-6 bg-gray-50 rounded-[25px] p-4">
                    <button 
                      onClick={() => setDailyHours(Math.max(1, dailyHours - 1))}
                      className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm font-black text-xl"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-black text-3xl tabular-nums">{dailyHours}h</span>
                    <button 
                      onClick={() => setDailyHours(Math.min(16, dailyHours + 1))}
                      className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm font-black text-xl"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-8">
                <button 
                  onClick={handleFinish}
                  disabled={!examDate}
                  className={`px-20 py-6 rounded-[30px] font-black uppercase tracking-widest shadow-2xl transition-all ${examDate ? 'bg-blue-600 text-white hover:scale-105 active:scale-95 shadow-blue-200' : 'bg-gray-100 text-gray-300'}`}
                >
                  Ativar Modo Edital
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-12 text-center">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em] italic">"O segredo da aprovação é a organização impiedosa"</p>
      </div>
    </div>
  );
};

export default EditalSetup;
