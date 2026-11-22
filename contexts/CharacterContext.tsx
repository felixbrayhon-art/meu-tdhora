import React, { createContext, useContext, useEffect, useState } from 'react';
import { AVISO, Mascote, ler as lerMascote } from '../services/mascote';

// Quem é o companheiro do aluno: o personagem escolhido e o que ele mudou no
// estúdio. As duas coisas andam juntas — toda tela que desenha o boneco
// precisa das duas, senão mostra o personagem cru enquanto o canto da tela
// mostra o editado.

const CharacterContext = createContext<string | undefined>(undefined);
const MascoteContext = createContext<Mascote>({ modo: 'pronto' });

export const CharacterProvider: React.FC<{ characterId?: string; children: React.ReactNode }> = ({ characterId, children }) => {
  // O estúdio é outra tela e grava direto no armazenamento; o aviso do
  // serviço é o que traz a mudança para cá sem recarregar a página.
  const [mascote, setMascote] = useState<Mascote>(() => lerMascote());
  useEffect(() => {
    const reler = () => setMascote(lerMascote());
    window.addEventListener(AVISO, reler);
    window.addEventListener('storage', reler);
    return () => { window.removeEventListener(AVISO, reler); window.removeEventListener('storage', reler); };
  }, []);

  return (
    <CharacterContext.Provider value={characterId}>
      <MascoteContext.Provider value={mascote}>{children}</MascoteContext.Provider>
    </CharacterContext.Provider>
  );
};

export const useCharacterId = (): string | undefined => useContext(CharacterContext);
export const useMascote = (): Mascote => useContext(MascoteContext);
