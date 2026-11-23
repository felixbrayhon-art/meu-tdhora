import React from 'react';
import { EditalConfig, StudyProfile } from '../types';
import EditalToggle from './EditalToggle';

// Matéria + assunto, do edital ou de tema livre — o par de campos que abre a Aula Guiada e a Aula Viva.
//
// Antes as duas telas só tinham campo de texto: quem cadastrou o edital tinha que digitar de novo o nome da
// matéria e do assunto que já estavam registrados, e errar uma letra significava pedir aula de outro tema.
// Com o `EditalToggle` em cima, "Do meu edital" troca os dois campos por listas do que o aluno cadastrou, e
// "Tema livre" devolve a digitação para quando ele quiser estudar algo de fora.
//
// O componente é um só, usado pelas duas telas, para as duas não saírem do mesmo lugar e divergirem depois.

interface EscolhaAssuntoProps {
  editalConfig?: EditalConfig;
  modoEdital: boolean;
  onModoEdital?: (ligado: boolean) => void;
  studyProfile?: StudyProfile;
  materia: string;
  assunto: string;
  onMateria: (valor: string) => void;
  onAssunto: (valor: string) => void;
  /** Enter no campo de assunto. */
  onEnter?: () => void;
  /** Classes dos campos, para cada tela manter sua moldura. */
  campo?: string;
  rotulo?: string;
}

const EscolhaAssunto: React.FC<EscolhaAssuntoProps> = ({
  editalConfig,
  modoEdital,
  onModoEdital,
  studyProfile,
  materia,
  assunto,
  onMateria,
  onAssunto,
  onEnter,
  campo = 'w-full rounded-2xl border border-[#e3d9ca] bg-[#fdfbf7] px-4 py-4 text-sm font-semibold text-[#473c33] outline-none transition-all placeholder:text-[#b7ac9e] focus:border-[#f5b84b] focus:ring-4 focus:ring-[#f5b84b]/15',
  rotulo = 'mb-2 block text-[10px] font-black uppercase tracking-widest text-[#725442]',
}) => {
  const materias = editalConfig?.isActive ? editalConfig.subjects ?? [] : [];
  const peloEdital = modoEdital && materias.length > 0;

  // Trocar de modo não pode deixar um resto de outro modo no formulário: o que foi digitado à mão quase
  // nunca é igual ao nome cadastrado, e o `select` ficaria em branco com a matéria antiga ainda valendo.
  const trocarModo = (ligado: boolean) => {
    if (ligado !== modoEdital) {
      onMateria('');
      onAssunto('');
    }
    onModoEdital?.(ligado);
  };

  return (
    <div className="space-y-5">
      <EditalToggle
        editalConfig={editalConfig}
        modoEdital={modoEdital}
        onModoEdital={onModoEdital ? trocarModo : undefined}
        studyProfile={studyProfile}
      />

      {peloEdital ? (
        <>
          <label className="block">
            <span className={rotulo}>{studyProfile === 'FACULDADE' ? 'Disciplina da grade' : 'Matéria do edital'}</span>
            <select
              value={materia}
              onChange={(e) => {
                onMateria(e.target.value);
                onAssunto('');
              }}
              className={`${campo} appearance-none cursor-pointer`}
            >
              <option value="">Selecionar matéria...</option>
              {materias.map((s, i) => (
                <option key={i} value={s.name}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={rotulo}>Assunto do edital</span>
            <select
              value={assunto}
              onChange={(e) => onAssunto(e.target.value)}
              disabled={!materia}
              className={`${campo} appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <option value="">Selecionar assunto...</option>
              {materias.find((s) => s.name === materia)?.topics?.map((t, i) => (
                <option key={i} value={t}>{t}</option>
              ))}
            </select>
            {materia && !materias.find((s) => s.name === materia)?.topics?.length && (
              <span className="mt-2 block text-[10px] font-medium text-[#a79c8e]">
                Essa matéria ainda não tem assuntos cadastrados no edital. Use "Tema livre" ou cadastre o conteúdo dela.
              </span>
            )}
          </label>
        </>
      ) : (
        <>
          <label className="block">
            <span className={rotulo}>Matéria</span>
            <input
              value={materia}
              onChange={(e) => onMateria(e.target.value)}
              placeholder="Ex.: Direito Constitucional"
              autoFocus
              className={campo}
            />
          </label>
          <label className="block">
            <span className={rotulo}>Assunto</span>
            <input
              value={assunto}
              onChange={(e) => onAssunto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
              placeholder="Ex.: Legítima defesa"
              className={campo}
            />
          </label>
        </>
      )}
    </div>
  );
};

export default EscolhaAssunto;
