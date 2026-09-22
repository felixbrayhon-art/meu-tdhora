import React from 'react';
import { CharacterPose, getCharacterSrc, getFaceZoom } from '../services/avatarService';

interface AvatarDisplayProps {
  characterId?: string;
  pose?: CharacterPose;
  className?: string;
}

const AvatarDisplay: React.FC<AvatarDisplayProps> = ({ characterId, pose = 'frente', className = '' }) => {
  const src = getCharacterSrc(characterId, pose);
  const { scale, positionY, originX } = getFaceZoom(characterId);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: `50% ${positionY}`, transform: `scale(${scale})`, transformOrigin: `${originX} top` }}
      />
    </div>
  );
};

export default AvatarDisplay;
