import React, { useState } from 'react';
import VoxelAvatar, { POSES_ESCOLHIVEIS, VoxelPose } from './VoxelAvatar';
import { VoxelAdereco, VoxelCabelo } from '../services/voxelCharacters';
import {
  ADERECOS,
  ACESSORIOS_ANIMAIS,
  SOBRANCELHAS,
  CALCADOS,
  CALCAS,
  CAMISAS,
  ChapeuId,
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
  trocarCamisa,
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
  /**
   * Quando existe, o estúdio também é a tela de escolher o personagem: ganha
   * o botão que confirma e devolve qual personagem ficou valendo. É o mesmo
   * estúdio, para quem está entrando já poder escolher e mexer de uma vez,
   * em vez de escolher numa tela e editar em outra.
   */
  onConfirmar?: (characterId: string) => void;
  rotuloConfirmar?: string;
  rotuloVoltar?: string;
}

// Cada bloco abre sozinho e fecha os outros do mesmo grupo. Com tudo aberto,
// a aba Roupa dava 1.815 px de rolagem e 161 controles à mostra numa janela de
// 615 — o aluno precisava passar por todas as cores para chegar no chapéu.
const Secao: React.FC<{ titulo: string; aberta: boolean; onAbrir: () => void; resumo?: string; children: React.ReactNode }> = ({ titulo, aberta, onAbrir, resumo, children }) => (
  <section className="overflow-hidden rounded-3xl border border-[#e9e0d4] bg-[#fdfbf7] dark:border-white/10 dark:bg-[#2d2e27]">
    <button
      type="button"
      onClick={onAbrir}
      aria-expanded={aberta}
      className="flex min-h-12 w-full items-center gap-3 px-4 text-left"
    >
      <span className="flex-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#a79c8e]">{titulo}</span>
      {/* O resumo diz o que está escolhido ali dentro, para o bloco fechado não
          virar uma gaveta cega. */}
      {!aberta && resumo && <span className="max-w-[45%] truncate text-[11px] font-bold text-[#8f8375] dark:text-[#a89680]">{resumo}</span>}
      <svg className={`h-3.5 w-3.5 shrink-0 text-[#a79c8e] transition-transform ${aberta ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {aberta && <div className="space-y-3 px-4 pb-4">{children}</div>}
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
    <label className="flex h-9 items-center gap-1 rounded-full border border-[#d7c9b7] bg-white px-2 text-[10px] font-bold text-[#66584b]">Outra cor<input type="color" aria-label={`Escolher outra cor para ${nome}`} value={valor || cores[0]} onChange={(e) => onEscolher(e.target.value)} className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0" /></label>
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

type AbaMascote = 'quem' | 'rosto' | 'roupa' | 'extras';

const ABAS: { id: AbaMascote; rotulo: string }[] = [
  { id: 'quem', rotulo: 'Quem é' },
  { id: 'rosto', rotulo: 'Rosto' },
  { id: 'roupa', rotulo: 'Roupa' },
  { id: 'extras', rotulo: 'Extras' },
];

const MascoteStudio: React.FC<MascoteStudioProps> = ({ characterId, onBack, onConfirmar, rotuloConfirmar = 'Confirmar mascote', rotuloVoltar = 'Voltar' }) => {
  const [mascote, setMascote] = useState<Mascote>(() => ler());
  // A animação não é mais só a amostra daqui: é a que o boneco faz no canto
  // da tela, e fica guardada com o resto do mascote. Era uma fatia separada
  // na roda, repetindo o que este seletor já fazia.
  const pose: VoxelPose = mascote.animacao || 'estudando';
  const criado = mascote.modo === 'criado';
  const cfg = configDoMascote(characterId, mascote);
  // No modo criado os campos que o aluno ainda não tocou valem pelo padrão, e é
  // o padrão que precisa aparecer marcado nos botões.
  const v = { ...PADRAO, ...Object.fromEntries(Object.entries(mascote).filter(([, valor]) => valor !== undefined)) } as Mascote & typeof PADRAO;
  const bicho = !!cfg?.bicho;

  // As escolhas vinham empilhadas numa coluna só: no modo "montar do zero" eram dez blocos, 204 controles e
  // 3.255 px de rolagem numa janela de 757 — quatro telas para achar o chapéu. Agora são quatro grupos, um
  // de cada vez, e cada um cabe quase inteiro na tela.
  const [aba, setAba] = useState<AbaMascote>('quem');
  // Qual bloco está aberto. Trocar de aba abre o primeiro bloco da nova, para
  // ela nunca aparecer só com cabeçalhos fechados.
  const PRIMEIRA: Record<AbaMascote, string> = { quem: 'partir', rosto: 'pele', roupa: criado ? 'cima' : 'prontoRoupa', extras: 'maos' };
  const [secao, setSecao] = useState<string>('partir');
  const abrirAba = (id: AbaMascote) => { setAba(id); setSecao(PRIMEIRA[id]); };
  const dobra = (id: string) => ({ aberta: secao === id, onAbrir: () => setSecao(secao === id ? '' : id) });

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
          {rotuloVoltar}
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
        </div>

        <div className="space-y-4">
          {/* Barra de grupos: só o grupo aberto aparece abaixo. */}
          <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-[#e9e0d4] bg-[#fdfbf7] p-1 dark:border-white/10 dark:bg-[#2d2e27] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Partes do mascote">
            {ABAS.map(({ id, rotulo }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id}
                onClick={() => abrirAba(id)}
                /* A cor da aba aberta vem da regra de [role=tab][aria-selected=true] do index.css, a mesma
                   das outras barras do app — pintar aqui só criaria uma segunda aparência de aba. */
                className={`min-h-10 flex-1 shrink-0 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  aba === id ? '' : 'text-[#8f8375] hover:text-[#473c33] dark:text-[#a89680]'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>

          {aba === 'quem' && <Secao titulo="De onde partir" {...dobra('partir')} resumo={criado ? 'Montar do zero' : 'Personagem pronto'}>
            <Opcoes
              itens={[{ id: 'criado', rotulo: 'Montar do zero' }, { id: 'pronto', rotulo: 'Personagem pronto' }] as const}
              valor={mascote.modo}
              nome="De onde partir"
              onEscolher={(modo) => mudar(modo === 'pronto' && mascote.modo === 'criado' && mascote.camisa === 'armadura' ? { ...trocarCamisa(mascote, 'camiseta'), modo } : { modo })}
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
          </Secao>}

          {aba === 'quem' && !criado && (
            <Secao titulo="Qual personagem" {...dobra('personagem')} resumo={cfg?.nome}>
              <Opcoes
                itens={PRONTOS.map((p) => ({ id: p.id, rotulo: p.nome }))}
                valor={mascote.base || characterId}
                nome="Qual personagem"
                /* Trocar de personagem recomeça do zero: cada receita tem a sua
                   paleta, e levar o cabelo roxo do anterior para um cachorro
                   devolvia um boneco que ninguém pediu. */
                onEscolher={(base) => mudar({ modo: 'pronto', base, pele: undefined, cabelo: undefined, estilo: undefined, olhos: undefined, corCamisa: undefined, corCalca: undefined, corCalcado: undefined, dir: undefined, esq: undefined, chapeu: undefined, corChapeu: undefined, antesArmadura: undefined })}
              />
            </Secao>
          )}

          {aba === 'quem' && criado && (
            <Secao titulo="Quem é ele" {...dobra('quemEle')} resumo={ESPECIES.find((e) => e.id === v.especie)?.rotulo}>
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
                <Opcoes itens={ESPECIES} valor={v.especie} nome="Pessoa ou bicho" onEscolher={(especie) => mudar({ especie, ...({ capivara: { pele: '#a87550' }, onca: { pele: '#e5ae4b' }, arara: { pele: '#df3433' } } as Partial<Record<typeof especie, Partial<Mascote>>>)[especie] })} />
              </div>
            </Secao>
          )}

          {aba === 'rosto' && <Secao titulo={bicho ? 'Pelo e olhos' : 'Pele e olhos'} {...dobra('pele')}>
            <div>
              <Rotulo>{v.especie === 'arara' && criado ? 'Cor das penas' : bicho ? 'Cor do pelo' : 'Tom de pele'}</Rotulo>
              <Cores cores={bicho ? CORES_PELO : CORES_PELE} valor={mascote.pele || (criado ? v.pele : cfg?.skin)} nome={bicho ? 'Cor do pelo' : 'Tom de pele'} onEscolher={(pele) => mudar({ pele })} />
            </div>
            <div>
              <Rotulo>Cor dos olhos</Rotulo>
              <Cores cores={CORES_OLHOS} valor={mascote.olhos || cfg?.iris || PADRAO.olhos} nome="Cor dos olhos" onEscolher={(olhos) => mudar({ olhos })} />
            </div>
          </Secao>}

          {/* O cabelo saiu de dentro de "pele e olhos": com os dois juntos o
              bloco aberto já tinha 54 controles, mais que a aba inteira dos
              extras. */}
          {aba === 'rosto' && !bicho && (
            <Secao titulo="Cabelo" {...dobra('cabelo')} resumo={ESTILOS_CABELO.find((e) => e.id === (mascote.estilo || cfg?.estilo))?.rotulo}>
              <div>
                <Rotulo>Penteado</Rotulo>
                <Opcoes itens={ESTILOS_CABELO} valor={(mascote.estilo || (criado ? v.estilo : cfg?.estilo)) as VoxelCabelo} nome="Penteado" onEscolher={(estilo) => mudar({ estilo })} />
              </div>
              <div>
                <Rotulo>Cor do cabelo</Rotulo>
                <Cores cores={CORES_CABELO} valor={mascote.cabelo || (criado ? v.cabelo : cfg?.cabelo)} nome="Cor do cabelo" onEscolher={(cabelo) => mudar({ cabelo })} />
              </div>
            </Secao>
          )}

          {aba === 'rosto' && criado && !bicho && (
            <Secao titulo="Rosto" {...dobra('rosto')} resumo={PELOS.find((e) => e.id === v.pelos)?.rotulo}>
              <div>
                <Rotulo>Barba e bigode</Rotulo>
                <Opcoes itens={PELOS} valor={v.pelos} nome="Barba e bigode" onEscolher={(pelos) => mudar({ pelos })} />
              </div>
              <div><Rotulo>Sobrancelhas</Rotulo><Opcoes itens={SOBRANCELHAS} valor={mascote.sobrancelha || 'natural'} nome="Sobrancelhas" onEscolher={(sobrancelha) => mudar({ sobrancelha })} /></div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Marcar ligado={!!mascote.sardas} onMudar={(sardas) => mudar({ sardas })}>Sardas</Marcar>
                <Marcar ligado={!!mascote.covinhas} onMudar={(covinhas) => mudar({ covinhas })}>Covinhas</Marcar>
                <Marcar ligado={!!mascote.aparelho} onMudar={(aparelho) => mudar({ aparelho })}>Aparelho nos dentes</Marcar>
                <Marcar ligado={mascote.cilios ?? v.sexo === 'menina'} onMudar={(cilios) => mudar({ cilios })}>Cílios</Marcar>
                <Marcar ligado={!!mascote.pinta} onMudar={(pinta) => mudar({ pinta })}>Pintinha no rosto</Marcar>
              </div>
            </Secao>
          )}

          {aba === 'roupa' && bicho && <Secao titulo="Acessórios do animal" {...dobra('bicho')} resumo={ACESSORIOS_ANIMAIS.find((e) => e.id === (mascote.acessorioAnimal || 'nenhum'))?.rotulo}>
            <Opcoes itens={ACESSORIOS_ANIMAIS} valor={mascote.acessorioAnimal || 'nenhum'} nome="Acessórios do animal" onEscolher={(acessorioAnimal) => mudar({ acessorioAnimal })} />
            {mascote.acessorioAnimal && mascote.acessorioAnimal !== 'nenhum' && <div><Rotulo>Cor do acessório</Rotulo><Cores cores={CORES_ROUPA} valor={mascote.corAcessorioAnimal || '#d77a3d'} nome="Cor do acessório do animal" onEscolher={(corAcessorioAnimal) => mudar({ corAcessorioAnimal })} /></div>}
            {mascote.acessorioAnimal === 'placa' && <p className="text-xs text-[#806e60] dark:text-[#c6b9a6]">A plaquinha mostra o nome do mascote.</p>}
          </Secao>}

          {aba === 'rosto' && criado && <Secao titulo="Óculos" {...dobra('oculos')} resumo={OCULOS.find((e) => e.id === v.oculos)?.rotulo}>
            <Opcoes itens={OCULOS} valor={v.oculos} nome="Óculos" onEscolher={(oculos) => mudar({ oculos })} />
            {v.oculos !== 'nenhum' && <div><Rotulo>Cor da armação</Rotulo><Cores cores={CORES_ROUPA} valor={mascote.corOculos || '#2a2a2e'} nome="Cor da armação" onEscolher={(corOculos) => mudar({ corOculos })} /></div>}
          </Secao>}

          {aba === 'roupa' && (criado ? (
            <>
              <Secao titulo="Roupa de cima" {...dobra('cima')} resumo={CAMISAS.find((e) => e.id === v.camisa)?.rotulo}>
                <Opcoes itens={CAMISAS} valor={v.camisa} nome="Roupa de cima" onEscolher={(camisa) => mudar(trocarCamisa(mascote, camisa))} />
                {v.camisa === 'armadura' && <p className="text-xs text-[#806e60] dark:text-[#c6b9a6]">O conjunto inclui elmo e botas. Você pode trocar cada peça abaixo.</p>}
                <div>
                  <Rotulo>Cor</Rotulo>
                  <Cores cores={CORES_ROUPA} valor={v.corCamisa} nome="Cor da roupa de cima" onEscolher={(corCamisa) => mudar({ corCamisa })} />
                </div>
                {/* Listras, gravata, colete e a faixa da social saem desta cor:
                    sem ela a peça some dentro da camisa quando as duas batem. */}
                {['listrada', 'social', 'terno', 'colete', 'jaleco', 'polo', 'jaqueta', 'jardineira', 'golaAlta', 'xadrez', 'futebol', 'farda', 'cardiga', 'estampada', 'jaquetaCapuz', 'vestido', 'esportiva', 'armadura'].includes(v.camisa) && (
                  <div>
                    <Rotulo>Cor do detalhe</Rotulo>
                    <Cores cores={CORES_ROUPA} valor={v.corDetalhe} nome="Cor do detalhe" onEscolher={(corDetalhe) => mudar({ corDetalhe })} />
                  </div>
                )}
              </Secao>

              <Secao titulo="Roupa de baixo" {...dobra('baixo')} resumo={CALCAS.find((e) => e.id === v.calca)?.rotulo}>
                <Opcoes itens={CALCAS} valor={v.calca} nome="Roupa de baixo" onEscolher={(calca) => mudar({ calca })} />
                <div>
                  <Rotulo>Cor</Rotulo>
                  <Cores cores={CORES_ROUPA} valor={v.corCalca} nome="Cor da roupa de baixo" onEscolher={(corCalca) => mudar({ corCalca })} />
                </div>
                <Marcar ligado={!!mascote.cinto} onMudar={(cinto) => mudar({ cinto })}>Com cinto</Marcar>
              </Secao>

              <Secao titulo="Nos pés" {...dobra('pes')} resumo={CALCADOS.find((e) => e.id === v.calcado)?.rotulo}>
                <Opcoes itens={CALCADOS} valor={v.calcado} nome="Nos pés" onEscolher={(calcado) => mudar({ calcado })} />
                {['tenis', 'tenisCanoAlto', 'tenisEsportivo', 'tenisCasual'].includes(v.calcado) && <div><Rotulo>Cor dos detalhes</Rotulo><Cores cores={CORES_ROUPA} valor={mascote.corDetalheCalcado || '#f3ece0'} nome="Cor dos detalhes do tênis" onEscolher={(corDetalheCalcado) => mudar({ corDetalheCalcado })} /></div>}
                {v.calcado !== 'descalco' && (
                  <div>
                    <Rotulo>Cor</Rotulo>
                    <Cores cores={CORES_ROUPA} valor={v.corCalcado} nome="Cor do calçado" onEscolher={(corCalcado) => mudar({ corCalcado })} />
                  </div>
                )}
              </Secao>

              <Secao titulo="Na cabeça" {...dobra('cabeca')} resumo={CHAPEUS.find((e) => e.id === v.chapeu)?.rotulo}>
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
            <Secao titulo="Roupa" {...dobra('prontoRoupa')}>
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
              <div>
                <Rotulo>Na cabeça</Rotulo>
                {/* 'Do personagem' é o estado sem escolha: mantém o que ele já
                    usa. As outras trocam — inclusive 'Nenhum', que é o tirar. */}
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Na cabeça">
                  {([{ id: 'original', rotulo: 'Do personagem' }, ...CHAPEUS] as const).map(({ id, rotulo }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={(mascote.chapeu ?? 'original') === id}
                      onClick={() => mudar({ chapeu: id === 'original' ? undefined : (id as ChapeuId) })}
                      className={`min-h-[40px] rounded-xl px-3 text-[11px] font-black uppercase tracking-wide transition-colors ${
                        (mascote.chapeu ?? 'original') === id ? 'bg-[#473c33] text-white' : 'bg-[#f0e8dc] text-[#8f8375] hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]'
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
              {mascote.chapeu && mascote.chapeu !== 'nenhum' && (
                <div>
                  <Rotulo>Cor do chapéu</Rotulo>
                  <Cores cores={CORES_ROUPA} valor={mascote.corChapeu || cfg?.bone || cfg?.fivePanel || cfg?.elmoMedieval || cfg?.boneTras || cfg?.faixaCabeca || cfg?.lacoCabeca || cfg?.quepe || cfg?.capacete || cfg?.balde || cfg?.touca || cfg?.boina} nome="Cor do chapéu" onEscolher={(corChapeu) => mudar({ corChapeu })} />
                </div>
              )}
            </Secao>
          ))}

          {aba === 'extras' && <Secao titulo="Nas mãos" {...dobra('maos')} resumo={ADERECOS.find((e) => e.id === v.dir)?.rotulo}>
            <div>
              <Rotulo>Mão direita</Rotulo>
              <Opcoes itens={ADERECOS} valor={(mascote.dir || cfg?.dir || 'nada') as VoxelAdereco} nome="Mão direita" onEscolher={(dir) => mudar({ dir })} />
            </div>
            <div>
              <Rotulo>Mão esquerda</Rotulo>
              <Opcoes itens={ADERECOS} valor={(mascote.esq || cfg?.esq || 'nada') as VoxelAdereco} nome="Mão esquerda" onEscolher={(esq) => mudar({ esq })} />
            </div>
          </Secao>}

          {aba === 'extras' && (
            <Secao titulo="O que ele fica fazendo" {...dobra('fazendo')} resumo={POSES_ESCOLHIVEIS.find((p) => p.pose === (mascote.animacao || 'estudando'))?.rotulo}>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="O que ele fica fazendo">
                {POSES_ESCOLHIVEIS.map(({ pose: p, rotulo }) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={pose === p}
                    onClick={() => mudar({ animacao: p })}
                    className={`min-h-10 rounded-xl px-3 text-[10px] font-black uppercase tracking-wide transition-colors ${
                      pose === p ? 'bg-[#e96f34] text-white' : 'bg-[#f0e8dc] text-[#8f8375] hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]'
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            </Secao>
          )}

          {aba === 'extras' && <button
            type="button"
            onClick={() => { const limpo: Mascote = { modo: mascote.modo }; setMascote(limpo); gravar(limpo); }}
            className="min-h-12 w-full rounded-2xl bg-[#f0e8dc] text-xs font-black uppercase tracking-widest text-[#8f8375] transition-colors hover:text-[#473c33] dark:bg-white/5 dark:text-[#a89680]"
          >
            Começar de novo
          </button>}
        </div>
      </div>

      {/* Preso embaixo: a lista de roupas é longa, e o botão que fecha a
          escolha não pode depender de rolar até o fim dela. */}
      {onConfirmar && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-[#e9e0d4] bg-[#fdfbf7]/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#24251f]/95 sm:-mx-6 sm:px-6">
          <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-black uppercase tracking-wide text-[#473c33] dark:text-[#f4ebdd]" aria-live="polite">{cfg?.nome || 'Mascote'}</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#a79c8e]">{criado ? 'Montado por você' : 'Personagem pronto'}</span>
            </span>
            <button
              type="button"
              onClick={() => onConfirmar(mascote.base || characterId || PRONTOS[0].id)}
              className="flex min-h-12 items-center gap-2 rounded-2xl bg-[#e96f34] px-5 text-xs font-black uppercase tracking-widest text-white transition-transform hover:scale-[1.02] active:scale-95"
            >
              {rotuloConfirmar}
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MascoteStudio;
