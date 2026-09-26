import React, { useState, useEffect } from 'react';
import { getDailyBibleMotivation } from '../services/geminiService';
import { useCharacterId } from '../contexts/CharacterContext';
import { getPeaceSrc } from '../services/avatarService';

const MotivationView: React.FC = () => {
  const [motivation, setMotivation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const characterId = useCharacterId();
  const peaceSrc = getPeaceSrc(characterId);

  useEffect(() => {
    const lastFetch = localStorage.getItem('motivation_fetch_date');
    const today = new Date().toISOString().split('T')[0];

    if (lastFetch === today) {
      setMotivation(localStorage.getItem('motivation_content'));
    } else {
      fetchMotivation();
    }
  }, []);

  const fetchMotivation = async () => {
    setLoading(true);
    try {
      const content = await getDailyBibleMotivation();
      try {
        localStorage.setItem('motivation_fetch_date', new Date().toISOString().split('T')[0]);
        localStorage.setItem('motivation_content', content);
      } catch (storageError) {
        console.warn('Could not save daily motivation to localStorage', storageError);
      }
      setMotivation(content);
    } catch (error) {
      console.error('Failed to fetch motivation', error);
      setMotivation('Tudo posso naquele que me fortalece. - Reflexão: Confie no seu processo e mantenha a calma.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#f4f7ec] rounded-[40px] p-10 border border-[#e9efda] flex flex-col justify-center items-center shadow-sm relative overflow-hidden h-full animate-in zoom-in-95 duration-300 lg:col-span-3">
      <h2 className="text-3xl font-black tracking-tighter uppercase mb-6 leading-none text-[#596b2a]">
        MOMENTO DE <span className="text-[#b1c77b]">PAZ</span>
      </h2>
      {loading ? (
        <p className="text-[#799339] text-lg font-bold text-center">Carregando inspiração...</p>
      ) : (
        <div className={`relative w-full flex flex-col items-center ${peaceSrc ? 'sm:flex-row sm:items-end sm:justify-center gap-2 sm:gap-0' : ''}`}>
          {peaceSrc && <img src={peaceSrc} alt="" className="h-28 sm:h-40 object-contain drop-shadow-lg shrink-0 sm:-mr-4 sm:mb-2" />}
          <div className="bg-white/70 rounded-[30px] px-6 py-5 shadow-sm max-w-lg">
            <p className="text-[#799339] text-lg font-bold text-center leading-relaxed">{motivation}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MotivationView;
