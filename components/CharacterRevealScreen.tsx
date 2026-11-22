import React, { useEffect, useState } from 'react';
import { ArrowRight } from './icons';
import { getCharacter } from '../services/avatarService';
import VoxelAvatar from './VoxelAvatar';
import { ler as lerMascote } from '../services/mascote';

interface CharacterRevealScreenProps {
  characterId: string;
  onContinue: () => void;
  continueLabel?: string;
}

const AUTO_CONTINUE_MS = 6000;

// Shown right after a character is confirmed, like a character-select reveal
// in a game. Uses the same "character sheet" look as the picker (sand band,
// tilted card, triangle seam) and moves on by itself after a few seconds.
// O boneco entra comemorando: antes isso era um clipe gravado por personagem,
// e agora é a animação que ele já sabe fazer em qualquer tela.
const CharacterRevealScreen: React.FC<CharacterRevealScreenProps> = ({
  characterId,
  onContinue,
  continueLabel = 'Vamos lá!',
}) => {
  const character = getCharacter(characterId);
  // Lido uma vez: esta tela aparece por segundos e some, e o estúdio acabou
  // de gravar. Vale também no cadastro, que roda antes do provedor existir.
  const [mascote] = useState(() => lerMascote());
  const autoContinueMs = AUTO_CONTINUE_MS;

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

        <figure className="cr-figure animate-in zoom-in-95 duration-700" aria-label={`${character.name} comemorando`}>
          <span aria-hidden="true" className="cr-figure__plate" />
          <VoxelAvatar characterId={characterId} mascote={mascote} altura={300} pose="festejando" className="cr-figure__art" />
        </figure>

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
