import React, { useEffect, useState } from 'react';
import { AppView, QuizFolder, FlashcardFolder, UserStats, getFishRank } from '../types';
import { Home, Timer, Layers, BookOpen, Brain, ChevronDown, ChevronRight, ChevronLeft, Folder, FileText, Users, Plus, PanelLeftOpen, PanelLeftClose, BarChart3, Bookmark, Scale, PenLine, Zap, Clock, Trophy, Moon, Sun } from './icons';
import { motion, AnimatePresence } from 'motion/react';
import FishLogo from './FishLogo';
import AvatarDisplay from './AvatarDisplay';

interface SidebarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  quizFolders: QuizFolder[];
  flashcardFolders: FlashcardFolder[];
  stats: UserStats;
  onSelectNotebook: (folderId: string, notebookId: string) => void;
  onSelectFlashcardFolder: (folderId: string) => void;
  questionSession?: boolean;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, quizFolders, flashcardFolders, stats, onSelectNotebook, onSelectFlashcardFolder, questionSession = false, isDarkMode = false, onToggleDarkMode }) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [questionNavigationOpen, setQuestionNavigationOpen] = useState(false);

  useEffect(() => {
    setQuestionNavigationOpen(false);
  }, [questionSession]);

  if (questionSession && !questionNavigationOpen) {
    return (
      <aside aria-label="Navegação durante questões" className="w-16 h-full bg-[#FDFBF7] dark:bg-[#1c1712] text-[#725442] dark:text-[#a89680] border-r border-[#eee6d6] dark:border-white/[0.06] flex flex-col items-center py-4 gap-6">
        <button
          onClick={() => setQuestionNavigationOpen(true)}
          aria-label="Abrir navegação"
          aria-expanded={false}
          title="Abrir navegação"
          className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-[#f4ebdd] dark:hover:bg-[#272019] hover:text-[#473c33] dark:hover:text-[#f4ebdd] focus-visible:outline-2 focus-visible:outline-[#ec6300] transition-colors"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
        <div aria-label="Respondendo questões" title="Respondendo questões" className="w-10 h-10 rounded-xl bg-[#f4ebdd] dark:bg-[#272019] text-[#473c33] dark:text-[#d9772b] flex items-center justify-center">
          <FileText className="w-5 h-5" />
        </div>
        {onToggleDarkMode && (
          <button
            onClick={onToggleDarkMode}
            aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
            aria-pressed={isDarkMode}
            title={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#f4ebdd] dark:bg-[#d9772b] text-[#473c33] dark:text-[#fdfbf7] hover:bg-[#eee6d6] dark:hover:bg-[#c96a25] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ec6300] transition-colors"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        )}
        <span className="text-[9px] font-bold uppercase tracking-widest [writing-mode:vertical-rl]">Foco nas questões</span>
      </aside>
    );
  }

  const collapsed = questionSession ? false : isCollapsed;

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const navItems = [
    { id: 'HUB' as AppView, label: 'Painel Principal', icon: Home },
    { id: 'TIMER' as AppView, label: 'Timer Pomodoro', icon: Timer },
    { id: 'MATERIALS' as AppView, label: 'Meus Materiais', icon: BookOpen },
    { id: 'FLASHCARDS' as AppView, label: 'Flashcards', icon: Layers },
    { id: 'VADE_MECUM' as AppView, label: 'Vade Mecum', icon: Scale },
    { id: 'DRIVE_READER' as AppView, label: 'Biblioteca Drive', icon: Folder },
    { id: 'NOTES' as AppView, label: 'Anotações', icon: PenLine },
    { id: 'TDH_QUESTOES' as AppView, label: 'TDHQuestões', icon: FileText },
    { id: 'AI_DIRECT' as AppView, label: 'Aula Direta', icon: Zap },
    { id: 'GUIDED_LESSON' as AppView, label: 'Aula Guiada', icon: BookOpen },
    { id: 'SAVED_GUIDED_LESSONS' as AppView, label: 'Aulas Salvas', icon: Bookmark },
    { id: 'DYNAMIC_TIMER' as AppView, label: 'Bloco Imutável', icon: Clock },
    { id: 'SMART_REVISION' as AppView, label: 'Revisão IA', icon: Brain },
    { id: 'PERFORMANCE' as AppView, label: 'Desempenho', icon: BarChart3 },
    { id: 'SOCIAL_MODULE' as AppView, label: 'Social', icon: Users },
  ];

  const rank = getFishRank(stats.totalDaysStudied);

  return (
    <div className={`${collapsed ? 'w-20' : 'w-72'} h-full bg-[#FDFBF7] dark:bg-[#1c1712] text-[#473c33] dark:text-[#f4ebdd] flex flex-col border-r border-[#eee6d6] dark:border-white/[0.06] relative ${questionSession ? 'z-50' : 'z-[1000]'} overflow-hidden transition-all duration-300 ease-in-out`}>
      {/* Header / Logo */}
      <div className={`p-8 pb-4 ${collapsed ? 'px-4' : 'px-8'}`}>
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : 'justify-between'}`}>
          <button
            onClick={() => setIsCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#473c33] dark:bg-[#272019] text-[#fdfbf7] dark:text-[#d9772b] shadow-[0_4px_12px_rgba(71,60,51,0.28)] dark:shadow-none transition-all hover:bg-[#5a4b3f] dark:hover:bg-[#322922] hover:shadow-[0_6px_16px_rgba(71,60,51,0.36)] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fec868]"
          >
            {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
              aria-pressed={isDarkMode}
              title={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f4ebdd] dark:bg-[#d9772b] text-[#473c33] dark:text-[#fdfbf7] transition-all hover:bg-[#eee6d6] dark:hover:bg-[#c96a25] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fec868]"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          )}
        </div>

        {!questionSession && (
          <button
            onClick={() => setView('PROFILE')}
            aria-label="Acessar perfil"
            title="Acessar perfil"
            className={`mt-8 flex items-center gap-3 w-full bg-[#f4ebdd] dark:bg-[#272019] p-3 rounded-2xl border border-[#eee6d6] dark:border-white/[0.06] overflow-hidden transition-all hover:bg-[#eee6d6] dark:hover:bg-[#322922] hover:border-[#e3d9ca] dark:hover:border-white/[0.1] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fec868] ${collapsed ? 'justify-center' : ''}`}
          >
            {stats.characterId ? (
              <AvatarDisplay characterId={stats.characterId} className="w-10 h-10 rounded-full shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: stats.avatarColor }}>
                <FishLogo iconOnly primaryColor="white" className="scale-[0.4]" days={stats.totalDaysStudied} />
              </div>
            )}
            {!collapsed && (
              <div className="overflow-hidden text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#473c33] dark:text-[#f4ebdd] leading-none truncate">{stats.name}</p>
                <p className="text-[8px] font-bold uppercase tracking-wider text-[#a79c8e] dark:text-[#7d6f5c] mt-1 truncate">{rank.label}</p>
              </div>
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-8 custom-scrollbar">
        {/* Main Nav */}
        <div className="space-y-1">
          {!collapsed && <p className="px-4 text-[9px] font-black text-[#a79c8e] dark:text-[#7d6f5c] uppercase tracking-[0.3em] mb-4">Funções</p>}
          {navItems.map((item) => (
            <button key={item.id} aria-label={item.label} title={collapsed ? item.label : undefined} onClick={() => setView(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all ${collapsed ? 'justify-center' : ''} ${currentView === item.id ? 'bg-[#473c33] dark:bg-[#d9772b] text-[#fdfbf7] shadow-md dark:shadow-none' : 'text-[#725442] dark:text-[#a89680] hover:bg-[#f4ebdd] dark:hover:bg-[#272019]'}`}>
              <item.icon className={`w-5 h-5 shrink-0 ${currentView === item.id ? 'text-[#fdfbf7]' : 'text-[#a79c8e] dark:text-[#7d6f5c]'}`} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </div>

        {/* Quiz Folders System */}
        {!collapsed && (
          <div className="space-y-1">
            <div className="px-4 flex items-center justify-between mb-2">
              <p className="text-[9px] font-black text-[#a79c8e] dark:text-[#7d6f5c] uppercase tracking-[0.3em]">Meus Materiais</p>
              <button onClick={() => setView('MATERIALS')} className="text-[#a79c8e] dark:text-[#7d6f5c] hover:text-[#473c33] dark:hover:text-[#f4ebdd]">
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-0.5">
              {quizFolders.map((folder) => (
                <div key={folder.id} className="space-y-0.5">
                  <button onClick={() => toggleFolder(folder.id)} className="w-full flex items-center justify-between px-4 py-2 bg-transparent hover:bg-[#f4ebdd] dark:hover:bg-[#272019] rounded-lg transition-colors group">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Folder className={`w-3.5 h-3.5 shrink-0 ${expandedFolders[folder.id] ? 'text-[#c9773e] dark:text-[#d9772b]' : 'text-[#a79c8e] dark:text-[#7d6f5c]'}`} />
                      <span className="text-[11px] font-bold text-[#725442] dark:text-[#a89680] truncate group-hover:text-[#473c33] dark:group-hover:text-[#f4ebdd]">{folder.name}</span>
                    </div>
                    {expandedFolders[folder.id] ? <ChevronDown className="w-3 h-3 text-[#a79c8e] dark:text-[#7d6f5c]" /> : <ChevronRight className="w-3 h-3 text-[#a79c8e] dark:text-[#7d6f5c]" />}
                  </button>

                  <AnimatePresence>
                    {expandedFolders[folder.id] && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-4 ml-3 border-l border-[#eee6d6] dark:border-white/[0.08] space-y-0.5">
                        {folder.notebooks.map((nb) => (
                          <button key={nb.id} onClick={() => onSelectNotebook(folder.id, nb.id)} className="w-full text-left px-4 py-2 text-[10px] font-medium text-[#a79c8e] dark:text-[#7d6f5c] hover:text-[#c9773e] dark:hover:text-[#d9772b] truncate flex items-center gap-2 transition-colors">
                            <FileText className="w-3 h-3 shrink-0" />
                            {nb.name}
                          </button>
                        ))}
                        {folder.notebooks.length === 0 && <p className="px-4 py-2 text-[9px] text-[#a79c8e] dark:text-[#7d6f5c]">Vazio</p>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
              {quizFolders.length === 0 && <p className="px-4 py-2 text-[10px] text-[#a79c8e] dark:text-[#7d6f5c]">Nenhuma pasta criada</p>}
            </div>
          </div>
        )}

        {/* Flashcard Folders System */}
        {!collapsed && (
          <div className="space-y-1">
            <div className="px-4 flex items-center justify-between mb-2">
              <p className="text-[9px] font-black text-[#a79c8e] dark:text-[#7d6f5c] uppercase tracking-[0.3em]">Flashcards</p>
              <button onClick={() => setView('FLASHCARDS')} className="text-[#a79c8e] dark:text-[#7d6f5c] hover:text-[#473c33] dark:hover:text-[#f4ebdd]">
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-0.5">
              {flashcardFolders.map((folder) => (
                <button key={folder.id} onClick={() => onSelectFlashcardFolder(folder.id)} className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-[#725442] dark:text-[#a89680] hover:bg-[#f4ebdd] dark:hover:bg-[#272019] transition-colors group">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: folder.color }}></div>
                  <span className="text-[11px] font-bold truncate">{folder.name}</span>
                </button>
              ))}
              {flashcardFolders.length === 0 && <p className="px-4 py-2 text-[10px] text-[#a79c8e] dark:text-[#7d6f5c]">Nenhum módulo criado</p>}
            </div>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {!questionSession && <div className={`p-6 bg-[#f4ebdd] dark:bg-[#272019] border-t border-[#eee6d6] dark:border-white/[0.06] ${collapsed ? 'px-4' : 'p-6'}`}>
        {!collapsed ? (
          <div className="space-y-3">
            <div className="flex justify-between text-[8px] font-black text-[#a79c8e] dark:text-[#7d6f5c] uppercase tracking-widest">
              <span>Progressão Nível {stats.level}</span>
              <span>{stats.xp % 1000}/1000</span>
            </div>
            <div className="w-full h-1 bg-[#eee6d6] dark:bg-[#3a2f22] rounded-full overflow-hidden">
              <div className="h-full bg-[#c9773e] dark:bg-[#d9772b] transition-all duration-500" style={{ width: `${(stats.xp % 1000) / 10}%` }} />
            </div>
            <div className="flex justify-between items-center bg-[#fdfbf7] dark:bg-[#1c1712] p-3 rounded-xl border border-[#eee6d6] dark:border-white/[0.06]">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-[#c9773e] dark:text-[#d9772b] uppercase tracking-widest">Moedas</span>
                <span className="text-sm font-black text-[#473c33] dark:text-[#f4ebdd]">{stats.coins}</span>
              </div>
              <Trophy className="w-4 h-4 text-[#c9773e] dark:text-[#d9772b]" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Trophy className="w-6 h-6 text-[#c9773e] dark:text-[#d9772b]" />
              <div className="absolute -top-2 -right-2 bg-[#c9773e] dark:bg-[#d9772b] text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">{stats.level}</div>
            </div>
          </div>
        )}
      </div>}
    </div>
  );
};

export default Sidebar;
