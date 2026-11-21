import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from './icons';
import FishLogo from './FishLogo';
import { CHARACTERS, defaultCharacterId, getCharacter, resolveCharacterId } from '../services/avatarService';
import VoxelAvatar from './VoxelAvatar';

interface AvatarBuilderProps {
  initialCharacterId?: string;
  onSave: (characterId: string) => void;
  onClose?: () => void;
  onBack?: () => void;
  confirmLabel?: string;
}

// As três vistas da folha de personagem. Antes eram três desenhos por
// personagem; agora é o mesmo boneco girado, então vale para qualquer um.
const VISTAS: { id: string; label: string; angulo: number }[] = [
  { id: 'frente', label: 'Frente', angulo: 0 },
  { id: 'lado', label: 'Perfil', angulo: -70 },
  { id: 'costas', label: 'Costas', angulo: 180 },
];

/**
 * O boneco de um card da grade. Duas economias, porque são 23 na mesma tela:
 * só a cabeça (o corpo inteiro são ~700 divs por boneco, cada cubo um contexto
 * 3D próprio) e montagem só quando o card chega perto da vista. Sem as duas, a
 * rolagem da escolha travava. O corpo inteiro de quem está escolhido continua
 * à mostra nas três vistas lá em cima.
 */
const CardArt: React.FC<{ characterId: string }> = ({ characterId }) => {
  const caixa = useRef<HTMLSpanElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const alvo = caixa.current;
    if (!alvo || typeof IntersectionObserver === 'undefined') { setVisivel(true); return; }
    const observador = new IntersectionObserver(([entrada]) => {
      if (entrada.isIntersecting) { setVisivel(true); observador.disconnect(); }
    }, { rootMargin: '300px' });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  return (
    <span ref={caixa} className="cs-card__art">
      {visivel && <VoxelAvatar characterId={characterId} recorte="rosto" estatico altura={116} pose="parado" />}
    </span>
  );
};

// Each card leans a little, like cut-out paper on a character sheet.
const PLATE_TILTS = ['-3deg', '2.5deg', '-1.5deg', '3deg', '-2.5deg', '1.5deg'];

interface GridCard {
  key: string;
  label: string;
  characterId: string;
  active: boolean;
  onClick: () => void;
}

const AvatarBuilder: React.FC<AvatarBuilderProps> = ({ initialCharacterId, onSave, onClose, onBack, confirmLabel = 'Confirmar personagem' }) => {
  const [characterId, setCharacterId] = useState(() => getCharacter(resolveCharacterId(initialCharacterId) || defaultCharacterId).id);

  const selected = getCharacter(characterId);

  const selectCharacter = (id: string) => setCharacterId(id);

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
        <CardArt characterId={card.characterId} />
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
            {VISTAS.map((vista, index) => (
              <figure key={vista.id} className="cs-sheet__view" style={{ '--cs-tilt': PLATE_TILTS[index] } as React.CSSProperties} aria-label={`${selected.name} — ${vista.label}`}>
                <span aria-hidden="true" className="cs-sheet__plate" />
                {/* Paradas: são três bonecos de corpo inteiro do mesmo
                    personagem, e mexer os três a cada quadro é o que mais pesa
                    nesta tela. Folha de personagem é retrato, não animação — e
                    logo depois, na revelação, ele entra comemorando. */}
                <VoxelAvatar key={`${characterId}-${vista.id}`} characterId={characterId} altura={200} angulo={vista.angulo} estatico pose="parado" className="cs-sheet__art" />
                <figcaption className="cs-sheet__label">{vista.label}</figcaption>
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
            characterId: character.id,
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
              <VoxelAvatar characterId={characterId} recorte="rosto" estatico altura={44} pose="parado" />
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
