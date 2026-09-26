import React, { useState } from 'react';
import { StudyProfile } from '../types';
import ProfileSelection from './ProfileSelection';
import AvatarBuilder from './AvatarBuilder';
import CharacterRevealScreen from './CharacterRevealScreen';
import { defaultCharacterId } from '../services/avatarService';

interface OnboardingFlowProps {
  onComplete: (data: { name: string; studyProfile: StudyProfile; characterId: string }) => void;
}

type Step = 'objetivo' | 'personagem' | 'revelacao';

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>('objetivo');
  const [name, setName] = useState('');
  const [studyProfile, setStudyProfile] = useState<StudyProfile | null>(null);
  const [characterId, setCharacterId] = useState(defaultCharacterId);

  if (step === 'objetivo') {
    return (
      <ProfileSelection
        initialName={name}
        onNext={(n, p) => { setName(n); setStudyProfile(p); setStep('personagem'); }}
      />
    );
  }

  if (step === 'personagem') {
    return (
      <AvatarBuilder
        initialCharacterId={characterId}
        onBack={() => setStep('objetivo')}
        confirmLabel="Começar"
        onSave={(id) => { setCharacterId(id); setStep('revelacao'); }}
      />
    );
  }

  return (
    <CharacterRevealScreen
      characterId={characterId}
      continueLabel="Começar"
      onContinue={() => onComplete({ name, studyProfile: studyProfile as StudyProfile, characterId })}
    />
  );
};

export default OnboardingFlow;
