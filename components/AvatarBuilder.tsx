import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from './icons';
import FishLogo from './FishLogo';
import { CHARACTERS, defaultCharacterId, getCharacter, resolveCharacterId, CharacterPose } from '../services/avatarService';

interface AvatarBuilderProps {
  initialCharacterId?: string;
  onSave: (characterId: string) => void;
  onClose?: () => void;
  onBack?: () => void;
  confirmLabel?: string;
}

const POSES: { id: CharacterPose; label: string }[] = [
  { id: 'frente', label: 'Frente' },
  { id: 'lado', label: 'Perfil' },
  { id: 'costas', label: 'Costas' },
];

// Each card leans a little, like cut-out paper on a character sheet.
const PLATE_TILTS = ['-3deg', '2.5deg', '-1.5deg', '3deg', '-2.5deg', '1.5deg'];

interface GridCard {
  key: string;
  label: string;
  src: string;
  active: boolean;
  onClick: () => void;
}

const AvatarBuilder: React.FC<AvatarBuilderProps> = ({ initialCharacterId, onSave, onClose, onBack, confirmLabel = 'Confirmar personagem' }) => {
  const [characterId, setCharacterId] = useState(() => getCharacter(resolveCharacterId(initialCharacterId) || defaultCharacterId).id);

  const selected = getCharacter(characterId);

  const selectCharacter = (id: string) => setCharacterId(id);

  // The sheet always shows the three turnaround views of the selected character.
  const sheetViews = POSES.map((pose) => ({ key: pose.id, label: pose.label, src: selected.poses[pose.id] }));

  const renderPlateCard = (card: GridCard, index: number) => (
    <button
      key={card.key}
      type="button"
      onClick={card.onClick}
      aria-pressed={card.active}
      className="cs-card group"
      style={{ '--cs-tilt': PLATE_TILTS[index % PLATE_TILTS.length] } as React.CSSProperties}
    >
      <span className="cs-card__stage">
        <span aria-hidden="true" className="cs-card__plate" />
        <img src={card.src} alt="" loading="lazy" className="cs-card__art character-avatar-thumb" />
        {card.active && (
          <span aria-hidden="true" className="cs-card__badge">
            <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
          </span>
        )}
      </span>
      <span className="cs-card__name">{card.label}</span>
    </button>
  );

  const characterNumber = CHARACTERS.findIndex((entry) => entry.id === characterId) + 1;

  return (
    <div
      id="avatar-selection-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-selection-title"
      className="cs-screen fixed inset-0 z-[1200] overflow-y-auto animate-in fade-in duration-500"
    >
      <section className="cs-hero" aria-label={`Folha de personagem: ${selected.name}`}>
        <div className="relative mx-auto w-full max-w-[1180px] px-4 pt-3 sm:px-6 sm:pt-4">
          <header className="flex items-center justify-between gap-3">
            {onBack || onClose ? (
              <button
                type="button"
                onClick={onBack ?? onClose}
                aria-label={onBack ? 'Voltar para escolha de perfil' : 'Fechar escolha de personagem'}
                className="cs-ghost-button group"
              >
                {onBack ? <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> : <X className="h-4 w-4" />}
                {onBack ? 'Voltar' : 'Fechar'}
              </button>
            ) : <span />}
            <span className="cs-logo"><FishLogo className="origin-center scale-[0.5] sm:scale-[0.58]" days={0} darkBg /></span>
            <span className="cs-step hidden sm:inline-block">Passo 2 de 2</span>
          </header>

          <div className="mt-3 text-center sm:mt-4">
            <p className="cs-eyebrow">Seu companheiro de foco</p>
            <h1 id="avatar-selection-title" className="cs-title font-logo">Quem vai estudar <span>com você?</span></h1>
          </div>

          <div className="cs-sheet" aria-live="polite">
            {sheetViews.map((view, index) => (
              <figure key={view.key} className="cs-sheet__view" style={{ '--cs-tilt': PLATE_TILTS[index] } as React.CSSProperties}>
                <span aria-hidden="true" className="cs-sheet__plate" />
                <img
                  key={view.src}
                  src={view.src}
                  alt={`${selected.name} — ${view.label}`}
                  className="cs-sheet__art character-avatar-art character-avatar-pose-transition"
                />
                <figcaption className="cs-sheet__label">{view.label}</figcaption>
              </figure>
            ))}
          </div>

          <div className="cs-nameplate">
            <h2 className="font-logo">{selected.name}</h2>
          </div>
          <p className="cs-hero__hint">Pronto para acompanhar suas aulas, anotações e conquistas.</p>
        </div>

        <div aria-hidden="true" className="cs-hero__strip" />
      </section>

      <main className="relative mx-auto w-full max-w-[1180px] px-4 pb-6 pt-2 sm:px-6">
        <h2 className="cs-section-title">Escolha seu personagem <span>{CHARACTERS.length}</span></h2>

        <div className="cs-grid pt-5">
          {CHARACTERS.map((character, index) => renderPlateCard({
            key: character.id,
            label: character.name,
            src: character.poses.frente,
            active: character.id === characterId,
            onClick: () => selectCharacter(character.id),
          }, index))}
        </div>

        <p className="cs-note">A escolha fica salva no perfil. Você pode mudá-la depois.</p>
      </main>

      <footer className="cs-footer">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="cs-footer__thumb" aria-hidden="true">
              <img src={selected.poses.frente} alt="" />
            </span>
            <span className="min-w-0">
              <span className="cs-footer__name">{selected.name}</span>
              <span className="cs-footer__meta">{characterNumber > 0 ? `${characterNumber} de ${CHARACTERS.length}` : ''}</span>
            </span>
          </div>
          <button type="button" onClick={() => onSave(characterId)} className="cs-cta group">
            {confirmLabel}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={3} />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default AvatarBuilder;
