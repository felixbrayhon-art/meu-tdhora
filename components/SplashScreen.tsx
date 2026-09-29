import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SPLASH_TITLE = 'ToDAHora';

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const exitTimer = window.setTimeout(() => {
      setIsVisible(false);
      window.setTimeout(onComplete, 700);
    }, prefersReducedMotion ? 1000 : 5000);

    return () => window.clearTimeout(exitTimer);
  }, [onComplete]);

  return (
    <div
      className={`splash-screen fixed inset-0 z-[100] flex items-center justify-center overflow-hidden px-6 transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      role="status"
      aria-label="Carregando ToDAHora"
    >
      <div className="splash-screen__glow splash-screen__glow--left" aria-hidden="true" />
      <div className="splash-screen__glow splash-screen__glow--right" aria-hidden="true" />

      <div className="splash-screen__content flex flex-col items-center text-center">
        <div className="splash-wordmark" aria-label="ToDAHora">
          <h1 className="splash-wordmark__title" aria-hidden="true">
            {Array.from(SPLASH_TITLE).map((character, index) => (
              <span
                key={`${character}-${index}`}
                className={`splash-wordmark__letter splash-wordmark__letter--${[0, 2, 3, 4].includes(index) ? 'gold' : 'orange'}`}
                style={{
                  '--splash-delay': `${1.55 + index * 0.055}s`,
                  '--splash-from': `${-0.38 * (index + 1)}em`,
                } as React.CSSProperties}
              >
                {character}
              </span>
            ))}
            <span className="splash-wordmark__suffix">estude</span>
          </h1>

          <div className="splash-orb" aria-hidden="true">
            <div className="splash-orb__inner">
              <svg className="splash-orb__wave splash-orb__wave--back" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
                <path d="M799.09 90c-80.714 0-79.621-90-200-90-120.377 0-118.607 90-200 90-81.391 0-81.215-90-200-90C80.308 0 78.68 89.29-.91 90v510h800V90z" />
              </svg>
              <svg className="splash-orb__wave splash-orb__wave--front" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
                <path d="M799.09 90c-80.714 0-79.621-90-200-90-120.377 0-118.607 90-200 90-81.391 0-81.215-90-200-90C80.308 0 78.68 89.29-.91 90v510h800V90z" />
              </svg>
            </div>
          </div>
        </div>

        <p className="splash-screen__tagline mt-8 text-[10px] font-extrabold uppercase tracking-[0.42em] sm:text-xs">
          Seu foco, no seu ritmo
        </p>

        <div className="splash-screen__progress mt-8 h-1 w-44 overflow-hidden rounded-full" aria-hidden="true">
          <span className="splash-screen__progress-fill block h-full rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
