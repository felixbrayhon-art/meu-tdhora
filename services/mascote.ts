// O mascote do aluno: ou um dos personagens prontos (com retoques de cor), ou
// um boneco montado peça por peça no estúdio.
//
// Os dois modos moram no mesmo objeto porque dividem quase todos os campos —
// cor da pele, do cabelo, dos olhos, o que ele segura. A diferença é de onde
// sai a receita: no modo 'pronto' partimos da receita do personagem e trocamos
// só o que foi mexido (assim um refinamento futuro no desenho dele chega
// junto); no modo 'criado' a receita é montada do zero, sem nenhum dos
// acabamentos que o VoxelAvatar faz por nome — o nome ali é o que o aluno
// escolheu, e nenhum `switch (cfg.nome)` casa com ele.
import {
  VOXEL_CHARACTERS,
  VoxelAdereco,
  VoxelCabelo,
  VoxelConfig,
  VoxelOrelha,
  VoxelPose,
  POSES_ESCOLHIVEIS,
  getVoxelConfig,
} from './voxelCharacters';

export type Sexo = 'menina' | 'menino' | 'neutro';
export type EspecieId = 'pessoa' | 'cachorro' | 'gato' | 'raposa' | 'guaxinim' | 'urso' | 'coelho' | 'rato' | 'capivara' | 'onca' | 'arara';
export type CamisaId = 'camiseta' | 'listrada' | 'social' | 'regata' | 'moletom' | 'jaleco' | 'terno' | 'colete' | 'toga' | 'polo' | 'jaqueta' | 'jardineira' | 'golaAlta' | 'xadrez' | 'futebol' | 'farda' | 'cardiga' | 'sem';
export type CalcaId = 'comprida' | 'bermuda' | 'saia';
export type CalcadoId = 'sapato' | 'tenis' | 'tenisCanoAlto' | 'tenisEsportivo' | 'tenisCasual' | 'bota' | 'chinelo' | 'descalco';
export type ChapeuId = 'nenhum' | 'bone' | 'fivePanel' | 'quepe' | 'capacete' | 'balde' | 'touca' | 'boina' | 'viseira' | 'palha' | 'bandana';
export type OculosId = 'nenhum' | 'armacao' | 'escuros' | 'redondo' | 'aviador' | 'gatinho';
export type PelosId = 'nada' | 'bigode' | 'barba' | 'cheia';

export interface Mascote {
  modo: 'pronto' | 'criado';
  /** modo 'pronto': de qual personagem sai a receita. */
  base?: string;
  /** modo 'criado': o nome que o aluno deu. */
  nome?: string;
  sexo?: Sexo;
  especie?: EspecieId;
  // cores — valem nos dois modos
  pele?: string;
  cabelo?: string;
  estilo?: VoxelCabelo;
  olhos?: string;
  corCamisa?: string;
  corDetalhe?: string;
  corCalca?: string;
  corCalcado?: string;
  corDetalheCalcado?: string;
  corOculos?: string;
  corChapeu?: string;
  // peças — só no modo 'criado'
  camisa?: CamisaId;
  calca?: CalcaId;
  calcado?: CalcadoId;
  chapeu?: ChapeuId;
  oculos?: OculosId;
  pelos?: PelosId;
  cilios?: boolean;
  pinta?: boolean;
  cinto?: boolean;

  dir?: VoxelAdereco;
  esq?: VoxelAdereco;
  /** A animação que o boneco faz parado na tela. */
  animacao?: VoxelPose;
}

const CHAVE = 'tdh_mascote';

// ---------------------------------------------------------------- catálogos

export const PRONTOS: { id: string; nome: string }[] = Object.entries(VOXEL_CHARACTERS)
  .map(([id, cfg]) => ({ id, nome: cfg.nome }))
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

export const SEXOS: { id: Sexo; rotulo: string }[] = [
  { id: 'menina', rotulo: 'Menina' },
  { id: 'menino', rotulo: 'Menino' },
  { id: 'neutro', rotulo: 'Tanto faz' },
];

export const ESPECIES: { id: EspecieId; rotulo: string; orelha?: VoxelOrelha; mascara?: boolean; focinhoClaro?: number }[] = [
  { id: 'pessoa', rotulo: 'Pessoa' },
  { id: 'cachorro', rotulo: 'Cachorro', orelha: 'caida', focinhoClaro: 1.3 },
  { id: 'gato', rotulo: 'Gato', orelha: 'ponta', focinhoClaro: 1.25 },
  { id: 'raposa', rotulo: 'Raposa', orelha: 'ponta', focinhoClaro: 1.35 },
  { id: 'guaxinim', rotulo: 'Guaxinim', orelha: 'ponta', mascara: true, focinhoClaro: 1.3 },
  { id: 'urso', rotulo: 'Urso', orelha: 'redonda', focinhoClaro: 1.2 },
  { id: 'coelho', rotulo: 'Coelho', orelha: 'comprida', focinhoClaro: 1.3 },
  { id: 'rato', rotulo: 'Rato', orelha: 'redonda', focinhoClaro: 1.28 },
  { id: 'capivara', rotulo: 'Capivara', orelha: 'redonda', focinhoClaro: 1.12 },
  { id: 'onca', rotulo: 'Onça-pintada', orelha: 'redonda', focinhoClaro: 1.25 },
  { id: 'arara', rotulo: 'Arara-vermelha', orelha: 'redonda' },
];

export const ESTILOS_CABELO: { id: VoxelCabelo; rotulo: string }[] = [
  { id: 'curto', rotulo: 'Curto' },
  { id: 'cacheado', rotulo: 'Cacheado' },
  { id: 'afro', rotulo: 'Afro' },
  { id: 'longo', rotulo: 'Longo' },
  { id: 'chanel', rotulo: 'Chanel' },
  { id: 'rabo', rotulo: 'Rabo de cavalo' },
  { id: 'coque', rotulo: 'Coque' },
  { id: 'moicano', rotulo: 'Moicano' },
  { id: 'trancas', rotulo: 'Tranças' },
  { id: 'ondulado', rotulo: 'Ondulado' },
  { id: 'coques', rotulo: 'Dois coques' },
  { id: 'espetado', rotulo: 'Espetado' },
  { id: 'topete', rotulo: 'Topete' },
  { id: 'raspado', rotulo: 'Raspado dos lados' },
  { id: 'dreads', rotulo: 'Dreads' },
  { id: 'chiquinhas', rotulo: 'Maria-chiquinha' },
  { id: 'careca', rotulo: 'Careca' },
];

export const CAMISAS: { id: CamisaId; rotulo: string }[] = [
  { id: 'camiseta', rotulo: 'Camiseta' },
  { id: 'listrada', rotulo: 'Listrada' },
  { id: 'social', rotulo: 'Social' },
  { id: 'regata', rotulo: 'Regata' },
  { id: 'moletom', rotulo: 'Moletom' },
  { id: 'jaleco', rotulo: 'Jaleco' },
  { id: 'terno', rotulo: 'Terno' },
  { id: 'colete', rotulo: 'Colete' },
  { id: 'toga', rotulo: 'Toga' },
  { id: 'polo', rotulo: 'Polo' },
  { id: 'jaqueta', rotulo: 'Jaqueta' },
  { id: 'jardineira', rotulo: 'Jardineira' },
  { id: 'golaAlta', rotulo: 'Gola alta' },
  { id: 'xadrez', rotulo: 'Xadrez' },
  { id: 'futebol', rotulo: 'Camisa de time' },
  { id: 'farda', rotulo: 'Operacional' },
  { id: 'cardiga', rotulo: 'Cardigã' },
  { id: 'sem', rotulo: 'Sem camisa' },
];

export const CALCAS: { id: CalcaId; rotulo: string }[] = [
  { id: 'comprida', rotulo: 'Calça' },
  { id: 'bermuda', rotulo: 'Bermuda' },
  { id: 'saia', rotulo: 'Saia' },
];

export const CALCADOS: { id: CalcadoId; rotulo: string }[] = [
  { id: 'sapato', rotulo: 'Sapato' },
  { id: 'tenis', rotulo: 'Tênis clássico' },
  { id: 'tenisCanoAlto', rotulo: 'Tênis cano alto' },
  { id: 'tenisEsportivo', rotulo: 'Tênis esportivo' },
  { id: 'tenisCasual', rotulo: 'Tênis casual' },
  { id: 'bota', rotulo: 'Bota' },
  { id: 'chinelo', rotulo: 'Chinelo' },
  { id: 'descalco', rotulo: 'Descalço' },
];

export const CHAPEUS: { id: ChapeuId; rotulo: string }[] = [
  { id: 'nenhum', rotulo: 'Nenhum' },
  { id: 'bone', rotulo: 'Boné' },
  { id: 'fivePanel', rotulo: 'Boné five panel' },
  { id: 'quepe', rotulo: 'Quepe' },
  { id: 'capacete', rotulo: 'Capacete' },
  { id: 'balde', rotulo: 'Chapéu de pescador' },
  { id: 'touca', rotulo: 'Touca' },
  { id: 'boina', rotulo: 'Boina' },
  { id: 'viseira', rotulo: 'Viseira' },
  { id: 'palha', rotulo: 'Chapéu de palha' },
  { id: 'bandana', rotulo: 'Bandana' },
];

export const OCULOS: { id: OculosId; rotulo: string }[] = [
  { id: 'nenhum', rotulo: 'Sem óculos' },
  { id: 'armacao', rotulo: 'De grau' },
  { id: 'escuros', rotulo: 'Escuros' },
  { id: 'redondo', rotulo: 'Redondos' },
  { id: 'aviador', rotulo: 'Aviador' },
  { id: 'gatinho', rotulo: 'Gatinho' },
];

export const PELOS: { id: PelosId; rotulo: string }[] = [
  { id: 'nada', rotulo: 'Nada' },
  { id: 'bigode', rotulo: 'Bigode' },
  { id: 'barba', rotulo: 'Barba' },
  { id: 'cheia', rotulo: 'Barba cheia' },
];

export const ADERECOS: { id: VoxelAdereco; rotulo: string }[] = [
  { id: 'nada', rotulo: 'Nada' },
  { id: 'prancheta', rotulo: 'Prancheta' },
  { id: 'caneta', rotulo: 'Caneta' },
  { id: 'livro', rotulo: 'Livro' },
  { id: 'tablet', rotulo: 'Tablet' },
  { id: 'celular', rotulo: 'Celular' },
  { id: 'garrafa', rotulo: 'Garrafa' },
  { id: 'pincel', rotulo: 'Pincel' },
  { id: 'radio', rotulo: 'Rádio' },
  { id: 'vaso', rotulo: 'Vaso' },
  { id: 'violao', rotulo: 'Violão' },
  { id: 'guitarra', rotulo: 'Guitarra' },
  { id: 'vara', rotulo: 'Vara de pesca' },
  { id: 'peixe', rotulo: 'Peixe' },
  { id: 'passaro', rotulo: 'Pássaro' },
  { id: 'martelo', rotulo: 'Martelo' },
  { id: 'chave', rotulo: 'Chave' },
  { id: 'rifle', rotulo: 'Fuzil' },
];

export const CORES_PELE = ['#f7dcc0', '#f4d0a8', '#f0b080', '#f0a060', '#e08040', '#c07a42', '#a05030', '#7a4a2c', '#5c3a24', '#4a3326'];
export const CORES_PELO = ['#df3433', '#e5ae4b', '#a87550', '#d99443', '#f08010', '#c07a42', '#8a6a4f', '#5c4433', '#2f2a26', '#bdb3a8', '#8f8375', '#e8ddcc', '#fdfbf7'];
export const CORES_CABELO = ['#2a1c14', '#402020', '#603020', '#8a5a2a', '#b05010', '#e9c46a', '#f0d090', '#d8d2c8', '#f3ece0', '#e04020', '#8a2be2', '#2f6fd0', '#2E4A54', '#8A9A7B'];
export const CORES_OLHOS = ['#2a1f1a', '#4a2f1a', '#5a3a1f', '#4a8a3a', '#6a8a3a', '#2E4A54', '#2f6fd0', '#7D7A36', '#8f8375', '#b3422f'];
export const CORES_ROUPA = ['#fdfbf7', '#f3ece0', '#e8ddcc', '#c9a87c', '#8a6a4f', '#e96f34', '#D8A53A', '#8A9A7B', '#7D7A36', '#2E4A54', '#2f6fd0', '#40a0a0', '#8a2be2', '#f04030', '#e88c9a', '#473c33', '#2a2a2e', '#303038'];

// ------------------------------------------------------------------ guardar

const COR = /^#[0-9a-f]{6}$/i;
const PECAS_CHAPEU = ['bone', 'boneAba', 'fivePanel', 'balde', 'quepe', 'capacete', 'touca', 'boina', 'viseira', 'palha', 'bandana'] as const;

/** Multiplica o tom, como o VoxelAvatar faz para dar luz às faces. */
const mult = (hex: string, k: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${((1 << 24) + (c(n >> 16) << 16) + (c((n >> 8) & 255) << 8) + c(n & 255)).toString(16).slice(1)}`;
};

// O que está no localStorage é texto que o usuário pode editar, e cada cor dali
// vai direto para `background` de uma div. Por isso nada entra sem conferência:
// cor tem de casar com #rrggbb, id tem de existir nas listas do próprio app e o
// nome vira texto de um só trecho, com tamanho de cabeçalho.
export const limpar = (bruto: unknown): Mascote => {
  const a = (bruto || {}) as Record<string, unknown>;
  const limpo: Mascote = { modo: a.modo === 'criado' ? 'criado' : 'pronto' };
  const cor = (v: unknown): string | undefined => (typeof v === 'string' && COR.test(v) ? v : undefined);
  const um = <T extends string>(v: unknown, lista: readonly { id: T }[]): T | undefined =>
    lista.some((i) => i.id === v) ? (v as T) : undefined;

  if (typeof a.base === 'string' && VOXEL_CHARACTERS[a.base]) limpo.base = a.base;
  if (typeof a.nome === 'string') {
    const nome = a.nome.replace(/\s+/g, ' ').trim().slice(0, 24);
    if (nome) limpo.nome = nome;
  }
  limpo.sexo = um(a.sexo, SEXOS);
  limpo.especie = um(a.especie, ESPECIES);
  limpo.estilo = um(a.estilo, ESTILOS_CABELO);
  limpo.camisa = um(a.camisa, CAMISAS);
  limpo.calca = um(a.calca, CALCAS);
  limpo.calcado = um(a.calcado, CALCADOS);
  limpo.chapeu = um(a.chapeu, CHAPEUS);
  limpo.oculos = um(a.oculos, OCULOS);
  limpo.pelos = um(a.pelos, PELOS);
  limpo.dir = um(a.dir, ADERECOS);
  if (POSES_ESCOLHIVEIS.some((p) => p.pose === a.animacao)) limpo.animacao = a.animacao as VoxelPose;
  limpo.esq = um(a.esq, ADERECOS);
  if (a.cilios === true) limpo.cilios = true;
  if (a.pinta === true) limpo.pinta = true;
  if (a.cinto === true) limpo.cinto = true;
  (['pele', 'cabelo', 'olhos', 'corCamisa', 'corDetalhe', 'corCalca', 'corCalcado', 'corDetalheCalcado', 'corOculos', 'corChapeu'] as const).forEach((campo) => {
    const v = cor(a[campo]);
    if (v) limpo[campo] = v;
  });
  return limpo;
};

export const ler = (): Mascote => {
  try {
    const cru = localStorage.getItem(CHAVE);
    return cru ? limpar(JSON.parse(cru)) : { modo: 'pronto' };
  } catch {
    return { modo: 'pronto' };
  }
};

/** Avisa quem está mostrando o boneco de que a receita mudou. O estúdio e o
 *  companheiro do canto são telas diferentes e não compartilham estado: sem
 *  este aviso o boneco do canto só mudava no próximo carregamento da página. */
export const AVISO = 'tdh-mascote-mudou';

export const gravar = (m: Mascote) => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(m));
  } catch {
    /* modo privado: a escolha vale só nesta sessão */
  }
  window.dispatchEvent(new CustomEvent(AVISO));
};

// ------------------------------------------------------- montar a receita

/**
 * Põe na receita o chapéu escolhido, tirando antes o que já estivesse lá.
 * Vale nos dois modos: no criado a cabeça começa vazia, no pronto ela começa
 * com o chapéu do personagem — e é por aqui que ele sai.
 */
const porChapeu = (cfg: VoxelConfig, chapeu: ChapeuId, cor: string) => {
  PECAS_CHAPEU.forEach((peca) => delete cfg[peca]);
  if (chapeu === 'bone') { cfg.bone = cor; cfg.boneAba = mult(cor, 0.78); }
  if (chapeu === 'fivePanel') cfg.fivePanel = cor;
  if (chapeu === 'quepe') cfg.quepe = cor;
  if (chapeu === 'capacete') cfg.capacete = cor;
  if (chapeu === 'balde') cfg.balde = cor;
  if (chapeu === 'touca') cfg.touca = cor;
  if (chapeu === 'boina') cfg.boina = cor;
  if (chapeu === 'viseira') cfg.viseira = cor;
  if (chapeu === 'palha') cfg.palha = cor;
  if (chapeu === 'bandana') cfg.bandana = cor;
};

/** Modo 'pronto': a receita do personagem com os retoques de cor por cima. */
export const aplicarMascote = (base: VoxelConfig, m: Mascote): VoxelConfig => {
  const cfg: VoxelConfig = { ...base };
  if (m.estilo) cfg.estilo = m.estilo;
  if (m.cabelo) cfg.cabelo = m.cabelo;
  // Vários personagens têm mechas próprias desenhadas à mão por cima do cabelo
  // padrão. Elas só combinam com o cabelo de origem, então quem mexe no cabelo
  // passa a usar apenas o penteado da tabela.
  if (m.estilo || m.cabelo) cfg.cabeloLivre = true;
  if (m.olhos) cfg.iris = m.olhos;
  if (m.corCamisa) cfg.torso = m.corCamisa;
  if (m.corCalca) cfg.pernas = m.corCalca;
  if (m.corCalcado) cfg.sapato = m.corCalcado;
  if (m.dir) cfg.dir = m.dir;
  if (m.esq) cfg.esq = m.esq;
  if (m.pele) {
    cfg.skin = m.pele;
    // Nos bichos a "pele" é o pelo: orelha, rabo e a touca de cima saem da mesma
    // cor, senão a cabeça troca de cor e as orelhas ficam da cor antiga.
    if (base.bicho) {
      cfg.bicho = { ...base.bicho, orelha: mult(m.pele, 0.88), rabo: base.bicho.rabo.map((_, i) => (i % 2 ? mult(m.pele, 0.87) : m.pele)) };
      if (!m.cabelo) cfg.cabelo = m.pele;
    }
  }
  // Sem escolha, fica o chapéu que o personagem já usava.
  if (m.chapeu) porChapeu(cfg, m.chapeu, m.corChapeu || base.bone || base.fivePanel || base.quepe || base.capacete || base.balde || base.viseira || base.palha || base.bandana || PADRAO.corChapeu);
  return cfg;
};

/** Valores de partida de quem abre o estúdio sem nada escolhido ainda. */
export const PADRAO: Required<Pick<Mascote, 'nome' | 'sexo' | 'especie' | 'pele' | 'cabelo' | 'estilo' | 'olhos' | 'camisa' | 'corCamisa' | 'corDetalhe' | 'calca' | 'corCalca' | 'calcado' | 'corCalcado' | 'chapeu' | 'corChapeu' | 'oculos' | 'pelos' | 'dir' | 'esq'>> = {
  nome: 'Meu mascote',
  sexo: 'neutro',
  especie: 'pessoa',
  pele: '#f0b080',
  cabelo: '#402020',
  estilo: 'curto',
  olhos: '#2a1f1a',
  camisa: 'camiseta',
  corCamisa: '#e96f34',
  corDetalhe: '#fdfbf7',
  calca: 'comprida',
  corCalca: '#2E4A54',
  calcado: 'sapato',
  corCalcado: '#473c33',
  chapeu: 'nenhum',
  corChapeu: '#2f6fd0',
  oculos: 'nenhum',
  pelos: 'nada',
  dir: 'nada',
  esq: 'nada',
};

/** Modo 'criado': a receita montada peça por peça, sem acabamento por nome. */
const doZero = (m: Mascote): VoxelConfig => {
  const v = { ...PADRAO, ...Object.fromEntries(Object.entries(m).filter(([, valor]) => valor !== undefined)) } as Mascote & typeof PADRAO;
  const especie = ESPECIES.find((e) => e.id === v.especie) || ESPECIES[0];
  const cfg: VoxelConfig = {
    // O nome é o do aluno de propósito: nenhum `switch (cfg.nome)` do
    // VoxelAvatar casa com ele, então o boneco sai só das peças escolhidas.
    nome: v.nome,
    skin: v.pele,
    cabelo: v.cabelo,
    estilo: v.estilo,
    cabeloLivre: true,
    iris: v.olhos,
    torso: v.corCamisa,
    pernas: v.corCalca,
    sapato: v.corCalcado,
    dir: v.dir,
    esq: v.esq,
    roupaEstudio: v.camisa,
    parteBaixoEstudio: v.calca,
    calcadoEstudio: v.calcado,
    detalheCalcadoEstudio: v.corDetalheCalcado || '#f3ece0',
  };

  if (especie.orelha) {
    cfg.bicho = {
      especie: v.especie === 'pessoa' ? undefined : v.especie,
      orelha: mult(v.pele, 0.88),
      dentro: mult(v.pele, 1.28),
      focinho: mult(v.pele, especie.focinhoClaro || 1.25),
      nariz: mult(v.pele, 0.38),
      rabo: v.especie === 'capivara' ? [] : v.especie === 'arara' ? [v.pele, '#247cac', '#e7be3f', '#247cac'] : v.especie === 'coelho' || v.especie === 'urso' ? [mult(v.pele, 1.15)] : v.especie === 'raposa' ? [v.pele, v.pele, mult(v.pele, 0.9), mult(v.pele, 1.35)] : [v.pele, mult(v.pele, 0.72), v.pele, mult(v.pele, 0.72)],
      orelhaTipo: especie.orelha,
      ...(especie.mascara ? { mascara: mult(v.pele, 0.5) } : {}),
    };
    // Nos bichos o pelo da cabeça acompanha o corpo; cabelo é só para pessoas.
    cfg.cabelo = v.pele;
    cfg.estilo = 'careca';
  }

  switch (v.camisa) {
    case 'listrada': cfg.listrasT = v.corDetalhe; break;
    case 'social': cfg.faixa = v.corDetalhe; break;
    case 'regata': cfg.regata = true; break;
    case 'moletom': cfg.capuz = v.corCamisa; break;
    case 'jaleco': cfg.jaleco = true; cfg.bolso = true; cfg.faixa = v.corDetalhe; break;
    case 'terno': cfg.lapela = mult(v.corCamisa, 1.12); cfg.gravata = v.corDetalhe; break;
    case 'colete': cfg.colete = v.corDetalhe; cfg.bolsosColete = true; break;
    case 'toga': cfg.toga = true; break;
    case 'polo': case 'jaqueta': case 'jardineira': case 'golaAlta':
    case 'xadrez': case 'futebol': case 'farda': case 'cardiga':
      cfg.detalheRoupa = v.camisa; cfg.corDetalheRoupa = v.corDetalhe; break;
    case 'sem': cfg.semCamisa = true; break;
    default: break;
  }

  if (v.calca === 'bermuda') { cfg.curto = true; cfg.bermuda = v.corCalca; }
  if (v.calca === 'saia') cfg.vestido = v.corCalca;
  if (v.cinto) { cfg.cinto = mult(v.corCalca, 0.6); cfg.fivela = '#e9b949'; }

  if (v.calcado === 'descalco') cfg.descalco = true;
  if (['tenis', 'tenisCanoAlto', 'tenisEsportivo', 'tenisCasual'].includes(v.calcado)) cfg.meia = '#fdfbf7';
  if (v.calcado === 'bota') cfg.bainha = mult(v.corCalcado, 1.2);

  porChapeu(cfg, v.chapeu, v.corChapeu);

  if (v.oculos !== 'nenhum') { cfg.oculos = v.corOculos || '#2a2a2e'; cfg.oculosEstudio = v.oculos; if (v.oculos === 'escuros') cfg.lente = '#2a2a2e'; if (v.oculos === 'aviador') cfg.lente = '#526779'; }

  // Pelo do rosto só em quem tem pele de pessoa: num bicho o focinho já ocupa
  // esse lugar e a barba virava uma mancha solta no meio da cara.
  if (!cfg.bicho) {
    cfg.sobr = mult(v.cabelo, 0.8);
    if (v.pelos === 'bigode' || v.pelos === 'cheia') cfg.bigode = v.cabelo;
    if (v.pelos === 'barba' || v.pelos === 'cheia') cfg.barba = v.cabelo;
    if (v.cilios ?? v.sexo === 'menina') cfg.cilios = mult(v.cabelo, 0.85);
    if (v.pinta) cfg.pinta = true;
  }
  return cfg;
};

/** A receita final do boneco, pronta para o VoxelAvatar montar. */
export const configDoMascote = (characterId?: string, m?: Mascote): VoxelConfig | undefined => {
  if (m?.modo === 'criado') return doZero(m);
  const base = getVoxelConfig(m?.base || characterId);
  return base && m ? aplicarMascote(base, m) : base;
};

/** O nome que aparece na roda e no chat. */
export const nomeDoMascote = (m: Mascote, padrao: string): string =>
  (m.modo === 'criado' ? m.nome : getVoxelConfig(m.base || '')?.nome) || padrao;
