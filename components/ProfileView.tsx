import React, { useEffect, useState } from 'react';
import { UserStats, StudyProfile, ExplanationStyle, getFishRank } from '../types';
import FishLogo from './FishLogo';
import AvatarBuilder from './AvatarBuilder';
import CharacterRevealScreen from './CharacterRevealScreen';
import { getCharacterSrc } from '../services/avatarService';
import { Zap } from './icons';
import { BackupSection } from './BackupControls';

interface ProfileViewProps {
  stats: UserStats;
  onUpdate: (stats: UserStats) => void;
  onBack: () => void;
  onOpenCatalog?: () => void;
  myId?: string;
  isAIEnabled: boolean;
  setIsAIEnabled: (val: boolean) => void;
  onLogout?: () => void;
  onLogin?: () => void;
  isLoggedIn?: boolean;
}

const AVATAR_OPTIONS = [
  { color: '#facc15', name: 'Peixe Amarelo' },
  { color: '#f97316', name: 'Peixe Laranja' },
  { color: '#3B82F6', name: 'Peixe Azul' },
  { color: '#8B5CF6', name: 'Peixe Roxo' },
  { color: '#473c33', name: 'Peixe Dark' },
];

const HERO_SCENARIO_OPTIONS: {
  id: NonNullable<UserStats['heroScenario']>;
  label: string;
}[] = [
  { id: 'quarto', label: 'Quarto' },
  { id: 'estudio', label: 'Estúdio' },
  { id: 'biblioteca', label: 'Biblioteca' },
  { id: 'quarto-3d', label: 'Quarto 3D' },
  { id: 'estudio-3d', label: 'Estúdio 3D' },
  { id: 'biblioteca-3d', label: 'Biblioteca 3D' },
  { id: 'solido', label: 'Cor Sólida' },
];

const HERO_TINT_OPTIONS: { color: string | null; name: string }[] = [
  { color: null, name: 'Padrão' },
  { color: '#facc15', name: 'Amarelo' },
  { color: '#f97316', name: 'Laranja' },
  { color: '#3B82F6', name: 'Azul' },
  { color: '#8B5CF6', name: 'Roxo' },
  { color: '#10B981', name: 'Verde' },
];

const ProfileView: React.FC<ProfileViewProps> = ({ stats, onUpdate, onBack, onOpenCatalog, myId, isAIEnabled, setIsAIEnabled, onLogout, onLogin, isLoggedIn }) => {
  const [name, setName] = useState(stats.name);
  const [selectedColor, setSelectedColor] = useState(stats.avatarColor);
  const [characterId, setCharacterId] = useState<string | undefined>(stats.characterId);
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [revealCharacterId, setRevealCharacterId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudyProfile>(stats.studyProfile || 'VESTIBULAR');
  const [explanationStyle, setExplanationStyle] = useState<ExplanationStyle>(stats.explanationStyle || 'TECNICA');
  const [aiProvider, setAiProvider] = useState<NonNullable<UserStats['aiProvider']>>(stats.aiProvider || 'auto');
  const [questionProfileStyle, setQuestionProfileStyle] = useState(stats.questionProfileStyle || '');
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(stats.fontSizeMultiplier || 1);
  const [heroScenario, setHeroScenario] = useState(stats.heroScenario || 'quarto');
  const [heroTintColor, setHeroTintColor] = useState(stats.heroTintColor);
  const [freeLLMAPIAvailable, setFreeLLMAPIAvailable] = useState(false);
  const localFreeLLMPreview = import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/freellmapi', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setFreeLLMAPIAvailable(data?.enabled === true))
      .catch(() => setFreeLLMAPIAvailable(false));
    return () => controller.abort();
  }, []);

  const currentRank = getFishRank(stats.totalDaysStudied);

  const handleSave = () => {
    onUpdate({
      ...stats,
      name,
      avatarColor: selectedColor,
      characterId,
      studyProfile: profile,
      explanationStyle,
      aiProvider,
      questionProfileStyle,
      fontSizeMultiplier,
      heroScenario,
      heroTintColor,
    });
    onBack();
  };

  return (
    <>
      <div className="max-w-4xl mx-auto py-10 animate-in fade-in slide-in-from-bottom-6 duration-500 px-4">
        <button onClick={onBack} className="min-h-[44px] mb-12 text-gray-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:text-gray-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
          </svg>
          VOLTAR AO HUB
        </button>

        <div className="bg-white rounded-[50px] shadow-2xl border border-gray-100 overflow-hidden">
          {/* Cabeçalho unificado: retrato, identidade e estatísticas reais */}
          <div className="bg-gradient-to-br from-[#473c33] to-[#141b30] dark:from-[#35362e] dark:to-[#24251f] text-white p-8 md:p-12 relative overflow-hidden">
            <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[#fed386]/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-[#fecc73]/10 blur-3xl" />

            <div className="relative z-10 flex flex-col items-center gap-8 md:flex-row">
              <button onClick={() => setShowAvatarBuilder(true)} className="group relative h-44 w-36 shrink-0 overflow-hidden rounded-[32px] border-4 border-white/10 bg-white/5 shadow-inner transition-transform hover:scale-[1.02]">
                {characterId ? (
                  <img src={getCharacterSrc(characterId)} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
                ) : (
                  <div className="flex h-full items-center justify-center" style={{ backgroundColor: selectedColor }}>
                    <FishLogo iconOnly primaryColor="white" className="scale-150" days={stats.totalDaysStudied} />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-[#473c33]/0 opacity-0 transition-colors group-hover:bg-[#473c33]/40 group-hover:opacity-100">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Editar</span>
                </div>
              </button>

              <div className="flex-1 text-center md:text-left">
                <h2 className="font-logo text-3xl uppercase">{name || 'Nadador'}</h2>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                  <span className="text-xs font-black uppercase text-[#fedda1]">{currentRank.label}</span>
                  {myId && <span className="rounded-full bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-gray-300">ID: {myId}</span>}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Nível</p>
                    <p className="text-xl font-black text-[#fed386]">{stats.level}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Moedas</p>
                    <p className="text-xl font-black text-white">{stats.coins}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Sequência</p>
                    <p className="text-xl font-black text-[#fdb887]">
                      {stats.streak}
                      <span className="text-xs">d</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Dias</p>
                    <p className="text-xl font-black text-[#fed386]">{stats.totalDaysStudied}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Formulário de edição */}
          <div className="space-y-10 p-8 md:p-12">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Nome do Nadador</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-50 border-2 border-transparent rounded-3xl px-6 py-4 text-xl font-bold focus:outline-none focus:border-[#fed386] transition-all shadow-sm" placeholder="Digite seu apelido..." />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Objetivo de Estudo</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button onClick={() => setProfile('VESTIBULAR')} className={`p-5 rounded-[22px] border-2 font-black text-[10px] uppercase tracking-widest transition-all ${profile === 'VESTIBULAR' ? 'bg-[#fecc73] border-[#fecc73] text-white shadow-lg' : 'bg-gray-50 border-transparent text-gray-400'}`}>
                  VESTIBULAR / ENEM
                </button>
                <button onClick={() => setProfile('FACULDADE')} className={`p-5 rounded-[22px] border-2 font-black text-[10px] uppercase tracking-widest transition-all ${profile === 'FACULDADE' ? 'bg-[#fec868] border-[#fec868] text-white shadow-lg' : 'bg-gray-50 border-transparent text-gray-400'}`}>
                  FACULDADE / SUPERIOR
                </button>
                <button onClick={() => setProfile('CONCURSO')} className={`p-5 rounded-[22px] border-2 font-black text-[10px] uppercase tracking-widest transition-all ${profile === 'CONCURSO' ? 'bg-[#473c33] border-[#473c33] text-white shadow-lg' : 'bg-gray-50 border-transparent text-gray-400'}`}>
                  CONCURSOS PÚBLICOS
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Cor do Peixe</label>
              <div className="grid grid-cols-5 gap-4">
                {AVATAR_OPTIONS.map((opt) => (
                  <button key={opt.color} onClick={() => setSelectedColor(opt.color)} aria-label={`Cor do avatar ${opt.color}`} aria-pressed={selectedColor === opt.color} className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${selectedColor === opt.color ? 'ring-4 ring-[#fed386] ring-offset-4 scale-110' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0'}`} style={{ backgroundColor: opt.color }}>
                    <FishLogo iconOnly primaryColor="white" className="scale-50" days={stats.totalDaysStudied} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Cenário do Painel</label>
              <div className="grid grid-cols-3 gap-4">
                {HERO_SCENARIO_OPTIONS.map((opt) => (
                  <button key={opt.id} onClick={() => setHeroScenario(opt.id)} className={`relative aspect-video overflow-hidden rounded-2xl transition-all ${heroScenario === opt.id ? 'ring-4 ring-[#fed386] ring-offset-2 scale-105' : 'opacity-70 hover:opacity-100'}`}>
                    {opt.id === 'solido' ? (
                      <div
                        className="absolute inset-0"
                        style={{
                          background: heroTintColor ? `linear-gradient(135deg, ${heroTintColor}, ${heroTintColor}cc)` : 'linear-gradient(135deg, #fde68a, #fb923c)',
                        }}
                      />
                    ) : (
                      <img src={`/hero-scenarios/${opt.id}.png`} alt={opt.label} className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-[#473c33]/50 py-1 text-[9px] font-black uppercase tracking-widest text-white">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Cor do Painel</label>
              <div className="grid grid-cols-6 gap-4">
                {HERO_TINT_OPTIONS.map((opt) => (
                  <button key={opt.name} onClick={() => setHeroTintColor(opt.color || undefined)} title={opt.name} className={`aspect-square rounded-2xl flex items-center justify-center transition-all border-2 ${heroTintColor === opt.color || (!heroTintColor && !opt.color) ? 'ring-4 ring-[#fed386] ring-offset-2 scale-110 border-transparent' : 'border-gray-100 opacity-70 hover:opacity-100'}`} style={{ backgroundColor: opt.color || '#E5E7EB' }}>
                    {!opt.color && <span className="text-xs font-black uppercase" style={{ color: '#473c33' }}>Padrão</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="group">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block group-hover:text-[#fecc73] transition-colors">ESTILO DO mapeamento da lógica (PROMPT)</label>
              <div className="relative">
                <textarea value={explanationStyle} onChange={(e) => setExplanationStyle(e.target.value)} placeholder="Ex: Explique como se eu fosse uma criança, use muitas analogias com esportes e termine com um bizu curto." className="w-full bg-gray-50 border-2 border-transparent focus:border-[#fecc73] focus:bg-white rounded-[30px] p-6 text-sm font-medium text-gray-600 outline-none transition-all min-h-[120px] resize-none shadow-inner" />
                <div className="absolute top-4 right-6 text-xl opacity-20 group-hover:opacity-100 transition-opacity">✨</div>
              </div>
              <p className="text-[9px] font-bold text-gray-300 mt-3 px-2 ">
                A IA usará este comando para construir todas as explicações das questões. <span className="text-[#fed386]">Dica: prompts mais diretos resultam em gerações mais rápidas.</span>
              </p>
            </div>

            <div className="group">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block group-hover:text-[#fecc73] transition-colors">PERFIL DAS QUESTÕES (PROMPT)</label>
              <div className="relative">
                <textarea value={questionProfileStyle} onChange={(e) => setQuestionProfileStyle(e.target.value)} placeholder="Ex: Quero questões focadas em casos práticos, com alternativas longas e difíceis." className="w-full bg-gray-50 border-2 border-transparent focus:border-[#fecc73] focus:bg-white rounded-[30px] p-6 text-sm font-medium text-gray-600 outline-none transition-all min-h-[120px] resize-none shadow-inner" />
                <div className="absolute top-4 right-6 text-xl opacity-20 group-hover:opacity-100 transition-opacity">❓</div>
              </div>
              <p className="text-[9px] font-bold text-gray-300 mt-3 px-2 ">A IA usará este comando para definir o perfil das questões geradas.</p>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Tamanho da Fonte (Acessibilidade)</label>
              <div className="flex gap-4">
                {[1, 1.25, 1.5].map((size) => (
                  <button key={size} onClick={() => setFontSizeMultiplier(size)} className={`flex-1 p-4 rounded-[20px] border-2 font-black text-xs uppercase transition-all ${fontSizeMultiplier === size ? 'bg-[#fecc73] border-[#fecc73] text-white shadow-lg' : 'bg-gray-50 border-transparent text-gray-400'}`}>
                    {size === 1 ? 'Normal' : size === 1.25 ? 'Grande' : 'Gigante'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Provedor de IA</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" aria-pressed={aiProvider === 'auto'} onClick={() => setAiProvider('auto')} className={`rounded-2xl border-2 p-4 text-left transition-all ${aiProvider === 'auto' ? 'border-[#e96f34] bg-[#fff6e8] shadow-md' : 'border-gray-100 bg-gray-50 hover:border-[#fed386]'}`}>
                  <span className="block text-xs font-black uppercase tracking-wide text-[#473c33]">Automático</span>
                  <span className="mt-1 block text-[10px] font-medium text-gray-500">Groq → FreeLLMAPI → OpenRouter → Gemini</span>
                </button>
                <button type="button" aria-pressed={aiProvider === 'groq'} onClick={() => setAiProvider('groq')} className={`rounded-2xl border-2 p-4 text-left transition-all ${aiProvider === 'groq' ? 'border-[#e96f34] bg-[#fff6e8] shadow-md' : 'border-gray-100 bg-gray-50 hover:border-[#fed386]'}`}>
                  <span className="block text-xs font-black uppercase tracking-wide text-[#473c33]">Groq</span>
                  <span className="mt-1 block text-[10px] font-medium text-gray-500">Hardware próprio, respostas rápidas</span>
                </button>
                <button type="button" aria-pressed={aiProvider === 'openrouter'} onClick={() => setAiProvider('openrouter')} className={`rounded-2xl border-2 p-4 text-left transition-all ${aiProvider === 'openrouter' ? 'border-[#e96f34] bg-[#fff6e8] shadow-md' : 'border-gray-100 bg-gray-50 hover:border-[#fed386]'}`}>
                  <span className="block text-xs font-black uppercase tracking-wide text-[#473c33]">OpenRouter</span>
                  <span className="mt-1 block text-[10px] font-medium text-gray-500">Pool de modelos gratuitos</span>
                </button>
                <button type="button" aria-pressed={aiProvider === 'gemini'} onClick={() => setAiProvider('gemini')} className={`rounded-2xl border-2 p-4 text-left transition-all ${aiProvider === 'gemini' ? 'border-[#e96f34] bg-[#fff6e8] shadow-md' : 'border-gray-100 bg-gray-50 hover:border-[#fed386]'}`}>
                  <span className="block text-xs font-black uppercase tracking-wide text-[#473c33]">Google Gemini</span>
                  <span className="mt-1 block text-[10px] font-medium text-gray-500">Google, usado por último no modo automático</span>
                </button>
                <button type="button" aria-pressed={aiProvider === 'freellmapi'} disabled={!freeLLMAPIAvailable || (!isLoggedIn && !localFreeLLMPreview)} onClick={() => setAiProvider('freellmapi')} className={`rounded-2xl border-2 p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${aiProvider === 'freellmapi' ? 'border-[#e96f34] bg-[#fff6e8] shadow-md' : 'border-gray-100 bg-gray-50 hover:border-[#fed386]'}`}>
                  <span className="block text-xs font-black uppercase tracking-wide text-[#473c33]">FreeLLMAPI</span>
                  <span className="mt-1 block text-[10px] font-medium text-gray-500">{!freeLLMAPIAvailable ? 'Aguardando configuração no servidor' : !isLoggedIn && localFreeLLMPreview ? 'Disponível nesta prévia local' : !isLoggedIn ? 'Entre com Google para usar' : 'Roteamento multi provedores'}</span>
                </button>
              </div>
              <p className="mt-3 text-[10px] font-medium text-gray-400">O provedor escolhido é tentado primeiro. Se estiver indisponível, o app tenta os outros na ordem Groq → FreeLLMAPI → OpenRouter → Gemini.</p>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block">Mentoria por IA</label>
              <div className="bg-[#fff6e8]/50 p-6 rounded-[30px] border border-[#fff0d5] flex items-center justify-between group hover:bg-[#fff6e8] transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isAIEnabled ? 'bg-[#fecc73] text-white shadow-lg' : 'bg-gray-200 text-gray-400'}`}>
                    <Zap className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-black text-sm uppercase tracking-tight">Cérebro Artificial</h4>
                    <p className="text-[10px] font-bold text-gray-400 leading-none">Insights dinâmicos e geração de conteúdo</p>
                  </div>
                </div>
                <button type="button" role="switch" aria-checked={isAIEnabled} aria-label="Mentoria por IA" onClick={() => setIsAIEnabled(!isAIEnabled)} className={`w-14 h-8 rounded-full relative transition-all duration-300 before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] ${isAIEnabled ? 'bg-[#fecc73]' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 ${isAIEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <BackupSection />

            <div className="pt-6">
              <button onClick={handleSave} className="w-full bg-[#e96f34] hover:bg-[#f07b40] text-white py-6 rounded-[30px] font-black text-xl shadow-xl shadow-[#e96f34]/30 hover:scale-[1.02] transition-all active:scale-95">
                SALVAR ALTERAÇÕES
              </button>
              {!isLoggedIn && onLogin && (
                <button onClick={onLogin} className="w-full mt-4 bg-white border-2 border-[#fed386] text-[#473c33] py-4 rounded-[25px] font-black text-[10px] uppercase tracking-widest hover:bg-[#fff6e8] transition-all">
                  ENTRAR COM O GOOGLE (SALVAR NA NUVEM)
                </button>
              )}
              {isLoggedIn && onLogout && (
                <button onClick={onLogout} className="w-full mt-4 border border-[#e8b8a8] bg-[#fff1ec] py-4 rounded-[25px] font-black text-[10px] uppercase tracking-widest text-[#a64b32] transition-all hover:border-[#df9278] hover:bg-[#ffe5db] dark:border-[#75463c] dark:bg-[#3d302a] dark:text-[#f1c5b4] dark:hover:bg-[#50372f]">
                  SAIR DESSA CONTA
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {showAvatarBuilder && (
        <AvatarBuilder
          initialCharacterId={characterId}
          onClose={() => setShowAvatarBuilder(false)}
          onSave={(newCharacterId: string) => {
            setShowAvatarBuilder(false);
            setRevealCharacterId(newCharacterId);
          }}
        />
      )}
      {revealCharacterId && (
        <CharacterRevealScreen
          characterId={revealCharacterId}
          onContinue={() => {
            setCharacterId(revealCharacterId);
            setRevealCharacterId(null);
            // Salva a escolha do personagem na hora — sem isso, ela só grava de
            // verdade se o usuário também clicar em "Salvar alterações" depois,
            // e some se ele voltar ao Hub antes disso.
            onUpdate({
              ...stats,
              name,
              avatarColor: selectedColor,
              characterId: revealCharacterId,
              studyProfile: profile,
              explanationStyle,
              aiProvider,
              questionProfileStyle,
              fontSizeMultiplier,
              heroScenario,
              heroTintColor,
            });
          }}
        />
      )}
    </>
  );
};

export default ProfileView;

