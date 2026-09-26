import React, { useEffect } from 'react';
import { getCharacter, getCharacterSrc, getSelectAnimationSrc } from '../services/avatarService';
import TransparentVideo from './TransparentVideo';

interface CharacterRevealScreenProps {
  characterId: string;
  onContinue: () => void;
  continueLabel?: string;
}

// Backdrop tuned per character so it contrasts with that character's own
// dominant colors (e.g. an orange fox needs a cool backdrop, not another
// warm one) — this screen only; every other screen keeps its own palette.
const DEFAULT_TEASER_BG = 'from-[#1584c4] via-[#0f6aa0] to-[#082a4a]';
const TEASER_BACKGROUNDS: Record<string, string> = {
  'roqueiro-3d': 'from-[#7c3aed] via-[#5b21b6] to-[#1e1b4b]', // violet, contrasts his blue denim + rust pants
  'raposa-3d': 'from-[#0ea5b7] via-[#0f6aa0] to-[#082a4a]', // cool blue/teal, contrasts orange fur
  'garoto-aquario-3d': 'from-[#2563eb] via-[#1e40af] to-[#172554]', // deep blue, contrasts yellow shirt
  'enfermeiro-3d': 'from-[#f97316] via-[#c2410c] to-[#7c2d12]', // warm rust, contrasts teal scrubs
};
// Only the animated-video reveal gets this yellow backdrop; the static-pose
// fallback keeps the per-character/default colors above untouched.
const VIDEO_TEASER_BG = 'from-[#fde047] via-[#f5b719] to-[#c2870a]';

// Shown right after a character is confirmed, like a character-select reveal
// in a game: plays the character's idle animation (when one exists) full-screen
// before handing off to whatever comes next.
const CharacterRevealScreen: React.FC<CharacterRevealScreenProps> = ({
  characterId,
  onContinue,
  continueLabel = 'Vamos lá!',
}) => {
  const character = getCharacter(characterId);
  const animationSrc = getSelectAnimationSrc(characterId);
  const isVideoReveal = !!animationSrc;
  const bgGradient = isVideoReveal ? VIDEO_TEASER_BG : (TEASER_BACKGROUNDS[characterId] ?? DEFAULT_TEASER_BG);

  useEffect(() => {
    const timer = setTimeout(onContinue, 5000);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <div
      className={`fixed inset-0 z-[1300] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br ${bgGradient} px-6 ${isVideoReveal ? 'text-[#473c33]' : 'text-white'}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(122,244,241,0.28),transparent_45%)]" />
      <div className={`pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full border-[38px] ${isVideoReveal ? 'border-white/25' : 'border-white/10'}`} />
      <div className={`pointer-events-none absolute -right-16 top-16 h-56 w-56 rounded-full border-[28px] ${isVideoReveal ? 'border-white/20' : 'border-[#7af4f1]/15'}`} />

      <p className={`relative z-10 animate-in fade-in text-[11px] font-black uppercase tracking-[0.3em] duration-500 ${isVideoReveal ? 'text-[#8d5d04]' : 'text-[#7af4f1]'}`}>
        Seu companheiro de foco é
      </p>
      <h1 className="font-logo relative z-10 mt-1 animate-in fade-in text-center text-4xl uppercase tracking-[-0.02em] drop-shadow-lg duration-500 sm:text-5xl">
        {character.name}
      </h1>

      <div className="relative z-10 mt-4 flex h-[78vh] min-h-[460px] w-full max-w-[720px] animate-in zoom-in-95 items-end justify-center duration-700">
        {animationSrc ? (
          <TransparentVideo key={animationSrc} src={animationSrc} inset={0.98} className="h-full max-w-full object-contain" />
        ) : (
          <img
            src={getCharacterSrc(characterId)}
            alt={character.name}
            className="h-full object-contain drop-shadow-2xl"
          />
        )}
      </div>

      <button
        onClick={onContinue}
        className="relative z-10 mt-8 flex items-center gap-2 rounded-2xl bg-[#79f1ed] px-8 py-4 text-sm font-black uppercase tracking-wide text-[#082a4a] shadow-[0_10px_25px_rgba(3,46,74,0.3)] transition hover:-translate-y-0.5 hover:bg-[#9ff7f1]"
      >
        {continueLabel}
      </button>
    </div>
  );
};

export default CharacterRevealScreen;
