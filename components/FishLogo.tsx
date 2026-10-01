
import React from 'react';

interface FishLogoProps {
  className?: string;
  /** @deprecated The flag mark uses the app's fixed brand palette. */
  primaryColor?: string;
  /** @deprecated The flag mark uses the app's fixed brand palette. */
  secondaryColor?: string;
  iconOnly?: boolean;
  /** Hide the flag icon and show only the "ToDaHORA" wordmark. */
  hideIcon?: boolean;
  /** Kept for compatibility with existing call sites. */
  days?: number;
  /** Set true when rendering on a dark background — dark-tone letters switch to cream for contrast. */
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
  iconOnly = false,
  hideIcon = false,
  darkBg = false
}) => {

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {!hideIcon && (
        <div className="relative w-12 h-12 flex-shrink-0 group flex items-center justify-center">
          <svg
            viewBox="0 0 100 64"
            className="w-full h-auto transform group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 drop-shadow-[0_4px_6px_rgba(0,0,0,0.1)]"
            role="img"
            aria-label="Bandeira do Brasil nas cores do ToDAHora"
          >
            <path d="M8 12Q8 7 14 7h72q6 0 6 6v38q0 6-6 6H14q-6 0-6-6V12Z" fill="#628a46" />
            <path d="m50 12 34 20-34 20-34-20 34-20Z" fill="#eab308" />
            <circle cx="50" cy="32" r="11" fill="#473c33" />
            <path d="M40 29q10-5 20 0" fill="none" stroke="#f2efd2" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="48" cy="34" r="1.3" fill="#f2efd2" />
            <circle cx="54" cy="37" r="1.2" fill="#ed6b2f" />
            <circle cx="52" cy="29" r="1.2" fill="#f2efd2" />
          </svg>
        </div>
      )}

      {!iconOnly && (
        <div className="flex items-baseline group cursor-default">
          {LOGO_LETTERS.map((letter, idx) => (
            <span
              key={idx}
              className={`font-logo leading-none ${letter.small ? 'text-2xl' : 'text-4xl'}`}
              style={{ color: letter.tone === 'dark' ? (darkBg ? '#f2efd2' : '#473c33') : '#eab308' }}
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
