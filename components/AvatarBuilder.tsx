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
      className={`group relative ${sizeClass} min-h-0 overflow-hidden rounded-[18px] border-2 bg-gradient-to-br from-[#fffdf8] to-[#f8efe0] text-left shadow-[0_3px_0_rgba(71,60,51,.035)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_9px_18px_rgba(71,60,51,.12)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/25 dark:from-[#35362e] dark:to-[#2d2e27] ${card.active ? 'border-[#e96f34] shadow-[0_0_0_3px_rgba(233,111,52,.13),0_8px_18px_rgba(71,60,51,.12)]' : 'border-[#e5d7c2] hover:border-[#e96f34]/55 dark:border-white/[.12] dark:hover:border-[#e96f34]/65'}`}
    >
      <img src={card.src} alt={card.label} className={`absolute object-contain object-bottom p-1 ${showLabel || showName ? 'inset-x-1 bottom-8 h-[calc(100%-2.25rem)] w-[calc(100%-0.5rem)]' : 'bottom-0 right-0 h-[88%] w-[72%]'}`} />
      {(showLabel || showName) && <span className="absolute inset-x-0 bottom-0 z-10 flex min-h-8 items-center justify-center border-t border-[#e5d7c2] bg-[#fffaf0]/95 px-1.5 py-1 text-center text-[9px] font-black uppercase leading-tight tracking-wide text-[#473c33] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden break-words dark:border-white/10 dark:bg-[#292a23]/95 dark:text-[#f2efd2]">{card.label}</span>}
      {card.active && (
        <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#e96f34] text-white shadow-md">
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
      className="fixed inset-0 z-[1200] overflow-y-auto bg-[#f1e9d9] px-3 py-3 text-[#473c33] animate-in fade-in duration-500 dark:bg-[#211d18] dark:text-[#f2efd2] sm:px-5 sm:py-4"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-25" style={{ backgroundImage: 'radial-gradient(ellipse at 12% 12%, rgba(233,111,52,.13), transparent 32%), radial-gradient(ellipse at 90% 82%, rgba(254,200,104,.16), transparent 30%)' }} />

      <div className="relative mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-[1240px] flex-col justify-center sm:min-h-[calc(100dvh-2rem)]">
        <div className="mb-2 flex items-center justify-between gap-3 px-1 sm:mb-3 sm:px-2">
          {onBack || onClose ? (
            <button
              type="button"
              onClick={onBack ?? onClose}
              aria-label={onBack ? 'Voltar para escolha de perfil' : 'Fechar escolha de personagem'}
              className="group inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-[10px] font-black uppercase tracking-[.16em] text-[#806f5d] transition hover:bg-white/55 hover:text-[#473c33] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/25 dark:text-[#c8c5a9] dark:hover:bg-white/[.06] dark:hover:text-[#f2efd2]"
            >
              {onBack ? <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> : <X className="h-4 w-4" />}
              {onBack ? 'Voltar' : 'Fechar'}
            </button>
          ) : <span />}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c9773e]/15 bg-[#fffaf0]/80 px-3.5 py-2 shadow-sm dark:border-white/[.08] dark:bg-[#34342b]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e96f34] dark:bg-[#fec868]" />
            <span className="text-[9px] font-black uppercase tracking-[.18em] text-[#a65c2f] dark:text-[#fed386]">Passo 2 de 2</span>
          </div>
        </div>

        <div className="[perspective:2400px]">
          <section aria-label="Escolha seu personagem" className="relative w-full rounded-[34px] border-[7px] border-[#473c33] bg-[#473c33] p-1.5 shadow-[0_28px_65px_rgba(50,38,25,.24),0_7px_0_#ddceb0,0_13px_0_#f8f1e4] dark:border-[#514638] dark:bg-[#514638] dark:shadow-[0_28px_65px_rgba(0,0,0,.52),0_7px_0_#514638,0_13px_0_#292a23]">
            <div className="avatar-book-spread relative grid min-h-[min(690px,calc(100dvh-104px))] overflow-hidden rounded-[27px] border border-[#d9cdb8] bg-[#fffaf0] md:grid-cols-[.78fr_1.22fr] dark:border-[#655b48] dark:bg-[#292a23]">
              <aside className="profile-book-page-left relative flex min-h-[410px] flex-col overflow-hidden bg-[#f1e9d9] px-6 py-5 sm:min-h-[440px] sm:px-9 sm:py-7 md:min-h-0 md:px-9 md:py-7 dark:bg-[#34342b] md:shadow-[inset_-18px_0_22px_-17px_rgba(71,60,51,.42)] md:dark:shadow-[inset_-18px_0_22px_-14px_rgba(0,0,0,.55)]">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-75 dark:opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(201,119,62,.16) 32px)' }} />
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-5 w-px bg-[#e96f34]/40 sm:left-7" />
                <div className="relative z-10 pl-2">
                  <FishLogo className="origin-left scale-[0.72] sm:scale-[0.82]" days={0} darkBg={document.documentElement.classList.contains('dark')} />
                </div>

                <div className="relative z-10 mt-3 flex min-h-0 flex-1 flex-col pl-2 sm:mt-4">
                  <div className="shrink-0">
                    <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-[#c9773e]/20 bg-white/55 px-3 py-1.5 text-[8px] font-black uppercase tracking-[.17em] text-[#a65c2f] dark:border-[#fec868]/20 dark:bg-white/[.06] dark:text-[#fed386]">
                      <Sparkles className="h-3.5 w-3.5" /> Seu companheiro de foco
                    </div>
                    <h1 className="max-w-sm font-logo text-[clamp(1.7rem,3vw,2.55rem)] uppercase leading-[.98] tracking-tight text-[#473c33] dark:text-[#f2efd2]">
                      Quem vai estudar <span className="text-[#e96f34] dark:text-[#fec868]">com você?</span>
                    </h1>
                    <p className="mt-2 max-w-sm text-xs font-semibold leading-5 text-[#725e4a] dark:text-[#d1c7b3] sm:mt-3 sm:text-sm sm:leading-6">
                      Escolha um personagem para acompanhar suas aulas, anotações e conquistas.
                    </p>
                  </div>

                  <div className="relative mt-1 flex h-[clamp(180px,32vh,290px)] shrink-0 items-end justify-center sm:h-[clamp(190px,34vh,310px)]">
                    <div aria-hidden="true" className="absolute bottom-0 left-[12%] right-[8%] h-[48%] rounded-[50%_50%_0_0] bg-gradient-to-br from-[#eab308]/20 to-[#ed6b2f]/20 [clip-path:ellipse(55%_50%_at_50%_100%)]" />
                    <button type="button" onClick={() => cyclePose(-1)} aria-label="Pose anterior" className="absolute left-0 top-[55%] z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#c9773e]/15 bg-[#fffaf0]/90 text-[#806f5d] shadow-sm transition hover:border-[#e96f34]/40 hover:text-[#e96f34] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/25 dark:border-white/10 dark:bg-[#292a23]/90 dark:text-[#c8c5a9]">
                      <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                    <div className="relative z-10 flex h-full w-full items-end justify-center overflow-hidden">
                      <img src={previewSrc} alt={`${selected.name} — ${selectedExpression ? EXPRESSION_LABELS[selectedExpression] : pose.label}`} className="h-full max-h-[36vh] max-w-[88%] object-contain object-bottom drop-shadow-[0_18px_14px_rgba(71,60,51,.2)]" />
                    </div>
                    <button type="button" onClick={() => cyclePose(1)} aria-label="Próxima pose" className="absolute right-0 top-[55%] z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#c9773e]/15 bg-[#fffaf0]/90 text-[#806f5d] shadow-sm transition hover:border-[#e96f34]/40 hover:text-[#e96f34] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/25 dark:border-white/10 dark:bg-[#292a23]/90 dark:text-[#c8c5a9]">
                      <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                  </div>

                  <div className="relative z-10 mt-2 grid min-w-0 grid-cols-1 gap-2 pl-2">
                    <div className="min-w-0">
                      <p className="line-clamp-2 max-w-full break-words font-logo text-[clamp(.9rem,1.45vw,1.125rem)] uppercase leading-[1.05] text-[#473c33] dark:text-[#f2efd2]">{selected.name}</p>
                      <p className="mt-1 text-[8px] font-black uppercase tracking-[.16em] text-[#a65c2f] dark:text-[#fed386]">
                        {selectedExpression ? EXPRESSION_LABELS[selectedExpression] : pose.label} · {selected.is3D ? '3D' : '2D'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-1.5">
                      <button type="button" onClick={() => setActiveTab('poses')} aria-label="Escolher pose" title="Poses" className={`flex h-10 w-10 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/25 ${activeTab === 'poses' ? 'border-[#e96f34] bg-[#e96f34] text-white' : 'border-[#d9cdb8] bg-white/60 text-[#a65c2f] hover:border-[#e96f34]/45 dark:border-white/10 dark:bg-white/[.05] dark:text-[#fed386]'}`}><RotateCcw className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setActiveTab('expressoes')} aria-label="Escolher expressão" title="Expressões" className={`flex h-10 w-10 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/25 ${activeTab === 'expressoes' ? 'border-[#e96f34] bg-[#e96f34] text-white' : 'border-[#d9cdb8] bg-white/60 text-[#a65c2f] hover:border-[#e96f34]/45 dark:border-white/10 dark:bg-white/[.05] dark:text-[#fed386]'}`}><Smile className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setActiveTab('estilo')} aria-label="Escolher estilo" title="Estilo" className={`flex h-10 w-10 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/25 ${activeTab === 'estilo' ? 'border-[#e96f34] bg-[#e96f34] text-white' : 'border-[#d9cdb8] bg-white/60 text-[#a65c2f] hover:border-[#e96f34]/45 dark:border-white/10 dark:bg-white/[.05] dark:text-[#fed386]'}`}><Palette className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 mt-3 hidden items-center justify-between gap-3 border-t border-[#473c33]/15 pl-2 pt-3 text-[9px] font-bold text-[#725e4a] sm:flex dark:border-white/10 dark:text-[#c8c5a9]">
                  <span>Você pode trocar depois no perfil.</span><span className="shrink-0 font-black tracking-widest opacity-60">02 / 02</span>
                </div>
              </aside>

              <section className="profile-book-page-right relative flex min-h-[510px] min-w-0 flex-col overflow-hidden bg-[#fffaf0] px-4 py-5 sm:px-6 sm:py-6 md:min-h-0 md:px-7 md:py-7 dark:bg-[#292a23] md:shadow-[inset_18px_0_22px_-17px_rgba(71,60,51,.38)] md:dark:shadow-[inset_18px_0_22px_-14px_rgba(0,0,0,.55)]">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(201,119,62,.12) 32px)' }} />
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-[#473c33]/10 dark:bg-white/10 md:block" />
                <div aria-hidden="true" className="pointer-events-none absolute right-0 top-12 z-10 h-12 w-2.5 rounded-l-md bg-[#e96f34] shadow-[inset_2px_0_3px_rgba(71,60,51,.2),0_3px_8px_rgba(71,60,51,.16)]" />

                <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                  <header className="mb-3 flex shrink-0 flex-col justify-between gap-3 border-b-2 border-[#e96f34]/30 pb-3 pr-5 dark:border-[#fec868]/30 sm:flex-row sm:items-end sm:gap-4">
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-[.2em] text-[#c9773e] dark:text-[#f3a06c]">Seu caderno de personagens</p>
                      <h2 className="mt-1 font-logo text-xl uppercase leading-tight tracking-tight text-[#473c33] dark:text-[#f2efd2] sm:text-2xl">Escolha seu personagem</h2>
                    </div>
                    {activeTab === 'personagens' && (
                      <div className="flex w-fit shrink-0 items-center gap-0.5 rounded-full border border-[#e5d7c2] bg-white/60 p-1 dark:border-white/10 dark:bg-white/[.04]" role="group" aria-label="Filtrar personagens por estilo">
                        {(['todos', '2d', '3d'] as CharacterFilter[]).map((filter) => (
                          <button key={filter} type="button" onClick={() => setCharacterFilter(filter)} aria-pressed={characterFilter === filter} className={`rounded-full px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e96f34]/40 ${characterFilter === filter ? 'bg-[#473c33] text-[#f2efd2] dark:bg-[#e96f34] dark:text-white' : 'text-[#8b7968] hover:bg-[#f1e9d9] dark:text-[#c8c5a9] dark:hover:bg-white/[.07]'}`}>
                            {filter === 'todos' ? `Todos ${characterCounts.todos}` : `${filter.toUpperCase()} ${characterCounts[filter]}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </header>

                  <nav className="mb-3 grid shrink-0 grid-cols-4 gap-1 rounded-2xl border border-[#e5d7c2] bg-white/55 p-1 dark:border-white/[.1] dark:bg-white/[.035]" aria-label="Opções de personalização">
                    {pickerTabs.map((tab) => (
                      <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e96f34]/40 sm:gap-2 sm:px-2 ${activeTab === tab.id ? 'bg-[#e96f34] text-white shadow-[0_4px_10px_rgba(233,111,52,.18)]' : 'text-[#8b7968] hover:bg-[#f1e9d9] hover:text-[#473c33] dark:text-[#c8c5a9] dark:hover:bg-white/[.07] dark:hover:text-[#f2efd2]'}`}>
                        {tab.icon}<span className="w-full text-center text-[8px] font-black uppercase leading-tight tracking-[.04em] sm:text-[9px] sm:tracking-[.06em]">{tab.label}</span>
                      </button>
                    ))}
                  </nav>

                  <div className="custom-scrollbar min-h-[260px] flex-1 overflow-y-auto overscroll-contain pr-1">
                    {activeTab === 'personagens' && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
                        {visibleCharacters.map((character) =>
                          renderTile({
                            key: character.id,
                            label: character.name,
                            src: character.poses.frente,
                            active: character.id === characterId,
                            onClick: () => selectCharacter(character.id),
                          }, 'h-[clamp(112px,16vh,145px)]', false, true),
                        )}
                      </div>
                    )}

                    {activeTab === 'estilo' && (styleCards.length > 1 ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{styleCards.map((card) => renderTile(card, 'h-[clamp(190px,28vh,280px)]', true))}</div>
                    ) : (
                      <div className="rounded-3xl border border-[#e5d7c2] bg-white/65 p-6 text-center dark:border-white/10 dark:bg-white/[.04]">
                        <Palette className="mx-auto mb-3 h-8 w-8 text-[#e96f34] dark:text-[#fec868]" />
                        <p className="text-xs font-black uppercase tracking-widest text-[#473c33] dark:text-[#f2efd2]">Este personagem tem um estilo disponível</p>
                        <p className="mt-2 text-xs font-semibold leading-relaxed text-[#8b7968] dark:text-[#c8c5a9]">Escolha outro personagem para alternar entre versões 2D e 3D.</p>
                      </div>
                    ))}

                    {activeTab === 'poses' && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{poseCards.map((card) => renderTile(card, 'h-[clamp(190px,28vh,280px)]', true))}</div>}

                    {activeTab === 'expressoes' && (expressionCards.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{expressionCards.map((card) => renderTile(card, 'h-[clamp(150px,23vh,220px)]', true))}</div>
                    ) : (
                      <div className="rounded-3xl border border-[#e5d7c2] bg-white/65 p-6 text-center dark:border-white/10 dark:bg-white/[.04]">
                        <Smile className="mx-auto mb-3 h-8 w-8 text-[#e96f34] dark:text-[#fec868]" />
                        <p className="text-xs font-black uppercase tracking-widest text-[#473c33] dark:text-[#f2efd2]">Expressões em breve</p>
                        <p className="mt-2 text-xs font-semibold leading-relaxed text-[#8b7968] dark:text-[#c8c5a9]">Use as setas para conferir as poses disponíveis.</p>
                      </div>
                    ))}
                  </div>

                  <footer className="mt-3 flex shrink-0 flex-col gap-2 border-t border-[#473c33]/15 pt-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-center text-[9px] font-semibold leading-4 text-[#8b7968] dark:text-[#c8c5a9] sm:text-left">A escolha fica salva no perfil. Você pode mudá-la depois.</p>
                    <button type="button" onClick={() => onSave(characterId)} className="group flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#e96f34] px-5 py-3 text-[10px] font-black uppercase tracking-[.1em] text-white shadow-[0_8px_18px_rgba(233,111,52,.24)] transition hover:-translate-y-0.5 hover:bg-[#d95f29] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96f34]/30 active:translate-y-0 dark:hover:bg-[#f07b40]">
                      {confirmLabel}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={3} />
                    </button>
                  </footer>
                </div>
              </section>
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute right-2 bottom-6 top-6 z-30 hidden w-1.5 rounded-r-full bg-[repeating-linear-gradient(to_bottom,#f4e6cf_0px,#f4e6cf_3px,#d5c6ac_4px,#d5c6ac_5px)] shadow-[3px_0_5px_rgba(20,16,12,.2)] dark:bg-[repeating-linear-gradient(to_bottom,#716957_0px,#716957_3px,#4e493d_4px,#4e493d_5px)] md:block" />
          </section>
        </div>
      </div>
    </div>
  );
};

export default AvatarBuilder;
