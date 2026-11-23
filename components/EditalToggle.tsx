import React from 'react';
import { EditalConfig, StudyProfile } from '../types';

// "Do meu edital" ou "Tema livre", nas ferramentas do dia a dia (Aula Direta, TDHQuestões, Flashcards,
// Cronômetro).
//
// Por que é preciso estar na tela: o modo edital já foi uma chave invisível, que ligava só quando o aluno
// entrava por um card da aba Edital do Hub e desligava em todo "voltar". A mesma tela mudava de cara sem
// nada explicando, e cadastrar o edital não bastava para ele valer. Agora a escolha é do aluno, está à
// vista, e quem não quer estudar pelo edital naquele momento desliga ali mesmo.
//
// Some quando não há edital ativo: sem matéria cadastrada não há escolha a fazer.

interface EditalToggleProps {
  editalConfig?: EditalConfig;
  modoEdital: boolean;
  onModoEdital?: (ligado: boolean) => void;
  studyProfile?: StudyProfile;
  /** 'escuro' para fundos escuros (o modal de flashcards com IA), onde o marrom do botão ativo sumiria. */
  tom?: 'claro' | 'escuro';
  className?: string;
}

const EditalToggle: React.FC<EditalToggleProps> = ({ editalConfig, modoEdital, onModoEdital, studyProfile, tom = 'claro', className = '' }) => {
  if (!onModoEdital || !editalConfig?.isActive || !editalConfig.subjects?.length) return null;

  const nomeDoPlano = studyProfile === 'FACULDADE' ? 'Da minha grade' : 'Do meu edital';
  const opcoes: { ligado: boolean; rotulo: string }[] = [
    { ligado: true, rotulo: nomeDoPlano },
    { ligado: false, rotulo: 'Tema livre' },
  ];

  const ativo = tom === 'escuro' ? 'bg-[#fecc73] text-[#473c33]' : 'bg-[#473c33] text-white dark:bg-[#fecc73] dark:text-[#2d2e27]';
  const inativo = tom === 'escuro'
    ? 'bg-white/10 text-[#e4d4bd] hover:bg-white/20'
    : 'bg-[#f0e8dc] text-[#8f8375] hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} role="group" aria-label="De onde vem o assunto">
      {opcoes.map(({ ligado, rotulo }) => (
        <button
          key={rotulo}
          type="button"
          aria-pressed={modoEdital === ligado}
          onClick={() => onModoEdital(ligado)}
          className={`min-h-[40px] rounded-2xl px-4 text-[10px] font-black uppercase tracking-widest transition-colors ${
            modoEdital === ligado ? ativo : inativo
          }`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
};

export default EditalToggle;
