import React from 'react';
import { UserStats } from '../types';
import FishLogo from './FishLogo';

interface HeaderProps {
  stats: UserStats;
  onLogoClick: () => void;
  isAIEnabled: boolean;
  isDarkMode: boolean;
  compact?: boolean;
}

const Header: React.FC<HeaderProps> = ({ stats, onLogoClick, isAIEnabled, isDarkMode, compact = false }) => {
  return (
    <header className={`${compact ? '' : 'app-header-pattern '}relative isolate overflow-hidden bg-white dark:bg-[#272019] border-b border-gray-100 dark:border-white/[0.06] ${compact ? 'py-2' : 'py-4'} px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm dark:shadow-none`}>
      <div className="relative z-10 flex items-center gap-6 lg:gap-8">
        <button onClick={onLogoClick} className="hover:opacity-80 transition-opacity active:scale-95 shrink-0" title="Ir para o Hub">
          <FishLogo days={stats.totalDaysStudied} darkBg={isDarkMode} className="scale-75 md:scale-90 lg:scale-100 origin-left" />
        </button>
      </div>

      <div className="relative z-10 flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5 bg-[#fff1e8] dark:bg-[#523126] text-[#a83100] dark:text-[#f0e89f] px-3 py-1.5 rounded-full font-bold text-xs uppercase tracking-tighter">DIAS estendidos: {stats.totalDaysStudied}</div>
        <div className="flex items-center gap-1.5 bg-[#fff6e8] dark:bg-[#523126] text-[#a83100] dark:text-[#f0e89f] px-3 py-1.5 rounded-full font-bold text-xs uppercase tracking-tighter">RITMO: {stats.streak}</div>

        <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border ${isAIEnabled ? 'bg-[#f0e89f]/60 dark:bg-[#8c2c0b] border-[#a83100]/20 dark:border-[#fb4d00]/50' : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 opacity-50'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isAIEnabled ? 'bg-[#fb4d00] dark:bg-[#f0e89f] animate-pulse' : 'bg-gray-400'}`}></div>
          <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${isAIEnabled ? 'text-[#a83100] dark:text-[#f0e89f]' : 'text-gray-400'}`}>IA: {isAIEnabled ? 'ATIVA' : 'DESATIVADA'}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
