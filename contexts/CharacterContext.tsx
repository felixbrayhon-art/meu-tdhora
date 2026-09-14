import React, { createContext, useContext } from 'react';

const CharacterContext = createContext<string | undefined>(undefined);

export const CharacterProvider: React.FC<{ characterId?: string; children: React.ReactNode }> = ({ characterId, children }) => (
  <CharacterContext.Provider value={characterId}>{children}</CharacterContext.Provider>
);

export const useCharacterId = (): string | undefined => useContext(CharacterContext);
