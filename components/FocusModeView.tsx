import React from 'react';
import { FocusSettings } from '../types';

interface FocusModeViewProps {
  settings: FocusSettings;
  onUpdate: (settings: FocusSettings) => void;
  onBack: () => void;
}

const FocusModeView: React.FC<FocusModeViewProps> = ({ settings, onUpdate, onBack }) => {
  const handleChange = (key: keyof FocusSettings, value: any) => {
    onUpdate({ ...settings, [key]: value });
  };

  return (
    <div className="max-w-3xl mx-auto py-10 text-[#473c33] dark:text-[#f4ebdd] animate-in fade-in duration-700">
      <div className="flex justify-between items-center mb-12">
        <button onClick={onBack} className="min-h-[44px] text-gray-400 dark:text-[#b9ad9c] font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:text-gray-600 dark:hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
          </svg>
          VOLTAR AO HUB
        </button>
        <h2 className="text-right text-xl font-black tracking-tight uppercase sm:text-2xl">
          PAUSAS & <span className="text-[#d9772b]">LEMBRETES</span>
        </h2>
      </div>

      <p className="-mt-7 mb-8 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-[#c2b6a6]">
        Configure lembretes de hidratação, medicação e transição de rotina. Eles são opcionais e não interrompem seu estudo.
      </p>

      <div className="grid grid-cols-1 gap-8">
        {/* Card Água */}
        <div className="bg-white rounded-[45px] p-10 border border-gray-100 shadow-xl shadow-gray-100/20 relative overflow-hidden group dark:bg-[#272019] dark:border-white/[0.08] dark:shadow-none">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#fff6e8] text-[#fecc73] rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-black uppercase leading-none">Combustível (Água)</h3>
                <p className="text-xs font-bold text-gray-400 dark:text-[#b9ad9c] uppercase tracking-widest mt-1">Hidratação constante</p>
              </div>
            </div>
            <button type="button" onClick={() => handleChange('waterReminder', !settings.waterReminder)} aria-label="Lembrete de hidratação" aria-pressed={settings.waterReminder} className={`w-14 h-8 rounded-full transition-all relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e96f34] ${settings.waterReminder ? 'bg-[#fecc73]' : 'bg-gray-200 dark:bg-white/20'}`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${settings.waterReminder ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {settings.waterReminder && (
            <div className="animate-in slide-in-from-top-2">
              <div className="flex justify-between mb-4">
                <label className="text-[10px] font-black text-gray-400 dark:text-[#b9ad9c] uppercase tracking-widest">Lembrete a cada</label>
                <span className="text-[#fec868] font-black">{settings.waterInterval} min</span>
              </div>
              <input aria-label="Intervalo do lembrete de hidratação" type="range" min="15" max="120" step="15" value={settings.waterInterval} onChange={(e) => handleChange('waterInterval', Number(e.target.value))} className="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full accent-[#fecc73] cursor-pointer" />
            </div>
          )}
        </div>

        {/* Card Remédio */}
        <div className="bg-white rounded-[45px] p-10 border border-gray-100 shadow-xl shadow-gray-100/20 dark:bg-[#272019] dark:border-white/[0.08] dark:shadow-none">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#fff1e8] text-[#fdad74] rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a2 2 0 00-1.96 1.414l-.477 2.387a2 2 0 00.547 1.022l1.428 1.428a2 2 0 001.022.547l2.387.477a2 2 0 001.96-1.414l.477-2.387a2 2 0 00-.547-1.022l-1.428-1.428z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-black uppercase leading-none">Medicamento</h3>
                <p className="text-xs font-bold text-gray-400 dark:text-[#b9ad9c] uppercase tracking-widest mt-1">Horário preferido</p>
              </div>
            </div>
            <button type="button" onClick={() => handleChange('medicationReminder', !settings.medicationReminder)} aria-label="Lembrete de medicamento" aria-pressed={settings.medicationReminder} className={`w-14 h-8 rounded-full transition-all relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e96f34] ${settings.medicationReminder ? 'bg-[#fdad74]' : 'bg-gray-200 dark:bg-white/20'}`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${settings.medicationReminder ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {settings.medicationReminder && (
            <div className="animate-in slide-in-from-top-2">
              <label className="text-[10px] font-black text-gray-400 dark:text-[#b9ad9c] uppercase tracking-widest block mb-3">Definir Horário</label>
              <input aria-label="Horário do lembrete de medicamento" type="time" value={settings.medicationTime} onChange={(e) => handleChange('medicationTime', e.target.value)} className="w-full bg-gray-50 dark:bg-[#1c1712] dark:text-[#f4ebdd] border-2 border-transparent rounded-2xl px-6 py-4 text-xl font-bold focus:outline-none focus:border-[#fdad74] transition-all" />
            </div>
          )}
        </div>

        {/* Card Trabalho / Transição */}
        <div className="bg-[#473c33] rounded-[45px] p-10 shadow-2xl relative overflow-hidden text-white">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#fed386]/10 blur-[80px] rounded-full"></div>
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#fed386]/20 text-[#fed386] rounded-2xl flex items-center justify-center backdrop-blur-md">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-black uppercase leading-none">Virote de Trabalho</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Sair do Hiperfoco</p>
              </div>
            </div>
            <button type="button" onClick={() => handleChange('workTransition', !settings.workTransition)} aria-label="Lembrete de transição para o trabalho" aria-pressed={settings.workTransition} className={`w-14 h-8 rounded-full transition-all relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fed386] ${settings.workTransition ? 'bg-[#fed386]' : 'bg-white/10'}`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${settings.workTransition ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {settings.workTransition && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 animate-in slide-in-from-top-2">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Horário de Início</label>
                <input aria-label="Horário de início do lembrete de trabalho" type="time" value={settings.workStartTime} onChange={(e) => handleChange('workStartTime', e.target.value)} className="w-full bg-white/5 border-2 border-transparent rounded-2xl px-6 py-4 text-xl font-bold focus:outline-none focus:border-[#fed386] transition-all text-white" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Tempo de Preparo</label>
                <div className="flex gap-4">
                  {[15, 30, 45].map((time) => (
                    <button key={time} onClick={() => handleChange('prepTime', time)} className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all ${settings.prepTime === time ? 'bg-[#fed386] text-[#473c33]' : 'bg-white/5 text-gray-400'}`}>
                      {time}min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 bg-gray-50 dark:bg-[#272019] p-8 rounded-[40px] text-center">
        <p className="text-gray-500 dark:text-[#c2b6a6] font-medium text-sm leading-relaxed max-w-lg mx-auto">Os lembretes ajudam a planejar pausas e transições. Você pode continuar estudando sem ativá-los.</p>
      </div>
    </div>
  );
};

export default FocusModeView;
