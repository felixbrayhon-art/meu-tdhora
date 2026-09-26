import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Palette, RotateCcw, Shirt, Smile, Sparkles, UserRound, X } from './icons';
import { CHARACTERS, defaultCharacterId, getAvailableExpressions, getCharacter, getExpressionSrc, CharacterOption, CharacterPose, Expression } from '../services/avatarService';
import TransparentVideo from './TransparentVideo';

const EXPRESSION_LABELS: Record<Expression, string> = {
  feliz: 'Feliz',
  comemorando: 'Comemorando',
  'em-duvida': 'Em dúvida',
  explicando: 'Explicando',
  triste: 'Triste',
  'com-sono': 'Com sono',
  surpreso: 'Surpreso',
  focado: 'Focado',
  explicando2: 'Explicando',
  serio: 'Sério',
  orgulhoso: 'Orgulhoso',
  pensativo: 'Pensativo',
};

interface AvatarBuilderProps {
  initialCharacterId?: string;
  onSave: (characterId: string) => void;
  onClose?: () => void;
  onBack?: () => void;
  confirmLabel?: string;
}

const POSES: { id: CharacterPose; label: string }[] = [
  { id: 'frente', label: 'Frente' },
  { id: 'lado', label: 'Lado' },
  { id: 'costas', label: 'Costas' },
];

type CharacterFilter = 'todos' | '2d' | '3d';
type PickerTab = 'personagens' | 'estilo' | 'poses' | 'expressoes';

interface GridCard {
  key: string;
  label: string;
  src: string;
  active: boolean;
  onClick: () => void;
}

const AvatarBuilder: React.FC<AvatarBuilderProps> = ({ initialCharacterId, onSave, onClose, onBack, confirmLabel = 'Confirmar personagem' }) => {
  const [characterId, setCharacterId] = useState(initialCharacterId || defaultCharacterId);
  const [poseIndex, setPoseIndex] = useState(0);
  const [selectedExpression, setSelectedExpression] = useState<Expression | null>(null);
  const [activeTab, setActiveTab] = useState<PickerTab>('personagens');
  const [characterFilter, setCharacterFilter] = useState<CharacterFilter>('todos');

  const selected = getCharacter(characterId);
  const pose = POSES[poseIndex];
  const expressions = getAvailableExpressions(characterId);
  const previewSrc = (selectedExpression && getExpressionSrc(characterId, selectedExpression)) || selected.poses[pose.id];
  // Keep the picker preview still so the character silhouette remains as clear as the reference layout.
  const animationSrc = undefined;

  const cyclePose = (direction: 1 | -1) => {
    setSelectedExpression(null);
    setPoseIndex((previous) => (previous + direction + POSES.length) % POSES.length);
  };

  const selectCharacter = (id: string) => {
    setCharacterId(id);
    setPoseIndex(0);
    setSelectedExpression(null);
  };

  const visibleCharacters = CHARACTERS.filter((character) => characterFilter === 'todos' || (characterFilter === '3d' ? character.is3D : !character.is3D));
  const characterCounts = {
    todos: CHARACTERS.length,
    '2d': CHARACTERS.filter((character) => !character.is3D).length,
    '3d': CHARACTERS.filter((character) => character.is3D).length,
  };

  const baseId = selected.baseId ?? (characterId.endsWith('-3d') ? characterId.slice(0, -3) : characterId);
  const variant2D = CHARACTERS.find((character) => character.id === baseId) ?? null;
  const variant3D = CHARACTERS.find((character) => character.is3D && (character.baseId === baseId || character.id === `${baseId}-3d`)) ?? null;
  const styleVariants = [variant2D, variant3D].filter((character): character is CharacterOption => !!character);

  const styleCards: GridCard[] = styleVariants.map((character) => ({
    key: `style-${character.id}`,
    label: character.is3D ? '3D' : '2D',
    src: character.poses.frente,
    active: character.id === characterId,
    onClick: () => selectCharacter(character.id),
  }));

  const poseCards: GridCard[] = POSES.map((currentPose, index) => ({
    key: `pose-${currentPose.id}`,
    label: currentPose.label,
    src: selected.poses[currentPose.id],
    active: !selectedExpression && index === poseIndex,
    onClick: () => {
      setSelectedExpression(null);
      setPoseIndex(index);
    },
  }));

  const expressionCards: GridCard[] = expressions
    .map((expression) => {
      const src = getExpressionSrc(characterId, expression);
      if (!src) return null;
      return {
        key: `expression-${expression}`,
        label: EXPRESSION_LABELS[expression],
        src,
        active: selectedExpression === expression,
        onClick: () => setSelectedExpression(expression),
      };
    })
    .filter((card): card is GridCard => !!card);

  const renderTile = (card: GridCard, sizeClass = 'aspect-square', showLabel = false) => (
    <button key={card.key} onClick={card.onClick} title={card.label} className={`group relative ${sizeClass} overflow-hidden rounded-2xl border-2 bg-[#0a74b5]/70 transition-all duration-200 ${card.active ? 'border-[#7af4f1] bg-[#26cbd6] shadow-[0_0_0_3px_rgba(122,244,241,0.2)]' : 'border-transparent hover:border-white/45 hover:bg-[#0c80c0]'}`}>
      <img src={card.src} alt={card.label} className="h-full w-full object-contain object-bottom p-1" />
      {card.active && (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#082a4a] text-white shadow-md">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
      {showLabel && <span className="absolute inset-x-1 bottom-1 rounded-md bg-[#082a4a]/75 px-1 py-1 text-center text-[8px] font-black uppercase tracking-wide text-white">{card.label}</span>}
    </button>
  );

  const pickerTabs: { id: PickerTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'personagens',
      label: 'Personagens',
      icon: <UserRound className="h-5 w-5" />,
    },
    { id: 'estilo', label: 'Estilo', icon: <Palette className="h-5 w-5" /> },
    { id: 'poses', label: 'Poses', icon: <Shirt className="h-5 w-5" /> },
    {
      id: 'expressoes',
      label: 'Expressões',
      icon: <Smile className="h-5 w-5" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col overflow-y-auto bg-[#1584c4] text-white lg:flex-row lg:overflow-hidden">
      <section className="relative flex min-h-[500px] w-full shrink-0 flex-col overflow-hidden bg-[#f5b719] px-5 pb-5 pt-5 sm:px-8 lg:min-h-0 lg:w-[46%] lg:px-10 lg:pb-8 lg:pt-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(255,255,255,0.35),transparent_22%),radial-gradient(circle_at_80%_70%,rgba(242,135,15,0.32),transparent_35%)]" />
        <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full border-[38px] border-[#ed9d16]/40" />
        <div className="pointer-events-none absolute -right-20 top-20 h-48 w-48 rounded-full border-[28px] border-white/20" />

        <header className="relative z-10 flex items-center justify-between gap-5">
          <button onClick={onBack ?? onClose} aria-label={onBack ? 'Voltar' : 'Fechar'} className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-white/90 text-[#fff8dc] transition-transform hover:scale-105">
            {onBack ? <ArrowLeft className="h-6 w-6" strokeWidth={3} /> : <X className="h-6 w-6" strokeWidth={3} />}
          </button>
          <div className="flex items-center gap-2 rounded-full bg-white/90 px-2 py-2 shadow-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1584c4] text-lg font-black text-white">2</span>
            <div className="h-3 w-36 overflow-hidden rounded-full border-2 border-[#1584c4] bg-[#0a385c] sm:w-44">
              <div className="h-full w-1/2 rounded-full bg-[#19b6df]" />
            </div>
          </div>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center pt-4 lg:pt-1">
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.28em] text-[#8d5d04]">Seu companheiro de foco</p>
          <h1 className="font-logo text-center text-3xl uppercase text-[#fff8dc] drop-shadow-[0_3px_0_rgba(131,82,0,0.15)] sm:text-4xl">{selected.name}</h1>
          <div className="relative mt-2 flex h-[300px] min-h-[240px] w-full items-end justify-center sm:h-[360px] lg:h-[400px]">
            <button onClick={() => cyclePose(-1)} aria-label="Pose anterior" className="absolute left-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[#0a385c] shadow-lg transition hover:bg-white">
              <ChevronLeft className="h-6 w-6" strokeWidth={3} />
            </button>
            <div className="relative flex h-full min-h-0 w-full max-w-[440px] items-end justify-center">{animationSrc ? <TransparentVideo key={animationSrc} src={animationSrc} inset={0.98} className="relative z-10 h-full max-w-full object-contain" /> : <img src={previewSrc} alt={`${selected.name} - ${selectedExpression ? EXPRESSION_LABELS[selectedExpression] : pose.label}`} className="relative z-10 h-full max-h-[48vh] object-contain drop-shadow-[0_24px_14px_rgba(115,67,0,0.25)]" />}</div>
            <button onClick={() => cyclePose(1)} aria-label="Próxima pose" className="absolute right-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[#0a385c] shadow-lg transition hover:bg-white">
              <ChevronRight className="h-6 w-6" strokeWidth={3} />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-full bg-[#8d5d04]/15 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-[#8d5d04]">
            <Sparkles className="h-3.5 w-3.5" /> {selectedExpression ? EXPRESSION_LABELS[selectedExpression] : pose.label}
          </div>
        </div>

        <div className="relative z-10 mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab('poses')} className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition ${activeTab === 'poses' ? 'border-white bg-[#168ac9] text-white' : 'border-white/70 bg-white/85 text-[#1584c4]'}`} aria-label="Editar pose">
              <RotateCcw className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <button onClick={() => setActiveTab('expressoes')} className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition ${activeTab === 'expressoes' ? 'border-white bg-[#168ac9] text-white' : 'border-white/70 bg-white/85 text-[#1584c4]'}`} aria-label="Editar expressão">
              <Smile className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <button onClick={() => setActiveTab('estilo')} className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition ${activeTab === 'estilo' ? 'border-white bg-[#168ac9] text-white' : 'border-white/70 bg-white/85 text-[#1584c4]'}`} aria-label="Editar estilo">
              <Palette className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
          <span className="rounded-full bg-[#8d5d04]/15 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-[#8d5d04]">{selected.is3D ? '3D' : '2D'}</span>
        </div>
      </section>

      <section className="relative flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden bg-[#1584c4] px-4 pb-5 pt-5 sm:px-7 lg:px-8 lg:pb-7 lg:pt-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(47,213,238,0.28),transparent_24%),radial-gradient(circle_at_22%_92%,rgba(5,66,115,0.28),transparent_34%)]" />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-5">
          <nav className="mb-4 flex shrink-0 gap-2 overflow-x-auto pb-1 lg:mb-0 lg:w-[76px] lg:flex-col lg:overflow-visible lg:pb-0">
            {pickerTabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} title={tab.label} className={`group flex min-w-[70px] flex-col items-center justify-center gap-1 rounded-[22px] border-2 px-2 py-3 transition lg:min-h-[78px] ${activeTab === tab.id ? 'border-[#7af4f1] bg-[#20cbd7] text-[#082a4a] shadow-lg' : 'border-transparent bg-[#0b70ad]/55 text-white/80 hover:border-white/30 hover:bg-[#0c7bb9]'}`}>
                {tab.icon}
                <span className="text-[8px] font-black uppercase tracking-wide">{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex min-h-0 flex-1 flex-col">
            <header className="mb-5 flex shrink-0 items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9feef1]">Personalize seu avatar</p>
                <h2 className="mt-1 text-2xl font-black uppercase tracking-[-0.04em] text-white sm:text-3xl">{activeTab === 'personagens' ? 'Escolha seu personagem' : pickerTabs.find((tab) => tab.id === activeTab)?.label}</h2>
              </div>
              {activeTab === 'personagens' && (
                <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-[#0a5e98]/70 p-1">
                  {(['todos', '2d', '3d'] as CharacterFilter[]).map((filter) => (
                    <button key={filter} onClick={() => setCharacterFilter(filter)} className={`rounded-xl px-2.5 py-2 text-[9px] font-black uppercase tracking-widest transition sm:px-3 ${characterFilter === filter ? 'bg-[#7af4f1] text-[#082a4a]' : 'text-white/70 hover:bg-white/10'}`}>
                      {filter === 'todos' ? 'Todos' : filter.toUpperCase()} <span className="opacity-60">{characterCounts[filter]}</span>
                    </button>
                  ))}
                </div>
              )}
            </header>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
              {activeTab === 'personagens' && (
                <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5 sm:gap-3 xl:grid-cols-6">
                  {visibleCharacters.map((character) =>
                    renderTile({
                      key: character.id,
                      label: character.name,
                      src: character.poses.frente,
                      active: character.id === characterId,
                      onClick: () => selectCharacter(character.id),
                    }),
                  )}
                </div>
              )}

              {activeTab === 'estilo' &&
                (styleCards.length > 1 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{styleCards.map((card) => renderTile(card, 'aspect-[4/5]', true))}</div>
                ) : (
                  <div className="rounded-3xl border border-white/20 bg-[#0a70ad]/60 p-6 text-center">
                    <Palette className="mx-auto mb-3 h-8 w-8 text-[#7af4f1]" />
                    <p className="text-xs font-black uppercase tracking-widest text-white">Este personagem tem um estilo disponível</p>
                    <p className="mt-2 text-xs font-bold leading-relaxed text-white/65">Escolha outro personagem para alternar entre versões 2D e 3D.</p>
                  </div>
                ))}

              {activeTab === 'poses' && <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">{poseCards.map((card) => renderTile(card, 'aspect-[4/5]', true))}</div>}

              {activeTab === 'expressoes' &&
                (expressionCards.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">{expressionCards.map((card) => renderTile(card, 'aspect-square', true))}</div>
                ) : (
                  <div className="rounded-3xl border border-white/20 bg-[#0a70ad]/60 p-6 text-center">
                    <Smile className="mx-auto mb-3 h-8 w-8 text-[#7af4f1]" />
                    <p className="text-xs font-black uppercase tracking-widest text-white">Expressões em breve</p>
                    <p className="mt-2 text-xs font-bold leading-relaxed text-white/65">Use as setas ao lado da prévia para conferir as poses disponíveis.</p>
                  </div>
                ))}
            </div>

            <div className="mt-5 flex shrink-0 flex-col gap-3 border-t border-white/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/60">
                <span className="h-2 w-2 rounded-full bg-[#7af4f1]" /> Toque em uma miniatura para selecionar
              </div>
              <button onClick={() => onSave(characterId)} className="group flex items-center justify-center gap-2 rounded-2xl bg-[#79f1ed] px-5 py-3.5 text-xs font-black uppercase tracking-wide text-[#082a4a] shadow-[0_10px_25px_rgba(3,46,74,0.2)] transition hover:-translate-y-0.5 hover:bg-[#9ff7f1]">
                {confirmLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AvatarBuilder;
