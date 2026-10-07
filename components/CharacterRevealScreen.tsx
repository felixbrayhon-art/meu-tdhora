import React, { useEffect, useState } from 'react';
import { ArrowRight } from './icons';
import { getCharacter, getCharacterSrc, getReactionVideoSrc } from '../services/avatarService';

interface CharacterRevealScreenProps {
  characterId: string;
  onContinue: () => void;
  continueLabel?: string;
}

const AUTO_CONTINUE_MS = 5000;
// With a reaction clip (~5s), leave time to see it end before moving on.
const AUTO_CONTINUE_WITH_VIDEO_MS = 7000;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Shown right after a character is confirmed, like a character-select reveal
// in a game. Uses the same "character sheet" look as the picker (sand band,
// tilted card, triangle seam) and moves on by itself after a few seconds.
// Characters with a reaction clip play it once and hold on its last frame.
const CharacterRevealScreen: React.FC<CharacterRevealScreenProps> = ({
  characterId,
  onContinue,
  continueLabel = 'Vamos lá!',
}) => {
  const character = getCharacter(characterId);
  const [videoFailed, setVideoFailed] = useState(false);
  const reactionSrc = prefersReducedMotion() || videoFailed ? undefined : getReactionVideoSrc(characterId);
  const autoContinueMs = reactionSrc ? AUTO_CONTINUE_WITH_VIDEO_MS : AUTO_CONTINUE_MS;

  useEffect(() => {
    const timer = setTimeout(onContinue, autoContinueMs);
    return () => clearTimeout(timer);
  }, [onContinue, autoContinueMs]);

  return (
    <div
      id="character-reveal-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="character-reveal-title"
      className="fixed inset-0 z-[1300] flex flex-col overflow-hidden animate-in fade-in duration-500"
    >
      <section className="cr-stage">
        <p className="cs-eyebrow">Seu companheiro de foco é</p>
        <h1 id="character-reveal-title" className="cs-title font-logo">{character.name}</h1>

        {reactionSrc ? (
          <figure className="cr-figure cr-figure--video">
            <video
              src={reactionSrc}
              autoPlay
              muted
              playsInline
              preload="auto"
              aria-label={`${character.name} comemorando`}
              onError={() => setVideoFailed(true)}
              className="cr-figure__video"
            />
          </figure>
        ) : (
          <figure className="cr-figure animate-in zoom-in-95 duration-700">
            <span aria-hidden="true" className="cr-figure__plate" />
            <img src={getCharacterSrc(characterId)} alt={character.name} className="cr-figure__art" />
          </figure>
        )}

        <div aria-hidden="true" className="cs-hero__strip" />
      </section>

      <footer className="cr-footer">
        <p className="cr-footer__text">Pronto para acompanhar suas aulas, anotações e conquistas.</p>
        <button type="button" onClick={onContinue} className="cs-cta group">
          {continueLabel}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={3} />
        </button>
        <span key={autoContinueMs} aria-hidden="true" className="cr-timer" style={{ animationDuration: `${autoContinueMs}ms` }} />
      </footer>
    </div>
  );
};

export default CharacterRevealScreen;
