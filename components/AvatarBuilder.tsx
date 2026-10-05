import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Palette, RotateCcw, Shirt, Smile, Sparkles, UserRound, X } from './icons';
import FishLogo from './FishLogo';
import { CHARACTERS, defaultCharacterId, getAvailableExpressions, getCharacter, getExpressionSrc, CharacterOption, CharacterPose, Expression } from '../services/avatarService';

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
  { id: 'lado', label: 'Perfil' },
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

  const renderTile = (card: GridCard, sizeClass = 'aspect-square', showLabel = false, showName = false) => (
    <button
      key={card.key}
      type="button"
      onClick={card.onClick}
      title={card.label}
      aria-pressed={card.active}
      className={`group relative ${sizeClass} min-h-0 overflow-hidden rounded-[18px] border-2 bg-[#f8f3e8] p-1.5 text-left shadow-[0_3px_0_rgba(71,60,51,.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_9px_18px_rgba(71,60,51,.16)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/25 dark:bg-[#35362e] ${card.active ? 'border-[#e96f34] shadow-[0_0_0_3px_rgba(233,111,52,.15),0_8px_18px_rgba(71,60,51,.12)]' : 'border-[#e5d7c2] hover:border-[#e96f34]/60 dark:border-white/[.12] dark:hover:border-[#e96f34]/65'}`}
    >
      <span aria-hidden="true" className="absolute inset-x-1.5 top-1.5 bottom-8 rounded-[12px] bg-[#e9e4d6] dark:bg-[#2d2e27]" />
      <img src={card.src} alt={card.label} className={`character-avatar-thumb absolute z-10 object-contain object-bottom p-1 ${showName ? 'inset-x-2 top-2 bottom-8 h-[calc(100%-2.75rem)] w-[calc(100%-1rem)]' : showLabel ? 'inset-x-1 bottom-8 h-[calc(100%-2.25rem)] w-[calc(100%-0.5rem)]' : 'bottom-0 right-0 h-[88%] w-[72%]'}`} />
      {(showName || showLabel) && <span aria-hidden="true" className="absolute bottom-[31px] left-1/2 z-20 h-1 w-[34%] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#526634] via-[#f2bd28] to-[#e96f34] shadow-[0_2px_0_rgba(36,37,31,.25)]" />}
      {showLabel && <span className="absolute inset-x-0 bottom-0 z-10 flex min-h-8 items-center justify-center border-t border-[#e5d7c2] bg-[#fffaf0]/95 px-1.5 py-1 text-center text-[9px] font-black uppercase leading-tight tracking-wide text-[#473c33] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden break-words dark:border-white/10 dark:bg-[#292a23]/95 dark:text-[#f2efd2]">{card.label}</span>}
      {showName && <span className="absolute inset-x-0 bottom-0 z-10 flex min-h-8 items-center justify-center border-t border-[#e5d7c2] bg-[#f8f3e8] px-1.5 py-1 text-center text-[9px] font-black uppercase leading-tight tracking-wide text-[#473c33] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden break-words dark:border-white/10 dark:bg-[#292a23] dark:text-[#f2efd2]">{card.label}</span>}
      {card.active && (
        <span className={`absolute z-30 flex h-5 w-5 items-center justify-center rounded-full bg-[#e96f34] text-white shadow-md ${showName ? 'bottom-[9px] right-[10px] ring-2 ring-[#fff5cf]' : 'right-1 top-1'}`}>
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );

  const pickerTabs: { id: PickerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'personagens', label: 'Personagem', icon: <UserRound className="h-4 w-4" /> },
    { id: 'estilo', label: 'Estilo', icon: <Palette className="h-4 w-4" /> },
    { id: 'poses', label: 'Poses', icon: <Shirt className="h-4 w-4" /> },
    { id: 'expressoes', label: 'Expressões', icon: <Smile className="h-4 w-4" /> },
  ];

  return (
    <div
      id="avatar-selection-screen"
      className="fixed inset-0 z-[1200] overflow-y-auto bg-[#24251f] px-3 py-3 text-[#f2efd2] animate-in fade-in duration-500 sm:px-5 sm:py-4"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(242,239,210,.07) 1px, transparent 1.5px), radial-gradient(ellipse at 12% 8%, rgba(233,111,52,.13), transparent 34%), radial-gradient(ellipse at 90% 88%, rgba(82,102,52,.2), transparent 32%)', backgroundSize: '18px 18px, auto, auto' }} />

      <div className="relative mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-[1480px] flex-col gap-3 sm:min-h-[calc(100dvh-2rem)]">
        <header className="flex shrink-0 items-center justify-between gap-3 px-1 sm:px-2">
          {onBack || onClose ? (
            <button
              type="button"
              onClick={onBack ?? onClose}
              aria-label={onBack ? 'Voltar para escolha de perfil' : 'Fechar escolha de personagem'}
              className="group inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-[10px] font-black uppercase tracking-[.16em] text-[#c8c5a9] transition hover:bg-white/[.06] hover:text-[#f2efd2] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/30"
            >
              {onBack ? <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> : <X className="h-4 w-4" />}
              {onBack ? 'Voltar' : 'Fechar'}
            </button>
          ) : <span />}
          <FishLogo className="origin-center scale-[0.55] sm:scale-[0.68]" days={0} darkBg />
          <div className="inline-flex items-center gap-2 rounded-full border border-[#f2efd2]/10 bg-[#2d2e27] px-3.5 py-2 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f2bd28]" />
            <span className="text-[9px] font-black uppercase tracking-[.18em] text-[#f2efd2]">Passo 2 de 2</span>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <section aria-label="Escolha seu personagem" className="flex min-h-[calc(100dvh-108px)] flex-1 flex-col overflow-hidden rounded-[26px] border border-[#48493f] bg-[#2d2e27] shadow-[0_24px_60px_rgba(0,0,0,.36)] lg:min-h-0">
            <div className="flex shrink-0 flex-col justify-between gap-3 border-b border-[#48493f] px-4 py-4 sm:flex-row sm:items-end sm:px-6 sm:py-5">
              <div>
                <p className="mb-1 inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[.2em] text-[#e96f34]"><Sparkles className="h-3 w-3" /> Seu companheiro de foco</p>
                <h1 className="font-logo text-2xl uppercase leading-tight tracking-tight text-[#f2efd2] sm:text-3xl">Quem vai estudar <span className="text-[#e96f34]">com você?</span></h1>
                <p className="mt-1 max-w-xl text-xs font-semibold leading-5 text-[#c8c5a9]">Escolha quem vai acompanhar suas aulas, anotações e conquistas.</p>
              </div>
              {activeTab === 'personagens' && (
                <div className="flex w-fit shrink-0 items-center gap-0.5 rounded-full border border-[#48493f] bg-[#24251f] p-1" role="group" aria-label="Filtrar personagens por estilo">
                  {(['todos', '2d', '3d'] as CharacterFilter[]).map((filter) => (
                    <button key={filter} type="button" onClick={() => setCharacterFilter(filter)} aria-pressed={characterFilter === filter} className={`rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-[.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e96f34]/50 ${characterFilter === filter ? 'bg-[#e96f34] text-white' : 'text-[#c8c5a9] hover:bg-white/[.06] hover:text-[#f2efd2]'}`}>
                      {filter === 'todos' ? `Todos ${characterCounts.todos}` : `${filter.toUpperCase()} ${characterCounts[filter]}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,350px)]">
              <section aria-label="Galeria de personagens" className="order-last flex min-h-[430px] min-w-0 flex-col lg:order-first lg:min-h-0">
                <nav className="grid shrink-0 grid-cols-4 gap-1 border-b border-[#48493f] bg-[#292a24] p-2 sm:px-4" aria-label="Opções do personagem">
                  {pickerTabs.map((tab) => (
                    <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e96f34]/50 sm:gap-2 sm:px-3 ${activeTab === tab.id ? 'bg-[#e96f34] text-white shadow-[0_4px_10px_rgba(0,0,0,.2)]' : 'text-[#c8c5a9] hover:bg-white/[.05] hover:text-[#f2efd2]'}`}>
                      {tab.icon}<span className="text-center text-[8px] font-black uppercase leading-tight tracking-[.04em] sm:text-[9px] sm:tracking-[.06em]">{tab.label}</span>
                    </button>
                  ))}
                </nav>

                <div className="custom-scrollbar min-h-[360px] flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
                  {activeTab === 'personagens' && (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 sm:gap-3">
                      {visibleCharacters.map((character) => renderTile({
                        key: character.id,
                        label: character.name,
                        src: character.poses.frente,
                        active: character.id === characterId,
                        onClick: () => selectCharacter(character.id),
                      }, 'aspect-[.9] min-h-[132px] max-h-[190px]', false, true))}
                    </div>
                  )}

                  {activeTab === 'estilo' && (styleCards.length > 1 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{styleCards.map((card) => renderTile(card, 'h-[clamp(190px,28vh,280px)]', true))}</div>
                  ) : (
                    <div className="rounded-3xl border border-[#48493f] bg-[#24251f] p-6 text-center">
                      <Palette className="mx-auto mb-3 h-8 w-8 text-[#f2bd28]" />
                      <p className="text-xs font-black uppercase tracking-widest text-[#f2efd2]">Este personagem tem um estilo disponível</p>
                      <p className="mt-2 text-xs font-semibold leading-relaxed text-[#c8c5a9]">Escolha outro personagem para alternar entre versões 2D e 3D.</p>
                    </div>
                  ))}

                  {activeTab === 'poses' && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{poseCards.map((card) => renderTile(card, 'h-[clamp(190px,28vh,280px)]', true))}</div>}

                  {activeTab === 'expressoes' && (expressionCards.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{expressionCards.map((card) => renderTile(card, 'h-[clamp(150px,23vh,220px)]', true))}</div>
                  ) : (
                    <div className="rounded-3xl border border-[#48493f] bg-[#24251f] p-6 text-center">
                      <Smile className="mx-auto mb-3 h-8 w-8 text-[#f2bd28]" />
                      <p className="text-xs font-black uppercase tracking-widest text-[#f2efd2]">Expressões em breve</p>
                      <p className="mt-2 text-xs font-semibold leading-relaxed text-[#c8c5a9]">Use as setas para conferir as poses disponíveis.</p>
                    </div>
                  ))}
                </div>
              </section>

              <aside aria-label={`Prévia de ${selected.name}`} className="order-first flex min-h-[330px] flex-col border-b border-[#48493f] bg-[#262720] p-4 sm:p-5 lg:order-last lg:min-h-0 lg:border-b-0 lg:border-l">
                <div className="flex shrink-0 items-center justify-between gap-2">
                  <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#f2bd28]">Prévia selecionada</p>
                  <span className="rounded-full border border-[#48493f] bg-[#2d2e27] px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-[#c8c5a9]">{selected.is3D ? '3D' : '2D'}</span>
                </div>

                <div className="character-avatar-stage relative mx-auto mt-2 flex h-[clamp(190px,34vh,290px)] w-full max-w-[330px] shrink-0 items-end justify-center">
                  <button type="button" onClick={() => cyclePose(-1)} aria-label="Girar para o ângulo anterior" className="absolute left-0 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#f2bd28]/60 bg-[#24251f]/90 text-[#f2efd2] shadow-md transition hover:border-[#e96f34] hover:bg-[#e96f34] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/30">
                    <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                  <div className="relative z-10 flex h-full w-[78%] items-end justify-center overflow-hidden">
                    <button type="button" onClick={() => cyclePose(1)} aria-label={`Girar ${selected.name} para o próximo ângulo`} title="Toque para girar o personagem" className="character-avatar-tap relative z-10 flex h-full max-w-full items-end justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e96f34]/60">
                      <span key={previewSrc} className="character-avatar-pose-transition flex h-full max-w-full items-end justify-center">
                        <img src={previewSrc} alt={`${selected.name} — ${selectedExpression ? EXPRESSION_LABELS[selectedExpression] : pose.label}`} className="character-avatar-art h-full max-h-[34vh] max-w-full object-contain object-bottom drop-shadow-[0_12px_12px_rgba(0,0,0,.45)]" />
                      </span>
                    </button>
                  </div>
                  <button type="button" onClick={() => cyclePose(1)} aria-label="Girar para o próximo ângulo" className="absolute right-0 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#f2bd28]/60 bg-[#24251f]/90 text-[#f2efd2] shadow-md transition hover:border-[#e96f34] hover:bg-[#e96f34] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/30">
                    <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                  <span aria-hidden="true" className="absolute bottom-0 left-1/2 z-0 h-1.5 w-[45%] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#526634] via-[#f2bd28] to-[#e96f34] shadow-[0_3px_0_rgba(0,0,0,.35)]" />
                </div>

                <div className="mt-2 flex shrink-0 items-center justify-center gap-2 text-[8px] font-black uppercase tracking-[.14em] text-[#c8c5a9]" aria-live="polite">
                  <RotateCcw className="h-3 w-3 text-[#e96f34]" />
                  {selectedExpression ? EXPRESSION_LABELS[selectedExpression] : pose.label} · {poseIndex + 1}/{POSES.length}
                </div>
                <div className="mt-3 min-w-0 text-center lg:text-left">
                  <h2 className="line-clamp-2 break-words font-logo text-xl uppercase leading-tight text-[#f2efd2]">{selected.name}</h2>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#c8c5a9]">Pronto para acompanhar suas aulas, anotações e conquistas.</p>
                </div>
                <p className="mt-auto hidden pt-4 text-[9px] font-semibold leading-4 text-[#aaa78e] lg:block">A escolha fica salva no perfil. Você pode mudá-la depois.</p>
              </aside>
            </div>

            <footer className="flex shrink-0 flex-col gap-2 border-t border-[#48493f] bg-[#292a24] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-center text-[9px] font-semibold leading-4 text-[#c8c5a9] sm:text-left lg:hidden">A escolha fica salva no perfil. Você pode mudá-la depois.</p>
              <span className="hidden text-[9px] font-black uppercase tracking-[.16em] text-[#aaa78e] sm:block">{characterId ? `${CHARACTERS.findIndex((entry) => entry.id === characterId) + 1} / ${CHARACTERS.length}` : ''} · Galeria de personagens</span>
              <button type="button" onClick={() => onSave(characterId)} className="group flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#e96f34] px-6 py-3 text-[10px] font-black uppercase tracking-[.1em] text-white shadow-[0_8px_18px_rgba(0,0,0,.24)] transition hover:-translate-y-0.5 hover:bg-[#f07b40] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/35 active:translate-y-0">
                {confirmLabel}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={3} />
              </button>
            </footer>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AvatarBuilder;
