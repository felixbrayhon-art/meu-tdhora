import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FriendProfile, FriendRequest, DirectMessage, UserStats } from '../types';
import FishLogo from './FishLogo';
import {
  ensureFriendCode, lookupUserByCode, sendFriendRequest, respondFriendRequest, cancelFriendRequest,
  removeFriend, listenFriendRequests, listenFriends, listenMessages, sendMessage as sendMessageToFirestore, pairId,
} from '../services/socialService';

interface SocialModuleProps {
  myUid?: string;
  myStats: UserStats;
  isLoggedIn: boolean;
  onLogin: () => void;
  isStudyMode: boolean; // Based on timer activity
  onBack: () => void;
}

const SocialModule: React.FC<SocialModuleProps> = ({
  myUid,
  myStats,
  isLoggedIn,
  onLogin,
  isStudyMode,
  onBack
}) => {
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [addFriendStatus, setAddFriendStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'FRIENDS' | 'CHAT' | 'FEED'>('FRIENDS');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!myUid) return;
    ensureFriendCode(myUid).then(setFriendCode).catch(() => setFriendCode(null));
  }, [myUid]);

  useEffect(() => {
    if (!myUid) return;
    const unsubFriends = listenFriends(myUid, setFriends);
    const unsubIncoming = listenFriendRequests(myUid, 'incoming', setIncomingRequests);
    const unsubOutgoing = listenFriendRequests(myUid, 'outgoing', setOutgoingRequests);
    return () => { unsubFriends(); unsubIncoming(); unsubOutgoing(); };
  }, [myUid]);

  useEffect(() => {
    if (!myUid || !activeFriendId) { setMessages([]); return; }
    const chatId = pairId(myUid, activeFriendId);
    return listenMessages(chatId, setMessages);
  }, [myUid, activeFriendId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAddFriend = useCallback(async () => {
    if (!myUid || !codeInput.trim()) return;
    setAddFriendStatus('Procurando...');
    try {
      const found = await lookupUserByCode(codeInput);
      if (!found) { setAddFriendStatus('Código não encontrado.'); return; }
      if (found.uid === myUid) { setAddFriendStatus('Esse código é o seu!'); return; }
      if (friends.some(f => f.id === found.uid)) { setAddFriendStatus('Vocês já são amigos!'); return; }
      if (outgoingRequests.some(r => r.toUid === found.uid)) { setAddFriendStatus('Pedido já enviado.'); return; }
      await sendFriendRequest(myUid, myStats.name, myStats.avatarColor, found.uid);
      setAddFriendStatus(`Pedido enviado para ${found.name}!`);
      setCodeInput('');
    } catch {
      setAddFriendStatus('Não foi possível enviar o pedido.');
    }
  }, [myUid, codeInput, friends, outgoingRequests, myStats.name, myStats.avatarColor]);

  const handleRespond = useCallback((request: FriendRequest, accept: boolean) => {
    if (!myUid) return;
    respondFriendRequest(request, myUid, accept).catch(() => {});
  }, [myUid]);

  const handleSend = useCallback(() => {
    if (!myUid || !activeFriendId || !msgInput.trim() || isStudyMode) return;
    const chatId = pairId(myUid, activeFriendId);
    sendMessageToFirestore(chatId, myUid, myStats.name, msgInput).catch(() => {});
    setMsgInput('');
  }, [myUid, activeFriendId, msgInput, isStudyMode, myStats.name]);

  const nudgeFriend = useCallback((friendId: string) => {
    if (!myUid) return;
    const friend = friends.find(f => f.id === friendId);
    if (!friend) return;
    const chatId = pairId(myUid, friendId);
    sendMessageToFirestore(chatId, myUid, myStats.name, "🐟 *CUTUCÃO DO PEIXE*! Ei, não esqueça da sua revisão de hoje!").catch(() => {});
  }, [myUid, friends, myStats.name]);

  const selectedFriend = friends.find(f => f.id === activeFriendId);

  if (!isLoggedIn) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-6 text-center">
        <div className="w-24 h-24 bg-gray-50 rounded-[35px] flex items-center justify-center text-blue-500 mb-8 border border-gray-100 mx-auto">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
        </div>
        <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-4">Faça login para conversar com amigos</h3>
        <p className="text-gray-400 font-bold max-w-sm mx-auto mb-8">O chat com amigos precisa da sua conta salva na nuvem, para que seus amigos consigam te encontrar.</p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={onLogin} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-colors">
            Entrar com Google
          </button>
          <button onClick={onBack} className="text-gray-400 font-bold text-xs uppercase tracking-widest">Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-6">
      <div className="flex justify-between items-center mb-12">
        <button onClick={onBack} className="text-gray-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          VOLTAR
        </button>
        <div className="text-right">
          <h2 className="text-3xl font-black italic tracking-tighter">MÓDULO SOCIAL</h2>
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">SEU CÓDIGO: {friendCode ?? '...'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[700px]">
        {/* Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-[40px] p-6 shadow-xl border border-gray-100 flex-1 overflow-hidden flex flex-col">
            <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
              <button onClick={() => setActiveTab('FRIENDS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'FRIENDS' ? 'bg-white text-[#0A0F1E] shadow-md' : 'text-gray-400'}`}>Amigos</button>
              <button onClick={() => setActiveTab('FEED')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'FEED' ? 'bg-white text-[#0A0F1E] shadow-md' : 'text-gray-400'}`}>
                Pedidos
                {incomingRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center">{incomingRequests.length}</span>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
              {activeTab === 'FRIENDS' ? (
                <>
                  <div className="mb-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={codeInput}
                        onChange={(e) => { setCodeInput(e.target.value); setAddFriendStatus(null); }}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddFriend()}
                        placeholder="Código do amigo..."
                        maxLength={6}
                        className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-xs font-bold uppercase focus:outline-none border border-transparent focus:border-blue-500 transition-all"
                      />
                      <button onClick={handleAddFriend} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                      </button>
                    </div>
                    {addFriendStatus && <p className="text-[10px] font-bold text-gray-400 mt-2 px-1">{addFriendStatus}</p>}
                  </div>
                  {friends.length === 0 && (
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest text-center py-8">Adicione um amigo pelo código dele</p>
                  )}
                  {friends.map(f => (
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
                  <div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2 mb-3">RECEBIDOS</h3>
                    {incomingRequests.length === 0 && <p className="text-[10px] font-bold text-gray-300 px-2">Nenhum pedido pendente.</p>}
                    <div className="space-y-3">
                      {incomingRequests.map(r => (
                        <div key={r.id} className="bg-gray-50 rounded-3xl p-4 border border-gray-100 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: r.fromAvatarColor }}></div>
                          <span className="text-xs font-black italic flex-1">{r.fromName}</span>
                          <button onClick={() => handleRespond(r, true)} className="bg-green-500 text-white text-[9px] font-black uppercase px-3 py-2 rounded-xl">Aceitar</button>
                          <button onClick={() => handleRespond(r, false)} className="bg-gray-200 text-gray-500 text-[9px] font-black uppercase px-3 py-2 rounded-xl">Recusar</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2 mb-3">ENVIADOS</h3>
                    {outgoingRequests.length === 0 && <p className="text-[10px] font-bold text-gray-300 px-2">Nenhum pedido enviado.</p>}
                    <div className="space-y-3">
                      {outgoingRequests.map(r => (
                        <div key={r.id} className="bg-gray-50 rounded-3xl p-4 border border-gray-100 flex items-center gap-3">
                          <span className="text-xs font-black text-gray-400 flex-1">Aguardando resposta...</span>
                          <button onClick={() => cancelFriendRequest(r.id)} className="bg-gray-200 text-gray-500 text-[9px] font-black uppercase px-3 py-2 rounded-xl">Cancelar</button>
                        </div>
                      ))}
                    </div>
                  </div>
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

          {activeFriendId && selectedFriend ? (
            <>
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl" style={{ backgroundColor: selectedFriend.avatarColor }}></div>
                  <div>
                    <h3 className="text-xl font-black italic tracking-tight">{selectedFriend.name}</h3>
                    <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">{selectedFriend.status}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => nudgeFriend(activeFriendId)} className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all active:scale-90" title="Cutucar">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </button>
                  <button
                    onClick={() => { removeFriend(pairId(myUid!, activeFriendId)).catch(() => {}); setActiveFriendId(null); }}
                    className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 transition-all active:scale-90"
                    title="Desfazer amizade"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300">
                    <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    <p className="text-xs font-black uppercase tracking-widest">Inicie uma conversa subaquática</p>
                  </div>
                )}
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.senderId === myUid ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] p-4 rounded-[25px] ${m.senderId === myUid ? 'bg-blue-600 text-white rounded-br-none shadow-xl shadow-blue-500/10' : 'bg-gray-100 text-[#0A0F1E] rounded-bl-none'}`}>
                      <p className="text-xs font-black mb-1">{m.senderName}</p>
                      <p className="text-sm font-medium leading-relaxed">{m.text}</p>
                      <p className={`text-[8px] mt-2 font-bold uppercase opacity-50 ${m.senderId === myUid ? 'text-right' : 'text-left'}`}>
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
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Escreva algo brilhante..."
                    className="flex-1 bg-white border border-gray-100 rounded-[25px] px-6 py-4 text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    onClick={handleSend}
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
               <p className="text-gray-400 font-bold max-w-sm mb-10 text-lg">Compartilhe seu código com um amigo, ou adicione o código dele, para trocar estratégias!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SocialModule;
