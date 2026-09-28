import React from 'react';
import { UserStats } from '../types';
import FishLogo from './FishLogo';

interface HeaderProps {
  stats: UserStats;
  onLogoClick: () => void;
  isAIEnabled: boolean;
  isDarkMode: boolean;
}

const Header: React.FC<HeaderProps> = ({ stats, onLogoClick, isAIEnabled, isDarkMode }) => {
  return (
    <header className="bg-white dark:bg-[#272019] border-b border-gray-100 dark:border-white/[0.06] py-4 px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm dark:shadow-none">
      <div className="flex items-center gap-6 lg:gap-8">
        <button onClick={onLogoClick} className="hover:opacity-80 transition-opacity active:scale-95 shrink-0" title="Ir para o Hub">
          <FishLogo days={stats.totalDaysStudied} darkBg={isDarkMode} className="scale-75 md:scale-90 lg:scale-100 origin-left" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5 bg-[#fff1e8] dark:bg-[#3a2f22] text-[#ff832a] dark:text-[#d9772b] px-3 py-1.5 rounded-full font-bold text-xs uppercase tracking-tighter">DIAS estendidos: {stats.totalDaysStudied}</div>
        <div className="flex items-center gap-1.5 bg-[#fff6e8] dark:bg-[#3a2f22] text-[#ffb22a] dark:text-[#d9772b] px-3 py-1.5 rounded-full font-bold text-xs uppercase tracking-tighter">RITMO: {stats.streak}</div>

        <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border ${isAIEnabled ? 'bg-[#fecc73]/5 dark:bg-[#d9772b]/10 border-[#fecc73]/10 dark:border-[#d9772b]/20' : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 opacity-50'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isAIEnabled ? 'bg-[#fecc73] dark:bg-[#d9772b] animate-pulse' : 'bg-gray-400'}`}></div>
          <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${isAIEnabled ? 'text-[#fec868] dark:text-[#d9772b]' : 'text-gray-400'}`}>IA: {isAIEnabled ? 'ATIVA' : 'DESATIVADA'}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
