
import React from 'react';
import { FishSilhouette } from './FishGraphics';
import { useCharacterId } from '../contexts/CharacterContext';
import { getLoadingSrc } from '../services/avatarService';

interface LoadingFishProps {
  message?: string;
  submessage?: string;
}

const LoadingFish: React.FC<LoadingFishProps> = ({
  message = "Ajustando o foco...",
  submessage = "A IA está mergulhando no oceano de informações"
}) => {
  const characterId = useCharacterId();
  const characterSrc = getLoadingSrc(characterId);

  if (characterSrc) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[55vh] space-y-4 animate-in fade-in duration-500">
        <div className="relative w-64 h-72 sm:w-72 sm:h-80 md:h-96 flex items-end justify-center">
          {/* Soft glow behind the character for depth */}
          <div className="absolute inset-0 flex items-center justify-center -z-10">
            <div className="w-2/3 h-2/3 rounded-full bg-gradient-to-b from-yellow-200/50 to-orange-200/30 blur-3xl"></div>
          </div>

          <img src={characterSrc} alt="" className="h-[88%] object-contain drop-shadow-2xl" />

          {/* Subtle light sweep overlay, masked to the character's own silhouette */}
          <div
            className="absolute inset-0 h-[88%] shimmer-sweep pointer-events-none"
            style={{
              WebkitMaskImage: `url(${characterSrc})`,
              maskImage: `url(${characterSrc})`,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'bottom center',
              maskPosition: 'bottom center',
            }}
          ></div>

          {/* Ground shadow */}
          <div className="absolute bottom-2 w-28 h-4 rounded-full bg-black/20 blur-md"></div>

          {/* Bubbles */}
          <div className="absolute top-2 right-6 w-2.5 h-2.5 rounded-full bg-blue-200 bubble" style={{ animationDelay: '0.2s' }}></div>
          <div className="absolute top-10 right-0 w-2 h-2 rounded-full bg-blue-100 bubble" style={{ animationDelay: '0.8s' }}></div>
          <div className="absolute top-20 right-8 w-1.5 h-1.5 rounded-full bg-blue-50 bubble" style={{ animationDelay: '1.5s' }}></div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-[#0A0F1E] font-black text-xl tracking-tight italic">{message}</p>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.3em]">{submessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-8 animate-in fade-in duration-500">
      <div className="relative w-48 h-24 flex items-end justify-center">
        <FishSilhouette className="w-full h-full text-blue-500/20" color="currentColor" />

        {/* Bubbles */}
        <div className="absolute top-0 right-4 w-2 h-2 rounded-full bg-blue-200 bubble" style={{ animationDelay: '0.2s' }}></div>
        <div className="absolute top-4 right-0 w-1.5 h-1.5 rounded-full bg-blue-100 bubble" style={{ animationDelay: '0.8s' }}></div>
        <div className="absolute top-8 right-6 w-1 h-1 rounded-full bg-blue-50 bubble" style={{ animationDelay: '1.5s' }}></div>
      </div>

      <div className="text-center space-y-2">
        <p className="text-[#0A0F1E] font-black text-xl tracking-tight italic">{message}</p>
        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.3em]">{submessage}</p>
      </div>
    </div>
  );
};

export default LoadingFish;
