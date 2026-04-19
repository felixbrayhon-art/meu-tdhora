
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flashcard, FlashcardFolder, StudyProfile, EditalConfig } from '../types';
import { generateStudyContent } from '../services/geminiService';
import LoadingFish from './LoadingFish';

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
  
  const [newCard, setNewCard] = useState({ question: '', answer: '', topic: '' });
  const [newFolder, setNewFolder] = useState({ name: '', color: '#3B82F6' });

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
    setNewFolder({ name: '', color: '#3B82F6' });
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.question || !newCard.answer) return;
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
    setNewCard({ question: '', answer: '', topic: activeFolder?.name || '' });
    setShowAddCardModal(false);
  };

  const generateAICards = async () => {
    const finalTopic = strategicMode ? (selectedTopic ? `${selectedSubject}: ${selectedTopic}` : '') : aiTopic;
    if (!finalTopic.trim()) return;
    setIsGeneratingAI(true);
    try {
      const content = await generateStudyContent(finalTopic, "Flashcards", 5, studyProfile);
      const newFlashcards: Flashcard[] = content.flashcards.map((f: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        question: f.question,
        answer: f.answer,
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
      alert(`${newFlashcards.length} flashcards gerados com sucesso!`);
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar cards com IA.");
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
      // Re-add missed card to the end
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

  if (isGeneratingAI) return <LoadingFish message="Processando conhecimento..." submessage="IA está moldando seus novos flashcards" />;

  return (
    <div className="min-h-screen pb-20 px-4 max-w-5xl mx-auto">
      <AnimatePresence mode="wait">
        
        {viewMode === 'FOLDERS' && (
          <motion.div 
            key="folders"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-10 py-10"
          >
            <div className="flex justify-between items-center">
               <button onClick={onBack} className="text-gray-400 font-black text-[10px] tracking-widest uppercase flex items-center gap-2">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                 Voltar ao Hub
               </button>
               <h1 className="text-3xl font-black italic uppercase tracking-tighter">Gerenciar <span className="text-blue-500">Cards</span></h1>
               <div className="w-20"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {/* Quick Review Card */}
               <button 
                onClick={() => startReview('all')}
                className="bg-[#0A0F1E] text-white p-8 rounded-[40px] text-left relative overflow-hidden group shadow-2xl transition-all hover:scale-[1.02]"
               >
                  <div className="relative z-10">
                    <h3 className="text-2xl font-black mb-1 uppercase tracking-tighter italic">REVISÃO GERAL</h3>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-8">Todos os cards pendentes</p>
                    <div className="flex items-center gap-3">
                       <span className="text-4xl font-black text-yellow-400">{dueCountOverall}</span>
                       <span className="text-[10px] font-black uppercase text-gray-400 leading-tight">Cards<br/>Pendentes</span>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-4 -translate-y-4">
                     <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
               </button>

               {/* Folder List */}
               {folders.map(folder => (
                 <button 
                  key={folder.id}
                  onClick={() => { setSelectedFolderId(folder.id); setViewMode('FOLDER_DETAIL'); }}
                  className="bg-white p-8 rounded-[40px] text-left border border-gray-100 hover:shadow-xl transition-all hover:scale-[1.02] relative group"
                 >
                    <div className="w-12 h-12 rounded-2xl mb-6 flex items-center justify-center shadow-sm" style={{ backgroundColor: folder.color + '15', color: folder.color }}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    </div>
                    <h3 className="text-xl font-black uppercase italic tracking-tight">{folder.name}</h3>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                      {flashcards.filter(f => f.folderId === folder.id).length} Cards
                    </p>
                    
                    {getFolderDueCount(folder.id) > 0 && (
                      <div className="absolute top-8 right-8 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-bounce">
                        {getFolderDueCount(folder.id)}
                      </div>
                    )}
                 </button>
               ))}

               {/* Add Folder Button */}
               <button 
                onClick={() => setShowAddFolderModal(true)}
                className="bg-gray-50 p-8 rounded-[40px] text-left border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center gap-4 group"
               >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-blue-500 group-hover:scale-110 transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <span className="text-[10px] font-black uppercase text-gray-400 group-hover:text-blue-500 tracking-widest">Nova Pasta</span>
               </button>
            </div>
          </motion.div>
        )}

        {viewMode === 'FOLDER_DETAIL' && activeFolder && (
          <motion.div 
            key="folder-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="py-10 space-y-8"
          >
            <div className="flex justify-between items-center">
               <button onClick={() => setViewMode('FOLDERS')} className="text-gray-400 font-bold text-[10px] tracking-widest uppercase flex items-center gap-2">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                 Pastas
               </button>
               <div className="text-center">
                  <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none" style={{ color: activeFolder.color }}>{activeFolder.name}</h2>
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">{folderCards.length} CARDS TOTAIS</p>
               </div>
               <div className="flex gap-2">
                 <button onClick={() => { setFolders(prev => prev.filter(f => f.id !== activeFolder.id)); setViewMode('FOLDERS'); }} className="w-10 h-10 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                 </button>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button 
                  onClick={() => startReview(activeFolder.id)}
                  className="md:col-span-1 bg-blue-500 text-white p-8 rounded-[40px] flex flex-col justify-between hover:scale-[1.02] transition-all shadow-xl shadow-blue-100"
                >
                   <div>
                     <h3 className="text-2xl font-black uppercase italic tracking-tighter">ESTUDAR AGORA</h3>
                     <p className="text-blue-100/60 text-[10px] uppercase font-bold tracking-widest leading-tight">SRS Ativo</p>
                   </div>
                   <div className="flex items-end justify-between mt-10">
                      <span className="text-5xl font-black tabular-nums">{getFolderDueCount(activeFolder.id)}</span>
                      <span className="text-[10px] font-black uppercase leading-[1.1] mb-2">Cards para<br/>hoje</span>
                   </div>
                </button>

                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button 
                      onClick={() => setShowAddCardModal(true)}
                      className="bg-white border-2 border-gray-100 p-8 rounded-[35px] hover:border-blue-400 transition-all group flex flex-col items-center justify-center"
                    >
                       <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-all">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                       </div>
                       <span className="font-black text-[10px] uppercase tracking-widest text-gray-500">Criação Manual</span>
                    </button>
                    <button 
                      onClick={() => setShowAIModal(true)}
                      className="bg-black text-white p-8 rounded-[35px] hover:bg-blue-600 transition-all group flex flex-col items-center justify-center shadow-xl"
                    >
                       <div className="w-10 h-10 bg-white/10 text-yellow-400 rounded-xl flex items-center justify-center mb-4 group-hover:rotate-12 transition-all">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                       </div>
                       <span className="font-black text-[10px] uppercase tracking-widest text-white">Gerar com IA</span>
                    </button>
                </div>
            </div>

            <div className="space-y-4 pt-10">
               <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Lista de Cards ({folderCards.length})</h3>
               <div className="grid grid-cols-1 gap-4">
                  {folderCards.length === 0 ? (
                    <div className="p-12 text-center bg-gray-50 border-2 border-dashed border-gray-100 rounded-[40px]">
                       <p className="text-gray-400 font-bold text-sm">Nenhum card nesta pasta ainda.</p>
                    </div>
                  ) : (
                    folderCards.map(card => (
                      <div key={card.id} className="bg-white p-6 rounded-[30px] border border-gray-100 flex items-center justify-between group">
                         <div className="flex-1 min-w-0">
                            <p className="text-gray-900 font-bold truncate">{card.question}</p>
                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Revisão: {card.nextReview ? new Date(card.nextReview).toLocaleDateString() : 'Não revisado'}</p>
                         </div>
                         <button 
                          onClick={() => setFlashcards(prev => prev.filter(f => f.id !== card.id))}
                          className="opacity-0 group-hover:opacity-100 p-3 text-red-300 hover:text-red-500 transition-all hover:scale-110"
                         >
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         </button>
                      </div>
                    ))
                  )}
               </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'REVIEW' && (
          <motion.div 
            key="review"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="py-10 flex flex-col items-center"
          >
            {isReviewDone ? (
               <div className="flex flex-col items-center text-center space-y-8 py-10">
                  <div className="w-24 h-24 bg-green-50 text-green-500 rounded-[40px] flex items-center justify-center shadow-sm">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h2 className="text-4xl font-black italic tracking-tighter uppercase">Missão Cumprida!</h2>
                  <p className="text-gray-400 font-bold max-w-sm">Você completou esta sessão de revisão. Seu cérebro agradece o estímulo!</p>
                  <button onClick={() => setViewMode('FOLDERS')} className="bg-[#0A0F1E] text-white px-10 py-5 rounded-[25px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                    Voltar ao Gerenciador
                  </button>
               </div>
            ) : (
              <>
                <div className="w-full flex justify-between items-center mb-10">
                  <button onClick={() => setViewMode('FOLDERS')} className="text-gray-400 font-black text-[10px] tracking-widest uppercase flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                    Sair
                  </button>
                  <div className="flex items-center gap-4">
                     <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                       Card {currentReviewIndex + 1} de {reviewQueue.length}
                     </span>
                  </div>
                </div>

                <div className="w-full max-w-2xl">
                  <div 
                    onClick={() => setShowAnswer(!showAnswer)}
                    className={`min-h-[400px] aspect-[4/3] rounded-[60px] p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-500 shadow-2xl relative overflow-hidden ${showAnswer ? 'bg-white text-gray-800' : 'bg-blue-50 text-blue-900 border-2 border-blue-100'}`}
                  >
                    <div className="absolute top-8 left-1/2 -translate-x-1/2">
                       <span className={`uppercase font-black text-[10px] tracking-[0.3em] px-4 py-1 rounded-full ${showAnswer ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-400'}`}>
                          {showAnswer ? 'RESPOSTA' : 'PERGUNTA'}
                       </span>
                    </div>

                    <p className="text-xs font-black text-blue-400/50 uppercase tracking-widest mb-4">{flashcards.find(f => f.id === reviewQueue[currentReviewIndex])?.topic}</p>
                    <h2 className="text-3xl font-bold leading-tight px-4 break-words w-full">
                      {showAnswer ? flashcards.find(f => f.id === reviewQueue[currentReviewIndex])?.answer : flashcards.find(f => f.id === reviewQueue[currentReviewIndex])?.question}
                    </h2>
                    
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 opacity-30">
                      <p className="text-[10px] uppercase font-black tracking-widest">Tocar para virar</p>
                    </div>
                  </div>

                  {showAnswer ? (
                    <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in slide-in-from-bottom-4">
                      <button onClick={() => handleRate(0)} className="flex flex-col items-center gap-1 bg-white border-2 border-red-50 p-6 rounded-[30px] hover:bg-red-50 transition-colors group">
                        <span className="text-2xl">😫</span>
                        <span className="text-[10px] font-black uppercase text-red-400 group-hover:text-red-500">Errei</span>
                      </button>
                      <button onClick={() => handleRate(1)} className="flex flex-col items-center gap-1 bg-white border-2 border-orange-50 p-6 rounded-[30px] hover:bg-orange-50 transition-colors group">
                        <span className="text-2xl">🫤</span>
                        <span className="text-[10px] font-black uppercase text-orange-400 group-hover:text-orange-500">Difícil</span>
                      </button>
                      <button onClick={() => handleRate(2)} className="flex flex-col items-center gap-1 bg-white border-2 border-yellow-50 p-6 rounded-[30px] hover:bg-yellow-50 transition-colors group">
                        <span className="text-2xl">🙂</span>
                        <span className="text-[10px] font-black uppercase text-yellow-500 group-hover:text-yellow-600">Bom</span>
                      </button>
                      <button onClick={() => handleRate(3)} className="flex flex-col items-center gap-1 bg-white border-2 border-green-50 p-6 rounded-[30px] hover:bg-green-50 transition-colors group">
                        <span className="text-2xl">😎</span>
                        <span className="text-[10px] font-black uppercase text-green-500 group-hover:text-green-600">Fácil</span>
                      </button>
                    </div>
                  ) : (
                    <div className="mt-8 flex justify-center">
                      <button onClick={() => setShowAnswer(true)} className="bg-[#0A0F1E] text-white px-12 py-6 rounded-[30px] font-black text-sm uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">
                        Ver Resposta
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showAddFolderModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl">
                <h3 className="text-2xl font-black mb-6 uppercase italic tracking-tighter">Nova <span className="text-blue-500">Pasta</span></h3>
                <form onSubmit={handleCreateFolder} className="space-y-6">
                   <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Nome da Pasta</label>
                      <input 
                        required autoFocus
                        value={newFolder.name}
                        onChange={e => setNewFolder(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-400 transition-all font-bold"
                        placeholder="Ex: Biologia Molecular"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Cor de Identificação</label>
                      <div className="flex gap-3 mt-2">
                        {['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'].map(c => (
                          <button 
                            key={c} type="button" 
                            onClick={() => setNewFolder(prev => ({ ...prev, color: c }))}
                            className={`w-10 h-10 rounded-full transition-all ${newFolder.color === c ? 'ring-4 ring-offset-2 ring-gray-100 scale-125' : 'opacity-70'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                   </div>
                   <div className="flex gap-4 pt-4">
                      <button type="button" onClick={() => setShowAddFolderModal(false)} className="flex-1 py-4 font-black uppercase tracking-widest text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                      <button type="submit" className="flex-[2] bg-blue-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-100">Criar Pasta</button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}

        {showAddCardModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl">
                <h3 className="text-2xl font-black mb-6 uppercase italic tracking-tighter">Adicionar NOVO <span className="text-blue-500">Card</span></h3>
                <form onSubmit={handleCreateCard} className="space-y-6">
                   <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Pergunta</label>
                      <textarea 
                        required
                        value={newCard.question}
                        onChange={e => setNewCard(prev => ({ ...prev, question: e.target.value }))}
                        className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-400 transition-all font-bold min-h-[100px]"
                        placeholder="Escreva a pergunta..."
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Resposta</label>
                      <textarea 
                        required
                        value={newCard.answer}
                        onChange={e => setNewCard(prev => ({ ...prev, answer: e.target.value }))}
                        className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-400 transition-all font-bold min-h-[100px]"
                        placeholder="Escreva a resposta..."
                      />
                   </div>
                   <div className="flex gap-4 pt-4">
                      <button type="button" onClick={() => setShowAddCardModal(false)} className="flex-1 py-4 font-black uppercase tracking-widest text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                      <button type="submit" className="flex-[2] bg-blue-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-100">Salvar Card</button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}

        {showAIModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0A0F1E] text-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl border border-white/10">
                <div className="w-16 h-16 bg-yellow-400 text-black rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-yellow-400/20">
                   <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-3xl font-black mb-4 uppercase italic tracking-tighter">Gerar com <span className="text-yellow-400">IA</span></h3>
                <p className="text-gray-400 text-sm mb-10 leading-relaxed font-medium uppercase tracking-[0.2em]">
                  {strategicMode ? 'O peixe irá gerar cards baseados no edital selecionado.' : 'O peixe irá mergulhar fundo no tema e extrair flashcards otimizados para você.'}
                </p>
                <div className="space-y-6">
                   {strategicMode && editalConfig ? (
                     <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Matéria do Edital</label>
                          <select 
                            value={selectedSubject}
                            onChange={(e) => { setSelectedSubject(e.target.value); setSelectedTopic(''); }}
                            className="w-full bg-white/5 border-2 border-transparent rounded-2xl px-6 py-5 focus:outline-none focus:border-yellow-400 transition-all font-black italic text-lg appearance-none cursor-pointer"
                          >
                            <option value="" className="bg-[#0A0F1E]">Selecionar Matéria...</option>
                            {editalConfig.subjects.map((s, i) => (
                              <option key={i} value={s.name} className="bg-[#0A0F1E]">{s.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Assunto Específico</label>
                          <select 
                            value={selectedTopic}
                            onChange={(e) => setSelectedTopic(e.target.value)}
                            disabled={!selectedSubject}
                            className="w-full bg-white/5 border-2 border-transparent rounded-2xl px-6 py-5 focus:outline-none focus:border-yellow-400 transition-all font-black italic text-lg appearance-none cursor-pointer disabled:opacity-30"
                          >
                            <option value="" className="bg-[#0A0F1E]">Selecionar Assunto...</option>
                            {editalConfig.subjects.find(s => s.name === selectedSubject)?.topics.map((t, i) => (
                              <option key={i} value={t} className="bg-[#0A0F1E]">{t}</option>
                            ))}
                          </select>
                        </div>
                     </div>
                   ) : (
                     <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Tema do Mergulho</label>
                        <input 
                          required autoFocus
                          value={aiTopic}
                          onChange={e => setAiTopic(e.target.value)}
                          className="w-full bg-white/5 border-2 border-transparent rounded-2xl px-6 py-5 focus:outline-none focus:border-yellow-400 transition-all font-black italic text-xl"
                          placeholder="Ex: Ciclo de Krebs..."
                          onKeyPress={e => e.key === 'Enter' && generateAICards()}
                        />
                     </div>
                   )}
                   <div className="flex gap-4 pt-4">
                      <button onClick={() => setShowAIModal(false)} className="flex-1 py-4 font-black uppercase tracking-widest text-xs text-gray-400 hover:text-gray-200">Cancelar</button>
                      <button onClick={() => generateAICards()} className="flex-[2] bg-yellow-400 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-yellow-400/10 hover:scale-105 transition-all">Iniciar Geração</button>
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
