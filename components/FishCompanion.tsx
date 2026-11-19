import React, { useState, useRef, useEffect } from 'react';
import { chatWithFish, getMotivacao, EstiloMotivacao } from '../services/geminiService';
import { StudyProfile } from '../types';
import { getCharacterSrc, getCharacter } from '../services/avatarService';
import AvatarDisplay from './AvatarDisplay';
import VoxelAvatar, { POSES_ESCOLHIVEIS, VoxelPose } from './VoxelAvatar';
import CompanionWheel, { ItemRoda } from './CompanionWheel';
import { getVoxelConfig } from '../services/voxelCharacters';

interface FishCompanionProps {
  studyProfile?: StudyProfile;
  characterId?: string;
  /** A que altura do rodapé ele encosta, em rem. Cada tela tem a sua barra fixa
   *  embaixo, e ele precisa ficar acima dela para não cobrir nem ser coberto. */
  recuoRem?: number;
  /** A tela já mostra o tempo em algum lugar: a etiqueta dele não aparece. */
  tempoJaNaTela?: boolean;
  /** Estação de música tocando agora (a mesma da barra de ferramentas), ou null. */
  activeChannel?: 'RELAX' | 'MPB' | null;
  setActiveChannel?: (c: 'RELAX' | 'MPB' | null) => void;
  /** O cronômetro global está correndo agora. */
  timerAtivo?: boolean;
  onLigarTimer?: () => void;
  onPararTimer?: () => void;
  /** Muda de valor toda vez que o pomodoro chega ao fim sozinho. */
  timerTerminouEm?: number;
  /** Quanto falta, em segundos, para mostrar na etiqueta acima dele. */
  timerSegundos?: number;
  /** Duração do pomodoro, em minutos, e como mudá-la. */
  minutosPomodoro?: number;
  onAjustarMinutos?: (minutos: number) => void;
  /** Chuva de fundo e volume, que antes viviam na barra do Pomodoro. */
  isPlayingRain?: boolean;
  setIsPlayingRain?: (v: boolean) => void;
  audioVolume?: number;
  setAudioVolume?: (v: number) => void;
}

const ler = (chave: string): string => { try { return localStorage.getItem(chave) || ''; } catch { return ''; } };
const gravar = (chave: string, valor: string) => { try { localStorage.setItem(chave, valor); } catch { /* modo privado */ } };

const PERIODOS = [
  { ms: 0, nome: 'Não' },
  { ms: 3_600_000, nome: '1 hora' },
  { ms: 86_400_000, nome: '1 dia' },
  { ms: 604_800_000, nome: '1 semana' },
];

const FishCompanion: React.FC<FishCompanionProps> = ({ studyProfile, characterId, recuoRem = 1, tempoJaNaTela = false, activeChannel = null, setActiveChannel, timerAtivo = false, onLigarTimer, onPararTimer, timerTerminouEm = 0, timerSegundos = 0, minutosPomodoro = 25, onAjustarMinutos, isPlayingRain = false, setIsPlayingRain, audioVolume = 0.5, setAudioVolume }) => {
  const companionIconSrc = characterId ? getCharacterSrc(characterId, 'frente') : '/fish-companion-icon.jpg';
  const companionName = characterId ? getCharacter(characterId).name : 'Peixe Amigo';
  // Nem todo personagem tem receita em cubos ainda; quem não tem cai no avatar 2D.
  const temVoxel = !!getVoxelConfig(characterId);
  const [menuAberto, setMenuAberto] = useState(false);
  // Agora que a barra do Pomodoro saiu, editar a duração é aqui.
  const [painelTempo, setPainelTempo] = useState(false);
  const [painelSom, setPainelSom] = useState(false);
  const [painelMotivacao, setPainelMotivacao] = useState(false);
  const [painelAnimacao, setPainelAnimacao] = useState(false);
  // A escolha entre bíblica e filosófica fica gravada: é preferência, não
  // decisão para refazer a cada frase pedida.
  const [estiloMotivacao, setEstiloMotivacao] = useState<EstiloMotivacao>(() => {
    try { return localStorage.getItem('tdh_motivacao_estilo') === 'filosofica' ? 'filosofica' : 'biblica'; } catch { return 'biblica'; }
  });
  const [frase, setFrase] = useState<string | null>(null);
  const [buscandoFrase, setBuscandoFrase] = useState(false);
  // De quanto em quanto tempo ele traz uma frase sozinho. 0 = desligado.
  const [periodoMotivacao, setPeriodoMotivacao] = useState(() => {
    const v = Number(ler('tdh_motivacao_periodo'));
    return PERIODOS.some((p) => p.ms === v) && v > 0 ? v : 0;
  });
  const sumirFraseRef = useRef<number>(0);
  // 'aqui' -> 'despedindo' -> 'andando' -> 'fora'. Não guardamos em disco: recarregar traz ele de volta.
  // Agora ele aparece em todas as telas, entao "sair" precisa durar: quem nao
  // quer o companheiro teria de dispensa-lo a cada recarga.
  const [presenca, setPresenca] = useState<'aqui' | 'despedindo' | 'andando' | 'fora' | 'chegando'>(() => {
    try { return localStorage.getItem('tdh_companheiro_fora') === '1' ? 'fora' : 'aqui'; } catch { return 'aqui'; }
  });
  useEffect(() => {
    try { localStorage.setItem('tdh_companheiro_fora', presenca === 'fora' ? '1' : '0'); } catch { /* modo privado */ }
  }, [presenca]);
  const [cochilando, setCochilando] = useState(false);
  // Ele só está de fone depois de ir buscar: a música é consequência da ida, não o contrário.
  const [comFone, setComFone] = useState(false);
  // Ele só está com o despertador depois de ir buscar, como acontece com o fone.
  const [comRelogio, setComRelogio] = useState(false);
  // O despertador tocando no fim do pomodoro.
  const [alarme, setAlarme] = useState(false);
  // Por que ele saiu da tela: para ficar fora, para pegar o fone ou o relógio.
  const missaoRef = useRef<'sair' | 'fone' | 'relogio'>('sair');
  // A roda de opções não cabe encostada no canto, então, enquanto ela está
  // aberta, o companheiro inteiro desliza para o meio da tela e volta depois.
  const [desloc, setDesloc] = useState({ x: 0, y: 0, escala: 1 });
  // A animação que o aluno escolheu. Enquanto for a padrão, o cochilo automático
  // ainda vale; a partir do momento em que ele escolhe algo, a escolha manda.
  const [animacao, setAnimacao] = useState<VoxelPose>('estudando');
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mascoteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isTyping]);

  // Fecha o menu pelo Esc ou clicando fora dele. O clique no próprio boneco já
  // alterna, então ele fica de fora para não abrir e fechar na mesma batida.
  useEffect(() => {
    if (!menuAberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fecharTudo(); };
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!menuRef.current?.contains(alvo) && !mascoteRef.current?.contains(alvo)) fecharTudo();
    };
    window.addEventListener('keydown', tecla);
    window.addEventListener('pointerdown', fora);
    return () => {
      window.removeEventListener('keydown', tecla);
      window.removeEventListener('pointerdown', fora);
    };
  }, [menuAberto]);

  // Acena primeiro, depois sai andando. Sem a pausa a despedida não se lê.
  useEffect(() => {
    if (presenca !== 'despedindo') return;
    const t = setTimeout(() => setPresenca('andando'), 1500);
    return () => clearTimeout(t);
  }, [presenca]);

  // Depois de um tempo sem ninguém mexer, ele cochila. Qualquer toque acorda.
  useEffect(() => {
    if (presenca !== 'aqui' || isOpen || animacao !== 'estudando') { setCochilando(false); return; }
    let t = 0;
    const reiniciar = () => {
      setCochilando(false);
      clearTimeout(t);
      t = window.setTimeout(() => setCochilando(true), 90_000);
    };
    reiniciar();
    const eventos: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel'];
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    return () => {
      clearTimeout(t);
      eventos.forEach((e) => window.removeEventListener(e, reiniciar));
    };
  }, [presenca, isOpen, animacao]);

  // Se a música for desligada pela barra de ferramentas, o fone sai da cabeça
  // junto: ficar de fone em silêncio diria que ainda está tocando. Reagimos à
  // virada para o silêncio, e não a "está em silêncio": durante a ida buscar o
  // fone ainda não há canal nenhum, e ele tiraria o fone ao chegar.
  const canalAnteriorRef = useRef(activeChannel);
  useEffect(() => {
    const antes = canalAnteriorRef.current;
    canalAnteriorRef.current = activeChannel;
    if (antes && !activeChannel) setComFone(false);
  }, [activeChannel]);

  // Medimos o boneco no lugar dele e mandamos a diferença até o centro da tela:
  // animar `transform` não mexe no layout, animar `bottom`/`right` mexeria.
  const abrirRoda = () => {
    const r = mascoteRef.current?.getBoundingClientRect();
    const menor = Math.min(window.innerWidth, window.innerHeight);
    if (r) {
      setDesloc({
        x: Math.round(window.innerWidth / 2 - (r.left + r.width / 2)),
        y: Math.round(window.innerHeight / 2 - (r.top + r.height / 2)),
        escala: Math.min(1, (menor - 36) / 344),
      });
    }
    setMenuAberto(true);
  };

  // Parar e acabar são coisas diferentes, e as duas chegam aqui como "o timer
  // não está mais ativo". Por isso as duas moram no mesmo efeito: separadas,
  // uma apagaria o relógio antes de a outra conseguir tocar o alarme.
  // Reagimos à virada, e não a "está parado": durante a ida buscar o relógio
  // ele ainda não começou a correr.
  const timerAnteriorRef = useRef(timerAtivo);
  const fimAnteriorRef = useRef(timerTerminouEm);
  useEffect(() => {
    const parou = timerAnteriorRef.current && !timerAtivo;
    const acabou = timerTerminouEm !== fimAnteriorRef.current;
    timerAnteriorRef.current = timerAtivo;
    fimAnteriorRef.current = timerTerminouEm;
    if (acabou) {
      setAlarme(true);
      const t = setTimeout(() => { setAlarme(false); setComRelogio(false); }, 3200);
      return () => clearTimeout(t);
    }
    if (parou) setComRelogio(false);
  }, [timerAtivo, timerTerminouEm]);

  // Qual estação ele vai ligar ao voltar com o fone.
  const canalDesejadoRef = useRef<'RELAX' | 'MPB'>('RELAX');

  const ligarMusica = (canal: 'RELAX' | 'MPB' = 'RELAX') => {
    canalDesejadoRef.current = canal;
    // Já está de fone: trocar de estação não pede viagem nenhuma.
    if (comFone) { setActiveChannel?.(canal); return; }
    setMenuAberto(false);
    setPainelSom(false);
    missaoRef.current = 'fone';
    setPresenca('andando');
  };

  const escolherEstilo = (estilo: EstiloMotivacao) => {
    setEstiloMotivacao(estilo);
    try { localStorage.setItem('tdh_motivacao_estilo', estilo); } catch { /* modo privado */ }
  };

  const escolherPeriodo = (ms: number) => {
    setPeriodoMotivacao(ms);
    gravar('tdh_motivacao_periodo', String(ms));
    // Ao ligar, a conta começa agora: a primeira frase vem depois de um
    // período inteiro, não no instante em que a pessoa marcou a opção.
    if (ms) gravar('tdh_motivacao_ultima', String(Date.now()));
  };

  const pedirFrase = async (automatica = false) => {
    setPainelMotivacao(false);
    setMenuAberto(false);
    window.clearTimeout(sumirFraseRef.current);
    setFrase(null);
    setBuscandoFrase(true);
    try {
      setFrase(await getMotivacao(estiloMotivacao));
      // A que ele trouxe sozinho se recolhe: ninguém pediu, e um balão parado
      // no canto para sempre vira estorvo. A pedida fica até ser fechada.
      if (automatica) sumirFraseRef.current = window.setTimeout(() => setFrase(null), 45_000);
    } finally {
      setBuscandoFrase(false);
    }
  };

  // O relógio do modo automático. Guardamos a função numa ref para a contagem
  // não ser reiniciada toda vez que ele troca o estilo da frase.
  const pedirFraseRef = useRef(pedirFrase);
  pedirFraseRef.current = pedirFrase;
  useEffect(() => {
    if (!periodoMotivacao || presenca !== 'aqui') return;
    // Marca de tempo gravada, e não um setInterval do tamanho do período: para
    // um dia ou uma semana o cronômetro só dispararia se a aba ficasse aberta
    // esse tempo todo, e ninguém deixa. Assim a frase vence sozinha e aparece
    // na primeira vez que a pessoa abre o app depois do prazo.
    const checar = () => {
      const ultima = Number(ler('tdh_motivacao_ultima'));
      if (Date.now() - ultima < periodoMotivacao) return;
      gravar('tdh_motivacao_ultima', String(Date.now()));
      pedirFraseRef.current(true);
    };
    checar();
    const t = window.setInterval(checar, 60_000);
    return () => window.clearInterval(t);
  }, [periodoMotivacao, presenca]);

  const ligarTimer = () => {
    setMenuAberto(false);
    missaoRef.current = 'relogio';
    setPresenca('andando');
  };

  const pararTimer = () => {
    setMenuAberto(false);
    setAlarme(false);
    setComRelogio(false);
    onPararTimer?.();
  };

  const desligarMusica = () => {
    setMenuAberto(false);
    setComFone(false);
    setActiveChannel?.(null);
  };

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

  // Paleta terrosa do app: laranja para a ação principal, mostarda quando a
  // música está no ar, café para a animação escolhida e areia para o resto.
  const itensRoda: ItemRoda[] = [
    { id: 'falar', rotulo: `Falar com ${companionName}`, peso: 2, cor: '#e96f34', texto: '#fffaf4', acao: () => { setMenuAberto(false); setIsOpen(true); } },
    {
      id: 'som',
      rotulo: 'Som',
      cor: activeChannel || isPlayingRain ? '#D8A53A' : '#F4EBDD',
      texto: activeChannel || isPlayingRain ? '#3a2a1d' : '#6b5a49',
      acao: () => setPainelSom(true),
    },
    {
      id: 'cronometro',
      rotulo: timerAtivo ? 'Parar o cronômetro' : 'Ligar o cronômetro',
      cor: timerAtivo ? '#7D7A36' : '#F4EBDD',
      texto: timerAtivo ? '#f7f3ed' : '#6b5a49',
      acao: timerAtivo ? pararTimer : ligarTimer,
    },
    {
      id: 'motivacao',
      rotulo: 'Motivação',
      cor: '#8A9A7B',
      texto: '#fffaf4',
      acao: () => setPainelMotivacao(true),
    },
    {
      id: 'ajustar',
      rotulo: 'Ajustar o tempo',
      cor: '#F4EBDD',
      texto: '#6b5a49',
      acao: () => setPainelTempo(true),
    },
    {
      id: 'animacao',
      rotulo: 'Animação',
      cor: '#E8DDCC',
      texto: '#6b5a49',
      acao: () => setPainelAnimacao(true),
    },
    { id: 'sair', rotulo: 'Sair da tela', cor: '#8f8375', texto: '#fffaf4', acao: () => { setMenuAberto(false); missaoRef.current = 'sair'; setPresenca('despedindo'); } },
  ];
  const emCena = presenca === 'aqui' && !isOpen;
  const rodaAberta = menuAberto && !painelTempo && !painelSom && !painelMotivacao && !painelAnimacao && emCena;
  const painelAberto = painelTempo && emCena;
  const somAberto = painelSom && emCena;
  const motivacaoAberta = painelMotivacao && emCena;
  const animacaoAberta = painelAnimacao && emCena;
  const aberto = rodaAberta || painelAberto || somAberto || motivacaoAberta || animacaoAberta;
  const fecharTudo = () => { setMenuAberto(false); setPainelTempo(false); setPainelSom(false); setPainelMotivacao(false); setPainelAnimacao(false); };
  const faltam = `${Math.floor(timerSegundos / 60)}:${String(timerSegundos % 60).padStart(2, '0')}`;
  // A etiqueta aparece onde a tela ainda não mostra o tempo em lugar nenhum:
  // duas contagens na mesma tela só competem entre si. Em pé ela fica acima da cabeça dele, altura que
  // também cabe dentro do furo da roda — então não precisa sumir quando a roda abre.
  const mostrarTempo = timerAtivo && !tempoJaNaTela && presenca === 'aqui';

  return (
    <>
    {aberto && (
      /* Escurece o fundo porque o boneco sai do canto e passa por cima do
         conteúdo: sem isso a roda disputaria leitura com a tela inteira. */
      <div className="fixed inset-0 z-[55] bg-[#2a1f18]/40 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={fecharTudo} aria-hidden="true" />
    )}
    <div
      className="fixed right-3 lg:right-6 z-[60] flex flex-col items-end pointer-events-none [&>*]:pointer-events-auto motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"
      style={{
        bottom: `calc(${recuoRem}rem + env(safe-area-inset-bottom, 0px))`,
        transform: aberto ? `translate3d(${desloc.x}px, ${desloc.y}px, 0)` : undefined,
      }}
    >
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
              <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder={`Falar com ${companionName}...`} className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none font-medium" />
              <button onClick={handleSend} disabled={!message.trim() || isTyping} className="bg-[#fed386] text-white p-2.5 rounded-2xl hover:bg-[#fecc73] transition-all disabled:opacity-30 disabled:grayscale">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* O balão da frase: irmão do invólucro do boneco, não filho dele. Dentro,
          ele entraria na caixa que serve de centro para a roda e jogaria o anel
          para cima. Some quando o personagem não está em cena. */}
      {(frase || buscandoFrase) && !isOpen && presenca === 'aqui' && (
        <div role="status" className="mb-3 w-[min(78vw,270px)] animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="relative rounded-[26px] border border-[#e9e0d4] bg-[#fdfbf7] px-4 py-3 shadow-xl dark:border-white/10 dark:bg-[#2d2e27]">
            <button
              type="button"
              onClick={() => { setFrase(null); setBuscandoFrase(false); }}
              aria-label="Fechar a frase"
              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-[#e9e0d4] bg-[#fdfbf7] text-[#8f8375] shadow-md transition-colors hover:text-[#473c33] dark:border-white/10 dark:bg-[#2d2e27]"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <p className="mb-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-[#a79c8e]">
              {estiloMotivacao === 'biblica' ? 'Motivação bíblica' : 'Motivação filosófica'}
            </p>
            {buscandoFrase ? (
              <p className="flex items-center gap-1.5 text-sm font-bold text-[#8f8375]">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#e96f34]" style={{ animationDelay: '0s' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#e96f34]" style={{ animationDelay: '0.15s' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#e96f34]" style={{ animationDelay: '0.3s' }} />
              </p>
            ) : (
              <p className="text-[13px] font-semibold leading-snug text-[#473c33] dark:text-[#f2efd2]">{frase}</p>
            )}
            {/* Rabinho apontando para ele, no canto de baixo à direita. */}
            <span aria-hidden="true" className="absolute -bottom-[7px] right-9 h-3.5 w-3.5 rotate-45 border-b border-r border-[#e9e0d4] bg-[#fdfbf7] dark:border-white/10 dark:bg-[#2d2e27]" />
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
      ) : characterId && temVoxel ? (
        // O personagem inteiro, montado em cubos CSS. Fundo transparente e silhueta
        // estreita: ocupa menos que a arte 2D de corpo inteiro, que cobria botões.
        presenca === 'fora' ? (
          <button
            onClick={() => setPresenca('chegando')}
            aria-label={`Chamar ${companionName} de volta`}
            title={`Chamar ${companionName} de volta`}
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-[#fed386] text-lg shadow-lg transition-transform hover:scale-110 active:scale-95"
          >
            <span aria-hidden="true">🫱</span>
          </button>
        ) : (
          <div
            // Em tela estreita a roda encolhe, e o boneco tem de encolher junto,
            // senão ele cresce dentro do furo e encosta nas peças. A escala é no
            // grupo e em volta do próprio centro, que é o ponto já centralizado.
            className="relative flex flex-col items-end gap-2 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"
            style={{ transform: aberto && desloc.escala < 1 ? `scale(${desloc.escala})` : undefined }}
          >
            {rodaAberta && (
              /* A roda nasce centrada no boneco: o invólucro só contém o botão
                 dele, então `inset-0` já é a caixa do personagem. */
              <div ref={menuRef} className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <CompanionWheel itens={itensRoda} rotulo={`Opções de ${companionName}`} />
              </div>
            )}
            {animacaoAberta && (
              /* As seis animações saíram da roda para cá. Com elas lá dentro o
                 anel chegou a doze fatias, e aí o rótulo fica maior que o setor
                 e vaza por cima do vizinho. Em duas colunas ainda se lê. */
              <div ref={menuRef} role="dialog" aria-label="Animação" className="absolute left-1/2 top-1/2 z-20 w-[244px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[#e9e0d4] bg-[#fdfbf7] p-4 shadow-2xl dark:border-white/10 dark:bg-[#2d2e27]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a79c8e]">Animação</span>
                  <button type="button" onClick={() => setPainelAnimacao(false)} aria-label="Fechar" className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8f8375] transition-colors hover:bg-[#f0e8dc] dark:hover:bg-white/5">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                {/* Fica aberto depois de escolher: o painel cobre o boneco, mas
                    a pessoa costuma experimentar duas ou três até achar a que quer. */}
                <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Qual animação">
                  {POSES_ESCOLHIVEIS.map(({ pose, rotulo }) => (
                    <button
                      key={pose}
                      type="button"
                      role="radio"
                      aria-checked={animacao === pose}
                      onClick={() => setAnimacao(pose)}
                      className={`min-h-[42px] rounded-xl px-1 text-[10px] font-black uppercase tracking-wide transition-colors ${
                        animacao === pose ? 'bg-[#473c33] text-white' : 'bg-[#f0e8dc] text-[#8f8375] hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]'
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {motivacaoAberta && (
              <div ref={menuRef} role="dialog" aria-label="Motivação" className="absolute left-1/2 top-1/2 z-20 w-[244px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[#e9e0d4] bg-[#fdfbf7] p-4 shadow-2xl dark:border-white/10 dark:bg-[#2d2e27]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a79c8e]">Motivação</span>
                  <button type="button" onClick={() => setPainelMotivacao(false)} aria-label="Fechar" className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8f8375] transition-colors hover:bg-[#f0e8dc] dark:hover:bg-white/5">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-1.5">
                  {([['biblica', 'Bíblica'], ['filosofica', 'Filosófica']] as const).map(([id, nome]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={estiloMotivacao === id}
                      onClick={() => escolherEstilo(id)}
                      className={`min-h-[42px] rounded-xl px-1 text-[10px] font-black uppercase tracking-wide transition-colors ${
                        estiloMotivacao === id ? 'bg-[#473c33] text-white' : 'bg-[#f0e8dc] text-[#8f8375] hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]'
                      }`}
                    >
                      {nome}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => pedirFrase()}
                  className="mb-3 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#e96f34] px-4 text-xs font-black uppercase tracking-wide text-white shadow-[0_6px_14px_rgba(233,111,52,0.3)] transition-all hover:bg-[#d55f27] active:scale-95"
                >
                  Quero uma frase
                </button>
                <p className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.2em] text-[#a79c8e]">Modo automático</p>
                {/* Duas colunas, e não quatro: "1 semana" não cabe num quarto
                    de 244px sem virar abreviação que ninguém lê. */}
                <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="De quanto em quanto tempo">
                  {PERIODOS.map(({ ms, nome }) => (
                    <button
                      key={ms}
                      type="button"
                      role="radio"
                      aria-checked={periodoMotivacao === ms}
                      onClick={() => escolherPeriodo(ms)}
                      className={`min-h-[38px] rounded-xl text-[10px] font-black uppercase transition-colors ${
                        periodoMotivacao === ms ? 'bg-[#473c33] text-white' : 'bg-[#f0e8dc] text-[#8f8375] hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]'
                      }`}
                    >
                      {nome}
                    </button>
                  ))}
                </div>
                {periodoMotivacao > 0 && (
                  <p className="mt-2 text-center text-[9px] font-bold leading-snug text-[#a79c8e]">
                    Uma frase por {PERIODOS.find((p) => p.ms === periodoMotivacao)?.nome.replace('1 ', '')}, na primeira vez que você abrir o app depois do prazo.
                  </p>
                )}
              </div>
            )}
            {somAberto && (
              <div ref={menuRef} role="dialog" aria-label="Som" className="absolute left-1/2 top-1/2 z-20 w-[244px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[#e9e0d4] bg-[#fdfbf7] p-4 shadow-2xl dark:border-white/10 dark:bg-[#2d2e27]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a79c8e]">Som</span>
                  <button type="button" onClick={() => setPainelSom(false)} aria-label="Fechar" className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8f8375] transition-colors hover:bg-[#f0e8dc] dark:hover:bg-white/5">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                {/* Duas estações, que a barra antiga nem mostrava: ela só tinha a
                    Lofi, e a MPB ficava escondida no leitor do Drive. */}
                <div className="mb-2 grid grid-cols-2 gap-1.5">
                  {([['RELAX', 'Lofi'], ['MPB', 'MPB']] as const).map(([canal, nome]) => (
                    <button
                      key={canal}
                      type="button"
                      aria-pressed={activeChannel === canal}
                      onClick={() => (activeChannel === canal ? desligarMusica() : ligarMusica(canal))}
                      className={`min-h-[42px] rounded-xl text-[10px] font-black uppercase tracking-wide transition-colors ${
                        activeChannel === canal ? 'bg-[#473c33] text-white' : 'bg-[#f0e8dc] text-[#8f8375] hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]'
                      }`}
                    >
                      {nome}
                    </button>
                  ))}
                </div>
                {/* Tocar de novo na estação acesa já desligava, mas isso não se
                    lê em dois botões iguais: o desligar precisa estar escrito. */}
                {activeChannel && (
                  <button
                    type="button"
                    onClick={desligarMusica}
                    className="mb-2 flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#f0e8dc] text-[10px] font-black uppercase tracking-wide text-[#8f8375] transition-colors hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6" />
                    </svg>
                    Desligar a música
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={isPlayingRain}
                  onClick={() => setIsPlayingRain?.(!isPlayingRain)}
                  className={`mb-3 min-h-[42px] w-full rounded-xl text-[10px] font-black uppercase tracking-wide transition-colors ${
                    isPlayingRain ? 'bg-[#2E4A54] text-white' : 'bg-[#f0e8dc] text-[#8f8375] hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]'
                  }`}
                >
                  Chuva de fundo
                </button>
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-[#a79c8e]">Volume</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={audioVolume}
                    onChange={(e) => setAudioVolume?.(parseFloat(e.target.value))}
                    className="h-1.5 w-full accent-[#e96f34]"
                  />
                </label>
                {!activeChannel && !isPlayingRain && (
                  <p className="mt-2 text-center text-[9px] font-bold leading-snug text-[#a79c8e]">
                    Ele vai buscar o fone antes de a música começar.
                  </p>
                )}
              </div>
            )}
            {painelAberto && (
              /* Ocupa o mesmo lugar da roda, centrado no boneco — que fica
                 coberto enquanto isto está aberto. Mantive centrado em vez de
                 acima dele para não estourar o topo em tela curta: o painel
                 tem 230px e subi-lo inteiro deixaria 12px de folga num 640. */
              <div ref={menuRef} role="dialog" aria-label="Ajustar o tempo do cronômetro" className="absolute left-1/2 top-1/2 z-20 w-[244px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[#e9e0d4] bg-[#fdfbf7] p-4 shadow-2xl dark:border-white/10 dark:bg-[#2d2e27]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a79c8e]">Ajustar o tempo</span>
                  <button type="button" onClick={() => setPainelTempo(false)} aria-label="Fechar" className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8f8375] transition-colors hover:bg-[#f0e8dc] dark:hover:bg-white/5">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <button type="button" onClick={() => onAjustarMinutos?.(Math.max(1, minutosPomodoro - 5))} aria-label="Cinco minutos a menos" className="h-11 w-11 rounded-2xl bg-[#f0e8dc] text-lg font-black text-[#473c33] transition-colors hover:bg-[#e6dac8] dark:bg-white/5 dark:text-[#f2efd2]">−</button>
                  <div className="text-center leading-none">
                    <span className="block text-3xl font-black tabular-nums text-[#473c33] dark:text-[#f2efd2]">{minutosPomodoro}</span>
                    <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.18em] text-[#a79c8e]">minutos</span>
                  </div>
                  <button type="button" onClick={() => onAjustarMinutos?.(Math.min(180, minutosPomodoro + 5))} aria-label="Cinco minutos a mais" className="h-11 w-11 rounded-2xl bg-[#f0e8dc] text-lg font-black text-[#473c33] transition-colors hover:bg-[#e6dac8] dark:bg-white/5 dark:text-[#f2efd2]">+</button>
                </div>
                <div className="mb-3 grid grid-cols-4 gap-1.5">
                  {[15, 25, 45, 50].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onAjustarMinutos?.(m)}
                      aria-pressed={minutosPomodoro === m}
                      className={`min-h-[36px] rounded-xl text-[11px] font-black tabular-nums transition-colors ${
                        minutosPomodoro === m ? 'bg-[#473c33] text-white' : 'bg-[#f0e8dc] text-[#8f8375] hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setPainelTempo(false); setMenuAberto(false); if (timerAtivo) pararTimer(); else ligarTimer(); }}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#e96f34] px-4 text-xs font-black uppercase tracking-wide text-white shadow-[0_6px_14px_rgba(233,111,52,0.3)] transition-all hover:bg-[#d55f27] active:scale-95"
                >
                  {timerAtivo ? 'Parar agora' : 'Começar agora'}
                </button>
                {!timerAtivo && (
                  <p className="mt-2 text-center text-[9px] font-bold leading-snug text-[#a79c8e]">
                    Ele vai buscar o relógio antes de começar.
                  </p>
                )}
              </div>
            )}
            {mostrarTempo && (
              <span className="pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#473c33] px-2.5 py-1 text-[11px] font-black tabular-nums leading-none text-[#f7f3ed] shadow-lg">
                {faltam}
              </span>
            )}
            <button
              ref={mascoteRef}
              onClick={() => { if (presenca !== 'aqui') return; if (menuAberto) fecharTudo(); else abrirRoda(); }}
              aria-label={menuAberto ? 'Fechar as opções' : `Opções de ${companionName}`}
              aria-expanded={menuAberto}
              aria-haspopup="menu"
              title={menuAberto ? 'Fechar' : companionName}
              // z-10: o boneco fica no miolo da roda e também é o botão de fechar.
              className="relative z-10 transition-transform duration-300 hover:scale-105 active:scale-95"
            >
              <VoxelAvatar
                characterId={characterId}
                altura={132}
                pose={presenca === 'despedindo' ? 'tchau' : presenca === 'andando' ? 'andando' : presenca === 'chegando' ? 'voltando' : cochilando ? 'dormindo' : animacao}
                fone={comFone}
                cronometro={comRelogio}
                alarme={alarme}
                onSaiuDaTela={() => {
                  // Foi buscar o fone: nos bastidores ele coloca e já volta andando,
                  // então não passa pelo estado 'fora' nem pede para ser chamado.
                  if (missaoRef.current === 'fone') { setComFone(true); setPresenca('chegando'); }
                  else if (missaoRef.current === 'relogio') { setComRelogio(true); setPresenca('chegando'); }
                  else setPresenca('fora');
                }}
                onChegou={() => {
                  setPresenca('aqui');
                  if (missaoRef.current === 'fone') { missaoRef.current = 'sair'; setActiveChannel?.(canalDesejadoRef.current); }
                  else if (missaoRef.current === 'relogio') { missaoRef.current = 'sair'; onLigarTimer?.(); }
                }}
              />
            </button>
          </div>
        )
      ) : characterId ? (
        <button onClick={() => setIsOpen(true)} aria-label={`Falar com ${companionName}`} title={`Falar com ${companionName}`} className="relative group h-14 w-14 lg:h-16 lg:w-16 rounded-full bg-[#fed386] shadow-xl border-2 border-white transition-transform duration-300 hover:scale-110 active:scale-95">
          <AvatarDisplay characterId={characterId} className="h-full w-full rounded-full" />
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#fff1e8] border-2 border-white rounded-full animate-pulse"></div>
        </button>
      ) : (
        <button onClick={() => setIsOpen(true)} className="w-20 h-20 rounded-[30px] shadow-2xl flex items-center justify-center transition-all duration-500 hover:scale-110 active:scale-95 group overflow-hidden bg-[#fed386] hover:bg-[#fecc73]">
          <div className="relative flex items-center justify-center w-full h-full">
            <img src={companionIconSrc} alt={`Falar com ${companionName}`} className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-300" />
            <div className="absolute top-1 right-1 w-4 h-4 bg-[#fff1e8] border-2 border-white rounded-full animate-pulse"></div>
          </div>
        </button>
      )}
    </div>
    </>
  );
};

export default FishCompanion;
