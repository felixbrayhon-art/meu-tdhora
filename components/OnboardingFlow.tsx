import React, { useState } from 'react';
import { StudyProfile } from '../types';
import ProfileSelection from './ProfileSelection';
import MascoteStudio from './MascoteStudio';
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
    // O estúdio é a própria escolha: quem está entrando escolhe entre os
    // prontos ou monta o seu na mesma tela, em vez de escolher aqui e só
    // depois descobrir que dá para editar.
    return (
      <div className="min-h-screen bg-[#fdfbf7] px-4 py-5 dark:bg-[#1c1712] sm:px-6">
        <div className="mx-auto w-full max-w-[1180px]">
          <MascoteStudio
            characterId={characterId}
            onBack={() => setStep('objetivo')}
            rotuloVoltar="Voltar"
            rotuloConfirmar="Começar"
            onConfirmar={(id) => { setCharacterId(id); setStep('revelacao'); }}
          />
        </div>
      </div>
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
