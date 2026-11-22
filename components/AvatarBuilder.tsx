import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from './icons';
import FishLogo from './FishLogo';
import { CHARACTERS, defaultCharacterId, getCharacter, resolveCharacterId } from '../services/avatarService';
import VoxelAvatar from './VoxelAvatar';

// Escolha de personagem: um boneco por vez.
//
// Antes era uma folha com três vistas em cima e os 23 em miniatura embaixo —
// 26 bonecos na mesma tela. Cada cubo do boneco é um contexto 3D próprio e o
// navegador compõe todos a cada quadro, então a tela engasgava só de existir.
// Agora é um boneco na tela, e o aluno passa para os lados: arrastando, nas
// setas ou pelo teclado. As três vistas viraram giros do mesmo boneco.

interface AvatarBuilderProps {
  initialCharacterId?: string;
  onSave: (characterId: string) => void;
  onClose?: () => void;
  onBack?: () => void;
  confirmLabel?: string;
}

const VISTAS: { id: string; label: string; angulo: number }[] = [
  { id: 'frente', label: 'Frente', angulo: 0 },
  { id: 'lado', label: 'Perfil', angulo: -70 },
  { id: 'costas', label: 'Costas', angulo: 180 },
];

/** Quantos pixels de arrasto contam como "passar para o próximo". */
const ARRASTO_MINIMO = 48;

const AvatarBuilder: React.FC<AvatarBuilderProps> = ({ initialCharacterId, onSave, onClose, onBack, confirmLabel = 'Confirmar personagem' }) => {
  const inicial = Math.max(0, CHARACTERS.findIndex((c) => c.id === (resolveCharacterId(initialCharacterId) || defaultCharacterId)));
  const [indice, setIndice] = useState(inicial);
  const [vista, setVista] = useState(0);
  const [entrando, setEntrando] = useState<'' | 'esquerda' | 'direita'>('');
  const arrastoRef = useRef<number | null>(null);
  const personagem = CHARACTERS[indice];

  const andar = (passo: number) => {
    setEntrando(passo > 0 ? 'direita' : 'esquerda');
    setIndice((i) => (i + passo + CHARACTERS.length) % CHARACTERS.length);
  };

  // Teclado: as setas andam na fila, como o arrastar faz no toque.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') andar(1);
      else if (e.key === 'ArrowLeft') andar(-1);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  // O arrasto é medido no ponteiro, que serve para dedo e mouse de uma vez.
  const aoPressionar = (e: React.PointerEvent) => { arrastoRef.current = e.clientX; };
  const aoSoltar = (e: React.PointerEvent) => {
    const inicio = arrastoRef.current;
    arrastoRef.current = null;
    if (inicio === null) return;
    const percorrido = e.clientX - inicio;
    if (Math.abs(percorrido) >= ARRASTO_MINIMO) andar(percorrido < 0 ? 1 : -1);
  };

  return (
    <div
      id="avatar-selection-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-selection-title"
      className="cs-screen fixed inset-0 z-[1200] flex flex-col overflow-y-auto animate-in fade-in duration-500"
    >
      <section className="cs-hero flex-1" aria-label={`Personagem: ${personagem.name}`}>
        {/* A paisagem é um elemento, não o fundo da seção: como fundo ela
            tinha de escolher entre ocupar a largura toda (e crescer até
            cobrir o título nas telas largas e baixas) ou manter a altura (e
            deixar a borda do desenho à mostra). Numa faixa própria ela faz as
            duas coisas. */}
        <span aria-hidden="true" className="cs-paisagem" />
        <div className="relative mx-auto flex w-full max-w-[1180px] flex-col px-4 pt-3 sm:px-6 sm:pt-4">
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

          {/* Nome, contador e as vistas vêm antes do boneco: embaixo dele
              eles caíam em cima da ilustração e ficavam difíceis de ler. */}
          <div className="cs-nameplate">
            <h2 className="font-logo" aria-live="polite">{personagem.name}</h2>
          </div>
          <p className="cs-hero__hint">{indice + 1} de {CHARACTERS.length} · arraste para os lados para ver os outros</p>

          <div className="cs-vistas" role="radiogroup" aria-label="Qual lado mostrar">
            {VISTAS.map((v, i) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={vista === i}
                onClick={() => setVista(i)}
                className={`cs-vista ${vista === i ? 'is-ativa' : ''}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          {/* Um boneco só, com as setas de cada lado. No celular o alvo do
              arrasto é o palco inteiro, que é bem maior que as setas. */}
          <div className="cs-palco" onPointerDown={aoPressionar} onPointerUp={aoSoltar} onPointerCancel={() => { arrastoRef.current = null; }}>
            <button type="button" onClick={() => andar(-1)} aria-label="Personagem anterior" className="cs-seta cs-seta--esq">
              <ArrowLeft className="h-5 w-5" strokeWidth={3} />
            </button>

            <figure key={personagem.id} className={`cs-palco__figura ${entrando === 'direita' ? 'cs-entra-direita' : 'cs-entra-esquerda'}`}>
              <VoxelAvatar
                key={`${personagem.id}-${vista}`}
                characterId={personagem.id}
                altura={226}
                angulo={VISTAS[vista].angulo}
                estatico
                pose="parado"
                className="relative z-[1]"
              />
            </figure>

            <button type="button" onClick={() => andar(1)} aria-label="Próximo personagem" className="cs-seta cs-seta--dir">
              <ArrowRight className="h-5 w-5" strokeWidth={3} />
            </button>
          </div>

        </div>

        <div aria-hidden="true" className="cs-hero__strip" />
      </section>

      <footer className="cs-footer">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="min-w-0">
            <span className="cs-footer__name">{personagem.name}</span>
            <span className="cs-footer__meta">{indice + 1} de {CHARACTERS.length}</span>
          </span>
          <button type="button" onClick={() => onSave(personagem.id)} className="cs-cta group">
            {confirmLabel}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={3} />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default AvatarBuilder;
