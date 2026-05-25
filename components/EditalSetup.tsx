
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EditalConfig, EditalSubject, StudyProfile } from '../types';
import LoadingFish from './LoadingFish';
import { MEDICINA_CURRICULUM, MedicinaPeriod } from '../services/medicinaCurriculum';
import { BookOpen, Sparkles, Plus, Trash2, HelpCircle, Calendar, Clock, SkipForward } from 'lucide-react';

interface EditalSetupProps {
  studyProfile?: StudyProfile;
  onComplete: (config: EditalConfig) => void;
  onBack: () => void;
}

const EditalSetup: React.FC<EditalSetupProps> = ({ studyProfile = 'VESTIBULAR', onComplete, onBack }) => {
  const [step, setStep] = useState(1);
  const [subjectsText, setSubjectsText] = useState('');
  const [subjects, setSubjects] = useState<EditalSubject[]>([]);
  const [currentSubjectIndex, setCurrentSubjectIndex] = useState(0);
  const [examDate, setExamDate] = useState('');
  const [dailyHours, setDailyHours] = useState(4);
  const [period, setPeriod] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMedicinaSelector, setShowMedicinaSelector] = useState(false);
  const [selectedMedPeriod, setSelectedMedPeriod] = useState<number | null>(null);

  // College curriculum custom period mapping state
  const [numPeriods, setNumPeriods] = useState<number>(8);
  const [periodSubjectsText, setPeriodSubjectsText] = useState<{ [key: number]: string }>({
    1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: ''
  });
  const [activePeriodTab, setActivePeriodTab] = useState<number>(1);
  const [preloadedEmentas, setPreloadedEmentas] = useState<{ [key: string]: string }>({});

  const handleLoadMedicinaPeriod = (periodNum: number) => {
    const periodData = MEDICINA_CURRICULUM[periodNum];
    if (!periodData) return;

    const names = periodData.materias.map(m => m.nome).join('\n');
    setPeriodSubjectsText(prev => ({
      ...prev,
      [periodNum]: names
    }));

    const nextEmentas = { ...preloadedEmentas };
    periodData.materias.forEach(m => {
      nextEmentas[m.nome] = m.ementa;
    });
    setPreloadedEmentas(nextEmentas);

    if (numPeriods < periodNum) {
      setNumPeriods(periodNum);
    }
    
    setActivePeriodTab(periodNum);
    setSelectedMedPeriod(periodNum);
    setPeriod(`${periodNum}º Período`);
    setShowMedicinaSelector(false);
  };

  const handleLoadAllMedicina = () => {
    const texts: { [key: number]: string } = {};
    const nextEmentas: { [key: string]: string } = {};

    Object.entries(MEDICINA_CURRICULUM).forEach(([numStr, perItem]) => {
      const num = Number(numStr);
      const per = perItem as MedicinaPeriod;
      texts[num] = per.materias.map(m => m.nome).join('\n');
      per.materias.forEach(m => {
        nextEmentas[m.nome] = m.ementa;
      });
    });

    setNumPeriods(12);
    setPeriodSubjectsText(texts);
    setPreloadedEmentas(nextEmentas);
    setActivePeriodTab(1);
    setPeriod('Todos os Períodos');
    setShowMedicinaSelector(false);
  };

  const handleStep1 = () => {
    if (studyProfile === 'FACULDADE') {
      const allSubjectsConfigs: EditalSubject[] = [];
      for (let p = 1; p <= numPeriods; p++) {
        const text = periodSubjectsText[p] || '';
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        
        lines.forEach(name => {
          const trimmedName = name.trim();
          const ementa = preloadedEmentas[trimmedName] || '';
          
          allSubjectsConfigs.push({
            id: `${p}_${Math.random().toString(36).substr(2, 9)}`,
            name: `[${p}º Período] ${trimmedName}`,
            content: ementa,
            topics: [],
            heat: 50
          });
        });
      }
      
      if (allSubjectsConfigs.length === 0) {
        alert("Adicione pelo menos uma disciplina em algum dos períodos!");
        return;
      }
      
      setSubjects(allSubjectsConfigs);
      setCurrentSubjectIndex(0);
      setStep(2);
    } else {
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
      setCurrentSubjectIndex(0);
      setStep(2);
    }
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
      dailyHours,
      period: studyProfile === 'FACULDADE' ? period.trim() : undefined
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
          <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none">
            Configuração de <span className="text-blue-500">{studyProfile === 'FACULDADE' ? 'Grade Curricular' : 'Edital'}</span>
          </h1>
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
            showMedicinaSelector && studyProfile === 'FACULDADE' ? (
              <motion.div 
                key="medicinaSelector"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-gray-100 pb-6">
                  <div>
                    <span className="bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">
                      Medicina Multivix São Mateus
                    </span>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter mt-2 text-purple-950 animate-in slide-in-from-left duration-300">
                      Selecione o seu Período
                    </h2>
                    <p className="text-gray-400 font-medium text-xs mt-1">
                      Você pode carregar um período singular ou a grade completa do curso modelo.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={handleLoadAllMedicina}
                      type="button"
                      className="bg-purple-600 hover:bg-purple-700 text-white select-none px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all"
                    >
                      ⚡ Carregar 12 Períodos Integrados
                    </button>
                    <button 
                      onClick={() => setShowMedicinaSelector(false)}
                      type="button"
                      className="flex items-center gap-2 text-xs font-black uppercase text-gray-500 hover:text-black tracking-widest"
                    >
                      Digitar Manual
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto p-1 pr-2">
                  {Object.entries(MEDICINA_CURRICULUM).map(([numStr, perItem]) => {
                    const num = Number(numStr);
                    const per = perItem as MedicinaPeriod;
                    return (
                      <button
                        type="button"
                        key={num}
                        onClick={() => handleLoadMedicinaPeriod(num)}
                        className="group bg-white rounded-[24px] p-5 border border-purple-100 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-50/50 transition-all text-left flex flex-col justify-between min-h-[140px] relative overflow-hidden"
                      >
                        <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-purple-50 rounded-full scale-0 group-hover:scale-100 transition-transform duration-500 opacity-30" />
                        
                        <div className="space-y-1">
                          <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                            {num}º Período
                          </span>
                          <h4 className="font-black italic uppercase tracking-tight text-gray-800 group-hover:text-purple-900 transition-colors text-sm line-clamp-1 mt-1">
                            {per.nome}
                          </h4>
                        </div>
                        
                        <div className="space-y-2 mt-2">
                          <p className="text-[10px] font-bold text-gray-400 leading-tight line-clamp-2">
                            {per.materias.map(m => m.nome).join(', ')}
                          </p>
                          <div className="flex items-center justify-between text-[10px] font-black text-purple-600 uppercase tracking-widest pt-2 border-t border-purple-50/50">
                            <span>{per.materias.length} matérias</span>
                            <span className="group-hover:translate-x-1 transition-transform">Carregar →</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : studyProfile === 'FACULDADE' ? (
              <motion.div 
                key="step1-faculdade"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8 animate-in fade-in duration-300"
              >
                <div className="space-y-2">
                  <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">
                    Passo 1: Grade de Períodos e Disciplinas
                  </span>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter">
                    Grade Curricular por Período
                  </h2>
                  <p className="text-gray-400 font-medium">
                    Defina abaixo a quantidade de períodos de sua faculdade e liste as disciplinas semestre a semestre para organização perfeita focado em TDAH.
                  </p>
                </div>

                {/* Sub-step A: Choose Quantity of Periods */}
                <div className="bg-slate-50 p-6 rounded-[35px] border border-gray-100 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-extrabold text-[#0B1528] uppercase text-xs tracking-wider flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-500" />
                        1. Quantidade de Períodos do Curso:
                      </h4>
                      <p className="text-[11px] text-gray-400 font-bold">
                        Como sua faculdade se divide? Escolha o número de períodos correspondente.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-2 border border-gray-100 rounded-2xl shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.max(1, numPeriods - 1);
                          setNumPeriods(nextVal);
                          if (activePeriodTab > nextVal) {
                            setActivePeriodTab(nextVal);
                          }
                        }}
                        className="w-10 h-10 bg-gray-50 hover:bg-gray-100 text-slate-800 rounded-xl flex items-center justify-center font-black transition-colors"
                      >
                        -
                      </button>
                      <span className="text-xl font-black italic px-2 tabular-nums">
                        {numPeriods} Semestre{numPeriods > 1 ? 's' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.min(20, numPeriods + 1);
                          setNumPeriods(nextVal);
                        }}
                        className="w-10 h-10 bg-gray-50 hover:bg-gray-100 text-slate-800 rounded-xl flex items-center justify-center font-black transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Fast selection list */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    {[2, 4, 6, 8, 10, 12].map((pVal) => (
                      <button
                        type="button"
                        key={pVal}
                        onClick={() => {
                          setNumPeriods(pVal);
                          if (activePeriodTab > pVal) {
                            setActivePeriodTab(pVal);
                          }
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${numPeriods === pVal ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-white hover:bg-gray-100 text-gray-500 border border-gray-100'}`}
                      >
                        {pVal} Períodos ({pVal/2} Anos)
                      </button>
                    ))}
                  </div>
                </div>

                {/* Medicina Pre-loaded course toggle */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50/50 rounded-[30px] p-6 border border-purple-100 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                      <h3 className="text-sm font-black italic uppercase tracking-wider text-purple-950">CURSO DE MEDICINA MODELO</h3>
                    </div>
                    <p className="text-xs text-purple-700 font-medium font-bold">Deseja carregar a matriz nacional modelo de Medicina (Multivix)? Economize digitação.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMedicinaSelector(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white select-none px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple-100 transition-all hover:scale-105 active:scale-95"
                  >
                    Abrir Matriz do Curso
                  </button>
                </div>

                {/* Sub-step B: Per period disciplines tabs + editor */}
                <div className="space-y-4">
                  <h4 className="font-extrabold text-[#0B1528] uppercase text-xs tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    2. Liste as disciplinas de cada período científico:
                  </h4>

                  {/* Horizontal Tabs List */}
                  <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-100 max-w-full">
                    {Array.from({ length: numPeriods }).map((_, i) => {
                      const pNum = i + 1;
                      const hasText = (periodSubjectsText[pNum] || '').trim().length > 0;
                      return (
                        <button
                          type="button"
                          key={pNum}
                          onClick={() => setActivePeriodTab(pNum)}
                          className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all shrink-0 flex items-center gap-1.5 border ${
                            activePeriodTab === pNum 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' 
                              : 'bg-white hover:bg-gray-50 text-gray-500 border-gray-100'
                          }`}
                        >
                          {pNum}º Período
                          {hasText && (
                            <span className={`w-2 h-2 rounded-full ${activePeriodTab === pNum ? 'bg-white' : 'bg-emerald-500'} animate-pulse`} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Textarea for currently active editor */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-gray-50/70 p-4 rounded-t-[24px] border-b border-gray-100">
                      <span className="font-black italic uppercase text-xs text-blue-600">
                        Editando Grade: {activePeriodTab}º Período acadêmico
                      </span>
                      <span className="text-[10px] font-extrabold text-[#0B1528] uppercase tracking-widest bg-blue-100/60 px-2 py-0.5 rounded-md">
                        {(periodSubjectsText[activePeriodTab] || '').split('\n').filter(l => l.trim().length > 0).length} Disciplina(s)
                      </span>
                    </div>
                    <textarea 
                      value={periodSubjectsText[activePeriodTab] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPeriodSubjectsText(prev => ({
                          ...prev,
                          [activePeriodTab]: val
                        }));
                      }}
                      placeholder={`Digite o nome de cada matéria por linha para o ${activePeriodTab}º Período...\nEx:\nAnatomia I\nSemiologia Prática\nSaúde da Família`}
                      className="w-full h-52 bg-gray-50 border-2 border-transparent rounded-b-[24px] p-6 focus:outline-none focus:border-blue-500 font-bold transition-all text-gray-700"
                    />
                  </div>
                </div>

                {/* Final status / Next Step Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-gray-100">
                  <div className="text-center sm:text-left">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Resumo Acumulado:</span>
                    <p className="text-xs font-black text-gray-700 italic mt-0.5 uppercase tracking-tight">
                      {Object.values(periodSubjectsText).reduce((acc, text) => {
                        return acc + text.split('\n').filter(l => l.trim().length > 0).length;
                      }, 0)} Matérias totais em {numPeriods} Semestre(s)
                    </p>
                  </div>

                  <button 
                    onClick={handleStep1}
                    disabled={Object.values(periodSubjectsText).every(t => !t.trim())}
                    className={`px-12 py-5 rounded-[25px] font-black uppercase tracking-widest shadow-xl transition-all ${
                      !Object.values(periodSubjectsText).every(t => !t.trim()) 
                        ? 'bg-blue-600 text-white hover:scale-105 active:scale-95 shadow-blue-100' 
                        : 'bg-gray-100 text-gray-300'
                    }`}
                  >
                    Confirmar Grades e Matérias
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="step1-normal"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">
                    Passo 1: Matérias de Estudo
                  </span>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter">
                    Liste as Matérias
                  </h2>
                  <p className="text-gray-400 font-medium">
                    Cole aqui o nome das matérias principais do seu edital, uma por linha.
                  </p>
                </div>

                <textarea 
                  value={subjectsText}
                  onChange={(e) => setSubjectsText(e.target.value)}
                  placeholder="Ex: Português&#10;Matemática&#10;Direito Administrativo..."
                  className="w-full h-64 bg-gray-50 border-2 border-transparent rounded-[35px] p-8 focus:outline-none focus:border-blue-500 font-bold transition-all text-gray-700"
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
            )
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
                    <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">Passo 2: Conteúdo Programático</span>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter text-blue-950 truncate max-w-lg">{subjects[currentSubjectIndex].name}</h2>
                    <p className="text-gray-400 font-medium text-xs">
                      {studyProfile === 'FACULDADE' 
                        ? 'Cole a ementa ou tópicos de aula desta matéria (Opcional - Pode clicar em Pular).'
                        : 'Cole o conteúdo programático listado no edital para esta disciplina.'}
                    </p>
                  </div>
                  <div className="text-sm font-black text-gray-400 italic shrink-0">
                    {currentSubjectIndex + 1} / {subjects.length}
                  </div>
                </div>
              </div>

              <textarea 
                value={subjects[currentSubjectIndex].content}
                onChange={(e) => updateSubjectContent(e.target.value)}
                placeholder={studyProfile === 'FACULDADE' ? `Ementa programática ou assuntos da disciplina ${subjects[currentSubjectIndex].name} (Opcional)...` : `Assuntos cobrados em ${subjects[currentSubjectIndex].name}...`}
                className="w-full h-80 bg-gray-50 border-2 border-transparent rounded-[35px] p-8 focus:outline-none focus:border-blue-500 font-bold transition-all text-gray-700"
              />

              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                {/* Advanced Quick Skip Actions to bypass clicking through large list */}
                <button
                  type="button"
                  onClick={() => {
                    setSubjects(prev => prev.map(s => ({
                      ...s,
                      content: s.content.trim() || `Conceitos integrados e tópicos acadêmicos para a disciplina de ${s.name}.`
                    })));
                    setStep(3);
                  }}
                  className="px-6 py-4 border border-amber-200/60 bg-amber-50/50 hover:bg-amber-50 text-amber-700 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  ⚡ Pular Todas Ementas/Conteúdos
                </button>

                <div className="flex justify-end gap-3 shrink-0">
                  <button 
                    type="button"
                    onClick={() => currentSubjectIndex > 0 && setCurrentSubjectIndex(currentSubjectIndex - 1)}
                    disabled={currentSubjectIndex === 0}
                    className={`px-8 py-5 rounded-[22px] font-black uppercase text-[10px] tracking-widest transition-all ${currentSubjectIndex > 0 ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-gray-50 text-gray-300'}`}
                  >
                    Anterior
                  </button>
                  <button 
                    type="button"
                    onClick={handleStep2Next}
                    className="px-10 py-5 rounded-[22px] font-black uppercase text-[10px] tracking-widest bg-blue-600 hover:bg-blue-500 text-white shadow-xl hover:scale-105 active:scale-95 transition-all"
                  >
                    {currentSubjectIndex < subjects.length - 1 ? (studyProfile === 'FACULDADE' ? 'Próxima Disciplina' : 'Próxima Matéria') : 'Definir Parâmetros'}
                  </button>
                </div>
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
                <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">
                  {studyProfile === 'FACULDADE' ? 'Passo 3: período acadêmico' : 'Passo 3: Parâmetros'}
                </span>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter">
                  {studyProfile === 'FACULDADE' ? 'Período, Provas & Horários' : 'Data & Intensidade'}
                </h2>
                <p className="text-gray-400 font-medium font-bold text-xs">
                  {studyProfile === 'FACULDADE' 
                    ? 'Selecione em qual período você está focando para que o motor neural acompanhe suas ementas.'
                    : 'Configure sua rotina para que o Peixe calcule o ritmo de revisões focado.'}
                </p>
              </div>

              {studyProfile === 'FACULDADE' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Seu Período Atual</label>
                    <select 
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-transparent rounded-[25px] p-6 focus:outline-none focus:border-blue-500 font-bold transition-all text-gray-700 appearance-none cursor-pointer"
                    >
                      <option value="">Selecione...</option>
                      {Array.from({ length: numPeriods }).map((_, i) => {
                        const pVal = i + 1;
                        const label = `${pVal}º Período`;
                        return (
                          <option key={pVal} value={label}>
                            {label}
                          </option>
                        );
                      })}
                      <option value="Todos os Períodos">Ver Todos os Períodos</option>
                    </select>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Data das Provas Finais (Fim do Período)</label>
                    <input 
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-transparent rounded-[25px] p-6 focus:outline-none focus:border-blue-500 font-bold transition-all text-gray-700"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Carga Horária de Estudo Diário</label>
                    <div className="flex items-center gap-4 bg-gray-50 rounded-[25px] p-4">
                      <button 
                        type="button"
                        onClick={() => setDailyHours(Math.max(1, dailyHours - 1))}
                        className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm font-black text-xl hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-black text-2xl tabular-nums">{dailyHours}h</span>
                      <button 
                        type="button"
                        onClick={() => setDailyHours(Math.min(16, dailyHours + 1))}
                        className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm font-black text-xl hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Data da Prova</label>
                    <input 
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-transparent rounded-[25px] p-6 focus:outline-none focus:border-blue-500 font-bold transition-all text-gray-700"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Carga Horária Diária (Horas)</label>
                    <div className="flex items-center gap-6 bg-gray-50 rounded-[25px] p-4">
                      <button 
                        type="button"
                        onClick={() => setDailyHours(Math.max(1, dailyHours - 1))}
                        className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm font-black text-xl hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-black text-3xl tabular-nums">{dailyHours}h</span>
                      <button 
                        type="button"
                        onClick={() => setDailyHours(Math.min(16, dailyHours + 1))}
                        className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm font-black text-xl hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-center pt-8">
                <button 
                  type="button"
                  onClick={handleFinish}
                  disabled={!examDate || (studyProfile === 'FACULDADE' && !period.trim())}
                  className={`px-20 py-6 rounded-[30px] font-black uppercase tracking-widest shadow-2xl transition-all ${
                    examDate && (studyProfile !== 'FACULDADE' || period.trim()) 
                      ? 'bg-blue-600 text-white hover:scale-105 active:scale-95 shadow-blue-200 shadow-lg' 
                      : 'bg-gray-100 text-gray-300'
                  }`}
                >
                  {studyProfile === 'FACULDADE' ? 'Ativar Grade Curricular' : 'Ativar Modo Edital'}
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
