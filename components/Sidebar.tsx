
import React, { useState } from 'react';
import { 
  AppView, 
  QuizFolder, 
  FlashcardFolder, 
  UserStats, 
  getFishRank 
} from '../types';
import { 
  Home, 
  Timer, 
  Layers, 
  BookOpen, 
  Brain, 
  Settings, 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft,
  Folder, 
  FileText,
  User,
  Users,
  Compass,
  Trophy,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart3,
  Bookmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FishLogo from './FishLogo';

interface SidebarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  quizFolders: QuizFolder[];
  flashcardFolders: FlashcardFolder[];
  stats: UserStats;
  onSelectNotebook: (folderId: string, notebookId: string) => void;
  onSelectFlashcardFolder: (folderId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setView, 
  quizFolders, 
  flashcardFolders, 
  stats,
  onSelectNotebook,
  onSelectFlashcardFolder
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [showFolders, setShowFolders] = useState(true);
  const [showFlashcards, setShowFlashcards] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const navItems = [
    { id: 'HUB' as AppView, label: 'Painel Principal', icon: Home },
    { id: 'TIMER' as AppView, label: 'Timer Pomodoro', icon: Timer },
    { id: 'MATERIALS' as AppView, label: 'Meus Materiais', icon: BookOpen },
    { id: 'FLASHCARDS' as AppView, label: 'Flashcards', icon: Layers },
    { id: 'SAVED_GUIDED_LESSONS' as AppView, label: 'Aulas Salvas', icon: Bookmark },
    { id: 'SMART_REVISION' as AppView, label: 'Revisão IA', icon: Brain },
    { id: 'PERFORMANCE' as AppView, label: 'Desempenho', icon: BarChart3 },
    { id: 'SOCIAL_MODULE' as AppView, label: 'Social', icon: Users },
  ];

  const rank = getFishRank(stats.totalDaysStudied);

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-72'} h-screen bg-[#0A0F1E] text-white flex flex-col border-r border-white/5 shadow-2xl relative z-[1000] overflow-hidden transition-all duration-300 ease-in-out`}>
      {/* Collapse Toggle */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-4 right-4 z-50 p-2 rounded-lg bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-all"
        title={isCollapsed ? "Expandir" : "Recolher"}
      >
        {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </button>

      {/* Header / Logo */}
      <div className={`p-8 pb-4 ${isCollapsed ? 'px-4' : 'px-8'}`}>
        <button onClick={() => setView('HUB')} className="block hover:opacity-80 transition-opacity">
          {isCollapsed ? (
            <FishLogo iconOnly days={stats.totalDaysStudied} className="scale-75 origin-center" />
          ) : (
            <FishLogo days={stats.totalDaysStudied} className="scale-75 origin-left" />
          )}
        </button>
        
        <div className={`mt-8 flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5 overflow-hidden ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: stats.avatarColor }}>
            <FishLogo iconOnly primaryColor="white" className="scale-[0.4]" days={stats.totalDaysStudied} />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 leading-none truncate">{stats.name}</p>
              <p className="text-[8px] font-bold uppercase tracking-wider text-gray-500 mt-1 truncate">{rank.label}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-8 custom-scrollbar">
        {/* Main Nav */}
        <div className="space-y-1">
          {!isCollapsed && <p className="px-4 text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-4">Navegação</p>}
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all ${isCollapsed ? 'justify-center' : ''} ${
                currentView === item.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${currentView === item.id ? 'text-white' : 'text-gray-500'}`} />
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </div>

        {/* Quiz Folders System */}
        {!isCollapsed && (
          <div className="space-y-1">
            <div className="px-4 flex items-center justify-between mb-2">
              <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em]">Meus Materiais</p>
              <button onClick={() => setView('MATERIALS')} className="text-gray-500 hover:text-white">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            
            <div className="space-y-0.5">
              {quizFolders.map(folder => (
                <div key={folder.id} className="space-y-0.5">
                  <button 
                    onClick={() => toggleFolder(folder.id)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-transparent hover:bg-white/5 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Folder className={`w-3.5 h-3.5 shrink-0 ${expandedFolders[folder.id] ? 'text-blue-500' : 'text-gray-500'}`} />
                      <span className="text-[11px] font-bold text-gray-300 truncate group-hover:text-white">{folder.name}</span>
                    </div>
                    {expandedFolders[folder.id] ? <ChevronDown className="w-3 h-3 text-gray-600" /> : <ChevronRight className="w-3 h-3 text-gray-600" />}
                  </button>
                  
                  <AnimatePresence>
                    {expandedFolders[folder.id] && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pl-4 ml-3 border-l border-white/5 space-y-0.5"
                      >
                        {folder.notebooks.map(nb => (
                          <button
                            key={nb.id}
                            onClick={() => onSelectNotebook(folder.id, nb.id)}
                            className="w-full text-left px-4 py-2 text-[10px] font-medium text-gray-500 hover:text-blue-400 truncate flex items-center gap-2 transition-colors"
                          >
                            <FileText className="w-3 h-3 shrink-0" />
                            {nb.name}
                          </button>
                        ))}
                        {folder.notebooks.length === 0 && (
                          <p className="px-4 py-2 text-[9px] text-gray-600 italic">Vazio</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
              {quizFolders.length === 0 && (
                <p className="px-4 py-2 text-[10px] text-gray-600 italic">Nenhuma pasta criada</p>
              )}
            </div>
          </div>
        )}

        {/* Flashcard Folders System */}
        {!isCollapsed && (
          <div className="space-y-1">
            <div className="px-4 flex items-center justify-between mb-2">
              <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em]">Flashcards</p>
              <button onClick={() => setView('FLASHCARDS')} className="text-gray-500 hover:text-white">
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-0.5">
              {flashcardFolders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => onSelectFlashcardFolder(folder.id)}
                  className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors group"
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: folder.color }}></div>
                  <span className="text-[11px] font-bold truncate">{folder.name}</span>
                </button>
              ))}
              {flashcardFolders.length === 0 && (
                <p className="px-4 py-2 text-[10px] text-gray-600 italic">Nenhum módulo criado</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className={`p-6 bg-black/40 border-t border-white/5 ${isCollapsed ? 'px-4' : 'p-6'}`}>
        {!isCollapsed ? (
          <div className="space-y-3">
            <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest">
              <span>Progressão Nível {stats.level}</span>
              <span>{stats.xp % 1000}/1000</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500" 
                style={{ width: `${(stats.xp % 1000) / 10}%` }}
              />
            </div>
            <div className="flex justify-between items-center bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
               <div className="flex flex-col">
                 <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Moedas</span>
                 <span className="text-sm font-black text-blue-400">{stats.coins}</span>
               </div>
               <Trophy className="w-4 h-4 text-blue-500" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Trophy className="w-6 h-6 text-blue-500" />
              <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {stats.level}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
