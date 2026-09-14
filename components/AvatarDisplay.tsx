import React from 'react';
import { CharacterPose, getCharacterSrc } from '../services/avatarService';

interface AvatarDisplayProps {
  characterId?: string;
  pose?: CharacterPose;
  className?: string;
}

const AvatarDisplay: React.FC<AvatarDisplayProps> = ({ characterId, pose = 'frente', className = '' }) => {
  const src = getCharacterSrc(characterId, pose);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
    </div>
  );
};

export default AvatarDisplay;
