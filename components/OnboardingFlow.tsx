import React, { useState } from 'react';
import { StudyProfile } from '../types';
import NameStep from './NameStep';
import ProfileSelection from './ProfileSelection';
import AvatarBuilder from './AvatarBuilder';
import { defaultCharacterId } from '../services/avatarService';

interface OnboardingFlowProps {
  onComplete: (data: { name: string; studyProfile: StudyProfile; characterId: string }) => void;
}

type Step = 'nome' | 'objetivo' | 'personagem';

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>('nome');
  const [name, setName] = useState('');
  const [studyProfile, setStudyProfile] = useState<StudyProfile | null>(null);

  if (step === 'nome') {
    return (
      <NameStep
        initialName={name}
        onNext={(n) => { setName(n); setStep('objetivo'); }}
      />
    );
  }

  if (step === 'objetivo') {
    return (
      <ProfileSelection
        onBack={() => setStep('nome')}
        onSelect={(p) => { setStudyProfile(p); setStep('personagem'); }}
      />
    );
  }

  return (
    <AvatarBuilder
      initialCharacterId={defaultCharacterId}
      onBack={() => setStep('objetivo')}
      confirmLabel="Começar"
      onSave={(characterId) => onComplete({ name, studyProfile: studyProfile as StudyProfile, characterId })}
    />
  );
};

export default OnboardingFlow;
