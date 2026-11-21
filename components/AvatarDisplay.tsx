import React, { useEffect, useRef, useState } from 'react';
import VoxelAvatar from './VoxelAvatar';
import { Mascote } from '../services/mascote';

// Avatar redondo pequeno — cabeçalho, barra lateral, listas. Antes era um
// recorte de uma arte 2D; agora é a cabeça do próprio boneco de cubos, para
// não existirem duas versões do mesmo personagem no app.
//
// O palco do VoxelAvatar é medido em px, e aqui o tamanho vem do CSS de quem
// usa (h-full, h-10, etc). Por isso a caixa se mede sozinha e repassa o valor.

interface AvatarDisplayProps {
  characterId?: string;
  /** Mostra o mascote do aluno (com as escolhas do estúdio) em vez do personagem. */
  mascote?: Mascote;
  /** Parado: para listas com muitos avatares de uma vez. */
  estatico?: boolean;
  className?: string;
}

const AvatarDisplay: React.FC<AvatarDisplayProps> = ({ characterId, mascote, estatico = true, className = '' }) => {
  const caixa = useRef<HTMLDivElement>(null);
  const [lado, setLado] = useState(0);

  useEffect(() => {
    const alvo = caixa.current;
    if (!alvo) return;
    const medir = () => setLado(Math.round(Math.min(alvo.clientWidth, alvo.clientHeight)));
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={caixa} className={`relative overflow-hidden ${className}`}>
      {lado > 0 && (
        <VoxelAvatar
          characterId={characterId}
          mascote={mascote}
          recorte="rosto"
          estatico={estatico}
          altura={lado}
          pose="parado"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        />
      )}
    </div>
  );
};

export default AvatarDisplay;
