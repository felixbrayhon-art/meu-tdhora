import React, { useState } from 'react';
import { X } from './icons';
import { useCharacterId } from '../contexts/CharacterContext';
import { getExpressionSrc, getCharacterSrc } from '../services/avatarService';

interface CharacterTipProps {
  /** Unique key for this tip — controls the "already seen" flag in localStorage. */
  id: string;
  message: string;
}

const CharacterTip: React.FC<CharacterTipProps> = ({ id, message }) => {
  const characterId = useCharacterId();
  const storageKey = `focus_tip_seen_${id}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const src = characterId
    ? (getExpressionSrc(characterId, 'explicando') ?? getCharacterSrc(characterId, 'frente'))
    : undefined;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative bg-blue-50 border border-blue-100 rounded-[30px] pt-5 pr-10 pb-5 pl-4 mb-6 flex items-end gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
      {src && <img src={src} alt="" className="h-20 sm:h-24 object-contain shrink-0 -mb-5" />}
      <div className="flex-1 bg-white rounded-2xl rounded-bl-none p-4 shadow-sm text-sm text-gray-700 font-medium leading-relaxed">
        {message}
      </div>
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 p-1.5 hover:bg-black/5 rounded-full transition-colors"
        aria-label="Dispensar dica"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  );
};

export default CharacterTip;
