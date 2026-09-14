import React, { useState } from 'react';
import { X, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { CHARACTERS, defaultCharacterId, getCharacter, CharacterPose } from '../services/avatarService';

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

const AvatarBuilder: React.FC<AvatarBuilderProps> = ({ initialCharacterId, onSave, onClose, onBack, confirmLabel = 'Confirmar Personagem' }) => {
  const [characterId, setCharacterId] = useState(initialCharacterId || defaultCharacterId);
  const [poseIndex, setPoseIndex] = useState(0);
  const selected = getCharacter(characterId);
  const pose = POSES[poseIndex];

  const cyclePose = (dir: 1 | -1) => {
    setPoseIndex(prev => (prev + dir + POSES.length) % POSES.length);
  };

  const selectCharacter = (id: string) => {
    setCharacterId(id);
    setPoseIndex(0);
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-[#FAF3E3] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between p-5 shrink-0">
        <h2 className="font-black text-base md:text-lg text-[#0A0F1E] uppercase tracking-wide">Escolha seu Personagem</h2>
        <button onClick={onBack ?? onClose} className="p-2 bg-black/5 rounded-full hover:bg-black/10 transition-colors">
          {onBack ? <ArrowLeft className="w-5 h-5 text-[#0A0F1E]" /> : <X className="w-5 h-5 text-[#0A0F1E]" />}
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Character list */}
        <div className="shrink-0 order-2 md:order-1 md:w-60 px-5 pb-4 md:py-6 md:pl-6">
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:max-h-full pb-1 md:pb-0 custom-scrollbar">
            {CHARACTERS.map(c => {
              const isSelected = characterId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => selectCharacter(c.id)}
                  className={`shrink-0 flex items-center gap-3 pl-2 pr-4 py-2 rounded-2xl transition-all whitespace-nowrap ${
                    isSelected ? 'bg-white shadow-lg' : 'bg-black/5 hover:bg-black/10'
                  }`}
                >
                  <img src={c.poses.frente} alt="" className="w-9 h-9 rounded-full object-cover object-top bg-white/60" />
                  <span className={`text-xs font-black uppercase tracking-wide ${isSelected ? 'text-orange-600' : 'text-[#0A0F1E]/70'}`}>
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center preview */}
        <div className="flex-1 order-1 md:order-2 flex flex-col items-center justify-center relative px-2 min-h-0">
          <div className="flex items-center gap-2 md:gap-8 w-full max-w-md">
            <button
              onClick={() => cyclePose(-1)}
              className="shrink-0 p-2 md:p-3 bg-black/5 rounded-full hover:bg-black/10 transition-colors"
              aria-label="Girar para esquerda"
            >
              <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-[#0A0F1E]" />
            </button>
            <div className="flex-1 h-56 sm:h-72 md:h-96 flex items-end justify-center">
              <img
                src={selected.poses[pose.id]}
                alt={`${selected.name} - ${pose.label}`}
                className="h-full object-contain drop-shadow-2xl"
              />
            </div>
            <button
              onClick={() => cyclePose(1)}
              className="shrink-0 p-2 md:p-3 bg-black/5 rounded-full hover:bg-black/10 transition-colors"
              aria-label="Girar para direita"
            >
              <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-[#0A0F1E]" />
            </button>
          </div>

          <h3 className="mt-2 font-black text-xl md:text-2xl text-[#0A0F1E]">{selected.name}</h3>

          {/* Pose thumbnails */}
          <div className="flex items-center gap-3 mt-4 md:mt-6">
            {POSES.map((p, i) => (
              <button key={p.id} onClick={() => setPoseIndex(i)} className="flex flex-col items-center gap-1">
                <div
                  className={`w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden border-2 transition-all ${
                    i === poseIndex ? 'border-yellow-400 ring-4 ring-yellow-400/30' : 'border-black/10'
                  }`}
                >
                  <img src={selected.poses[p.id]} alt="" className="w-full h-full object-cover object-top bg-black/5" />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest ${i === poseIndex ? 'text-[#0A0F1E]' : 'text-[#0A0F1E]/40'}`}>
                  {p.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer confirm */}
      <div className="p-5 shrink-0">
        <button
          onClick={() => onSave(characterId)}
          className="w-full max-w-md mx-auto block bg-yellow-400 hover:bg-yellow-500 text-[#0A0F1E] font-black uppercase tracking-wide py-4 rounded-2xl shadow-xl transition-colors"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
};

export default AvatarBuilder;
