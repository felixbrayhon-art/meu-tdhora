
import React, { useState } from 'react';
import { TimerMode } from '../types';

interface TimerViewProps {
  isActive: boolean;
  setIsActive: (a: boolean) => void;
  seconds: number;
  setSeconds: (s: number) => void;
  mode: TimerMode;
  onBack: () => void;
  onComplete: () => void;
}

const TimerView: React.FC<TimerViewProps> = ({ isActive, setIsActive, seconds, setSeconds, mode, onBack, onComplete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempMinutes, setTempMinutes] = useState(Math.floor(seconds / 60).toString());

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEditConfirm = () => {
    const val = parseInt(tempMinutes);
    if (!isNaN(val) && val > 0 && val <= 240) {
      setSeconds(val * 60);
    }
    setIsEditing(false);
  };

  const isEmergency = mode === TimerMode.EMERGENCY;
  const themeColor = isEmergency ? 'bg-orange-500' : 'bg-yellow-400';
  const label = isEmergency ? 'MODO QUEBRA-INÉRCIA' : 'MODO FOCO PROFUNDO';

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center py-10">
      <div className="w-full flex justify-between items-center mb-8">
        <button onClick={onBack} className="text-gray-400 font-bold uppercase text-xs tracking-widest flex items-center gap-2 hover:text-gray-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          VOLTAR
        </button>
        <div className={`px-4 py-2 rounded-full font-black text-[10px] tracking-widest uppercase ${isEmergency ? 'bg-orange-50 text-orange-600' : 'bg-yellow-50 text-yellow-600'}`}>
          {label}
        </div>
      </div>

      <div className="bg-white rounded-[60px] w-full max-w-2xl p-16 flex flex-col items-center border border-gray-100 shadow-2xl relative">
        {!isActive && !isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="absolute top-8 right-12 flex items-center gap-2 text-[10px] font-black text-gray-300 hover:text-yellow-500 uppercase tracking-widest transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            EDITAR TEMPO
          </button>
        )}

        <div className="relative group">
          {isEditing ? (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-4">
                <input 
                  autoFocus
                  type="number" 
                  value={tempMinutes}
                  onChange={(e) => setTempMinutes(e.target.value)}
                  onBlur={handleEditConfirm}
                  onKeyPress={(e) => e.key === 'Enter' && handleEditConfirm()}
                  className="text-[100px] md:text-[140px] font-black text-center bg-gray-50 rounded-[40px] w-48 md:w-80 outline-none border-4 border-yellow-200 tabular-nums"
                />
                <span className="text-2xl font-black text-gray-300">MIN</span>
              </div>
              <p className="mt-4 text-[10px] font-black text-yellow-500 uppercase tracking-widest">ENTER PARA CONFIRMAR</p>
            </div>
          ) : (
            <div 
              className={`text-[110px] md:text-[150px] font-black leading-none tracking-tighter tabular-nums italic transition-all ${!isActive ? 'cursor-pointer hover:scale-105 hover:text-yellow-500' : ''}`}
              onClick={() => !isActive && setIsEditing(true)}
            >
              {formatTime(seconds)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-8 mt-16">
          <button 
            onClick={() => { if(!isEditing) setIsActive(!isActive); }}
            className={`w-28 h-28 rounded-[40px] text-white flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95 ${isEditing ? 'bg-gray-200 cursor-not-allowed' : themeColor}`}
          >
            {isActive ? (
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg className="w-12 h-12 ml-2" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          
          <button 
            onClick={() => { setIsActive(false); setSeconds(isEmergency ? 300 : 1500); }}
            className="w-20 h-20 rounded-[35px] bg-gray-50 text-gray-300 flex items-center justify-center transition-all hover:bg-gray-100 hover:text-red-400"
            title="Resetar"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      <div className="mt-12 max-w-md text-center">
         <p className="text-gray-400 text-sm font-medium italic">
           {isActive ? 'Mantenha o foco. O cronômetro continua rodando mesmo se você navegar pelo app.' : 'Clique no tempo acima para personalizar a duração do seu mergulho.'}
         </p>
      </div>
    </div>
  );
};

export default TimerView;
