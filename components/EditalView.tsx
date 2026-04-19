
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EditalConfig, EditalSubject } from '../types';
import { extractTopicsFromEdital } from '../services/geminiService';
import LoadingFish from './LoadingFish';

interface EditalViewProps {
  config: EditalConfig;
  onUpdate: (config: EditalConfig) => void;
  onSelectTopic: (subject: string, topic: string, type: 'LESSON' | 'QUIZ' | 'FLASHCARDS') => void;
  onBack: () => void;
  onDisable: () => void;
  onSmartRevision: () => void;
  onTopicComplete?: (topic: string, subject: string, isCompleted: boolean) => void;
}

const EditalView: React.FC<EditalViewProps> = ({ config, onUpdate, onSelectTopic, onBack, onDisable, onSmartRevision, onTopicComplete }) => {
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<{subject: string, topic: string} | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTopic, setEditingTopic] = useState<{ subjectId: string, oldTopic: string, newTopic: string } | null>(null);
  const [showAddTopic, setShowAddTopic] = useState<{ subjectId: string } | null>(null);
  const [newTopicName, setNewTopicName] = useState('');

  const activeSubject = config.subjects.find(s => s.id === activeSubjectId);

  useEffect(() => {
    const extractNeeded = config.subjects.find(s => s.content.trim() && s.topics.length === 0);
    if (extractNeeded) {
      handleAutoExtract(extractNeeded);
    }
  }, [config.subjects]);

  const handleAutoExtract = async (subject: EditalSubject) => {
    setIsExtracting(true);
    try {
      const result = await extractTopicsFromEdital(subject.name, subject.content);
      const updatedSubjects = config.subjects.map(s => 
        s.id === subject.id ? { ...s, topics: result.topics } : s
      );
      onUpdate({ ...config, subjects: updatedSubjects });
    } catch (error) {
      console.error("Erro ao extrair tópicos:", error);
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleTopicCompletion = (subjectId: string, topic: string) => {
    const updatedSubjects = config.subjects.map(sub => {
      if (sub.id !== subjectId) return sub;
      const currentCompleted = sub.completedTopics || [];
      const isCompleted = currentCompleted.includes(topic);
      const newCompleted = isCompleted 
        ? currentCompleted.filter(t => t !== topic)
        : [...currentCompleted, topic];
      
      if (onTopicComplete) {
        onTopicComplete(topic, sub.name, !isCompleted);
      }

      return { ...sub, completedTopics: newCompleted };
    });
    onUpdate({ ...config, subjects: updatedSubjects });
  };

  const addManualTopic = (subjectId: string) => {
    if (!newTopicName.trim()) return;
    const updatedSubjects = config.subjects.map(s => {
      if (s.id !== subjectId) return s;
      return { ...s, topics: [...s.topics, newTopicName.trim()] };
    });
    onUpdate({ ...config, subjects: updatedSubjects });
    setNewTopicName('');
    setShowAddTopic(null);
  };

  const removeTopic = (subjectId: string, topic: string) => {
    const updatedSubjects = config.subjects.map(s => {
      if (s.id !== subjectId) return s;
      return { 
        ...s, 
        topics: s.topics.filter(t => t !== topic),
        completedTopics: s.completedTopics?.filter(t => t !== topic)
      };
    });
    onUpdate({ ...config, subjects: updatedSubjects });
  };

  const saveEditedTopic = () => {
    if (!editingTopic || !editingTopic.newTopic.trim()) return;
    const updatedSubjects = config.subjects.map(s => {
      if (s.id !== editingTopic.subjectId) return s;
      return {
        ...s,
        topics: s.topics.map(t => t === editingTopic.oldTopic ? editingTopic.newTopic.trim() : t),
        completedTopics: s.completedTopics?.map(t => t === editingTopic.oldTopic ? editingTopic.newTopic.trim() : t)
      };
    });
    onUpdate({ ...config, subjects: updatedSubjects });
    setEditingTopic(null);
  };

  const calculateDaysLeft = () => {
    if (!config.examDate) return 0;
    const diff = new Date(config.examDate).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = calculateDaysLeft();

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <button onClick={onBack} className="text-gray-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 hover:text-black transition-colors mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            Voltar ao Hub
          </button>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">MODO <span className="text-blue-600">EDITAL</span></h1>
            <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest animate-pulse">Ativo</span>
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={onSmartRevision}
            className="group relative flex items-center gap-3 bg-[#0A0F1E] text-white px-8 py-4 rounded-[30px] font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-900/10"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center group-hover:bg-yellow-400 group-hover:text-black transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            SISTEMA DE REVISÃO
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-bounce"></div>
          </button>
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center font-black text-xl tabular-nums">
              {daysLeft}
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Dias para</p>
              <p className="text-xs font-black uppercase italic leading-none mt-1">A Prova</p>
            </div>
          </div>
          <button 
            onClick={onDisable}
            className="bg-gray-100 text-gray-400 px-6 py-4 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all"
          >
            Desativar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Subject List */}
        <div className="lg:col-span-1 space-y-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 mb-4 text-left">Navegação</p>
          
          <button
            onClick={() => setActiveSubjectId(null)}
            className={`w-full text-left p-5 rounded-[25px] font-black uppercase italic transition-all border-2 ${activeSubjectId === null ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100' : 'bg-white border-transparent text-gray-400 hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              <span className="text-sm">Visão Geral</span>
            </div>
          </button>

          <div className="pt-4 border-t border-gray-100 mt-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 mb-4 text-left">Disciplinas</p>
            {config.subjects.map(subject => {
              const completedCount = subject.completedTopics?.length || 0;
              const totalCount = subject.topics.length;
              const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
              return (
                <button
                  key={subject.id}
                  onClick={() => setActiveSubjectId(subject.id)}
                  className={`w-full text-left p-5 rounded-[25px] font-black uppercase italic transition-all border-2 mb-2 ${activeSubjectId === subject.id ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100' : 'bg-white border-transparent text-gray-400 hover:bg-gray-50'}`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm truncate mr-2">{subject.name}</span>
                    <span className={`text-[10px] tracking-widest shrink-0 ${activeSubjectId === subject.id ? 'text-blue-200' : 'text-gray-300'}`}>{completedCount}/{totalCount}</span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full overflow-hidden ${activeSubjectId === subject.id ? 'bg-blue-700' : 'bg-gray-100'}`}>
                    <div 
                      className={`h-full transition-all duration-700 ${activeSubjectId === subject.id ? 'bg-white' : 'bg-blue-500'}`} 
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-[50px] p-10 shadow-xl border border-gray-100 min-h-[600px] relative">
            {isExtracting && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-[50px]">
                <LoadingFish message="O Peixe está mapeando o edital..." submessage="Transformando texto bruto em tópicos estratégicos" />
              </div>
            )}

            {activeSubject ? (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-start border-b border-gray-100 pb-8 text-left">
                  <div className="flex-1">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-blue-600">{activeSubject.name}</h2>
                    <p className="text-gray-400 font-bold text-xs mt-2 uppercase tracking-widest">Selecione um tópico para estudar ou gerencie sua lista</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsEditing(!isEditing)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isEditing ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-black'}`}
                    >
                      {isEditing ? 'Finalizar Edição' : 'Editar Lista'}
                    </button>
                    <button 
                      onClick={() => setShowAddTopic({ subjectId: activeSubject.id })}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-200"
                    >
                      + Novo Tópico
                    </button>
                  </div>
                </div>

                {showAddTopic && (
                  <div className="bg-blue-50/50 p-6 rounded-[30px] border-2 border-blue-100 animate-in fade-in slide-in-from-top-4 duration-300">
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 text-left">Novo Tópico em {activeSubject.name}</h4>
                    <div className="flex gap-4">
                      <input 
                        autoFocus
                        value={newTopicName}
                        onChange={(e) => setNewTopicName(e.target.value)}
                        placeholder="Ex: Teoria da Relatividade Geral"
                        className="flex-1 bg-white border border-blue-200 rounded-2xl px-6 py-4 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setShowAddTopic(null)} className="px-6 py-4 bg-white text-gray-400 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-gray-100 italic transition-all">Cancelar</button>
                        <button onClick={() => addManualTopic(activeSubject.id)} className="px-8 py-4 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 italic transition-all">Adicionar</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeSubject.topics.map((topic, i) => {
                    const isCompleted = activeSubject.completedTopics?.includes(topic);
                    return (
                      <div
                        key={i}
                        className={`group p-6 rounded-[30px] border-2 text-left transition-all relative ${
                          isCompleted ? 'border-green-100 bg-green-50/30 hover:border-green-200' : 'border-gray-50 bg-gray-50/30 hover:border-blue-200 hover:bg-white hover:shadow-lg'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleTopicCompletion(activeSubject.id, topic); }}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all ${
                              isCompleted ? 'bg-green-500 text-white border-transparent' : 'bg-white border-2 border-blue-100 text-blue-600 hover:bg-blue-50'
                            }`}
                          >
                            {isCompleted ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> : i + 1}
                          </button>
                          
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => !isEditing && setSelectedTopic({ subject: activeSubject.name, topic })}
                          >
                            {editingTopic?.oldTopic === topic && editingTopic.subjectId === activeSubject.id ? (
                              <div className="flex gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                                <input 
                                  autoFocus
                                  value={editingTopic.newTopic}
                                  onChange={(e) => setEditingTopic({ ...editingTopic, newTopic: e.target.value })}
                                  className="flex-1 bg-white border-2 border-blue-400 rounded-xl px-4 py-1 font-bold text-sm"
                                />
                                <button onClick={saveEditedTopic} className="text-green-500 hover:scale-110 px-1"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>
                                <button onClick={() => setEditingTopic(null)} className="text-red-500 hover:scale-110 px-1"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
                              </div>
                            ) : (
                              <p className={`font-bold leading-tight ${isCompleted ? 'text-green-800 line-through opacity-70' : 'text-gray-700 group-hover:text-blue-600'}`}>
                                {topic}
                              </p>
                            )}
                          </div>

                          {isEditing && (
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <button 
                                onClick={() => setEditingTopic({ subjectId: activeSubject.id, oldTopic: topic, newTopic: topic })}
                                className="text-blue-400 hover:text-blue-600 p-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button 
                                onClick={() => removeTopic(activeSubject.id, topic)}
                                className="text-red-300 hover:text-red-500 p-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {activeSubject.topics.length === 0 && !isExtracting && (
                  <div className="flex flex-col items-center justify-center h-96 text-center space-y-4">
                    <div className="text-5xl opacity-20">📖</div>
                    <p className="text-gray-400 font-bold max-w-xs">Aguardando mapeamento estratégico deste conteúdo...</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="border-b border-gray-100 pb-8 text-left">
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter text-blue-600">Visão Geral do Edital</h2>
                  <p className="text-gray-400 font-bold text-xs mt-2 uppercase tracking-widest">Acompanhe seu progresso em todas as disciplinas</p>
                </div>

                <div className="space-y-12">
                  {config.subjects.map((subject) => {
                    const completedCount = subject.completedTopics?.length || 0;
                    const totalCount = subject.topics.length;
                    const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                    
                    return (
                      <div key={subject.id} className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <h3 className="text-xl font-black uppercase italic tracking-tighter text-gray-800">{subject.name}</h3>
                          <div className="flex items-center gap-4 flex-1 max-w-md">
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                              <div 
                                className="h-full bg-blue-500 transition-all duration-1000" 
                                style={{ width: `${progressPercentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-black tabular-nums text-gray-400 min-w-[50px]">{Math.round(progressPercentage)}%</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {subject.topics.map((topic, i) => {
                            const isCompleted = subject.completedTopics?.includes(topic);
                            return (
                              <div
                                key={i}
                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                                  isCompleted ? 'border-green-100 bg-green-50/20' : 'border-gray-50 bg-gray-50/20'
                                }`}
                              >
                                <button
                                  onClick={() => toggleTopicCompletion(subject.id, topic)}
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 transition-all ${
                                    isCompleted ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-100 text-gray-300 hover:border-blue-200'
                                  }`}
                                >
                                  {isCompleted ? <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> : null}
                                </button>
                                <p 
                                  className={`text-sm font-bold cursor-pointer hover:text-blue-600 transition-colors ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-600'}`}
                                  onClick={() => setSelectedTopic({ subject: subject.name, topic })}
                                >
                                  {topic}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Topic Action Modal */}
      <AnimatePresence>
        {selectedTopic && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTopic(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[60px] p-8 md:p-12 z-[101] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] border-t border-gray-100"
            >
              <div className="max-w-4xl mx-auto">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8"></div>
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none">{selectedTopic.subject}</p>
                    </div>
                    <h3 className="text-3xl font-black uppercase italic leading-none tracking-tighter">{selectedTopic.topic}</h3>
                  </div>
                  
                  <button 
                    onClick={() => setSelectedTopic(null)}
                    className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 hover:text-black transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button 
                  onClick={() => { onSelectTopic(selectedTopic.subject, selectedTopic.topic, 'LESSON'); setSelectedTopic(null); }}
                  className="group flex flex-col items-center gap-4 p-8 rounded-[40px] bg-blue-600 text-white font-black uppercase italic tracking-tighter hover:scale-105 transition-all shadow-xl shadow-blue-200"
                  >
                  <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center group-hover:bg-white group-hover:text-blue-600 transition-all font-sans">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253" /></svg>
                  </div>
                    <span className="text-sm">Gerar Aula Direta</span>
                </button>
                <button 
                  onClick={() => { onSelectTopic(selectedTopic.subject, selectedTopic.topic, 'QUIZ'); setSelectedTopic(null); }}
                  className="group flex flex-col items-center gap-4 p-8 rounded-[40px] bg-[#0A0F1E] text-white font-black uppercase italic tracking-tighter hover:scale-105 transition-all shadow-xl shadow-gray-200"
                  >
                  <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center group-hover:bg-orange-500 transition-all font-sans">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                  </div>
                    <span className="text-sm">Batalha de Questões</span>
                </button>
                <button 
                  onClick={() => { onSelectTopic(selectedTopic.subject, selectedTopic.topic, 'FLASHCARDS'); setSelectedTopic(null); }}
                  className="group flex flex-col items-center gap-4 p-8 rounded-[40px] bg-yellow-400 text-white font-black uppercase italic tracking-tighter hover:scale-105 transition-all shadow-xl shadow-yellow-100"
                  >
                  <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center group-hover:bg-white group-hover:text-yellow-600 transition-all font-sans">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
                  </div>
                    <span className="text-sm">Criar Flashcards</span>
                </button>
              </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EditalView;
