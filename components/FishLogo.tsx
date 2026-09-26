
import React from 'react';
import { getFishRank } from '../types';

interface FishLogoProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
  iconOnly?: boolean;
  /** Hide the fish icon and show only the "ToDaHORA" wordmark. */
  hideIcon?: boolean;
  days?: number;
  /** Set true when rendering on a dark background (e.g. the sidebar) — the "dark"-tone
   * letters switch from black to white there, since solid black is invisible on navy. */
  darkBg?: boolean;
}

// "ToDaHORA" wordmark: T-D-A-H spell the acronym (dark tone), o-O-R-A spell "ORA" (yellow) —
// together the whole word reads "Toda hora" (PT-BR for "all the time"), sharing the H.
// Solid flat colors, no outline/shadow — see the `darkBg` prop for background-adaptive contrast.
const LOGO_LETTERS: { char: string; tone: 'dark' | 'light'; small?: boolean }[] = [
  { char: 'T', tone: 'dark' },
  { char: 'o', tone: 'light', small: true },
  { char: 'D', tone: 'dark' },
  { char: 'A', tone: 'dark' },
  { char: 'H', tone: 'dark' },
  { char: 'O', tone: 'light' },
  { char: 'R', tone: 'light' },
  { char: 'A', tone: 'light' },
];

const FishLogo: React.FC<FishLogoProps> = ({
  className = "",
  primaryColor = "#eab308",
  secondaryColor = "#facc15",
  iconOnly = false,
  hideIcon = false,
  days = 0,
  darkBg = false
}) => {
  const rank = getFishRank(days);

  // Renderização condicional do Path baseada na evolução
  const renderFishShape = () => {
    switch (rank.id) {
      case 'TUBARAO':
        return (
          <>
            {/* Tubarão: Maior, barbatana pontuda e cauda forte */}
            <path d="M5 30 Q 25 5, 60 10 Q 85 5, 95 15 L 100 0 L 98 25 Q 105 35, 95 45 L 100 60 L 92 50 Q 60 55, 5 30" fill={primaryColor} />
            <path d="M45 12 L 55 0 L 65 10" fill={primaryColor} /> {/* Barbatana Dorsal */}
          </>
        );
      case 'ESPADA':
        return (
          <>
            {/* Peixe-Espada: Bico longo e corpo hidrodinâmico */}
            <path d="M25 30 C 35 15, 65 10, 85 25 C 95 20, 98 15, 100 25 C 98 35, 95 30, 85 35 C 65 50, 35 45, 25 30" fill={primaryColor} />
            <path d="M0 30 L 25 28 L 25 32 Z" fill={primaryColor} /> {/* O Bico/Espada */}
          </>
        );
      case 'ARRAIA':
        return (
          <path d="M10 30 Q 30 5, 70 5 Q 95 30, 70 55 Q 30 55, 10 30 M 70 30 L 100 30" fill={primaryColor} stroke={primaryColor} strokeWidth="2" />
        );
      case 'CAVALO':
        return (
          <path d="M40 5 Q 60 5, 55 20 Q 45 25, 50 40 Q 55 55, 40 55 Q 30 50, 35 40 Q 30 35, 35 25 Q 30 15, 40 5" fill={primaryColor} />
        );
      default:
        // Peixe Padrão (Palhaço/Cirurgião/Iniciante)
        return (
          <path 
            d="M10 30 C 25 10, 55 5, 80 25 C 90 20, 95 15, 100 20 C 97 30, 97 30, 100 40 C 95 45, 90 40, 80 35 C 55 55, 25 50, 10 30 Z" 
            fill={primaryColor}
          />
        );
    }
  };

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {!hideIcon && (
        <div className="relative w-12 h-12 flex-shrink-0 group flex items-center justify-center">
          <svg
            viewBox="0 0 100 60"
            className="w-full h-auto transform group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 drop-shadow-[0_4px_6px_rgba(0,0,0,0.1)]"
          >
            {renderFishShape()}
            <circle cx={rank.id === 'CAVALO' ? "50" : "28"} cy={rank.id === 'CAVALO' ? "12" : "27"} r="4" fill="white" />
            <circle cx={rank.id === 'CAVALO' ? "51" : "29"} cy={rank.id === 'CAVALO' ? "12" : "27"} r="1.8" fill="#473c33" />
          </svg>
        </div>
      )}

      {!iconOnly && (
        <div className="flex items-baseline group cursor-default">
          {LOGO_LETTERS.map((letter, idx) => (
            <span
              key={idx}
              className={`font-logo leading-none ${letter.small ? 'text-2xl' : 'text-4xl'}`}
              style={{ color: letter.tone === 'dark' ? (darkBg ? '#FFFFFF' : '#473c33') : '#eab308' }}
            >
              {letter.char}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default FishLogo;
