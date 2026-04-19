
import React, { useState } from 'react';
import { generateExamQuestions } from '../services/geminiService';
import { QuizQuestion, QuizFolder, StudyProfile, EditalConfig } from '../types';
import LoadingFish from './LoadingFish';
import SaveToFolderModal from './SaveToFolderModal';

interface TDHQuestoesProps {
  onBack: () => void;
  folders: QuizFolder[];
  onSaveToNotebook: (folderId: string, notebookName: string, questions: QuizQuestion[]) => void;
  studyProfile: StudyProfile;
  prefill?: string | null;
  onConsumedPrefill?: () => void;
  strategicMode?: boolean;
  editalConfig?: EditalConfig;
  onBatchComplete?: (topic: string, subject: string, total: number, correct: number, questions?: QuizQuestion[]) => void;
}

const TDHQuestoes: React.FC<TDHQuestoesProps> = ({ 
  onBack, 
  onSaveToNotebook, 
  folders, 
  studyProfile, 
  prefill, 
  onConsumedPrefill,
  strategicMode,
  editalConfig,
  onBatchComplete
}) => {
  const [topic, setTopic] = useState(prefill || '');
  const [banca, setBanca] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [showCommentary, setShowCommentary] = useState(false);
  const [saved, setSaved] = useState(false);
  const [numQuestions, setNumQuestions] = useState(10);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});

  React.useEffect(() => {
    if (prefill) {
      handleGenerate(prefill);
      onConsumedPrefill?.();
    }
  }, [prefill]);

  const handleGenerate = async (targetTopic?: string) => {
    const finalTopic = targetTopic || (strategicMode ? (selectedTopic ? `${selectedSubject}: ${selectedTopic}` : '') : topic);
    if (!finalTopic.trim()) return;
    setLoading(true);
    setQuestions([]);
    setCurrentIdx(0);
    setShowCommentary(false);
    setSaved(false);
    setUserAnswers({});
    if (!targetTopic) setTopic(finalTopic);
    
    try {
      const result = await generateExamQuestions(finalTopic, numQuestions, studyProfile, banca);
      const formatted = result.questions.map((q: any) => ({
        ...q,
        id: Math.random().toString(36).substr(2, 9)
      }));
      setQuestions(formatted);
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar simulado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelection = (idx: number) => {
    setSelectedOpt(idx);
    setUserAnswers(prev => ({ ...prev, [currentIdx]: idx }));
    
    // If it's the last question, we can potentially trigger onBatchComplete
    // but usually users wait until they see all answers. 
    // Let's trigger it when they return or finish.
  };

  const handleFinish = () => {
    const total = questions.length;
    const correct = questions.filter((q, i) => userAnswers[i] === q.correctAnswer).length;
    onBatchComplete?.(topic, selectedSubject, total, correct, questions.map((q, i) => ({ ...q, userAnswer: userAnswers[i] })));
    onBack();
  };

  const handleConfirmSave = (folderId: string, notebookName: string) => {
    onSaveToNotebook(folderId, notebookName, questions);
    setSaved(true);
    setShowSaveModal(false);
  };

  const currentQ = questions[currentIdx];

  if (loading) {
    return (
      <LoadingFish 
        message="Arquitetando seu Simulado..." 
        submessage={`IA preparando questões focadas em ${studyProfile === 'CONCURSO' ? 'Concursos de Elite' : 'ENEM/Vestibular'}`}
      />
    );
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
      {!questions.length ? (
        <div className="py-20">
          <button onClick={onBack} className="mb-10 text-gray-400 font-bold uppercase text-xs tracking-widest flex items-center gap-2 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
            VOLTAR AO HUB
          </button>
          
          <div className="bg-white rounded-[50px] p-12 md:p-20 shadow-2xl border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-10">
               <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
            </div>
            
            <div className="relative z-10 text-center max-w-2xl mx-auto">
              <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-8">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <h1 className="text-5xl font-black mb-2 tracking-tighter leading-none italic uppercase">TDH<span className="text-orange-500">{strategicMode ? 'estratégico' : 'questões'}</span></h1>
              <p className="text-gray-400 text-lg mb-8 font-medium">
                {strategicMode ? 'Questões alinhadas automaticamente ao seu edital.' : `Simulados ${studyProfile === 'CONCURSO' ? 'nível concurso público' : 'estilo Vestibular/ENEM'} com gabarito comentado.`}
              </p>
              
              <div className="space-y-8">
                {strategicMode && editalConfig ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 text-left">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Matéria do Edital</label>
                      <select 
                        value={selectedSubject}
                        onChange={(e) => { setSelectedSubject(e.target.value); setSelectedTopic(''); }}
                        className="w-full bg-gray-50 border-2 border-transparent rounded-[25px] px-6 py-5 text-lg focus:outline-none focus:border-orange-500 transition-all font-bold appearance-none cursor-pointer"
                      >
                        <option value="">Selecionar Matéria...</option>
                        {editalConfig.subjects.map((s, i) => (
                           <option key={i} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 text-left">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Assunto Específico</label>
                      <select 
                        value={selectedTopic}
                        onChange={(e) => setSelectedTopic(e.target.value)}
                        disabled={!selectedSubject}
                        className="w-full bg-gray-50 border-2 border-transparent rounded-[25px] px-6 py-5 text-lg focus:outline-none focus:border-orange-500 transition-all font-bold appearance-none cursor-pointer disabled:opacity-50"
                      >
                        <option value="">Selecionar Assunto...</option>
                        {editalConfig.subjects.find(s => s.name === selectedSubject)?.topics.map((t, i) => (
                          <option key={i} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <input 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={studyProfile === 'CONCURSO' ? "Ex: Direito Administrativo - Atos" : "Ex: Biologia - Genética Mendeliana"}
                    className="w-full bg-gray-50 border-2 border-transparent rounded-[30px] px-8 py-6 text-xl focus:outline-none focus:border-orange-500 transition-all font-medium text-center"
                    onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                  />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50/50 p-6 rounded-3xl text-left border-2 border-transparent focus-within:border-orange-200 transition-all">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Banca Examinadora (Opcional)</label>
                    <input 
                      value={banca}
                      onChange={(e) => setBanca(e.target.value)}
                      placeholder="Ex: FCC, FGV, CESPE, VUNESP..."
                      className="w-full bg-transparent border-none text-lg focus:outline-none font-bold placeholder:text-gray-300"
                    />
                  </div>
                  <div className="bg-gray-50/50 p-6 rounded-3xl">
                    <div className="flex justify-between mb-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quantidade de Questões</label>
                      <span className="text-orange-600 font-black">{numQuestions}</span>
                    </div>
                    <input 
                      type="range" min="1" max="50" 
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-full accent-orange-500 cursor-pointer"
                    />
                  </div>
                </div>

                <button 
                  onClick={() => handleGenerate()}
                  className="w-full bg-orange-500 text-white py-6 rounded-[30px] font-black text-xl hover:bg-orange-600 transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3"
                >
                  GERAR SIMULADO AGORA
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-10 space-y-8">
          <div className="flex justify-between items-center bg-white p-6 rounded-[30px] border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => { handleFinish(); setQuestions([]); }} className="p-3 hover:bg-gray-50 rounded-2xl transition-colors">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h4 className="font-black text-lg tracking-tight uppercase italic">{topic}</h4>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Questão {currentIdx + 1} de {questions.length} • {studyProfile}</p>
              </div>
            </div>
            <button 
              onClick={() => setShowSaveModal(true)}
              disabled={saved}
              className={`px-6 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all ${saved ? 'bg-green-500 text-white' : 'bg-[#0A0F1E] text-white hover:bg-orange-500'}`}
            >
              {saved ? 'SIMULADO SALVO!' : 'SALVAR EM CADERNO'}
              {!saved && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>}
            </button>
          </div>

          <div className="bg-white rounded-[45px] p-10 md:p-14 shadow-xl border border-gray-100">
            <div className="mb-10 text-xl font-bold text-[#1E293B] leading-relaxed">
              {currentQ.question}
            </div>

            <div className="grid grid-cols-1 gap-4 mb-10">
              {currentQ.options.map((opt, idx) => {
                const isCorrect = idx === currentQ.correctAnswer;
                const isSelected = selectedOpt === idx;
                
                let btnClass = "border-2 border-gray-50 bg-gray-50/30 hover:bg-white hover:border-orange-200 text-gray-700";
                
                if (selectedOpt !== null) {
                  if (isCorrect) btnClass = "border-green-500 bg-green-50 text-green-700 ring-4 ring-green-100";
                  else if (isSelected) btnClass = "border-red-500 bg-red-50 text-red-700 ring-4 ring-red-100";
                  else btnClass = "opacity-40 border-gray-100 text-gray-400";
                }

                return (
                  <button 
                    key={idx}
                    onClick={() => handleAnswerSelection(idx)}
                    disabled={selectedOpt !== null}
                    className={`w-full text-left p-6 rounded-[25px] font-bold text-base transition-all flex items-center gap-4 ${btnClass}`}
                  >
                    <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black flex-shrink-0 ${selectedOpt !== null && isCorrect ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200'}`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {selectedOpt !== null && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-4">
                <button 
                  onClick={() => setShowCommentary(!showCommentary)}
                  className="w-full bg-blue-50 text-blue-700 py-4 rounded-[20px] font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  {showCommentary ? 'OCULTAR GABARITO COMENTADO' : 'VER GABARITO COMENTADO'}
                </button>

                {showCommentary && (
                  <div className="bg-[#F8FAFC] border border-blue-100 rounded-[30px] p-8 text-sm leading-relaxed text-gray-600 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-2 text-blue-600 font-black mb-4 uppercase tracking-widest text-[10px]">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm-1-11V7h2v4h-2zm0 6v-4h2v4h-2z" /></svg>
                      EXPLICAÇÃO DA IA
                    </div>
                    {currentQ.commentary}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <button 
              onClick={() => { if(currentIdx > 0) { setCurrentIdx(currentIdx - 1); setSelectedOpt(null); setShowCommentary(false); } }}
              disabled={currentIdx === 0}
              className="px-8 py-4 bg-white border border-gray-100 rounded-2xl font-bold text-gray-400 hover:text-[#0A0F1E] disabled:opacity-30 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              ANTERIOR
            </button>
            <button 
              onClick={() => { if(currentIdx < questions.length - 1) { setCurrentIdx(currentIdx + 1); setSelectedOpt(null); setShowCommentary(false); } }}
              disabled={currentIdx === questions.length - 1}
              className="px-8 py-4 bg-white border border-gray-100 rounded-2xl font-bold text-gray-400 hover:text-[#0A0F1E] disabled:opacity-30 transition-all flex items-center gap-2"
            >
              PRÓXIMA
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}

      {showSaveModal && (
        <SaveToFolderModal 
          folders={folders}
          suggestedName={topic}
          onConfirm={handleConfirmSave}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
};

export default TDHQuestoes;
