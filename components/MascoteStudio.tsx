import React, { useState } from 'react';
import VoxelAvatar, { POSES_ESCOLHIVEIS, VoxelPose } from './VoxelAvatar';
import { VoxelAdereco, VoxelCabelo } from '../services/voxelCharacters';
import {
  ADERECOS,
  CALCADOS,
  CALCAS,
  CAMISAS,
  CHAPEUS,
  CORES_CABELO,
  CORES_OLHOS,
  CORES_PELE,
  CORES_PELO,
  CORES_ROUPA,
  ESPECIES,
  ESTILOS_CABELO,
  Mascote,
  OCULOS,
  PADRAO,
  PELOS,
  PRONTOS,
  SEXOS,
  configDoMascote,
  gravar,
  ler,
} from '../services/mascote';

// Estúdio do mascote: a tela onde o aluno monta o boneco de cubos que o
// acompanha pelo app. Dois caminhos, escolhidos na primeira pergunta:
// começar de um personagem pronto (e trocar as cores dele) ou montar um do
// zero, peça por peça, com nome próprio.
//
// Cada escolha é gravada na hora. Não existe botão de salvar porque não existe
// rascunho: o boneco do canto da tela já é o resultado, e o aluno vê a mudança
// acontecer enquanto decide.

interface MascoteStudioProps {
  characterId?: string;
  onBack: () => void;
}

const Secao: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <section className="rounded-3xl border border-[#e9e0d4] bg-[#fdfbf7] p-4 dark:border-white/10 dark:bg-[#2d2e27]">
    <h3 className="mb-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a79c8e]">{titulo}</h3>
    <div className="space-y-3">{children}</div>
  </section>
);

const Rotulo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.15em] text-[#a79c8e]">{children}</span>
);

const Cores: React.FC<{ cores: string[]; valor?: string; nome: string; onEscolher: (cor: string) => void }> = ({ cores, valor, nome, onEscolher }) => (
  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={nome}>
    {(valor && !cores.includes(valor) ? [valor, ...cores] : cores).map((cor, i) => (
      <button
        key={cor}
        type="button"
        role="radio"
        aria-checked={valor === cor}
        aria-label={`${nome}, cor ${i + 1}`}
        onClick={() => onEscolher(cor)}
        className={`h-9 w-9 rounded-full border transition-transform hover:scale-110 ${
          valor === cor ? 'border-[#473c33] ring-2 ring-[#473c33] ring-offset-2 ring-offset-[#fdfbf7] dark:ring-offset-[#2d2e27]' : 'border-black/10'
        }`}
        style={{ background: cor }}
      />
    ))}
  </div>
);

function Opcoes<T extends string>({ itens, valor, nome, onEscolher }: {
  itens: readonly { id: T; rotulo: string }[];
  valor?: T;
  nome: string;
  onEscolher: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={nome}>
      {itens.map(({ id, rotulo }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={valor === id}
          onClick={() => onEscolher(id)}
          className={`min-h-[40px] rounded-xl px-3 text-[11px] font-black uppercase tracking-wide transition-colors ${
            valor === id ? 'bg-[#473c33] text-white' : 'bg-[#f0e8dc] text-[#8f8375] hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]'
          }`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}

const Marcar: React.FC<{ ligado: boolean; onMudar: (v: boolean) => void; children: React.ReactNode }> = ({ ligado, onMudar, children }) => (
  <label className="flex min-h-11 items-center gap-2 rounded-xl bg-[#f0e8dc] px-3 text-[11px] font-bold text-[#66584b] dark:bg-white/5 dark:text-[#e5d8c8]">
    <input type="checkbox" checked={ligado} onChange={(e) => onMudar(e.target.checked)} className="h-4 w-4 accent-[#e96f34]" />
    {children}
  </label>
);

const MascoteStudio: React.FC<MascoteStudioProps> = ({ characterId, onBack }) => {
  const [mascote, setMascote] = useState<Mascote>(() => ler());
  const [pose, setPose] = useState<VoxelPose>('parado');
  const criado = mascote.modo === 'criado';
  const cfg = configDoMascote(characterId, mascote);
  // No modo criado os campos que o aluno ainda não tocou valem pelo padrão, e é
  // o padrão que precisa aparecer marcado nos botões.
  const v = { ...PADRAO, ...Object.fromEntries(Object.entries(mascote).filter(([, valor]) => valor !== undefined)) } as Mascote & typeof PADRAO;
  const bicho = !!cfg?.bicho;

  const mudar = (campo: Partial<Mascote>) => {
    const proximo = { ...mascote, ...campo };
    setMascote(proximo);
    gravar(proximo);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 items-center gap-2 rounded-2xl bg-[#f0e8dc] px-4 text-xs font-black uppercase tracking-widest text-[#8f8375] transition-colors hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          Voltar
        </button>
        <p className="text-[11px] font-bold text-[#a79c8e]">Cada escolha é guardada na hora.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        {/* O boneco fica preso no alto: rolando a lista de roupas, ele
            continua à vista e a escolha pode ser julgada sem subir de novo. */}
        <div className="rounded-[32px] border border-[#e9e0d4] bg-[#f7f1e6] p-5 dark:border-white/10 dark:bg-[#24251f] lg:sticky lg:top-4">
          <div className="flex justify-center">
            <VoxelAvatar characterId={characterId} mascote={mascote} altura={240} pose={pose} />
          </div>
          <h2 className="mt-2 text-center text-xl font-black uppercase tracking-tight text-[#473c33] dark:text-[#f4ebdd]">{cfg?.nome || 'Mascote'}</h2>
          <div className="mt-3">
            <Rotulo>Ver mexendo</Rotulo>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Animação da amostra">
              {POSES_ESCOLHIVEIS.map(({ pose: p, rotulo }) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={pose === p}
                  onClick={() => setPose(p)}
                  className={`min-h-9 rounded-lg px-2 text-[9px] font-black uppercase tracking-wide transition-colors ${
                    pose === p ? 'bg-[#e96f34] text-white' : 'bg-[#f0e8dc] text-[#8f8375] hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]'
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Secao titulo="De onde partir">
            <Opcoes
              itens={[{ id: 'criado', rotulo: 'Montar do zero' }, { id: 'pronto', rotulo: 'Personagem pronto' }] as const}
              valor={mascote.modo}
              nome="De onde partir"
              onEscolher={(modo) => mudar({ modo })}
            />
            {criado && (
              <label className="block">
                <Rotulo>Nome do mascote</Rotulo>
                <input
                  value={mascote.nome ?? ''}
                  onChange={(e) => mudar({ nome: e.target.value.slice(0, 24) })}
                  placeholder={PADRAO.nome}
                  maxLength={24}
                  className="min-h-11 w-full rounded-xl border border-[#e9e0d4] bg-[#f7f1e6] px-3 text-sm font-bold text-[#473c33] outline-none focus:border-[#e96f34] dark:border-white/10 dark:bg-white/5 dark:text-[#f4ebdd]"
                />
              </label>
            )}
          </Secao>

          {!criado && (
            <Secao titulo="Qual personagem">
              <Opcoes
                itens={PRONTOS.map((p) => ({ id: p.id, rotulo: p.nome }))}
                valor={mascote.base || characterId}
                nome="Qual personagem"
                /* Trocar de personagem recomeça do zero: cada receita tem a sua
                   paleta, e levar o cabelo roxo do anterior para um cachorro
                   devolvia um boneco que ninguém pediu. */
                onEscolher={(base) => mudar({ modo: 'pronto', base, pele: undefined, cabelo: undefined, estilo: undefined, olhos: undefined, corCamisa: undefined, corCalca: undefined, corCalcado: undefined, dir: undefined, esq: undefined, semChapeu: undefined })}
              />
            </Secao>
          )}

          {criado && (
            <Secao titulo="Quem é ele">
              <div>
                <Rotulo>Sexo</Rotulo>
                {/* Quem ainda não mexeu no cabelo recebe o penteado que
                    combina com a escolha; a partir daí o cabelo é dele. */}
                <Opcoes
                  itens={SEXOS}
                  valor={v.sexo}
                  nome="Sexo"
                  onEscolher={(sexo) => mudar({ sexo, estilo: mascote.estilo ?? (sexo === 'menina' ? 'longo' : sexo === 'menino' ? 'curto' : undefined) })}
                />
              </div>
              <div>
                <Rotulo>Pessoa ou bicho</Rotulo>
                <Opcoes itens={ESPECIES} valor={v.especie} nome="Pessoa ou bicho" onEscolher={(especie) => mudar({ especie })} />
              </div>
            </Secao>
          )}

          <Secao titulo={bicho ? 'Pelo e olhos' : 'Pele, cabelo e olhos'}>
            <div>
              <Rotulo>{bicho ? 'Cor do pelo' : 'Tom de pele'}</Rotulo>
              <Cores cores={bicho ? CORES_PELO : CORES_PELE} valor={mascote.pele || (criado ? v.pele : cfg?.skin)} nome={bicho ? 'Cor do pelo' : 'Tom de pele'} onEscolher={(pele) => mudar({ pele })} />
            </div>
            {!bicho && (
              <>
                <div>
                  <Rotulo>Penteado</Rotulo>
                  <Opcoes itens={ESTILOS_CABELO} valor={(mascote.estilo || (criado ? v.estilo : cfg?.estilo)) as VoxelCabelo} nome="Penteado" onEscolher={(estilo) => mudar({ estilo })} />
                </div>
                <div>
                  <Rotulo>Cor do cabelo</Rotulo>
                  <Cores cores={CORES_CABELO} valor={mascote.cabelo || (criado ? v.cabelo : cfg?.cabelo)} nome="Cor do cabelo" onEscolher={(cabelo) => mudar({ cabelo })} />
                </div>
              </>
            )}
            <div>
              <Rotulo>Cor dos olhos</Rotulo>
              <Cores cores={CORES_OLHOS} valor={mascote.olhos || cfg?.iris || PADRAO.olhos} nome="Cor dos olhos" onEscolher={(olhos) => mudar({ olhos })} />
            </div>
          </Secao>

          {criado && !bicho && (
            <Secao titulo="Rosto">
              <div>
                <Rotulo>Barba e bigode</Rotulo>
                <Opcoes itens={PELOS} valor={v.pelos} nome="Barba e bigode" onEscolher={(pelos) => mudar({ pelos })} />
              </div>
              <div>
                <Rotulo>Óculos</Rotulo>
                <Opcoes itens={OCULOS} valor={v.oculos} nome="Óculos" onEscolher={(oculos) => mudar({ oculos })} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Marcar ligado={mascote.cilios ?? v.sexo === 'menina'} onMudar={(cilios) => mudar({ cilios })}>Cílios</Marcar>
                <Marcar ligado={!!mascote.pinta} onMudar={(pinta) => mudar({ pinta })}>Pintinha no rosto</Marcar>
              </div>
            </Secao>
          )}

          {criado ? (
            <>
              <Secao titulo="Roupa de cima">
                <Opcoes itens={CAMISAS} valor={v.camisa} nome="Roupa de cima" onEscolher={(camisa) => mudar({ camisa })} />
                <div>
                  <Rotulo>Cor</Rotulo>
                  <Cores cores={CORES_ROUPA} valor={v.corCamisa} nome="Cor da roupa de cima" onEscolher={(corCamisa) => mudar({ corCamisa })} />
                </div>
                {/* Listras, gravata, colete e a faixa da social saem desta cor:
                    sem ela a peça some dentro da camisa quando as duas batem. */}
                {['listrada', 'social', 'terno', 'colete', 'jaleco'].includes(v.camisa) && (
                  <div>
                    <Rotulo>Cor do detalhe</Rotulo>
                    <Cores cores={CORES_ROUPA} valor={v.corDetalhe} nome="Cor do detalhe" onEscolher={(corDetalhe) => mudar({ corDetalhe })} />
                  </div>
                )}
              </Secao>

              <Secao titulo="Roupa de baixo">
                <Opcoes itens={CALCAS} valor={v.calca} nome="Roupa de baixo" onEscolher={(calca) => mudar({ calca })} />
                <div>
                  <Rotulo>Cor</Rotulo>
                  <Cores cores={CORES_ROUPA} valor={v.corCalca} nome="Cor da roupa de baixo" onEscolher={(corCalca) => mudar({ corCalca })} />
                </div>
                <Marcar ligado={!!mascote.cinto} onMudar={(cinto) => mudar({ cinto })}>Com cinto</Marcar>
              </Secao>

              <Secao titulo="Nos pés">
                <Opcoes itens={CALCADOS} valor={v.calcado} nome="Nos pés" onEscolher={(calcado) => mudar({ calcado })} />
                {v.calcado !== 'descalco' && (
                  <div>
                    <Rotulo>Cor</Rotulo>
                    <Cores cores={CORES_ROUPA} valor={v.corCalcado} nome="Cor do calçado" onEscolher={(corCalcado) => mudar({ corCalcado })} />
                  </div>
                )}
              </Secao>

              <Secao titulo="Na cabeça">
                <Opcoes itens={CHAPEUS} valor={v.chapeu} nome="Na cabeça" onEscolher={(chapeu) => mudar({ chapeu })} />
                {v.chapeu !== 'nenhum' && (
                  <div>
                    <Rotulo>Cor</Rotulo>
                    <Cores cores={CORES_ROUPA} valor={v.corChapeu} nome="Cor do chapéu" onEscolher={(corChapeu) => mudar({ corChapeu })} />
                  </div>
                )}
              </Secao>
            </>
          ) : (
            <Secao titulo="Roupa">
              <div>
                <Rotulo>Camisa</Rotulo>
                <Cores cores={CORES_ROUPA} valor={mascote.corCamisa || cfg?.torso} nome="Cor da camisa" onEscolher={(corCamisa) => mudar({ corCamisa })} />
              </div>
              <div>
                <Rotulo>Calça</Rotulo>
                <Cores cores={CORES_ROUPA} valor={mascote.corCalca || cfg?.pernas} nome="Cor da calça" onEscolher={(corCalca) => mudar({ corCalca })} />
              </div>
              <div>
                <Rotulo>Sapato</Rotulo>
                <Cores cores={CORES_ROUPA} valor={mascote.corCalcado || cfg?.sapato} nome="Cor do sapato" onEscolher={(corCalcado) => mudar({ corCalcado })} />
              </div>
              {(cfg?.bone || cfg?.quepe || cfg?.capacete || cfg?.balde || mascote.semChapeu) && (
                <Marcar ligado={!!mascote.semChapeu} onMudar={(semChapeu) => mudar({ semChapeu })}>Tirar o chapéu</Marcar>
              )}
            </Secao>
          )}

          <Secao titulo="Nas mãos">
            <div>
              <Rotulo>Mão direita</Rotulo>
              <Opcoes itens={ADERECOS} valor={(mascote.dir || cfg?.dir || 'nada') as VoxelAdereco} nome="Mão direita" onEscolher={(dir) => mudar({ dir })} />
            </div>
            <div>
              <Rotulo>Mão esquerda</Rotulo>
              <Opcoes itens={ADERECOS} valor={(mascote.esq || cfg?.esq || 'nada') as VoxelAdereco} nome="Mão esquerda" onEscolher={(esq) => mudar({ esq })} />
            </div>
          </Secao>

          <button
            type="button"
            onClick={() => { const limpo: Mascote = { modo: mascote.modo }; setMascote(limpo); gravar(limpo); }}
            className="min-h-12 w-full rounded-2xl bg-[#f0e8dc] text-xs font-black uppercase tracking-widest text-[#8f8375] transition-colors hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]"
          >
            Começar de novo
          </button>
        </div>
      </div>
    </div>
  );
};

export default MascoteStudio;
