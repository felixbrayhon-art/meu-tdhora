
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SocialState, FriendProfile, DirectMessage, UserStats, EditalConfig } from '../types';
import FishLogo from './FishLogo';

interface SocialModuleProps {
  socialState: SocialState;
  onUpdateSocial: (state: SocialState) => void;
  myStats: UserStats;
  editalConfig: EditalConfig;
  isStudyMode: boolean; // Based on timer activity
  onBack: () => void;
}

const SocialModule: React.FC<SocialModuleProps> = ({
  socialState,
  onUpdateSocial,
  myStats,
  editalConfig,
  isStudyMode,
  onBack
}) => {
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');
  const [friendIdInput, setFriendIdInput] = useState('');
  const [activeTab, setActiveTab] = useState<'FRIENDS' | 'CHAT' | 'FEED'>('FRIENDS');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [socialState.chats, activeFriendId]);

  const addFriend = () => {
    if (!friendIdInput.trim()) return;
    // Mock logic: adding a random friend for demo purposes or a specific ID
    const newFriend: FriendProfile = {
      id: friendIdInput,
      name: `Estudante_${friendIdInput.slice(0, 4)}`,
      avatarColor: '#' + Math.floor(Math.random()*16777215).toString(16),
      level: Math.floor(Math.random() * 5) + 1,
      xp: Math.floor(Math.random() * 1000),
      status: 'ONLINE',
      lastEditalProgress: { 'Direito': 40, 'Português': 75 },
    };

    onUpdateSocial({
      ...socialState,
      myFriends: [...socialState.myFriends, newFriend],
      chats: { ...socialState.chats, [newFriend.id]: [] }
    });
    setFriendIdInput('');
  };

  const sendMessage = () => {
    if (!msgInput.trim() || !activeFriendId || isStudyMode) return;

    const newMsg: DirectMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: socialState.myId,
      senderName: myStats.name,
      text: msgInput,
      timestamp: Date.now(),
    };

    onUpdateSocial({
      ...socialState,
      chats: {
        ...socialState.chats,
        [activeFriendId]: [...(socialState.chats[activeFriendId] || []), newMsg]
      }
    });
    setMsgInput('');
  };

  const nudgeFriend = (friendId: string) => {
    const friend = socialState.myFriends.find(f => f.id === friendId);
    if (!friend) return;

    const nudgeMsg: DirectMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: socialState.myId,
      senderName: myStats.name,
      text: "🐟 *CUTUCÃO DO PEIXE*! Ei, não esqueça da sua revisão de hoje!",
      timestamp: Date.now(),
    };

    onUpdateSocial({
      ...socialState,
      chats: {
        ...socialState.chats,
        [friendId]: [...(socialState.chats[friendId] || []), nudgeMsg]
      }
    });
    alert(`Você cutucou ${friend.name}!`);
  };

  const activeChat = activeFriendId ? socialState.chats[activeFriendId] || [] : [];
  const selectedFriend = socialState.myFriends.find(f => f.id === activeFriendId);

  return (
    <div className="max-w-6xl mx-auto py-10 px-6">
      <div className="flex justify-between items-center mb-12">
        <button onClick={onBack} className="text-gray-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          VOLTAR
        </button>
        <div className="text-right">
          <h2 className="text-3xl font-black italic tracking-tighter">MÓDULO SOCIAL</h2>
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">ID: {socialState.myId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[700px]">
        {/* Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-[40px] p-6 shadow-xl border border-gray-100 flex-1 overflow-hidden flex flex-col">
            <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
              <button onClick={() => setActiveTab('FRIENDS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'FRIENDS' ? 'bg-white text-[#0A0F1E] shadow-md' : 'text-gray-400'}`}>Amigos</button>
              <button onClick={() => setActiveTab('FEED')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'FEED' ? 'bg-white text-[#0A0F1E] shadow-md' : 'text-gray-400'}`}>Progresso</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
              {activeTab === 'FRIENDS' ? (
                <>
                  <div className="flex gap-2 mb-6">
                    <input 
                      type="text" 
                      value={friendIdInput}
                      onChange={(e) => setFriendIdInput(e.target.value)}
                      placeholder="ID do peixe..."
                      className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none border border-transparent focus:border-blue-500 transition-all"
                    />
                    <button onClick={addFriend} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                  {socialState.myFriends.map(f => (
                    <button 
                      key={f.id}
                      onClick={() => { setActiveFriendId(f.id); setActiveTab('CHAT'); }}
                      className={`w-full flex items-center gap-3 p-4 rounded-3xl transition-all ${activeFriendId === f.id ? 'bg-blue-50 border-blue-100 border' : 'hover:bg-gray-50 border border-transparent'}`}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center relative" style={{ backgroundColor: f.avatarColor }}>
                        <FishLogo iconOnly primaryColor="white" className="scale-50" />
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${f.status === 'STUDYING' ? 'bg-yellow-400 animate-pulse' : f.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-black text-[#0A0F1E] leading-none uppercase italic">{f.name}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Nível {f.level} • {f.status}</p>
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <div className="space-y-6">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">RADAR DE CONCURSEIROS</h3>
                  {socialState.myFriends.map(f => (
                    <div key={f.id} className="bg-gray-50 rounded-3xl p-5 border border-gray-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: f.avatarColor }}></div>
                        <span className="text-xs font-black italic">{f.name}</span>
                      </div>
                      <div className="space-y-3">
                        {Object.entries(f.lastEditalProgress).map(([sub, heat]) => (
                          <div key={sub}>
                             <div className="flex justify-between text-[8px] font-black uppercase tracking-widest mb-1">
                               <span>{sub}</span>
                               <span className="text-blue-600">{heat}%</span>
                             </div>
                             <div className="w-full bg-blue-100 h-1.5 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${heat}%` }}></div>
                             </div>
                          </div>
                        ))}
                      </div>
                      {f.status === 'OFFLINE' && (
                        <button 
                          onClick={() => nudgeFriend(f.id)}
                          className="w-full mt-4 bg-white border border-red-100 text-red-500 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-50 transition-colors"
                        >
                          CUTUCAR (REVISÃO ATRASADA)
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-8 flex flex-col bg-white rounded-[40px] shadow-2xl border border-gray-100 overflow-hidden relative">
          {isStudyMode && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-50 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500">
               <div className="w-20 h-20 bg-[#0A0F1E] rounded-3xl flex items-center justify-center text-white mb-6 shadow-2xl">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
               </div>
               <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-4">CHAT BLOQUEADO PARA ESTUDO</h3>
               <p className="text-gray-500 font-bold max-w-sm">Mergulho de foco ativo. O Peixe não deixa as bolhas sociais te distraírem agora. Termine seu bloco para conversar!</p>
            </div>
          )}

          {activeFriendId ? (
            <>
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl" style={{ backgroundColor: selectedFriend?.avatarColor }}></div>
                  <div>
                    <h3 className="text-xl font-black italic tracking-tight">{selectedFriend?.name}</h3>
                    <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">{selectedFriend?.status}</p>
                  </div>
                </div>
                <button onClick={() => nudgeFriend(activeFriendId)} className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all active:scale-90" title="Cutucar">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
                {activeChat.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300">
                    <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    <p className="text-xs font-black uppercase tracking-widest">Inicie uma conversa subaquática</p>
                  </div>
                )}
                {activeChat.map(m => (
                  <div key={m.id} className={`flex ${m.senderId === socialState.myId ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] p-4 rounded-[25px] ${m.senderId === socialState.myId ? 'bg-blue-600 text-white rounded-br-none shadow-xl shadow-blue-500/10' : 'bg-gray-100 text-[#0A0F1E] rounded-bl-none'}`}>
                      <p className="text-xs font-black mb-1">{m.senderName}</p>
                      <p className="text-sm font-medium leading-relaxed">{m.text}</p>
                      <p className={`text-[8px] mt-2 font-bold uppercase opacity-50 ${m.senderId === socialState.myId ? 'text-right' : 'text-left'}`}>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-gray-50/50">
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={msgInput}
                    onChange={(e) => setMsgInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Escreva algo brilhante..."
                    className="flex-1 bg-white border border-gray-100 rounded-[25px] px-6 py-4 text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button 
                    onClick={sendMessage}
                    className="bg-blue-600 text-white p-5 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all"
                  >
                    <svg className="w-6 h-6 rotate-45" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
               <div className="w-24 h-24 bg-gray-50 rounded-[35px] flex items-center justify-center text-blue-500 mb-8 border border-gray-100">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
               </div>
               <h3 className="text-3xl font-black italic tracking-tighter uppercase mb-4 text-[#0A0F1E]">CONECTE-SE AO CARDUME</h3>
               <p className="text-gray-400 font-bold max-w-sm mb-10 text-lg">Selecione um amigo para trocar estratégias ou cutuque quem está procrastinando!</p>
               <div className="flex gap-4">
                  <span className="px-6 py-2 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">Semanal: +1500 XP em dupla</span>
                  <span className="px-6 py-2 bg-yellow-50 text-yellow-600 rounded-full text-[10px] font-black uppercase tracking-widest">Ativos agora: 4</span>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SocialModule;
