import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EditalConfig, EditalSubject, StudyProfile } from '../types';
import LoadingFish from './LoadingFish';
import CharacterTip from './CharacterTip';
import { MEDICINA_CURRICULUM, MedicinaPeriod } from '../services/medicinaCurriculum';
import { BookOpen, Sparkles, Plus, Trash2, HelpCircle, Calendar, Clock, SkipForward } from './icons';

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
  const [periodSubjectsText, setPeriodSubjectsText] = useState<{
    [key: number]: string;
  }>({
    1: '',
    2: '',
    3: '',
    4: '',
    5: '',
    6: '',
    7: '',
    8: '',
  });
  const [activePeriodTab, setActivePeriodTab] = useState<number>(1);
  const [preloadedEmentas, setPreloadedEmentas] = useState<{
    [key: string]: string;
  }>({});

  const getPeriodSubjectCount = (periodNum: number) =>
    (periodSubjectsText[periodNum] || '').split('\n').filter((line) => line.trim().length > 0).length;
  const totalActivePeriodSubjects = Array.from({ length: numPeriods }, (_, index) => getPeriodSubjectCount(index + 1))
    .reduce((total, count) => total + count, 0);

  const handleLoadMedicinaPeriod = (periodNum: number) => {
    const periodData = MEDICINA_CURRICULUM[periodNum];
    if (!periodData) return;

    const names = periodData.materias.map((m) => m.nome).join('\n');
    setPeriodSubjectsText((prev) => ({
      ...prev,
      [periodNum]: names,
    }));

    const nextEmentas = { ...preloadedEmentas };
    periodData.materias.forEach((m) => {
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
      texts[num] = per.materias.map((m) => m.nome).join('\n');
      per.materias.forEach((m) => {
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
        const lines = text.split('\n').filter((l) => l.trim().length > 0);

        lines.forEach((name) => {
          const trimmedName = name.trim();
          const ementa = preloadedEmentas[trimmedName] || '';

          allSubjectsConfigs.push({
            id: `${p}_${Math.random().toString(36).substr(2, 9)}`,
            name: `[${p}º Período] ${trimmedName}`,
            content: ementa,
            topics: [],
            heat: 50,
          });
        });
      }

      if (allSubjectsConfigs.length === 0) {
        alert('Adicione pelo menos uma disciplina em algum dos períodos!');
        return;
      }

      setSubjects(allSubjectsConfigs);
      setCurrentSubjectIndex(0);
      setStep(2);
    } else {
      const lines = subjectsText.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length === 0) return;

      const initialSubjects: EditalSubject[] = lines.map((name, i) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: name.trim(),
        content: '',
        topics: [],
        heat: 50, // Start at neutral heat
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
    setSubjects((prev) => prev.map((s, i) => (i === currentSubjectIndex ? { ...s, content } : s)));
  };

  const handleFinish = () => {
    onComplete({
      isActive: true,
      subjects,
      examDate,
      dailyHours,
      period: studyProfile === 'FACULDADE' ? period.trim() : undefined,
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:py-7">
      <div className="mb-5 flex items-center justify-between gap-4 sm:mb-6">
        <button onClick={onBack} className="text-gray-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 hover:text-[#473c33] transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <div className="flex flex-col items-end text-right">
          <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">
            Configuração de <span className="text-[#fecc73]">{studyProfile === 'FACULDADE' ? 'Grade Curricular' : 'Edital'}</span>
          </h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 ">Conexão total estratégica</p>
        </div>
      </div>

      <CharacterTip id="edital-setup" message={studyProfile === 'FACULDADE' ? 'Vamos montar sua grade curricular! Liste as matérias de cada período (ou use um currículo pronto, se tiver), me diga a data da prova e quantas horas por dia você consegue estudar. No final eu monto um cronograma completo pra você.' : 'Vamos montar seu edital! Liste as matérias que vão cair na prova, a data do exame e quantas horas por dia você consegue estudar. No final eu transformo tudo isso num cronograma estratégico, sem você precisar organizar nada na mão.'} />

      <div className="relative min-h-[500px] overflow-hidden rounded-[28px] border border-gray-100 bg-white p-5 shadow-xl sm:rounded-[36px] sm:p-8">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gray-50">
          <motion.div className="h-full bg-[#fecc73]" initial={{ width: '0%' }} animate={{ width: `${(step / 3) * 100}%` }} />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 &&
            (showMedicinaSelector && studyProfile === 'FACULDADE' ? (
              <motion.div key="medicinaSelector" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-gray-100 pb-6">
                  <div>
                    <span className="bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">Medicina Multivix São Mateus</span>
                    <h2 className="text-3xl font-black uppercase tracking-tighter mt-2 text-purple-950 animate-in slide-in-from-left duration-300">Selecione o seu Período</h2>
                    <p className="text-gray-400 font-medium text-xs mt-1">Você pode carregar um período singular ou a grade completa do curso modelo.</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleLoadAllMedicina} type="button" className="bg-purple-600 hover:bg-purple-700 text-white select-none px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all">
                      ⚡ Carregar 12 Períodos Integrados
                    </button>
                    <button onClick={() => setShowMedicinaSelector(false)} type="button" className="flex items-center gap-2 text-xs font-black uppercase text-gray-500 hover:text-[#473c33] tracking-widest">
                      Digitar Manual
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto p-1 pr-2">
                  {Object.entries(MEDICINA_CURRICULUM).map(([numStr, perItem]) => {
                    const num = Number(numStr);
                    const per = perItem as MedicinaPeriod;
                    return (
                      <button type="button" key={num} onClick={() => handleLoadMedicinaPeriod(num)} className="group bg-white rounded-[24px] p-5 border border-purple-100 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-50/50 transition-all text-left flex flex-col justify-between min-h-[140px] relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-purple-50 rounded-full scale-0 group-hover:scale-100 transition-transform duration-500 opacity-30" />

                        <div className="space-y-1">
                          <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">{num}º Período</span>
                          <h4 className="font-black uppercase tracking-tight text-gray-800 group-hover:text-purple-900 transition-colors text-sm line-clamp-1 mt-1">{per.nome}</h4>
                        </div>

                        <div className="space-y-2 mt-2">
                          <p className="text-[10px] font-bold text-gray-400 leading-tight line-clamp-2">{per.materias.map((m) => m.nome).join(', ')}</p>
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
              <motion.div key="step1-faculdade" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 animate-in fade-in duration-300 sm:space-y-6">
                <div className="space-y-2">
                  <span className="curriculum-step-badge inline-flex rounded-full bg-[#fff6e8] px-3 py-1 font-black text-[9px] uppercase tracking-[0.18em] text-[#a85c28]">Passo 1 de 3 · Grade curricular</span>
                  <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Organize suas disciplinas</h2>
                  <p className="max-w-3xl text-sm font-medium leading-relaxed text-gray-500">Escolha quantos períodos tem o curso e preencha as disciplinas de cada um.</p>
                </div>

                {/* Sub-step A: Choose Quantity of Periods */}
                <section className="curriculum-panel space-y-4 rounded-3xl border border-gray-100 bg-slate-50/80 p-4 sm:p-5" aria-labelledby="period-count-heading">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fff0d5] text-[#b65f2e]"><Calendar className="h-4 w-4" /></span>
                        <div>
                          <h3 id="period-count-heading" className="font-extrabold text-[#473c33] uppercase text-xs tracking-wider">1. Quantos períodos tem seu curso?</h3>
                          <p className="mt-0.5 text-[11px] font-medium text-gray-500">Você pode alterar essa quantidade depois.</p>
                        </div>
                      </div>
                    </div>

                    <div className="curriculum-period-control flex shrink-0 items-center gap-2 rounded-2xl border border-gray-200 bg-white p-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.max(1, numPeriods - 1);
                          setNumPeriods(nextVal);
                          if (activePeriodTab > nextVal) {
                            setActivePeriodTab(nextVal);
                          }
                        }}
                        aria-label="Diminuir quantidade de períodos"
                        disabled={numPeriods <= 1}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 font-black text-slate-800 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        -
                      </button>
                      <span className="min-w-[118px] px-2 text-center text-sm font-black tabular-nums text-[#473c33] sm:text-base">
                        {numPeriods} período{numPeriods > 1 ? 's' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.min(20, numPeriods + 1);
                          setNumPeriods(nextVal);
                        }}
                        aria-label="Aumentar quantidade de períodos"
                        disabled={numPeriods >= 20}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 font-black text-slate-800 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Fast selection list */}
                  <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-3" aria-label="Opções rápidas de duração do curso">
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
                        aria-pressed={numPeriods === pVal}
                        className={`rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-wide transition-all ${numPeriods === pVal ? 'border-[#e96f34] bg-[#e96f34] text-white shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-[#e96f34]/50 hover:bg-[#fffaf4]'}`}
                      >
                        {pVal} períodos <span className="font-semibold opacity-75">· {pVal / 2} anos</span>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Medicina Pre-loaded course toggle */}
                <div className="curriculum-template flex flex-col gap-3 rounded-2xl border border-[#eadfcf] bg-[#fbf7f0] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff0d5] text-[#b65f2e]"><Sparkles className="h-4 w-4" /></span>
                    <div className="space-y-0.5">
                      <h3 className="text-xs font-black uppercase tracking-wide text-[#473c33]">Matriz pronta · Medicina Multivix</h3>
                      <p className="text-xs leading-relaxed text-gray-500">Preencha a grade modelo automaticamente ou continue digitando sua própria grade.</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowMedicinaSelector(true)} className="shrink-0 rounded-xl bg-[#e96f34] px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-white transition-colors hover:bg-[#d8612b]">
                    Usar matriz pronta
                  </button>
                </div>

                {/* Sub-step B: Per period disciplines tabs + editor */}
                <section className="space-y-3" aria-labelledby="period-subjects-heading">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 id="period-subjects-heading" className="flex items-center gap-2 font-extrabold text-[#473c33] uppercase text-xs tracking-wider">
                        <BookOpen className="h-4 w-4 text-[#e96f34]" />
                        2. Disciplinas por período
                      </h3>
                      <p className="mt-1 text-[11px] font-medium text-gray-500">Selecione um período e digite uma disciplina por linha.</p>
                    </div>
                    <span className="curriculum-total-count rounded-full bg-[#f4f0e8] px-3 py-1 text-[10px] font-black text-[#6e6255]">{totalActivePeriodSubjects} disciplina{totalActivePeriodSubjects === 1 ? '' : 's'}</span>
                  </div>

                  {/* Compact grid keeps every period visible without a clipped horizontal tab row. */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6" role="tablist" aria-label="Períodos do curso">
                    {Array.from({ length: numPeriods }).map((_, i) => {
                      const pNum = i + 1;
                      const subjectCount = getPeriodSubjectCount(pNum);
                      return (
                        <button type="button" role="tab" aria-selected={activePeriodTab === pNum} key={pNum} onClick={() => setActivePeriodTab(pNum)} className={`curriculum-period-tab flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${activePeriodTab === pNum ? 'border-[#e96f34] bg-[#fff6ed] text-[#8a421f] shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-[#e96f34]/50 hover:bg-[#fffaf4]'}`}>
                          <span className="text-[10px] font-black uppercase tracking-wide">{pNum}º período</span>
                          <span className={`curriculum-subject-count shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${subjectCount ? 'bg-[#e9efda] text-[#526b32]' : 'bg-gray-100 text-gray-400'}`}>{subjectCount}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Textarea for currently active editor */}
                  <div className="curriculum-editor overflow-hidden rounded-2xl border border-gray-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#b65f2e]">Editando período {activePeriodTab}</p>
                        <p className="mt-0.5 text-xs font-semibold text-gray-600">Uma disciplina por linha</p>
                      </div>
                      <span className="curriculum-editor-count rounded-lg bg-[#f4f0e8] px-2.5 py-1 text-[10px] font-extrabold text-[#6e6255]">{getPeriodSubjectCount(activePeriodTab)} disciplina{getPeriodSubjectCount(activePeriodTab) === 1 ? '' : 's'} cadastrada{getPeriodSubjectCount(activePeriodTab) === 1 ? '' : 's'}</span>
                    </div>
                    <textarea
                      value={periodSubjectsText[activePeriodTab] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPeriodSubjectsText((prev) => ({
                          ...prev,
                          [activePeriodTab]: val,
                        }));
                      }}
                      aria-label={`Disciplinas do período ${activePeriodTab}`}
                      placeholder={`Ex.: Anatomia I\nSemiologia Prática\nSaúde da Família`}
                      className="w-full min-h-40 resize-y bg-transparent px-4 py-4 text-sm font-medium leading-relaxed text-gray-700 placeholder:text-gray-400 focus:outline-none sm:min-h-44 sm:px-5"
                    />
                  </div>
                </section>

                {/* Final status / Next Step Actions */}
                <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-center sm:text-left">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">Resumo desta grade</span>
                    <p className="mt-0.5 text-xs font-bold text-gray-700">
                      {totalActivePeriodSubjects} disciplina{totalActivePeriodSubjects === 1 ? '' : 's'} em {numPeriods} período{numPeriods === 1 ? '' : 's'}
                    </p>
                  </div>

                  <button onClick={handleStep1} disabled={totalActivePeriodSubjects === 0} className="rounded-2xl bg-[#e96f34] px-6 py-3.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md transition hover:bg-[#d8612b] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none sm:min-w-60">
                    Continuar com esta grade
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="step1-normal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="space-y-2">
                  <span className="bg-[#fff6e8] text-[#fec868] px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">Passo 1: Matérias de Estudo</span>
                  <h2 className="text-4xl font-black uppercase tracking-tighter">Liste as Matérias</h2>
                  <p className="text-gray-400 font-medium">Cole aqui o nome das matérias principais do seu edital, uma por linha.</p>
                </div>

                <textarea
                  value={subjectsText}
                  onChange={(e) => setSubjectsText(e.target.value)}
                  placeholder="Ex: Português&#10;Matemática&#10;Direito Administrativo..."
                  className="w-full h-64 bg-gray-50 border-2 border-transparent rounded-[35px] p-8 focus:outline-none focus:border-[#fecc73] font-bold transition-all text-gray-700"
                />

                <div className="flex justify-end">
                  <button onClick={handleStep1} disabled={!subjectsText.trim()} className={`px-12 py-5 rounded-[25px] font-black uppercase tracking-widest shadow-xl transition-all ${subjectsText.trim() ? 'bg-[#fec868] text-white hover:scale-105 active:scale-95' : 'bg-gray-100 text-gray-300'}`}>
                    Confirmar Matérias
                  </button>
                </div>
              </motion.div>
            ))}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <div className="space-y-2">
                    <span className="bg-[#fff6e8] text-[#fec868] px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">Passo 2: Conteúdo Programático</span>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-[#734a00] truncate max-w-lg">{subjects[currentSubjectIndex].name}</h2>
                    <p className="text-gray-400 font-medium text-xs">{studyProfile === 'FACULDADE' ? 'Cole a ementa ou tópicos de aula desta matéria (Opcional - Pode clicar em Pular).' : 'Cole o conteúdo programático listado no edital para esta disciplina.'}</p>
                  </div>
                  <div className="text-sm font-black text-gray-400 shrink-0">
                    {currentSubjectIndex + 1} / {subjects.length}
                  </div>
                </div>
              </div>

              <textarea value={subjects[currentSubjectIndex].content} onChange={(e) => updateSubjectContent(e.target.value)} placeholder={studyProfile === 'FACULDADE' ? `Ementa programática ou assuntos da disciplina ${subjects[currentSubjectIndex].name} (Opcional)...` : `Assuntos cobrados em ${subjects[currentSubjectIndex].name}...`} className="w-full h-80 bg-gray-50 border-2 border-transparent rounded-[35px] p-8 focus:outline-none focus:border-[#fecc73] font-bold transition-all text-gray-700" />

              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                {/* Advanced Quick Skip Actions to bypass clicking through large list */}
                <button
                  type="button"
                  onClick={() => {
                    setSubjects((prev) =>
                      prev.map((s) => ({
                        ...s,
                        content: s.content.trim() || `Conceitos integrados e tópicos acadêmicos para a disciplina de ${s.name}.`,
                      })),
                    );
                    setStep(3);
                  }}
                  className="px-6 py-4 border border-[#fed6ba]/60 bg-[#fff1e8]/50 hover:bg-[#fff1e8] text-[#ff832a] rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <SkipForward className="w-3.5 h-3.5" />⚡ Pular Todas Ementas/Conteúdos
                </button>

                <div className="flex justify-end gap-3 shrink-0">
                  <button type="button" onClick={() => currentSubjectIndex > 0 && setCurrentSubjectIndex(currentSubjectIndex - 1)} disabled={currentSubjectIndex === 0} className={`px-8 py-5 rounded-[22px] font-black uppercase text-[10px] tracking-widest transition-all ${currentSubjectIndex > 0 ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-gray-50 text-gray-300'}`}>
                    Anterior
                  </button>
                  <button type="button" onClick={handleStep2Next} className="px-10 py-5 rounded-[22px] font-black uppercase text-[10px] tracking-widest bg-[#fec868] hover:bg-[#fecc73] text-white shadow-xl hover:scale-105 active:scale-95 transition-all">
                    {currentSubjectIndex < subjects.length - 1 ? (studyProfile === 'FACULDADE' ? 'Próxima Disciplina' : 'Próxima Matéria') : 'Definir Parâmetros'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-12">
              <div className="space-y-2">
                <span className="bg-[#fff6e8] text-[#fec868] px-4 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase">{studyProfile === 'FACULDADE' ? 'Passo 3: período acadêmico' : 'Passo 3: Parâmetros'}</span>
                <h2 className="text-4xl font-black uppercase tracking-tighter">{studyProfile === 'FACULDADE' ? 'Período, Provas & Horários' : 'Data & Intensidade'}</h2>
                <p className="text-gray-400 font-medium font-bold text-xs">{studyProfile === 'FACULDADE' ? 'Selecione em qual período você está focando para que o motor neural acompanhe suas ementas.' : 'Configure sua rotina para que o Peixe calcule o ritmo de revisões focado.'}</p>
              </div>

              {studyProfile === 'FACULDADE' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Seu Período Atual</label>
                    <select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full bg-gray-50 border-2 border-transparent rounded-[25px] p-6 focus:outline-none focus:border-[#fecc73] font-bold transition-all text-gray-700 appearance-none cursor-pointer">
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
                    <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="w-full bg-gray-50 border-2 border-transparent rounded-[25px] p-6 focus:outline-none focus:border-[#fecc73] font-bold transition-all text-gray-700" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Carga Horária de Estudo Diário</label>
                    <div className="flex items-center gap-4 bg-gray-50 rounded-[25px] p-4">
                      <button type="button" onClick={() => setDailyHours(Math.max(1, dailyHours - 1))} className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-[#fecc73] shadow-sm font-black text-xl hover:bg-gray-100">
                        -
                      </button>
                      <span className="flex-1 text-center font-black text-2xl tabular-nums">{dailyHours}h</span>
                      <button type="button" onClick={() => setDailyHours(Math.min(16, dailyHours + 1))} className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-[#fecc73] shadow-sm font-black text-xl hover:bg-gray-100">
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Data da Prova</label>
                    <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="w-full bg-gray-50 border-2 border-transparent rounded-[25px] p-6 focus:outline-none focus:border-[#fecc73] font-bold transition-all text-gray-700" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Carga Horária Diária (Horas)</label>
                    <div className="flex items-center gap-6 bg-gray-50 rounded-[25px] p-4">
                      <button type="button" onClick={() => setDailyHours(Math.max(1, dailyHours - 1))} className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-[#fecc73] shadow-sm font-black text-xl hover:bg-gray-100">
                        -
                      </button>
                      <span className="flex-1 text-center font-black text-3xl tabular-nums">{dailyHours}h</span>
                      <button type="button" onClick={() => setDailyHours(Math.min(16, dailyHours + 1))} className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-[#fecc73] shadow-sm font-black text-xl hover:bg-gray-100">
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-center pt-8">
                <button type="button" onClick={handleFinish} disabled={!examDate || (studyProfile === 'FACULDADE' && !period.trim())} className={`px-20 py-6 rounded-[30px] font-black uppercase tracking-widest shadow-2xl transition-all ${examDate && (studyProfile !== 'FACULDADE' || period.trim()) ? 'bg-[#fec868] text-white hover:scale-105 active:scale-95 shadow-[#ffe6b9]/60 shadow-lg' : 'bg-gray-100 text-gray-300'}`}>
                  {studyProfile === 'FACULDADE' ? 'Ativar Grade Curricular' : 'Ativar Modo Edital'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-12 text-center">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em] ">"O segredo da aprovação é a organização impiedosa"</p>
      </div>
    </div>
  );
};

export default EditalSetup;
