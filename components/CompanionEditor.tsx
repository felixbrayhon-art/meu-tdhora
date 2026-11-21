import React, { useState } from 'react';
import VoxelAvatar from './VoxelAvatar';
import { VoxelCabelo, VoxelAdereco } from '../services/voxelCharacters';
import {
  ADERECOS,
  CORES_CABELO,
  CORES_OLHOS,
  CORES_PELE,
  CORES_ROUPA,
  ESTILOS_CABELO,
  MASCOTES,
  VoxelAjustes,
  configBase,
} from '../services/voxelCustom';

// Editor do mascote 3D. Mexe só nos campos que o aluno escolheu — o resto
// continua vindo da receita do personagem, então um refinamento futuro no
// boneco chega para quem editou também.

interface CompanionEditorProps {
  characterId?: string;
  ajustes: VoxelAjustes;
  onMudar: (ajustes: VoxelAjustes) => void;
  onFechar: () => void;
}

type Aba = 'tipo' | 'cabelo' | 'rosto' | 'roupa' | 'maos';

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'tipo', rotulo: 'Tipo' },
  { id: 'cabelo', rotulo: 'Cabelo' },
  { id: 'rosto', rotulo: 'Rosto' },
  { id: 'roupa', rotulo: 'Roupa' },
  { id: 'maos', rotulo: 'Mãos' },
];

const Titulo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.2em] text-[#a79c8e]">{children}</span>
);

/**
 * Fileira de cores. O escolhido ganha um anel escuro em volta. A cor que o
 * personagem já usa entra na frente quando não está na paleta — sem isso a
 * fileira abria toda apagada e parecia que nada estava escolhido.
 */
const Cores: React.FC<{ cores: string[]; valor?: string; nome: string; onEscolher: (cor: string) => void }> = ({ cores, valor, nome, onEscolher }) => (
  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={nome}>
    {(valor && !cores.includes(valor) ? [valor, ...cores] : cores).map((cor, i) => (
      <button
        key={cor}
        type="button"
        role="radio"
        aria-checked={valor === cor}
        aria-label={`${nome}, cor ${i + 1}`}
        onClick={() => onEscolher(cor)}
        className={`h-8 w-8 rounded-full border transition-transform hover:scale-110 ${
          valor === cor ? 'border-[#473c33] ring-2 ring-[#473c33] ring-offset-1 ring-offset-[#fdfbf7] dark:ring-offset-[#2d2e27]' : 'border-black/10'
        }`}
        style={{ background: cor }}
      />
    ))}
  </div>
);

/** Grade de botões de texto, igual à do painel de animação. */
const Opcoes = <T extends string>({ itens, valor, nome, colunas = 2, onEscolher }: {
  itens: { id: T; rotulo: string }[];
  valor?: T;
  nome: string;
  colunas?: number;
  onEscolher: (id: T) => void;
}) => (
  <div className={`grid gap-1.5 ${colunas === 3 ? 'grid-cols-3' : 'grid-cols-2'}`} role="radiogroup" aria-label={nome}>
    {itens.map(({ id, rotulo }) => (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={valor === id}
        onClick={() => onEscolher(id)}
        className={`min-h-[40px] rounded-xl px-1 text-[10px] font-black uppercase leading-tight tracking-wide transition-colors ${
          valor === id ? 'bg-[#473c33] text-white' : 'bg-[#f0e8dc] text-[#8f8375] hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]'
        }`}
      >
        {rotulo}
      </button>
    ))}
  </div>
);

const CompanionEditor: React.FC<CompanionEditorProps> = ({ characterId, ajustes, onMudar, onFechar }) => {
  const [aba, setAba] = useState<Aba>('tipo');
  const base = configBase(characterId, ajustes);
  const idBase = ajustes.base || characterId;
  const temChapeu = !!(base && (base.bone || base.balde || base.quepe || base.capacete));
  // Enquanto o aluno não escolhe, o seletor mostra o que o personagem já usa:
  // assim ele vê de onde está partindo em vez de uma fileira toda apagada.
  const mudar = (campo: Partial<VoxelAjustes>) => onMudar({ ...ajustes, ...campo });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a79c8e]">Editar o mascote</span>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8f8375] transition-colors hover:bg-[#f0e8dc] dark:hover:bg-white/5">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* O boneco de verdade, com os ajustes já aplicados: o painel cobre o
          mascote do canto, então a conferência tem de acontecer aqui dentro. */}
      <div className="flex items-center gap-3 rounded-2xl bg-[#f7f1e6] p-2 dark:bg-white/5">
        <VoxelAvatar characterId={idBase} ajustes={ajustes} altura={104} pose="parado" className="shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-wide text-[#473c33] dark:text-[#f4ebdd]">{base?.nome || 'Sem boneco'}</p>
          <p className="mt-0.5 text-[10px] font-semibold leading-snug text-[#8f8375]">Vai mudando: ele se refaz aqui na hora.</p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-0.5" role="tablist" aria-label="O que editar">
        {ABAS.map(({ id, rotulo }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={`shrink-0 rounded-lg px-2.5 py-2 text-[10px] font-black uppercase tracking-wide transition-colors ${
              aba === id ? 'bg-[#e96f34] text-white' : 'bg-[#f0e8dc] text-[#8f8375] hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="min-h-[150px]">
        {aba === 'tipo' && (
          <>
            <Titulo>Qual mascote</Titulo>
            {/* Trocar de mascote recomeça do zero: cada receita tem a sua
                paleta, e levar o cabelo roxo do anterior para um cachorro
                devolvia um boneco que ninguém pediu. */}
            <Opcoes itens={MASCOTES.map((m) => ({ id: m.id, rotulo: m.nome }))} valor={idBase} nome="Qual mascote" onEscolher={(id) => onMudar({ base: id })} />
          </>
        )}

        {aba === 'cabelo' && (
          <div className="space-y-3">
            <div>
              <Titulo>Penteado</Titulo>
              <Opcoes itens={ESTILOS_CABELO} valor={(ajustes.estilo || base?.estilo) as VoxelCabelo | undefined} nome="Penteado" colunas={3} onEscolher={(id) => mudar({ estilo: id })} />
            </div>
            <div>
              <Titulo>Cor do cabelo</Titulo>
              <Cores cores={CORES_CABELO} valor={ajustes.cabelo || base?.cabelo} nome="Cor do cabelo" onEscolher={(cor) => mudar({ cabelo: cor })} />
            </div>
            {temChapeu && (
              <label className="flex min-h-11 items-center gap-2 rounded-xl bg-[#f0e8dc] px-3 text-[11px] font-bold text-[#66584b] dark:bg-white/5 dark:text-[#e5d8c8]">
                <input type="checkbox" checked={!!ajustes.semChapeu} onChange={(e) => mudar({ semChapeu: e.target.checked })} className="h-4 w-4 accent-[#e96f34]" />
                Tirar o chapéu
              </label>
            )}
          </div>
        )}

        {aba === 'rosto' && (
          <div className="space-y-3">
            <div>
              <Titulo>Cor dos olhos</Titulo>
              <Cores cores={CORES_OLHOS} valor={ajustes.iris || base?.iris || '#2a1f1a'} nome="Cor dos olhos" onEscolher={(cor) => mudar({ iris: cor })} />
            </div>
            <div>
              <Titulo>{base?.bicho ? 'Cor do pelo' : 'Cor da pele'}</Titulo>
              <Cores cores={CORES_PELE} valor={ajustes.skin || base?.skin} nome={base?.bicho ? 'Cor do pelo' : 'Cor da pele'} onEscolher={(cor) => mudar({ skin: cor })} />
            </div>
          </div>
        )}

        {aba === 'roupa' && (
          <div className="space-y-3">
            <div>
              <Titulo>Camisa</Titulo>
              <Cores cores={CORES_ROUPA} valor={ajustes.torso || base?.torso} nome="Cor da camisa" onEscolher={(cor) => mudar({ torso: cor })} />
            </div>
            <div>
              <Titulo>Calça</Titulo>
              <Cores cores={CORES_ROUPA} valor={ajustes.pernas || base?.pernas} nome="Cor da calça" onEscolher={(cor) => mudar({ pernas: cor })} />
            </div>
            <div>
              <Titulo>Sapato</Titulo>
              <Cores cores={CORES_ROUPA} valor={ajustes.sapato || base?.sapato} nome="Cor do sapato" onEscolher={(cor) => mudar({ sapato: cor })} />
            </div>
          </div>
        )}

        {aba === 'maos' && (
          <div className="space-y-3">
            <div>
              <Titulo>Mão direita</Titulo>
              <Opcoes itens={ADERECOS} valor={(ajustes.dir || base?.dir || 'nada') as VoxelAdereco} nome="Mão direita" onEscolher={(id) => mudar({ dir: id })} />
            </div>
            <div>
              <Titulo>Mão esquerda</Titulo>
              <Opcoes itens={ADERECOS} valor={(ajustes.esq || base?.esq || 'nada') as VoxelAdereco} nome="Mão esquerda" onEscolher={(id) => mudar({ esq: id })} />
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onMudar({})}
        className="min-h-11 rounded-xl bg-[#f0e8dc] text-[10px] font-black uppercase tracking-wide text-[#8f8375] transition-colors hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]"
      >
        Voltar ao original
      </button>
    </div>
  );
};

export default CompanionEditor;
