import React, { useRef, useState } from 'react';
import { ArrowLeft, BookOpen, GraduationCap, Scale } from './icons';
import { StudyProfile } from '../types';
import FishLogo from './FishLogo';

interface ProfileSelectionProps {
  initialName?: string;
  onNext: (name: string, profile: StudyProfile) => void;
  onBack?: () => void;
}

type Variant = 'olive' | 'terracotta' | 'dark';

const PROFILE_OPTIONS: Array<{
  id: StudyProfile;
  title: string;
  eyebrow: string;
  description: string;
  tags: string[];
  icon: React.ReactNode;
  variant: Variant;
}> = [
  {
    id: 'VESTIBULAR',
    title: 'Vestibular',
    eyebrow: 'ENEM • FUVEST',
    description: 'Construa uma base forte para chegar mais preparado às grandes universidades.',
    tags: ['Base sólida', 'Interdisciplinar'],
    icon: <BookOpen className="w-7 h-7" />,
    variant: 'olive',
  },
  {
    id: 'FACULDADE',
    title: 'Faculdade',
    eyebrow: 'GRADE • PROVAS',
    description: 'Organize suas disciplinas, trabalhos e provas com mais clareza durante o período.',
    tags: ['Disciplinas', 'Trabalhos'],
    icon: <GraduationCap className="w-7 h-7" />,
    variant: 'terracotta',
  },
  {
    id: 'CONCURSO',
    title: 'Concursos',
    eyebrow: 'EDITAL • CARREIRA',
    description: 'Estude com estratégia para dominar o edital, a jurisprudência e as questões complexas.',
    tags: ['Plano de prova', 'Alta performance'],
    icon: <Scale className="w-7 h-7" />,
    variant: 'dark',
  },
];

const ACCENTS: Record<Variant, { text: string; iconBg: string; chipBg: string }> = {
  olive: { text: '#446B4E', iconBg: 'rgba(138,154,123,0.20)', chipBg: 'rgba(138,154,123,0.18)' },
  terracotta: { text: '#C96C4A', iconBg: 'rgba(201,108,74,0.16)', chipBg: 'rgba(217,139,123,0.20)' },
  dark: { text: '#D8A53A', iconBg: 'rgba(216,165,58,0.22)', chipBg: 'rgba(216,165,58,0.22)' },
};

const ProfileSelection: React.FC<ProfileSelectionProps> = ({ initialName, onNext, onBack }) => {
  const [name, setName] = useState(initialName ?? '');
  const [nameError, setNameError] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handlePick = (profile: StudyProfile) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(true);
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onNext(trimmed, profile);
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col overflow-hidden animate-in fade-in duration-700"
      style={{
        background: 'radial-gradient(120% 90% at 25% 0%, #FBF7F0 0%, #F4EBDD 55%, #E8DDCC 100%)',
        fontFamily: "'Manrope', sans-serif",
      }}
    >
      {/* almost-invisible geometric module background */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        <defs>
          <pattern id="profileSelectModules" width="64" height="64" patternUnits="userSpaceOnUse">
            <rect x="8" y="8" width="48" height="48" rx="10" fill="none" stroke="#473c33" strokeWidth="1" strokeOpacity="0.05" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#profileSelectModules)" />
      </svg>

      <header className="relative z-10 flex items-center justify-between px-5 md:px-10 pt-5 md:pt-7 pb-3 shrink-0">
        {onBack ? (
          <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 rounded-2xl text-[#725442]/70 hover:text-[#473c33] hover:bg-white/70 transition-all">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[11px] font-medium uppercase tracking-[0.06em]">Voltar</span>
          </button>
        ) : <span />}
        <div className="flex items-center gap-2 bg-[#E8DDCC] rounded-full px-4 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#725442]">Passo 1 de 2</span>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 md:px-10 py-5 md:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center text-center mb-8 md:mb-10">
            <div className="mb-4">
              <FishLogo className="scale-90" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#725442] mb-3">Personalize sua jornada</p>

            <h1 className="font-logo font-medium text-2xl md:text-3xl text-[#473c33] leading-[1.1]">
              Como podemos te chamar?
            </h1>
            <input
              ref={nameInputRef}
              value={name}
              onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError(false); }}
              placeholder="Digite seu apelido..."
              className="w-full max-w-xs mt-4 bg-[#FBF7F0] border-2 rounded-2xl px-5 py-3.5 text-base font-semibold text-center text-[#473c33] placeholder:text-[#725442]/40 focus:outline-none transition-all"
              style={{ borderColor: nameError ? '#A94432' : '#E8DDCC' }}
            />
            {nameError && (
              <p className="text-[11px] font-semibold mt-2" style={{ color: '#A94432' }}>Digite seu apelido antes de continuar</p>
            )}

            <h1 className="font-logo font-bold text-4xl md:text-6xl text-[#473c33] leading-[1.05] mt-10">
              O que você quer estudar?
            </h1>
            <p className="max-w-xl text-[#725442] text-sm md:text-base leading-relaxed mt-4">
              Sua escolha ajusta o conteúdo, as questões e o tom da IA em todo o app.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-7 max-w-5xl mx-auto">
            {PROFILE_OPTIONS.map((option) => {
              const dark = option.variant === 'dark';
              const accent = ACCENTS[option.variant];
              return (
                <button
                  key={option.id}
                  onClick={() => handlePick(option.id)}
                  className="group relative min-h-[280px] md:min-h-[340px] rounded-[32px] p-6 md:p-8 text-left flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
                  style={{
                    background: dark ? '#2E4A54' : '#FBF7F0',
                    border: dark ? 'none' : '1px solid #E8DDCC',
                    boxShadow: dark ? '0 24px 48px -28px rgba(46,74,84,0.45)' : '0 24px 48px -28px rgba(74,53,42,0.22)',
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                    style={{ background: accent.iconBg, color: accent.text }}
                  >
                    {option.icon}
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mt-4" style={{ color: dark ? '#D8A53A' : accent.text }}>
                    {option.eyebrow}
                  </p>
                  <h2 className="font-logo font-medium text-2xl md:text-[26px] mt-1.5" style={{ color: dark ? '#FBF7F0' : '#473c33' }}>
                    {option.title}
                  </h2>
                  <p className="text-[13.5px] leading-relaxed mt-3 flex-grow" style={{ color: dark ? 'rgba(251,247,240,0.72)' : '#725442' }}>
                    {option.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {option.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-semibold rounded-full px-3.5 py-1.5"
                        style={{ background: dark ? 'rgba(216,165,58,0.22)' : accent.chipBg, color: dark ? '#D8A53A' : accent.text }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs font-medium mt-8 md:mt-10 pb-3" style={{ color: 'rgba(74,53,42,0.55)' }}>
            Você poderá alterar isso depois, no seu perfil.
          </p>
        </div>
      </main>
    </div>
  );
};

export default ProfileSelection;
