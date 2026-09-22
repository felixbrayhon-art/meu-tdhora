
import React, { useEffect, useState } from 'react';
import FishLogo from './FishLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showBrand, setShowBrand] = useState(false);

  useEffect(() => {
    // Inicia o surgimento da marca logo após a barra de progresso
    const brandTimer = setTimeout(() => {
      setShowBrand(true);
    }, 2000);

    // Finaliza a splash screen após a animação da marca
    const exitTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 600);
    }, 5000);

    return () => {
      clearTimeout(brandTimer);
      clearTimeout(exitTimer);
    };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[100] overflow-hidden transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <img
        src="/splash-cast-banner.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />

      <div className="relative z-10 h-full flex flex-col items-center justify-end pb-16 px-10">
        <div className="max-w-md w-full text-center space-y-8 animate-in zoom-in-95 duration-1000">
          {/* Container com animação de entrada amortecida para a tipografia/logo */}
          <div
            className={`transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform-gpu ${
              showBrand ? 'opacity-100 translate-y-0 scale-150' : 'opacity-0 translate-y-8 scale-125'
            }`}
          >
            <FishLogo className="justify-center py-4" darkBg hideIcon />
          </div>

          <div className="space-y-6 w-full flex flex-col items-center">
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.5em]">Superando a memória de peixe</p>

            <div className="h-1 w-48 bg-white/20 rounded-full overflow-hidden">
               <div className="h-full bg-yellow-400 animate-[loading_5s_linear_forwards]"></div>
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
