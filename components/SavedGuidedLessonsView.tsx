
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Trash2, ChevronRight, Bookmark, Calendar, Clock, Search } from 'lucide-react';
import { SavedGuidedLesson } from '../types';

interface SavedGuidedLessonsViewProps {
  onOpenLesson: (subject: string, topic: string, lesson: any) => void;
}

const SavedGuidedLessonsView: React.FC<SavedGuidedLessonsViewProps> = ({ onOpenLesson }) => {
  const [savedLessons, setSavedLessons] = useState<SavedGuidedLesson[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('saved_guided_lessons');
      if (saved) {
        setSavedLessons(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Error loading saved guided lessons:", e);
      setSavedLessons([]);
    }
  }, []);

  const deleteLesson = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newLessons = savedLessons.filter(l => l.id !== id);
    setSavedLessons(newLessons);
    try {
      localStorage.setItem('saved_guided_lessons', JSON.stringify(newLessons));
    } catch (e) {
      console.warn("Storage quota exceeded in SavedGuidedLessonsView", e);
    }
  };

  const filteredLessons = savedLessons.filter(l => 
    l.topic.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.subject.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => b.savedAt - a.savedAt);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-[#0A0F1E]">Biblioteca de Imersão</h2>
          <p className="text-slate-500 font-bold text-sm tracking-widest uppercase mt-1">Aulas guiadas que você salvou para estudar offline.</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Pesquisar lição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl w-full md:w-80 font-bold text-sm focus:border-blue-500 outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      {filteredLessons.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-20 text-center space-y-6">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto text-slate-300">
            <Bookmark className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase italic text-slate-400">Nenhuma aula salva</h3>
            <p className="text-slate-500 text-sm font-bold mt-2">Salve uma aula guiada enquanto estuda para que ela apareça aqui.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredLessons.map((item) => (
            <motion.div
              layoutId={item.id}
              key={item.id}
              onClick={() => onOpenLesson(item.subject, item.topic, item.lesson)}
              className="group bg-white border-2 border-slate-100 p-8 rounded-[40px] hover:border-blue-500 transition-all cursor-pointer shadow-sm hover:shadow-xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => deleteLesson(item.id, e)}
                  className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-lg">{item.subject}</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                      <Clock className="w-3 h-3" /> {item.lesson.steps.length} blocos
                    </span>
                  </div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tight text-[#0A0F1E] group-hover:text-blue-600 transition-colors">{item.topic}</h3>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <Calendar className="w-3 h-3" />
                    Salvo em {new Date(item.savedAt).toLocaleDateString()}
                  </div>
                  <div className="bg-blue-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg shadow-blue-500/30">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedGuidedLessonsView;
