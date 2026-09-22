import React from 'react';
import { ArrowLeft, ArrowRight, BookOpen, GraduationCap, Scale, Sparkles } from './icons';
import { StudyProfile } from '../types';
import FishLogo from './FishLogo';

interface ProfileSelectionProps {
  onSelect: (profile: StudyProfile) => void;
  onBack?: () => void;
}

const PROFILE_OPTIONS: Array<{
  id: StudyProfile;
  title: string;
  eyebrow: string;
  description: string;
  tags: string[];
  cardClass: string;
  iconClass: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'VESTIBULAR',
    title: 'Vestibular',
    eyebrow: 'ENEM • FUVEST',
    description: 'Construa uma base forte para chegar mais preparado às grandes universidades.',
    tags: ['Base sólida', 'Interdisciplinar'],
    cardClass: 'bg-[#EEF6FF] border-blue-100 hover:border-blue-300 hover:shadow-blue-100/80',
    iconClass: 'bg-blue-600 text-white shadow-blue-200',
    icon: <BookOpen className="w-7 h-7" strokeWidth={2.5} />,
  },
  {
    id: 'FACULDADE',
    title: 'Faculdade',
    eyebrow: 'GRADE • PROVAS',
    description: 'Organize suas disciplinas, trabalhos e provas com mais clareza durante o período.',
    tags: ['Disciplinas', 'Trabalhos'],
    cardClass: 'bg-[#F7F1FF] border-violet-100 hover:border-violet-300 hover:shadow-violet-100/80',
    iconClass: 'bg-violet-600 text-white shadow-violet-200',
    icon: <GraduationCap className="w-7 h-7" strokeWidth={2.5} />,
  },
  {
    id: 'CONCURSO',
    title: 'Concursos',
    eyebrow: 'EDITAL • CARREIRA',
    description: 'Estude com estratégia para dominar o edital, a jurisprudência e as questões complexas.',
    tags: ['Plano de prova', 'Alta performance'],
    cardClass: 'bg-[#101728] border-[#26334D] hover:border-yellow-400 hover:shadow-yellow-900/30',
    iconClass: 'bg-yellow-400 text-[#0A0F1E] shadow-yellow-900/30',
    icon: <Scale className="w-7 h-7" strokeWidth={2.5} />,
  },
];

const ProfileSelection: React.FC<ProfileSelectionProps> = ({ onSelect, onBack }) => {
  return (
    <div className="fixed inset-0 z-[110] bg-[#F8F4EA] flex flex-col overflow-hidden animate-in fade-in duration-700">
      <div className="absolute inset-0 pointer-events-none opacity-70 bg-[radial-gradient(circle_at_12%_10%,rgba(250,204,21,0.18),transparent_24%),radial-gradient(circle_at_92%_88%,rgba(96,165,250,0.14),transparent_28%)]" />
      <div className="absolute -right-16 top-28 w-48 h-48 rounded-full border-[26px] border-white/50 pointer-events-none" />
      <div className="absolute -left-24 bottom-8 w-64 h-64 rounded-full border-[36px] border-white/40 pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-5 md:px-10 pt-5 md:pt-7 pb-3 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-2xl text-[#0A0F1E]/55 hover:text-[#0A0F1E] hover:bg-white/70 transition-all"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={3} />
          <span className="text-[10px] font-black uppercase tracking-[0.16em]">Voltar</span>
        </button>
        <div className="flex items-center gap-2 bg-white/65 border border-white rounded-full px-3 py-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#0A0F1E]/55">Passo 2 de 3</span>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 md:px-10 py-5 md:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center text-center mb-8 md:mb-10">
            <div className="mb-4 p-3 rounded-[22px] bg-white/75 border border-white shadow-sm">
              <FishLogo className="scale-90" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-600 mb-3">Personalize sua jornada</p>
            <h1 className="font-logo text-4xl md:text-6xl text-[#0A0F1E] uppercase leading-[0.95]">
              O que você quer <span className="text-yellow-400">estudar</span>?
            </h1>
            <p className="max-w-xl text-[#0A0F1E]/50 font-bold text-xs md:text-sm leading-relaxed mt-4">
              Escolha um objetivo para ajustarmos o conteúdo, as questões e o tom da IA ao seu momento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 max-w-5xl mx-auto">
            {PROFILE_OPTIONS.map(option => {
              const darkCard = option.id === 'CONCURSO';
              return (
                <button
                  key={option.id}
                  onClick={() => onSelect(option.id)}
                  className={`group relative min-h-[260px] md:min-h-[310px] rounded-[30px] border p-5 md:p-6 text-left flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(30,41,59,0.14)] ${option.cardClass}`}
                >
                  <div className="absolute -right-9 -top-9 w-32 h-32 rounded-full border-[18px] border-white/40 group-hover:scale-110 transition-transform duration-500" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3 mb-7">
                      <div className={`w-14 h-14 rounded-[19px] flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-105 group-hover:rotate-2 ${option.iconClass}`}>
                        {option.icon}
                      </div>
                      <Sparkles className={`w-4 h-4 ${darkCard ? 'text-yellow-400/60' : 'text-[#0A0F1E]/20'}`} />
                    </div>
                    <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-2 ${darkCard ? 'text-yellow-400/75' : 'text-[#0A0F1E]/40'}`}>{option.eyebrow}</p>
                    <h2 className={`text-2xl md:text-[28px] font-black italic tracking-[-0.04em] uppercase ${darkCard ? 'text-white' : 'text-[#0A0F1E]'}`}>{option.title}</h2>
                    <p className={`text-xs font-bold leading-relaxed mt-3 ${darkCard ? 'text-white/55' : 'text-[#0A0F1E]/52'}`}>{option.description}</p>
                  </div>
                  <div className="relative flex items-center justify-between gap-3 mt-6">
                    <div className="flex flex-wrap gap-1.5">
                      {option.tags.map(tag => (
                        <span key={tag} className={`text-[9px] font-black uppercase tracking-wide rounded-full px-2.5 py-1.5 ${darkCard ? 'bg-white/10 text-white/65' : 'bg-white/70 text-[#0A0F1E]/50'}`}>{tag}</span>
                      ))}
                    </div>
                    <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all group-hover:translate-x-1 ${darkCard ? 'bg-white/10 text-white' : 'bg-white text-[#0A0F1E]'}`}>
                      <ArrowRight className="w-4 h-4" strokeWidth={3} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2 mt-8 md:mt-10 pb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            <p className="text-[9px] font-black text-[#0A0F1E]/30 uppercase tracking-[0.22em]">Você poderá mudar isso a qualquer momento no perfil</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfileSelection;
