
import React, { useState, useRef, useEffect } from 'react';

const LOFI_RELAX_URL = "https://stream.zeno.fm/0r0xa792kwzuv"; 
const MPB_LOFI_URL = "https://stream.zeno.fm/f978v6v6h0huv"; // Estação MPB/Bossa Lofi
const RAIN_SOUND_URL = "https://www.soundjay.com/nature/rain-01.mp3"; 

const LofiPlayer: React.FC = () => {
  const [activeChannel, setActiveChannel] = useState<'RELAX' | 'MPB' | null>(null);
  const [isPlayingRain, setIsPlayingRain] = useState(false);
  const [volume, setVolume] = useState(0.5);
  
  const relaxRef = useRef<HTMLAudioElement | null>(null);
  const mpbRef = useRef<HTMLAudioElement | null>(null);
  const rainRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    // Stop all and play only active
    [relaxRef, mpbRef].forEach(ref => {
      if (ref.current) ref.current.pause();
    });

    if (activeChannel === 'RELAX' && relaxRef.current) {
      relaxRef.current.play().catch(() => {});
    } else if (activeChannel === 'MPB' && mpbRef.current) {
      mpbRef.current.play().catch(() => {});
    }
  }, [activeChannel]);

  useEffect(() => {
    if (rainRef.current) {
      if (isPlayingRain) {
        rainRef.current.play().catch(() => {});
      } else {
        rainRef.current.pause();
      }
    }
  }, [isPlayingRain]);

  useEffect(() => {
    if (relaxRef.current) relaxRef.current.volume = volume;
    if (mpbRef.current) mpbRef.current.volume = volume;
    if (rainRef.current) rainRef.current.volume = volume * 0.7;
  }, [volume]);

  return (
    <div className="bg-white rounded-[40px] p-8 border border-gray-100 flex flex-col justify-between shadow-sm relative overflow-hidden h-full">
      <audio ref={relaxRef} src={LOFI_RELAX_URL} loop />
      <audio ref={mpbRef} src={MPB_LOFI_URL} loop />
      <audio ref={rainRef} src={RAIN_SOUND_URL} loop />
      
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h2 className="text-2xl font-black italic tracking-tighter">AMBIENTE</h2>
        <div className="flex items-center gap-2">
           <input 
             type="range" 
             min="0" 
             max="1" 
             step="0.01" 
             value={volume} 
             onChange={(e) => setVolume(parseFloat(e.target.value))}
             className="w-16 h-1 accent-yellow-400 opacity-30 hover:opacity-100 transition-opacity"
           />
           <div className="text-yellow-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 relative z-10">
        <button 
          onClick={() => setActiveChannel(activeChannel === 'RELAX' ? null : 'RELAX')}
          className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all border-2 ${
            activeChannel === 'RELAX' 
            ? 'bg-yellow-400 border-yellow-400 text-black shadow-lg shadow-yellow-100' 
            : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest">LOFI RELAX</span>
        </button>

        <button 
          onClick={() => setActiveChannel(activeChannel === 'MPB' ? null : 'MPB')}
          className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all border-2 ${
            activeChannel === 'MPB' 
            ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-100' 
            : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest">MPB LOFI</span>
        </button>

        <button 
          onClick={() => setIsPlayingRain(!isPlayingRain)}
          className={`col-span-2 p-3 rounded-2xl flex items-center justify-center gap-3 transition-all border-2 ${
            isPlayingRain 
            ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-100' 
            : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest">CHUVA FUNDO</span>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 relative z-10">
        <div className={`w-1.5 h-1.5 rounded-full ${activeChannel || isPlayingRain ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {activeChannel || isPlayingRain ? 'IMERSÃO ATIVA' : 'SONS EM PAUSA'}
        </span>
      </div>
    </div>
  );
};

export default LofiPlayer;
