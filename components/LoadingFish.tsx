import React from 'react';
import { FishSilhouette } from './FishGraphics';
import { useCharacterId } from '../contexts/CharacterContext';
import { getLoadingSrc, getSceneSrc } from '../services/avatarService';

interface LoadingFishProps {
  message?: string;
  submessage?: string;
  /** Fill the entire viewport edge-to-edge (no rounded card) — use when this is the only content of a `fixed inset-0` overlay. */
  fullScreen?: boolean;
}

const LoadingFish: React.FC<LoadingFishProps> = ({ message = 'Ajustando o foco...', submessage = 'A IA está mergulhando no oceano de informações', fullScreen = false }) => {
  const characterId = useCharacterId();
  const characterSrc = getLoadingSrc(characterId);
  const sceneSrc = getSceneSrc(characterId);

  if (characterSrc && sceneSrc) {
    return (
      <div className={`relative overflow-hidden flex flex-col items-end justify-end animate-in fade-in duration-500 bg-[#faf3e3] ${fullScreen ? 'w-full h-full' : 'min-h-[55vh] rounded-[40px]'}`}>
        <img src={sceneSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#473c33]/80 via-[#473c33]/10 to-transparent"></div>

        <div className="relative z-10 text-center space-y-2 p-8 w-full">
          <p className="text-white font-black text-xl tracking-tight drop-shadow-md">{message}</p>
          <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.3em]">{submessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-8 animate-in fade-in duration-500 bg-[#faf3e3] rounded-[40px] p-8">
      <div className="relative w-48 h-24 flex items-end justify-center">
        <FishSilhouette className="w-full h-full text-[#fecc73]/20" color="currentColor" />

        {/* Bubbles */}
        <div className="absolute top-0 right-4 w-2 h-2 rounded-full bg-[#ffe6b9] bubble" style={{ animationDelay: '0.2s' }}></div>
        <div className="absolute top-4 right-0 w-1.5 h-1.5 rounded-full bg-[#fff0d5] bubble" style={{ animationDelay: '0.8s' }}></div>
        <div className="absolute top-8 right-6 w-1 h-1 rounded-full bg-[#fff6e8] bubble" style={{ animationDelay: '1.5s' }}></div>
      </div>

      <div className="text-center space-y-2">
        <p className="text-[#473c33] font-black text-xl tracking-tight ">{message}</p>
        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.3em]">{submessage}</p>
      </div>
    </div>
  );
};

export default LoadingFish;
