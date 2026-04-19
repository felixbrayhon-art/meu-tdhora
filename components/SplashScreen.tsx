
import React, { useEffect, useState } from 'react';
import { FishSilhouette } from './FishGraphics';
import FishLogo from './FishLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showBrand, setShowBrand] = useState(false);

  useEffect(() => {
    // Inicia o surgimento da marca logo após a barra de progresso (3s)
    const brandTimer = setTimeout(() => {
      setShowBrand(true);
    }, 3100);

    // Finaliza a splash screen após a animação da marca
    const exitTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 600); 
    }, 5500);

    return () => {
      clearTimeout(brandTimer);
      clearTimeout(exitTimer);
    };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[100] bg-[#FAFAFA] flex flex-col items-center justify-center transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="max-w-md w-full text-center px-10 space-y-12 animate-in zoom-in-95 duration-1000">
        <div className="relative flex justify-center">
          <FishSilhouette className="w-64 h-32 text-gray-100 opacity-60" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-300 font-bold text-[8px] uppercase tracking-[0.6em] opacity-30">
            Carregando Foco
          </div>
        </div>
        
        <div className="space-y-8 flex flex-col items-center">
          {/* Container com animação de entrada amortecida para a tipografia/logo */}
          <div 
            className={`transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform-gpu ${
              showBrand ? 'opacity-100 translate-y-0 scale-150' : 'opacity-0 translate-y-8 scale-125'
            }`}
          >
            <FishLogo className="py-4" />
          </div>
          
          <div className="space-y-6 w-full flex flex-col items-center">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.5em] opacity-60">Superando a memória de peixe</p>

            <div className="h-1 w-48 bg-gray-100 rounded-full overflow-hidden">
               <div className="h-full bg-yellow-400 animate-[loading_3s_linear_forwards]"></div>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes loading {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
