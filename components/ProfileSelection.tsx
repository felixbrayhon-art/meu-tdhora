
import React from 'react';
import { StudyProfile } from '../types';
import FishLogo from './FishLogo';

interface ProfileSelectionProps {
  onSelect: (profile: StudyProfile) => void;
}

const ProfileSelection: React.FC<ProfileSelectionProps> = ({ onSelect }) => {
  return (
    <div className="fixed inset-0 z-[110] bg-[#FDFBF7] flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
      <div className="max-w-4xl w-full text-center space-y-12">
        <div className="flex flex-col items-center space-y-4">
          <FishLogo className="scale-125 mb-4" />
          <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-[#0A0F1E] uppercase">
            Qual o seu <span className="text-yellow-400">Objetivo</span>?
          </h1>
          <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">
            Ajustaremos as questões e o tom da IA para você
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => onSelect('VESTIBULAR')}
            className="group relative bg-white rounded-[50px] p-8 shadow-xl border border-gray-100 hover:border-yellow-400 hover:shadow-yellow-100 transition-all duration-500 overflow-hidden text-left flex flex-col justify-between"
          >
            <div>
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" />
                </svg>
              </div>
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-2xl font-black italic tracking-tighter mb-3 uppercase">Vestibular</h2>
              <p className="text-gray-400 text-xs font-semibold leading-relaxed">
                Foco em ENEM, FUVEST e grandes universidades. Linguagem leve e conteúdos de base.
              </p>
            </div>
          </button>

          <button 
            onClick={() => onSelect('FACULDADE')}
            className="group relative bg-[#FAF7FD] rounded-[50px] p-8 shadow-xl border border-purple-100 hover:border-violet-400 hover:shadow-violet-100 transition-all duration-500 overflow-hidden text-left flex flex-col justify-between"
          >
            <div>
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <svg className="w-24 h-24 text-violet-900" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12,3L1,9L12,15L21,10.09V17H23V9M12,17L12,17C12,17 12,17 12,17L5,13.18V17.18L12,21L19,17.18V13.18L12,17Z" />
                </svg>
              </div>
              <div className="w-14 h-14 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
              <h2 className="text-2xl font-black italic tracking-tighter mb-3 uppercase text-violet-900">Faculdade</h2>
              <p className="text-violet-500/80 text-xs font-semibold leading-relaxed">
                Foco em disciplinas acadêmicas, provas e trabalhos de graduação. Linguagem estruturada e rigor técnico equilibrado.
              </p>
            </div>
          </button>

          <button 
            onClick={() => onSelect('CONCURSO')}
            className="group relative bg-[#0A0F1E] rounded-[50px] p-8 shadow-2xl border border-transparent hover:border-yellow-400 transition-all duration-500 overflow-hidden text-left flex flex-col justify-between"
          >
            <div>
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12,3L1,9L12,15L21,10.09V17H23V9M12,17L12,17C12,17 12,17 12,17L5,13.18V17.18L12,21L19,17.18V13.18L12,17Z" />
                </svg>
              </div>
              <div className="w-14 h-14 bg-yellow-400 text-[#0A0F1E] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <h2 className="text-2xl font-black italic tracking-tighter mb-3 uppercase text-white">Concursos</h2>
              <p className="text-gray-400 text-xs font-semibold leading-relaxed">
                Foco em editais, jurisprudência e lei seca. Linguagem técnica de carreira pública e questões complexas.
              </p>
            </div>
          </button>
        </div>

        <div className="pt-8">
           <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em]">Você poderá mudar isso a qualquer momento no perfil</p>
        </div>
      </div>
    </div>
  );
};

export default ProfileSelection;
