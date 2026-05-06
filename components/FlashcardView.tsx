import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flashcard, FlashcardFolder, StudyProfile, EditalConfig } from '../types';
import { generateStudyContent } from '../services/geminiService';
import LoadingFish from './LoadingFish';
import ReactMarkdown from 'react-markdown';
import { RichTextEditor } from './RichTextEditor';
import { ChevronLeft, Brain, Plus, Trash2, FolderPlus, Sparkles, Check, X, RotateCcw, HelpCircle, Layers, Maximize2, Minimize2 } from 'lucide-react';

interface FlashcardViewProps {
  flashcards: Flashcard[];
  setFlashcards: React.Dispatch<React.SetStateAction<Flashcard[]>>;
  folders: FlashcardFolder[];
  setFolders: React.Dispatch<React.SetStateAction<FlashcardFolder[]>>;
  onBack: () => void;
  studyProfile: StudyProfile;
  strategicMode?: boolean;
  editalConfig?: EditalConfig;
  onReviewBatchComplete?: (folderName: string, count: number) => void;
}

type ManagedView = 'FOLDERS' | 'FOLDER_DETAIL' | 'REVIEW';

const FlashcardView: React.FC<FlashcardViewProps> = ({ 
  flashcards, 
  setFlashcards, 
  folders, 
  setFolders, 
  onBack, 
  studyProfile,
  strategicMode,
  editalConfig,
  onReviewBatchComplete
}) => {
  const [viewMode, setViewMode] = useState<ManagedView>('FOLDERS');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  
  const [newCard, setNewCard] = useState<{
    type: 'SIMPLE' | 'MULTIPLE_CHOICE';
    question: string;
    answer: string;
    explanation: string;
    options: string[];
    correctAnswerIndex: number;
    topic: string;
  }>({ 
    type: 'SIMPLE',
    question: '', 
    answer: '', 
    explanation: '',
    options: ['', '', '', '', ''], 
    correctAnswerIndex: 0,
    topic: '' 
  });
  const [newFolder, setNewFolder] = useState({ name: '', color: '#F97316' });

  // Review State
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isReviewDone, setIsReviewDone] = useState(false);

  const activeFolder = useMemo(() => folders.find(f => f.id === selectedFolderId), [folders, selectedFolderId]);
  const folderCards = useMemo(() => 
    flashcards.filter(f => selectedFolderId === 'all' ? true : f.folderId === selectedFolderId),
    [flashcards, selectedFolderId]
  );

  const dueCountOverall = useMemo(() => {
    const now = Date.now();
    return flashcards.filter(f => !f.nextReview || f.nextReview <= now).length;
  }, [flashcards]);

  const getFolderDueCount = (folderId: string) => {
    const now = Date.now();
    return flashcards.filter(f => f.folderId === folderId && (!f.nextReview || f.nextReview <= now)).length;
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolder.name) return;
    const folder: FlashcardFolder = {
      id: Math.random().toString(36).substr(2, 9),
      name: newFolder.name,
      color: newFolder.color,
      createdAt: Date.now()
    };
    setFolders(prev => [...prev, folder]);
    setShowAddFolderModal(false);
    setNewFolder({ name: '', color: '#F97316' });
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.question) return;
    if (newCard.type === 'SIMPLE' && !newCard.answer) return;
    if (newCard.type === 'MULTIPLE_CHOICE' && (!newCard.options || newCard.options.some(o => !o))) return;
    
    const card: Flashcard = {
      id: Math.random().toString(36).substr(2, 9),
      ...newCard,
      folderId: selectedFolderId || 'default',
      nextReview: Date.now(),
      interval: 0,
      easeFactor: 2.5,
      reviewsCount: 0
    };
    setFlashcards(prev => [...prev, card]);
    setNewCard({ 
      type: 'SIMPLE',
      question: '', 
      answer: '', 
      explanation: '',
      options: ['', '', '', '', ''], 
      correctAnswerIndex: 0,
      topic: activeFolder?.name || '' 
    });
    setShowAddCardModal(false);
  };

  const generateAICards = async () => {
    const finalTopic = strategicMode ? (selectedSubject && selectedTopic ? `${selectedSubject}: ${selectedTopic}` : '') : aiTopic;
    if (!finalTopic.trim()) return;
    setIsGeneratingAI(true);
    try {
      const content = await generateStudyContent(finalTopic, "Flashcards", 5, studyProfile);
      const newFlashcards: Flashcard[] = content.flashcards.map((f: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        type: 'SIMPLE',
        question: f.question,
        answer: f.answer,
        explanation: f.explanation || '',
        topic: finalTopic,
        folderId: selectedFolderId || 'default',
        nextReview: Date.now(),
        interval: 0,
        easeFactor: 2.5,
        reviewsCount: 0
      }));
      setFlashcards(prev => [...prev, ...newFlashcards]);
      setShowAIModal(false);
      setAiTopic('');
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Erro desconhecido ao gerar cards com IA.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const startReview = (folderId: string | 'all') => {
    const now = Date.now();
    const cards = flashcards.filter(f => 
       (folderId === 'all' || f.folderId === folderId) && 
       (!f.nextReview || f.nextReview <= now)
    );
    
    if (cards.length === 0) {
      alert("Nenhum card pendente para revisão nesta pasta!");
      return;
    }

    const ids = cards.map(c => c.id).sort(() => Math.random() - 0.5);
    setReviewQueue(ids);
    setCurrentReviewIndex(0);
    setShowAnswer(false);
    setIsReviewDone(false);
    setViewMode('REVIEW');
  };

  const handleRate = (quality: 0 | 1 | 2 | 3) => {
    const currentId = reviewQueue[currentReviewIndex];
    const current = flashcards.find(f => f.id === currentId);
    if (!current) return;

    setFlashcards(prev => prev.map(f => {
      if (f.id !== current.id) return f;

      const ease = f.easeFactor || 2.5;
      const count = (f.reviewsCount || 0) + 1;
      let interval = f.interval || 0;
      let nextEase = ease;

      if (quality === 0) {
        interval = 0;
        nextEase = Math.max(1.3, ease - 0.2);
      } else {
        if (interval === 0) interval = 1;
        else if (interval === 1) interval = 6;
        else interval = Math.round(interval * ease);

        if (quality === 1) nextEase = Math.max(1.3, ease - 0.15);
        if (quality === 3) nextEase = Math.min(5, ease + 0.15);
      }

      const qualityFactor = [0, 0.8, 1, 1.3][quality];
      const finalInterval = Math.round(interval * qualityFactor);
      const nextReview = Date.now() + (finalInterval * 24 * 60 * 60 * 1000);

      return {
        ...f,
        interval: finalInterval,
        easeFactor: nextEase,
        reviewsCount: count,
        nextReview: quality === 0 ? Date.now() + (10 * 60 * 1000) : nextReview
      };
    }));

    setShowAnswer(false);
    
    if (quality === 0) {
      setReviewQueue(prev => [...prev, currentId]);
    }

    if (currentReviewIndex + 1 < reviewQueue.length) {
      setCurrentReviewIndex(prev => prev + 1);
    } else {
      setIsReviewDone(true);
      if (onReviewBatchComplete) {
        onReviewBatchComplete(activeFolder?.name || 'Geral', reviewQueue.length);
      }
    }
  };

  if (isGeneratingAI) return <LoadingFish message="PROCESSANDO CONHECIMENTO..." submessage="Sua rede neural está sendo moldada pela IA de elite" />;

  return (
    <div className="fixed inset-0 z-[200] bg-[#0A0F1E] text-white selection:bg-orange-500/30 overflow-y-auto font-sans">
      <div className="w-full max-w-5xl mx-auto px-6 py-12 animate-in fade-in slide-in-from-bottom-10 duration-700">
        <AnimatePresence mode="wait">
          
          {viewMode === 'FOLDERS' && (
            <motion.div 
              key="folders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-center bg-black/40 backdrop-blur-2xl p-8 rounded-[40px] border border-white/5 shadow-2xl">
                <div className="flex items-center gap-6">
                  <button onClick={onBack} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group active:scale-90">
                    <ChevronLeft className="w-6 h-6 text-white/50 group-hover:text-white" />
                  </button>
                  <div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">
                      Flash<span className="text-orange-500">Cards</span>
                    </h1>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">SISTEMA REPETIÇÃO ESPAÇADA (SRS)</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddFolderModal(true)}
                  className="bg-orange-500 text-white p-4 rounded-2xl hover:bg-orange-400 transition-all shadow-lg active:scale-90 flex items-center gap-2 group"
                >
                  <FolderPlus className="w-6 h-6" />
                  <span className="hidden md:inline font-black text-xs uppercase tracking-widest">Nova Pasta</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 {/* Quick Review Card */}
                 <button 
                  onClick={() => startReview('all')}
                  className="group relative overflow-hidden bg-gradient-to-br from-orange-600 to-red-600 p-10 rounded-[50px] text-left shadow-2xl transition-all hover:scale-[1.03] active:scale-95"
                 >
                    <div className="relative z-10">
                      <h3 className="text-3xl font-black mb-1 uppercase tracking-tighter italic leading-none">REVISÃO GERAL</h3>
                      <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-10">Todos os cards pendentes</p>
                      <div className="flex items-center gap-4">
                         <span className="text-6xl font-black">{dueCountOverall}</span>
                         <div className="text-[10px] font-black uppercase text-white/80 leading-tight">
                           Cards<br/>Para Hoje
                         </div>
                      </div>
                    </div>
                    <div className="absolute -top-4 -right-4 p-8 opacity-20 transform group-hover:scale-125 group-hover:rotate-12 transition-all duration-500">
                       <RotateCcw className="w-32 h-32" />
                    </div>
                 </button>

                 {/* Folder List */}
                 {folders.map(folder => (
                   <div key={folder.id} className="group relative">
                     <button 
                      onClick={() => { setSelectedFolderId(folder.id); setViewMode('FOLDER_DETAIL'); }}
                      className="w-full h-full bg-white/5 backdrop-blur-xl p-10 rounded-[50px] text-left border border-white/5 hover:border-orange-500/30 transition-all hover:scale-[1.02] shadow-2xl overflow-hidden relative"
                     >
                        <div className="w-16 h-16 rounded-3xl mb-8 flex items-center justify-center shadow-lg" style={{ backgroundColor: folder.color + '20', color: folder.color }}>
                          <Layers className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none mb-1 text-white group-hover:text-orange-500 transition-colors">{folder.name}</h3>
                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                          {flashcards.filter(f => f.folderId === folder.id).length} Cards Totais
                        </p>
                        
                        {getFolderDueCount(folder.id) > 0 && (
                          <div className="mt-8 flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                             <span className="text-orange-500 font-black text-[10px] uppercase tracking-widest">
                               {getFolderDueCount(folder.id)} PENDENTES
                             </span>
                          </div>
                        )}

                        <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                          <Layers className="w-32 h-32" />
                        </div>
                     </button>
                     <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Excluir pasta e todos os seus cards?")) {
                            setFolders(prev => prev.filter(f => f.id !== folder.id));
                            setFlashcards(prev => prev.filter(c => c.folderId !== folder.id));
                          }
                        }}
                        className="absolute top-8 right-8 p-3 bg-red-500/10 text-red-500 rounded-2xl opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all z-20 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                 ))}

                 {/* Empty State / Add Suggestion */}
                 {folders.length === 0 && (
                   <div className="col-span-full py-20 text-center">
                      <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10">
                        <Layers className="w-12 h-12 text-white/20" />
                      </div>
                      <h2 className="text-2xl font-black text-white/30 uppercase italic tracking-widest">Crie sua primeira pasta para começar</h2>
                   </div>
                 )}
              </div>
            </motion.div>
          )}

          {viewMode === 'FOLDER_DETAIL' && activeFolder && (
            <motion.div 
              key="folder-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-center bg-black/40 backdrop-blur-2xl p-8 rounded-[40px] border border-white/5 shadow-2xl">
                <div className="flex items-center gap-6">
                  <button onClick={() => setViewMode('FOLDERS')} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group active:scale-90">
                    <ChevronLeft className="w-6 h-6 text-white/50 group-hover:text-white" />
                  </button>
                  <div>
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none" style={{ color: activeFolder.color }}>
                      {activeFolder.name}
                    </h2>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mt-1">{folderCards.length} CARDS NO MÓDULO</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowAddCardModal(true)}
                    className="p-4 bg-white/5 border border-white/10 text-white rounded-2xl hover:bg-white hover:text-black transition-all active:scale-90"
                    title="Novo Card Manual"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <button 
                    onClick={() => startReview(activeFolder.id)}
                    className="lg:col-span-1 bg-[#F97316] text-white p-12 rounded-[50px] flex flex-col justify-between hover:scale-[1.02] transition-all shadow-3xl shadow-orange-950/20 group relative overflow-hidden"
                  >
                     <div className="relative z-10">
                       <h3 className="text-4xl font-black uppercase italic tracking-tighter leading-none mb-2">MERGULHAR AGORA</h3>
                       <p className="text-white/60 text-[10px] uppercase font-black tracking-widest leading-tight">SRS ATIVO PARA ESTE MÓDULO</p>
                     </div>
                     <div className="flex items-end justify-between mt-16 relative z-10">
                        <span className="text-8xl font-black tabular-nums">{getFolderDueCount(activeFolder.id)}</span>
                        <div className="text-[10px] font-black uppercase leading-tight mb-4 opacity-80">
                          Cards Para<br/>Revisão
                        </div>
                     </div>
                     <div className="absolute -bottom-10 -right-10 opacity-20 transform group-hover:scale-125 group-hover:-rotate-12 transition-all duration-700">
                        <RotateCcw className="w-48 h-48" />
                     </div>
                  </button>

                  <div className="lg:col-span-2 space-y-8">
                    <button 
                      onClick={() => setShowAIModal(true)}
                      className="w-full bg-white/5 border-2 border-dashed border-white/10 p-12 rounded-[50px] hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group flex flex-col items-center justify-center gap-6"
                    >
                       <div className="w-20 h-20 bg-orange-500/10 text-orange-500 rounded-[30px] flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
                          <Sparkles className="w-10 h-10" />
                       </div>
                       <div className="text-center">
                         <h4 className="text-2xl font-black uppercase italic tracking-tight mb-2">Gerar com IA</h4>
                         <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Criar 5 flashcards técnicos via Inteligência Artificial</p>
                       </div>
                    </button>

                    <div className="space-y-4">
                       <div className="flex justify-between items-center px-4">
                         <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">ACERVO DE CARDS ({folderCards.length})</h3>
                       </div>
                       <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                          {folderCards.length === 0 ? (
                            <div className="p-16 text-center bg-white/2 border-2 border-dashed border-white/5 rounded-[40px]">
                               <p className="text-gray-600 font-black text-[10px] uppercase tracking-widest">Nenhum card cadastrado</p>
                            </div>
                          ) : (
                            folderCards.map(card => (
                              <div key={card.id} className="bg-white/5 backdrop-blur-lg p-8 rounded-[35px] border border-white/5 flex items-center justify-between group hover:border-white/20 transition-all">
                                 <div className="flex-1 min-w-0 pr-6">
                                    <p className="text-white font-bold text-lg truncate italic">{card.question}</p>
                                    <div className="flex items-center gap-4 mt-2">
                                      <span className="text-gray-500 text-[9px] font-black uppercase tracking-widest">PRÓXIMA REVISÃO:</span>
                                      <span className="text-orange-500/60 font-black text-[9px] uppercase tracking-widest">
                                        {card.nextReview ? new Date(card.nextReview).toLocaleDateString() : 'IMEDIATA'}
                                      </span>
                                    </div>
                                 </div>
                                 <button 
                                  onClick={() => { if(confirm("Excluir este card?")) setFlashcards(prev => prev.filter(f => f.id !== card.id)); }}
                                  className="opacity-0 group-hover:opacity-100 p-4 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                                 >
                                   <Trash2 className="w-5 h-5" />
                                 </button>
                              </div>
                            ))
                          )}
                       </div>
                    </div>
                  </div>
              </div>
            </motion.div>
          )}

          {viewMode === 'REVIEW' && (() => {
            const currentCard = flashcards.find(f => f.id === reviewQueue[currentReviewIndex]);
            return (
              <motion.div 
                key="review"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="py-10 flex flex-col items-center"
              >
              {isReviewDone ? (
                 <div className="flex flex-col items-center text-center space-y-12 py-20 bg-white/5 rounded-[60px] border border-white/5 p-16 w-full max-w-2xl shadow-3xl">
                    <div className="w-32 h-32 bg-green-500/20 text-green-500 rounded-[50px] flex items-center justify-center shadow-2xl">
                      <Check className="w-16 h-16" />
                    </div>
                    <div>
                      <h2 className="text-5xl font-black italic tracking-tighter uppercase mb-4">Missão Cumprida</h2>
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-xs max-w-sm mx-auto leading-relaxed">
                        Sessão de reforço sináptico concluída com sucesso. Seu cérebro está mais denso!
                      </p>
                    </div>
                    <button 
                      onClick={() => setViewMode('FOLDERS')} 
                      className="bg-orange-500 text-white px-16 py-8 rounded-full font-black uppercase tracking-[0.3em] text-xs hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-orange-500/20"
                    >
                      Voltar ao HUB
                    </button>
                 </div>
              ) : (
                <>
                  <div className="w-full flex justify-between items-center mb-12 bg-black/40 backdrop-blur-2xl p-6 rounded-[35px] border border-white/5">
                    <button onClick={() => setViewMode('FOLDERS')} className="text-gray-500 font-black text-[10px] tracking-[0.4em] uppercase flex items-center gap-3 hover:text-white transition-all group">
                      <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                      ABORTAR
                    </button>
                    <div className="flex items-center gap-6">
                       <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 italic">
                         REVISÃO TÉCNICA EM CURSO
                       </span>
                       <div className="px-4 py-2 bg-orange-500 text-white rounded-xl text-[10px] font-black tabular-nums">
                         {currentReviewIndex + 1} / {reviewQueue.length}
                       </div>
                    </div>
                  </div>

                  <div className="w-full max-w-3xl">
                    {currentReviewIndex < reviewQueue.length && (
                      <>
                        {/* Card Info Bar */}
                        <div className="flex justify-between items-center mb-6 px-4">
                          <span className="uppercase font-black text-[10px] tracking-[0.4em] text-orange-500/50">
                             {currentCard?.topic}
                          </span>
                          <span className="uppercase font-black text-[10px] tracking-[0.4em] text-white/50 bg-white/5 px-4 py-1 rounded-full">
                             {showAnswer ? 'RESOLUÇÃO' : 'ENUNCIADO'}
                          </span>
                        </div>

                        {/* Immersive Card */}
                        <motion.div 
                          layout
                          onClick={() => setShowAnswer(!showAnswer)}
                          className={`min-h-[500px] w-full rounded-[60px] p-12 md:p-20 shadow-3xl cursor-pointer transition-all duration-700 border-2 relative overflow-hidden flex flex-col justify-center ${showAnswer ? 'bg-white border-white text-[#0A0F1E]' : 'bg-white/5 border-white/10 text-white hover:border-orange-500/50'}`}
                        >
                          <AnimatePresence mode="wait">
                            {!showAnswer ? (
                              <motion.div 
                                key="question"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex flex-col h-full items-center text-center"
                              >
                                <div className="text-2xl md:text-3xl font-black italic leading-[1.3] mb-12 markdown-body overflow-y-auto max-h-[300px] custom-scrollbar selection:bg-orange-500/50" dangerouslySetInnerHTML={{ __html: currentCard?.question || '' }} />
                                
                                {currentCard?.type === 'MULTIPLE_CHOICE' && (
                                    <div className="w-full space-y-4 max-w-lg">
                                        {currentCard?.options?.map((opt, idx) => (
                                            <div key={idx} className="w-full text-left bg-white/5 border border-white/10 p-5 rounded-3xl text-sm font-bold opacity-60">
                                                <span className="font-black text-orange-500 mr-3 uppercase">{String.fromCharCode(65 + idx)})</span> {opt}
                                            </div>
                                        ))}
                                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mt-8">Toque no card para revelar a resposta</p>
                                    </div>
                                )}

                                {!currentCard?.type || currentCard.type === 'SIMPLE' && (
                                   <div className="mt-12 group flex items-center gap-4 text-white/20">
                                      <Brain className="w-8 h-8 group-hover:text-orange-500 transition-colors animate-pulse" />
                                      <span className="text-[10px] font-black uppercase tracking-[0.5em]">Processando...</span>
                                   </div>
                                )}
                              </motion.div>
                            ) : (
                              <motion.div 
                                key="answer"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex flex-col h-full space-y-10"
                              >
                                 {/* Simple Answer */}
                                 {(!currentCard?.type || currentCard.type === 'SIMPLE') && (
                                    <div className="text-center">
                                       <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mb-6">RESPOSTA DIRETA</h4>
                                       <div className="text-3xl md:text-4xl font-black italic tracking-tighter leading-tight text-[#0A0F1E] markdown-body selection:bg-orange-200" dangerouslySetInnerHTML={{ __html: currentCard?.answer || '' }} />
                                    </div>
                                 )}

                                 {/* Result Display for MC */}
                                 {currentCard?.type === 'MULTIPLE_CHOICE' && (
                                    <div className="bg-green-500/10 border border-green-500/20 p-8 rounded-[40px] text-center">
                                        <h4 className="text-[10px] font-black text-green-600 uppercase tracking-[0.4em] mb-4 text-center">GABARITO CONFIRMADO</h4>
                                        <div className="text-2xl md:text-3xl font-black italic text-[#0A0F1E] leading-tight">
                                            {String.fromCharCode(65 + (currentCard.correctAnswerIndex || 0))}) {currentCard.options?.[currentCard.correctAnswerIndex || 0]}
                                        </div>
                                    </div>
                                 )}

                                 {/* Explanation */}
                                 {currentCard?.explanation && (
                                    <div className="bg-[#0A0F1E]/5 p-10 rounded-[40px] border border-[#0A0F1E]/5">
                                      <div className="flex items-center gap-3 mb-6 text-orange-600">
                                        <HelpCircle className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">ANÁLISE TÉCNICA</span>
                                      </div>
                                      <div className="prose prose-lg text-[#0A0F1E] font-medium leading-[1.6] markdown-body selection:bg-orange-200" dangerouslySetInnerHTML={{ __html: currentCard.explanation }} />
                                    </div>
                                 )}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Decorative Elements */}
                          <div className={`absolute top-0 left-0 w-2 h-full ${showAnswer ? 'bg-orange-500' : 'bg-orange-500/20'}`}></div>
                        </motion.div>
                        
                        {/* Rating Controls */}
                        <AnimatePresence>
                          {showAnswer ? (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4"
                            >
                              <button onClick={() => handleRate(0)} className="flex flex-col items-center gap-3 bg-red-500/10 border border-red-500/20 p-8 rounded-[40px] hover:bg-red-500 hover:text-white transition-all group active:scale-95">
                                <span className="text-3xl group-hover:scale-125 transition-transform">😫</span>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 group-hover:text-white">ERREI</span>
                              </button>
                              <button onClick={() => handleRate(1)} className="flex flex-col items-center gap-3 bg-orange-500/10 border border-orange-500/20 p-8 rounded-[40px] hover:bg-orange-500 hover:text-white transition-all group active:scale-95">
                                <span className="text-3xl group-hover:scale-125 transition-transform">🫤</span>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 group-hover:text-white">DIFÍCIL</span>
                              </button>
                              <button onClick={() => handleRate(2)} className="flex flex-col items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 p-8 rounded-[40px] hover:bg-yellow-500 hover:text-white transition-all group active:scale-95">
                                <span className="text-3xl group-hover:scale-125 transition-transform">🙂</span>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500 group-hover:text-white">BOM</span>
                              </button>
                              <button onClick={() => handleRate(3)} className="flex flex-col items-center gap-3 bg-green-500/10 border border-green-500/20 p-8 rounded-[40px] hover:bg-green-500 hover:text-white transition-all group active:scale-95">
                                <span className="text-3xl group-hover:scale-125 transition-transform">😎</span>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-500 group-hover:text-white">FÁCIL</span>
                              </button>
                            </motion.div>
                          ) : (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mt-12 flex justify-center"
                            >
                              <button 
                                onClick={() => setShowAnswer(true)} 
                                className="bg-white text-[#0A0F1E] px-20 py-8 rounded-full font-black text-sm uppercase tracking-[0.4em] shadow-3xl hover:scale-105 active:scale-95 transition-all flex items-center gap-4 group"
                              >
                                REVELAR <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          );
          })()}

        </AnimatePresence>
      </div>

      {/* MODALS ESTILO BRUTALISTA DARK */}
      <AnimatePresence>
        {showAddFolderModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[1000] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0A0F1E] border border-white/10 rounded-[60px] w-full max-w-lg p-12 shadow-3xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-orange-500"></div>
                <h3 className="text-3xl font-black mb-8 uppercase italic tracking-tighter">Novo <span className="text-orange-500">Módulo</span></h3>
                <form onSubmit={handleCreateFolder} className="space-y-8">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Nome da Pasta</label>
                      <input 
                        required autoFocus
                        value={newFolder.name}
                        onChange={e => setNewFolder(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-white/5 border-2 border-white/5 rounded-[30px] px-8 py-6 focus:outline-none focus:border-orange-500 transition-all font-black italic text-xl"
                        placeholder="Ex: Legislação Penal"
                      />
                   </div>
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Cor de Identificação</label>
                      <div className="flex flex-wrap gap-4 mt-2 px-2">
                        {['#F97316', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#EAB308'].map(c => (
                          <button 
                            key={c} type="button" 
                            onClick={() => setNewFolder(prev => ({ ...prev, color: c }))}
                            className={`w-12 h-12 rounded-2xl transition-all scale-100 active:scale-90 ${newFolder.color === c ? 'ring-4 ring-offset-4 ring-offset-[#0A0F1E] ring-orange-500 scale-110' : 'opacity-40 hover:opacity-100'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                   </div>
                   <div className="flex gap-4 pt-6">
                      <button type="button" onClick={() => setShowAddFolderModal(false)} className="flex-1 py-6 font-black uppercase tracking-widest text-[10px] text-gray-500 hover:text-white transition-colors uppercase">Cancelar</button>
                      <button type="submit" className="flex-[2] bg-orange-500 text-white py-6 rounded-[30px] font-black uppercase tracking-widest text-xs shadow-2xl shadow-orange-500/20 active:scale-95">Criar Módulo</button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}

        {showAddCardModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[1000] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0A0F1E] border border-white/10 rounded-[60px] w-full max-w-2xl p-12 shadow-3xl relative overflow-hidden overflow-y-auto max-h-[90vh]">
                <div className="absolute top-0 right-0 w-2 h-full bg-orange-500"></div>
                <h3 className="text-3xl font-black mb-8 uppercase italic tracking-tighter">Arquiteto de <span className="text-orange-500">Cards</span></h3>
                <form onSubmit={handleCreateCard} className="space-y-8">
                   <div className="flex bg-white/5 p-2 rounded-[30px]">
                       <button type="button" onClick={() => setNewCard(p => ({ ...p, type: 'SIMPLE' }))} className={`flex-1 py-4 rounded-[24px] font-black text-[10px] uppercase tracking-widest transition-all ${newCard.type === 'SIMPLE' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Simples (Frente/Verso)</button>
                       <button type="button" onClick={() => setNewCard(p => ({ ...p, type: 'MULTIPLE_CHOICE' }))} className={`flex-1 py-4 rounded-[24px] font-black text-[10px] uppercase tracking-widest transition-all ${newCard.type === 'MULTIPLE_CHOICE' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Múltipla Escolha</button>
                   </div>
                   
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Pergunta (Enunciado)</label>
                      <RichTextEditor 
                        content={newCard.question}
                        onChange={html => setNewCard(prev => ({ ...prev, question: html }))}
                      />
                   </div>

                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Explicação Técnica (Opcional)</label>
                      <RichTextEditor 
                        content={newCard.explanation}
                        onChange={html => setNewCard(prev => ({ ...prev, explanation: html }))}
                      />
                   </div>

                   {newCard.type === 'SIMPLE' ? (
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Resposta Direta</label>
                        <RichTextEditor 
                          content={newCard.answer}
                          onChange={html => setNewCard(prev => ({ ...prev, answer: html }))}
                        />
                     </div>
                   ) : (
                     <div className="space-y-6">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Alternativas e Gabarito</label>
                        <div className="space-y-4">
                          {[0, 1, 2, 3, 4].map(i => (
                              <div key={i} className="flex gap-4 items-center">
                                  <input 
                                    type="radio" 
                                    checked={newCard.correctAnswerIndex === i}
                                    onChange={() => setNewCard(p => ({ ...p, correctAnswerIndex: i }))}
                                    className="w-6 h-6 accent-orange-500 cursor-pointer"
                                  />
                                  <input 
                                    required
                                    value={newCard.options[i]}
                                    onChange={e => setNewCard(p => {
                                        const newOptions = [...p.options];
                                        newOptions[i] = e.target.value;
                                        return { ...p, options: newOptions };
                                    })}
                                    className="flex-1 bg-white/5 border border-white/5 rounded-[20px] px-6 py-4 focus:outline-none focus:border-orange-500 transition-all font-bold text-sm"
                                    placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                                  />
                              </div>
                          ))}
                        </div>
                     </div>
                   )}
                   <div className="flex gap-4 pt-4 sticky bottom-0 bg-[#0A0F1E] py-4 border-t border-white/5">
                      <button type="button" onClick={() => setShowAddCardModal(false)} className="flex-1 py-6 font-black uppercase tracking-widest text-[10px] text-gray-500 hover:text-white transition-colors">Abortar</button>
                      <button type="submit" className="flex-[2] bg-orange-500 text-white py-6 rounded-[30px] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95">Salvar Card</button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}

        {showAIModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[1000] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0A0F1E] text-white rounded-[60px] w-full max-w-lg p-12 shadow-3xl border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.5)]"></div>
                
                <div className="w-20 h-20 bg-orange-500/10 text-orange-500 rounded-[30px] flex items-center justify-center mb-10 shadow-xl mx-auto">
                   <Sparkles className="w-12 h-12" />
                </div>
                
                <h3 className="text-4xl font-black mb-4 uppercase italic tracking-tighter text-center">Geração <span className="text-orange-500">Mestre</span></h3>
                <p className="text-gray-500 text-xs mb-12 text-center leading-relaxed font-black uppercase tracking-[0.2em] px-4">
                  {strategicMode ? 'O peixe-ia vai vasculhar seu edital para criar os flashcards perfeitos.' : 'Defina o tema e a IA mergulhará fundo para trazer o conhecimento puro.'}
                </p>
                
                <div className="space-y-8">
                   {strategicMode && editalConfig ? (
                     <div className="space-y-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Matéria do Edital</label>
                          <select 
                            value={selectedSubject}
                            onChange={(e) => { setSelectedSubject(e.target.value); setSelectedTopic(''); }}
                            className="w-full bg-white/5 border-2 border-white/5 rounded-[30px] px-8 py-6 focus:outline-none focus:border-orange-500 transition-all font-black italic text-lg appearance-none cursor-pointer text-white"
                          >
                            <option value="" className="bg-[#0A0F1E]">Selecionar Matéria...</option>
                            {editalConfig.subjects.map((s, i) => (
                              <option key={i} value={s.name} className="bg-[#0A0F1E]">{s.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Assunto Específico</label>
                          <select 
                            value={selectedTopic}
                            onChange={(e) => setSelectedTopic(e.target.value)}
                            disabled={!selectedSubject}
                            className="w-full bg-white/5 border-2 border-white/5 rounded-[30px] px-8 py-6 focus:outline-none focus:border-orange-500 transition-all font-black italic text-lg appearance-none cursor-pointer disabled:opacity-20 text-white"
                          >
                            <option value="" className="bg-[#0A0F1E]">Selecionar Assunto...</option>
                            {editalConfig.subjects.find(s => s.name === selectedSubject)?.topics.map((t, i) => (
                              <option key={i} value={t} className="bg-[#0A0F1E]">{t}</option>
                            ))}
                          </select>
                        </div>
                     </div>
                   ) : (
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Tema do Card</label>
                        <input 
                          required autoFocus
                          value={aiTopic}
                          onChange={e => setAiTopic(e.target.value)}
                          className="w-full bg-white/5 border-2 border-white/5 rounded-[30px] px-10 py-8 focus:outline-none focus:border-orange-500 transition-all font-black italic text-2xl text-center text-white placeholder:text-white/10"
                          placeholder="Ex: Mitose vs Meiose"
                          onKeyPress={e => e.key === 'Enter' && generateAICards()}
                        />
                     </div>
                   )}
                   
                   <div className="flex gap-4 pt-6">
                      <button onClick={() => setShowAIModal(false)} className="flex-1 py-6 font-black uppercase tracking-widest text-[10px] text-gray-500 hover:text-white transition-colors">Cancelar</button>
                      <button 
                        onClick={() => generateAICards()} 
                        disabled={strategicMode ? (!selectedSubject || !selectedTopic) : !aiTopic.trim()}
                        className="flex-[2] bg-orange-500 text-white py-6 rounded-[30px] font-black uppercase tracking-widest text-xs shadow-3xl shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        Iniciar Mergulho
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FlashcardView;
