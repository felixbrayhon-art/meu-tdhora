
import React from 'react';
import { FishSilhouette } from './FishGraphics';

interface LoadingFishProps {
  message?: string;
  submessage?: string;
}

const LoadingFish: React.FC<LoadingFishProps> = ({ 
  message = "Ajustando o foco...", 
  submessage = "A IA está mergulhando no oceano de informações" 
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-8 animate-in fade-in duration-500">
      <div className="relative w-48 h-24">
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
