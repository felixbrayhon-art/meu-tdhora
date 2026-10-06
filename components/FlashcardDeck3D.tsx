import React from 'react';

interface FlashcardDeck3DProps {
  color: string;
}

/** A small CSS-only stack of study cards for the Flashcards folder gallery. */
const FlashcardDeck3D: React.FC<FlashcardDeck3DProps> = ({ color }) => (
  <div
    className="flashcard-deck-3d"
    style={{ '--flashcard-deck-accent': color } as React.CSSProperties}
    aria-hidden="true"
  >
    <div className="flashcard-deck-3d__back flashcard-deck-3d__back--far" />
    <div className="flashcard-deck-3d__back flashcard-deck-3d__back--near" />
    <div className="flashcard-deck-3d__front">
      <span className="flashcard-deck-3d__brand">ToDAHora · Revisão</span>
      <span className="flashcard-deck-3d__mark">?</span>
      <span className="flashcard-deck-3d__lines">
        <i />
        <i />
        <i />
      </span>
      <span className="flashcard-deck-3d__footer">FRENTE · VERSO</span>
    </div>
  </div>
);

export default FlashcardDeck3D;
