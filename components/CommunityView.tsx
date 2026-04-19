

import React, { useState } from 'react';
import { Activity } from '../types';
import FishLogo from './FishLogo';

interface CommunityViewProps {
  activities: Activity[];
  onBack: () => void;
  onPostManual: (text: string) => void;
}

const CommunityView: React.FC<CommunityViewProps> = ({ activities, onBack, onPostManual }) => {
  const [localActivities, setLocalActivities] = useState(activities);
  const [statusText, setStatusText] = useState('');

  const handlePost = () => {
    if (!statusText.trim()) return;
    onPostManual(statusText);
    setStatusText('');
  };

  const addBubble = (id: string) => {
    setLocalActivities(prev => prev.map(act => 
      act.id === id ? { ...act, bubbles: act.bubbles + 1 } : act
    ));
  };

  return (
    <div className="max-w-3xl mx-auto py-10 animate-in fade-in duration-700">
      <div className="flex justify-between items-center mb-12">
        <button onClick={onBack} className="text-gray-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          VOLTAR
        </button>
        <h2 className="text-3xl font-black italic tracking-tighter">CARDUME SOCIAL</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Feed de Atividades */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Postagem Manual */}
          <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-xl mb-10 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-yellow-400"></div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">O que você está mergulhando agora?</h3>
            <textarea 
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              placeholder="Ex: Destruindo Direito Penal hoje!"
              className="w-full bg-gray-50 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all resize-none h-24"
            />
            <div className="flex justify-end mt-4">
              <button 
                onClick={handlePost}
                disabled={!statusText.trim()}
                className="bg-yellow-400 text-white px-8 py-3 rounded-xl font-black text-xs shadow-lg shadow-yellow-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
              >
                PUBLICAR MERGULHO
              </button>
            </div>
          </div>

          <div className="bg-blue-50 text-blue-800 p-6 rounded-[35px] border border-blue-100 flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
               </div>
               <p className="font-bold text-sm">O cardume está focado! 14 peixes estão mergulhando agora.</p>
            </div>
          </div>

          {localActivities.map((act) => (
            <div key={act.id} className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-sm transition-all hover:shadow-md group animate-in slide-in-from-top-4">
              <div className="flex items-start gap-4">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: act.avatarColor }}
                >
                  <FishLogo iconOnly primaryColor="white" className="scale-75" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-gray-800 uppercase text-sm tracking-tight">{act.userName}</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {act.type === 'STATUS' ? 'PENSAMENTO' : 'MERGULHO'}
                      </p>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      act.type === 'EMERGENCY' ? 'bg-orange-50 text-orange-600' : 
                      act.type === 'STATUS' ? 'bg-blue-50 text-blue-600' : 'bg-yellow-50 text-yellow-600'
                    }`}>
                      {act.type}
                    </span>
                  </div>
                  
                  <div className="mt-6 mb-8">
                    <h3 className="text-2xl font-black italic text-gray-800 leading-none mb-2">{act.subject}</h3>
                    {act.duration > 0 && (
                      <div className="flex items-center gap-2">
                         <span className="text-sm font-bold text-gray-500">{act.duration} minutos de foco ininterrupto</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => addBubble(act.id)}
                      className="flex items-center gap-2 bg-gray-50 px-6 py-3 rounded-2xl group-hover:bg-blue-50 transition-colors"
                    >
                      <svg className={`w-5 h-5 transition-transform active:scale-150 ${act.bubbles > 0 ? 'text-blue-500 fill-blue-500' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 21a9.003 9.003 0 008.34-12.66A9.003 9.003 0 0012 3a9.003 9.003 0 00-8.34 5.34A9.003 9.003 0 0012 21z" />
                      </svg>
                      <span className={`text-xs font-black ${act.bubbles > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {act.bubbles === 0 ? 'SOLTAR BOLHAS' : `${act.bubbles} BOLHAS`}
                      </span>
                    </button>
                    <button className="flex items-center gap-2 bg-gray-50 px-6 py-3 rounded-2xl text-gray-300">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar: Ranking Semanal */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#0A0F1E] rounded-[45px] p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            
            <h3 className="text-xl font-black italic uppercase tracking-tighter mb-8 relative z-10">REI DO LAGO (Semana)</h3>
            
            <div className="space-y-6 relative z-10">
              {[
                { name: 'Beta Focado', xp: 4500, color: '#F97316' },
                { name: 'Peixe Elétrico', xp: 3200, color: '#8B5CF6' },
                { name: 'Tubarão do Estudo', xp: 2800, color: '#3B82F6' },
              ].map((user, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <span className="text-2xl font-black italic text-yellow-400 w-6">{idx + 1}</span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: user.color }}>
                    <FishLogo iconOnly primaryColor="white" className="scale-50" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-tight">{user.name}</p>
                    <div className="w-full bg-white/10 h-1 rounded-full mt-1">
                      <div className="bg-yellow-400 h-full" style={{ width: `${(user.xp / 5000) * 100}%` }}></div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400">{user.xp} XP</span>
                </div>
              ))}
            </div>

            <button className="w-full mt-12 bg-white/10 hover:bg-white/20 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all">
              VER RANKING COMPLETO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityView;