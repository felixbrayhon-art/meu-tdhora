import React, { useEffect, useRef } from 'react';
import { AppView, HubCategory } from '../types';
import { FileText, Layers, Zap, Brain, Scale, BookOpen, BarChart3, ClipboardList, Clock, Smile, Heart, ScrollText } from './icons';

// Barra de ferramentas que fica sempre visível, logo abaixo do cabeçalho. Antes a tela
// inicial era um cardápio de cards que só levavam para telas que a barra lateral já abria;
// agora cada aba daqui abre a ferramenta ocupando a tela, uma por vez.
//
// A lista é rolável de propósito: são mais de quinze ferramentas no app e só cabem umas
// sete na largura de um celular. Aqui ficam as de uso diário; o resto continua na lateral.
type Aba = { chave: string; label: string; icon: typeof Zap; view: AppView; categoria?: HubCategory };

// Barra unica: as ferramentas e as secoes do painel ficam lado a lado aqui. Antes havia duas
// barras empilhadas — esta e a de categorias dentro do Hub — e uma grade de cards que so
// repetia a barra lateral. A primeira aba e a Aula Direta: e onde o app abre.
const TABS: Aba[] = [
  { chave: 'AI_DIRECT', label: 'Aula Direta', icon: Zap, view: 'AI_DIRECT' },
  { chave: 'GUIDED_LESSON', label: 'Aula Guiada', icon: BookOpen, view: 'GUIDED_LESSON' },
  { chave: 'LIVING_LESSON', label: 'Aula Viva', icon: ScrollText, view: 'LIVING_LESSON' },
  { chave: 'TDH_QUESTOES', label: 'TDHQuestões', icon: FileText, view: 'TDH_QUESTOES' },
  { chave: 'FLASHCARDS', label: 'Flashcards', icon: Layers, view: 'FLASHCARDS' },
  { chave: 'SMART_REVISION', label: 'Revisão IA', icon: Brain, view: 'SMART_REVISION' },
  { chave: 'VADE_MECUM', label: 'Vade Mecum', icon: Scale, view: 'VADE_MECUM' },
  { chave: 'MATERIALS', label: 'Materiais', icon: ClipboardList, view: 'MATERIALS' },
  { chave: 'HUB_EDITAL', label: 'Edital', icon: ClipboardList, view: 'HUB', categoria: 'EDITAL' },
  { chave: 'HUB_ORGANIZACAO', label: 'Organização', icon: Clock, view: 'HUB', categoria: 'ORGANIZACAO' },
  { chave: 'HUB_RELAXE', label: 'Relaxe', icon: Smile, view: 'HUB', categoria: 'RELAXE' },
  { chave: 'HUB_MOTIVACAO', label: 'Motivação', icon: Heart, view: 'HUB', categoria: 'MOTIVACAO' },
  { chave: 'PERFORMANCE', label: 'Desempenho', icon: BarChart3, view: 'PERFORMANCE' },
  { chave: 'MASCOTE', label: 'Meu Mascote', icon: Smile, view: 'MASCOTE' },
];

interface ToolTabsProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  hubCategory: HubCategory;
  setHubCategory: (c: HubCategory) => void;
  pendingRevisions?: number;
  pendingFlashcards?: number;
}

const ToolTabs: React.FC<ToolTabsProps> = ({ currentView, setView, hubCategory, setHubCategory, pendingRevisions = 0, pendingFlashcards = 0 }) => {
  const barra = useRef<HTMLDivElement>(null);

  // Numa tela estreita a aba ativa pode estar fora de vista depois de uma troca pela
  // lateral ou por um link. Traz ela para dentro sem arrastar a página junto.
  useEffect(() => {
    const ativo = barra.current?.querySelector('[data-ativo="sim"]') as HTMLElement | null;
    ativo?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [currentView, hubCategory]);

  const contagem = (aba: Aba) =>
    aba.view === 'SMART_REVISION' ? pendingRevisions : aba.view === 'FLASHCARDS' ? pendingFlashcards : 0;

  return (
    <nav aria-label="Ferramentas" className="border-b border-[#e9e0d4] bg-[#fdfbf7] dark:border-white/10 dark:bg-[#1c1712]">
      <div
        ref={barra}
        className="mx-auto flex max-w-[1760px] gap-1 overflow-x-auto px-3 py-2 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((aba) => {
          const { chave, label, icon: Icone, view, categoria } = aba;
          const ativo = currentView === view && (!categoria || hubCategory === categoria);
          const pendentes = contagem(aba);
          return (
            <button
              key={chave}
              type="button"
              data-ativo={ativo ? 'sim' : 'nao'}
              aria-current={ativo ? 'page' : undefined}
              onClick={() => { if (categoria) setHubCategory(categoria); setView(view); }}
              className={`relative flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e96f34] ${
                ativo
                  ? 'bg-[#473c33] text-white shadow-md dark:bg-[#d9772b] dark:shadow-none'
                  : 'text-[#8f8375] hover:bg-[#f7f3ed] hover:text-[#473c33] dark:text-[#a89680] dark:hover:bg-[#3a2f22] dark:hover:text-[#f4ebdd]'
              }`}
            >
              <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
              {pendentes > 0 && (
                <span className="ml-0.5 rounded-full bg-[#e24b4a] px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
                  {pendentes > 99 ? '99+' : pendentes}
                  <span className="sr-only"> pendentes</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default ToolTabs;
