import React, { useState, useRef, useEffect } from 'react';
import { chatWithFish } from '../services/geminiService';
import { StudyProfile } from '../types';
import { getCharacterSrc, getCharacter } from '../services/avatarService';
import AvatarDisplay from './AvatarDisplay';

interface FishCompanionProps {
  studyProfile?: StudyProfile;
  characterId?: string;
  /** A mini-barra do Pomodoro está visível: ancora o mascote acima dela para não cobrir controles. */
  liftForBar?: boolean;
}

const FishCompanion: React.FC<FishCompanionProps> = ({ studyProfile, characterId, liftForBar = false }) => {
  const companionIconSrc = characterId ? getCharacterSrc(characterId, 'frente') : '/fish-companion-icon.jpg';
  const companionName = characterId ? getCharacter(characterId).name : 'Peixe Amigo';
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isTyping]);

  const handleSend = async () => {
    if (!message.trim() || isTyping) return;

    const userMessage = message.trim();
    setMessage('');
    setChatHistory((prev) => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);

    try {
      const historyForAPI = chatHistory.map((h) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      }));

      const response = await chatWithFish(userMessage, historyForAPI, studyProfile);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'model',
          text: response || 'Ops, minha bolha estourou! Pode repetir?',
        },
      ]);
    } catch (error) {
      console.error(error);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'model',
          text: 'Tive uma cãibra na nadadeira! Tente novamente em instantes.',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed right-3 lg:right-6 z-[60] flex flex-col items-end pointer-events-none [&>*]:pointer-events-auto" style={{ bottom: liftForBar ? 'calc(6.5rem + env(safe-area-inset-bottom, 0px))' : 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
      {/* Janela de Chat */}
      {isOpen && (
        <div className="mb-4 w-[calc(100vw-1.5rem)] max-w-[400px] h-[min(500px,60vh)] bg-white rounded-[40px] shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
          {/* Header do Chat */}
          <div className="p-6 bg-[#fed386] text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                {characterId ? <AvatarDisplay characterId={characterId} className="h-full w-full" /> : <img src={companionIconSrc} alt="" className="w-full h-full object-cover object-top" />}
              </div>
              <div>
                <h3 className="font-black text-lg leading-none uppercase">{companionName}</h3>
                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1">{studyProfile ? `MODO ${studyProfile}` : 'Sempre focado por você'}</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} aria-label="Fechar conversa" className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 hover:bg-white/20 rounded-xl transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Área de Mensagens */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#FDFBF7] scroll-smooth">
            {chatHistory.length === 0 && (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 bg-[#fff6e8] text-[#fecc73] rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm font-medium px-8">"Oi! Esqueceu algum detalhe do estudo? Quer uma revisão rápida ou só um incentivo? Estou aqui!"</p>
              </div>
            )}

            {chatHistory.map((chat, idx) => (
              <div key={idx} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-[25px] text-sm font-medium shadow-sm leading-relaxed ${chat.role === 'user' ? 'bg-[#fed386] text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>{chat.text}</div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 p-4 rounded-[25px] rounded-tl-none shadow-sm flex gap-1">
                  <div className="w-2 h-2 bg-[#fed386] rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-2 h-2 bg-[#fed386] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-[#fed386] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Input do Chat */}
          <div className="p-4 bg-white border-t border-gray-100">
            <div className="relative flex items-center bg-gray-50 rounded-[25px] p-1 pr-2">
              <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder={`Pergunte ao ${companionName}...`} className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none font-medium" />
              <button onClick={handleSend} disabled={!message.trim() || isTyping} className="bg-[#fed386] text-white p-2.5 rounded-2xl hover:bg-[#fecc73] transition-all disabled:opacity-30 disabled:grayscale">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botão Flutuante (O Peixe / Personagem) */}
      {isOpen ? (
        <button onClick={() => setIsOpen(false)} aria-label="Fechar conversa" className="w-14 h-14 lg:w-16 lg:h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-500 hover:scale-110 active:scale-95 bg-[#473c33]">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : characterId ? (
        // Só o rosto do personagem (mesmo recorte do avatar do perfil): o corpo inteiro cobria botões e textos.
        <button onClick={() => setIsOpen(true)} aria-label={`Pergunte ao ${companionName}`} title={`Pergunte ao ${companionName}`} className="relative group h-14 w-14 lg:h-16 lg:w-16 rounded-full bg-[#fed386] shadow-xl border-2 border-white transition-transform duration-300 hover:scale-110 active:scale-95">
          <AvatarDisplay characterId={characterId} className="h-full w-full rounded-full" />
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#fff1e8] border-2 border-white rounded-full animate-pulse"></div>
        </button>
      ) : (
        <button onClick={() => setIsOpen(true)} className="w-20 h-20 rounded-[30px] shadow-2xl flex items-center justify-center transition-all duration-500 hover:scale-110 active:scale-95 group overflow-hidden bg-[#fed386] hover:bg-[#fecc73]">
          <div className="relative flex items-center justify-center w-full h-full">
            <img src={companionIconSrc} alt={`Pergunte ao ${companionName}`} className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-300" />
            <div className="absolute top-1 right-1 w-4 h-4 bg-[#fff1e8] border-2 border-white rounded-full animate-pulse"></div>
          </div>
        </button>
      )}
    </div>
  );
};

export default FishCompanion;
