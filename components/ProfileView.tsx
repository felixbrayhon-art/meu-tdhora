
import React, { useState } from 'react';
import { UserStats, StudyProfile, FISH_RANKS, getFishRank } from '../types';
import FishLogo from './FishLogo';

interface ProfileViewProps {
  stats: UserStats;
  onUpdate: (stats: UserStats) => void;
  onBack: () => void;
}

const AVATAR_OPTIONS = [
  { color: '#FACC15', name: 'Peixe Amarelo' },
  { color: '#F97316', name: 'Peixe Laranja' },
  { color: '#3B82F6', name: 'Peixe Azul' },
  { color: '#8B5CF6', name: 'Peixe Roxo' },
  { color: '#0A0F1E', name: 'Peixe Dark' },
];

const ProfileView: React.FC<ProfileViewProps> = ({ stats, onUpdate, onBack }) => {
  const [name, setName] = useState(stats.name);
  const [selectedColor, setSelectedColor] = useState(stats.avatarColor);
  const [profile, setProfile] = useState<StudyProfile>(stats.studyProfile || 'VESTIBULAR');

  const currentRank = getFishRank(stats.totalDaysStudied);
  const nextRank = FISH_RANKS.find(r => r.days > stats.totalDaysStudied);

  const handleSave = () => {
    onUpdate({ ...stats, name, avatarColor: selectedColor, studyProfile: profile });
    onBack();
  };

  return (
    <div className="max-w-4xl mx-auto py-10 animate-in fade-in slide-in-from-bottom-6 duration-500 px-4">
      <button onClick={onBack} className="mb-12 text-gray-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:text-gray-600 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
        VOLTAR AO HUB
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 bg-white rounded-[50px] p-12 shadow-2xl border border-gray-100 h-fit">
          <div className="flex flex-col items-center mb-12">
            <div 
              className="w-32 h-32 rounded-[40px] flex items-center justify-center shadow-xl mb-6 transition-all duration-500 border-4 border-white"
              style={{ backgroundColor: selectedColor }}
            >
              <FishLogo iconOnly primaryColor="white" className="scale-150" days={stats.totalDaysStudied} />
            </div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase">MEU PERFIL</h2>
            <p className="text-blue-500 font-black text-sm uppercase mt-1">{currentRank.label}</p>
          </div>

          <div className="space-y-10">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Nome do Nadador</label>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 border-2 border-transparent rounded-3xl px-6 py-4 text-xl font-bold focus:outline-none focus:border-yellow-400 transition-all shadow-sm"
                placeholder="Digite seu apelido..."
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Objetivo de Estudo</label>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setProfile('VESTIBULAR')}
                  className={`p-6 rounded-[25px] border-2 font-black text-xs uppercase tracking-widest transition-all ${profile === 'VESTIBULAR' ? 'bg-blue-500 border-blue-500 text-white shadow-lg' : 'bg-gray-50 border-transparent text-gray-400'}`}
                >
                  VESTIBULAR / ENEM
                </button>
                <button 
                  onClick={() => setProfile('CONCURSO')}
                  className={`p-6 rounded-[25px] border-2 font-black text-xs uppercase tracking-widest transition-all ${profile === 'CONCURSO' ? 'bg-[#0A0F1E] border-[#0A0F1E] text-white shadow-lg' : 'bg-gray-50 border-transparent text-gray-400'}`}
                >
                  CONCURSOS PÚBLICOS
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Cor do Peixe</label>
              <div className="grid grid-cols-5 gap-4">
                {AVATAR_OPTIONS.map((opt) => (
                  <button 
                    key={opt.color}
                    onClick={() => setSelectedColor(opt.color)}
                    className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${
                      selectedColor === opt.color ? 'ring-4 ring-yellow-400 ring-offset-4 scale-110' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0'
                    }`}
                    style={{ backgroundColor: opt.color }}
                  >
                    <FishLogo iconOnly primaryColor="white" className="scale-50" days={stats.totalDaysStudied} />
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6">
              <button 
                onClick={handleSave}
                className="w-full bg-yellow-400 text-white py-6 rounded-[30px] font-black text-xl shadow-xl shadow-yellow-100 hover:scale-[1.02] transition-all active:scale-95"
              >
                SALVAR ALTERAÇÕES
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#0A0F1E] rounded-[45px] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
               <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M10 30 C 25 10, 55 5, 80 25 C 90 20, 95 15, 100 20 C 97 30, 97 30, 100 40 C 95 45, 90 40, 80 35 C 55 55, 25 50, 10 30 Z" /></svg>
            </div>
            
            <h3 className="text-xl font-black italic uppercase tracking-tighter mb-10 relative z-10 border-b border-white/10 pb-4">
              AQUÁRIO DE ELITE
            </h3>
            
            <div className="space-y-10 relative z-10">
              {FISH_RANKS.map((rank, idx) => {
                const isUnlocked = stats.totalDaysStudied >= rank.days;
                const isCurrent = currentRank.id === rank.id;

                return (
                  <div key={rank.id} className="flex items-center gap-6">
                    {/* Visualização do Peixe */}
                    <div className="relative">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 ${
                        isUnlocked 
                          ? 'bg-white/5 border-yellow-400/50' 
                          : 'bg-black/40 border-white/5 grayscale opacity-40'
                      }`}>
                        <FishLogo 
                          iconOnly 
                          primaryColor={isUnlocked ? selectedColor : "#4B5563"} 
                          className="scale-90" 
                          days={rank.days} 
                        />
                      </div>
                      
                      {/* Overlay de Bloqueio */}
                      {!isUnlocked && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-lg flex items-center justify-center shadow-lg animate-pulse border-2 border-[#0A0F1E]">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      )}
                      
                      {isUnlocked && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-white w-6 h-6 rounded-lg flex items-center justify-center shadow-lg border-2 border-[#0A0F1E]">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                         <p className={`font-black text-xs uppercase tracking-widest ${isCurrent ? 'text-yellow-400' : isUnlocked ? 'text-white' : 'text-gray-600'}`}>
                           {rank.label}
                         </p>
                      </div>
                      <p className={`text-[9px] font-bold leading-tight ${isUnlocked ? 'text-gray-400' : 'text-gray-700 italic'}`}>
                        {isUnlocked ? rank.description : `Bloqueado: Estude mais ${rank.days - stats.totalDaysStudied} dias`}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${isUnlocked ? 'bg-yellow-400' : 'bg-gray-800'}`}
                            style={{ width: `${Math.min((stats.totalDaysStudied / rank.days) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[8px] font-black text-gray-600 uppercase tracking-tighter">{rank.days}D</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {nextRank && (
              <div className="mt-12 bg-white/5 p-6 rounded-[35px] border border-white/10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-yellow-400/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                <div className="relative z-10">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    PRÓXIMA EVOLUÇÃO EM CURSO
                  </p>
                  <div className="flex justify-between items-end">
                     <p className="text-sm font-black text-white italic uppercase">{nextRank.label}</p>
                     <p className="text-xs font-bold text-yellow-400 italic">Faltam {nextRank.days - stats.totalDaysStudied} dias</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
