// Ajustes que o aluno faz no mascote 3D do canto da tela: trocar o tipo, o
// cabelo, a cor dos olhos, a pele e a roupa. Guardamos só o que foi mexido —
// um punhado de campos — e não a receita inteira do boneco. Assim, quando um
// personagem é refinado no VoxelAvatar, quem só trocou a cor dos olhos recebe
// o refinamento junto, em vez de ficar preso a uma cópia velha.
import { VOXEL_CHARACTERS, VoxelAdereco, VoxelCabelo, VoxelConfig, getVoxelConfig } from './voxelCharacters';

export interface VoxelAjustes {
  /** Qual receita serve de base. Vazio = o personagem escolhido no onboarding. */
  base?: string;
  estilo?: VoxelCabelo;
  cabelo?: string;
  skin?: string;
  iris?: string;
  torso?: string;
  pernas?: string;
  sapato?: string;
  /** Tira boné, quepe, capacete ou balde para o cabelo aparecer. */
  semChapeu?: boolean;
  dir?: VoxelAdereco;
  esq?: VoxelAdereco;
}

const CHAVE = 'tdh_mascote_ajustes';

export const MASCOTES: { id: string; nome: string }[] = Object.entries(VOXEL_CHARACTERS)
  .map(([id, cfg]) => ({ id, nome: cfg.nome }))
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

export const ESTILOS_CABELO: { id: VoxelCabelo; rotulo: string }[] = [
  { id: 'curto', rotulo: 'Curto' },
  { id: 'cacheado', rotulo: 'Cacheado' },
  { id: 'afro', rotulo: 'Afro' },
  { id: 'longo', rotulo: 'Longo' },
  { id: 'careca', rotulo: 'Careca' },
];

export const ADERECOS: { id: VoxelAdereco; rotulo: string }[] = [
  { id: 'nada', rotulo: 'Nada' },
  { id: 'prancheta', rotulo: 'Prancheta' },
  { id: 'caneta', rotulo: 'Caneta' },
  { id: 'livro', rotulo: 'Livro' },
  { id: 'tablet', rotulo: 'Tablet' },
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

export const CORES_PELE = ['#f7dcc0', '#f4d0a8', '#f0b080', '#f0a060', '#e08040', '#c07a42', '#a05030', '#7a4a2c', '#4a3326', '#d99443', '#bdb3a8', '#f08010'];
export const CORES_CABELO = ['#2a1c14', '#402020', '#603020', '#8a5a2a', '#b05010', '#e9c46a', '#f0d090', '#d8d2c8', '#f3ece0', '#e04020', '#8a2be2', '#2f6fd0'];
export const CORES_OLHOS = ['#2a1f1a', '#4a2f1a', '#5a3a1f', '#4a8a3a', '#6a8a3a', '#2E4A54', '#2f6fd0', '#7D7A36', '#8f8375', '#b3422f'];
export const CORES_ROUPA = ['#fdfbf7', '#f3ece0', '#e8ddcc', '#c9a87c', '#8a6a4f', '#e96f34', '#D8A53A', '#8A9A7B', '#7D7A36', '#2E4A54', '#2f6fd0', '#40a0a0', '#8a2be2', '#f04030', '#e88c9a', '#473c33', '#2a2a2e', '#303038'];

const COR = /^#[0-9a-f]{6}$/i;
const CHAPEUS = ['bone', 'boneAba', 'balde', 'quepe', 'capacete'] as const;

/** Multiplica o tom, como o VoxelAvatar faz para dar luz às faces. */
const mult = (hex: string, k: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${((1 << 24) + (c(n >> 16) << 16) + (c((n >> 8) & 255) << 8) + c(n & 255)).toString(16).slice(1)}`;
};

// O que está no localStorage é texto que o usuário pode editar, e cada cor daqui
// vai direto para `background` de uma div. Por isso nada entra sem conferência:
// cor tem de casar com #rrggbb, e id tem de existir nas listas do próprio app.
export const limparAjustes = (bruto: unknown): VoxelAjustes => {
  const a = (bruto || {}) as Record<string, unknown>;
  const cor = (v: unknown): string | undefined => (typeof v === 'string' && COR.test(v) ? v : undefined);
  const limpo: VoxelAjustes = {};
  if (typeof a.base === 'string' && VOXEL_CHARACTERS[a.base]) limpo.base = a.base;
  if (ESTILOS_CABELO.some((e) => e.id === a.estilo)) limpo.estilo = a.estilo as VoxelCabelo;
  if (ADERECOS.some((d) => d.id === a.dir)) limpo.dir = a.dir as VoxelAdereco;
  if (ADERECOS.some((d) => d.id === a.esq)) limpo.esq = a.esq as VoxelAdereco;
  if (a.semChapeu === true) limpo.semChapeu = true;
  (['cabelo', 'skin', 'iris', 'torso', 'pernas', 'sapato'] as const).forEach((campo) => {
    const v = cor(a[campo]);
    if (v) limpo[campo] = v;
  });
  return limpo;
};

export const lerAjustes = (): VoxelAjustes => {
  try {
    const cru = localStorage.getItem(CHAVE);
    return cru ? limparAjustes(JSON.parse(cru)) : {};
  } catch {
    return {};
  }
};

export const gravarAjustes = (ajustes: VoxelAjustes) => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(ajustes));
  } catch {
    /* modo privado: a escolha vale só nesta sessão */
  }
};

/** A receita de base, já contando a troca de tipo feita no editor. */
export const configBase = (characterId?: string, ajustes?: VoxelAjustes): VoxelConfig | undefined =>
  getVoxelConfig(ajustes?.base || characterId);

export const aplicarAjustes = (base: VoxelConfig, aj: VoxelAjustes): VoxelConfig => {
  const cfg: VoxelConfig = { ...base };
  if (aj.estilo) cfg.estilo = aj.estilo;
  if (aj.cabelo) cfg.cabelo = aj.cabelo;
  // Vários personagens têm mechas próprias desenhadas à mão por cima do cabelo
  // padrão. Elas só combinam com o cabelo de origem, então quem mexe no cabelo
  // passa a usar apenas o penteado da tabela.
  if (aj.estilo || aj.cabelo) cfg.cabeloLivre = true;
  if (aj.iris) cfg.iris = aj.iris;
  if (aj.torso) cfg.torso = aj.torso;
  if (aj.pernas) cfg.pernas = aj.pernas;
  if (aj.sapato) cfg.sapato = aj.sapato;
  if (aj.dir) cfg.dir = aj.dir;
  if (aj.esq) cfg.esq = aj.esq;
  if (aj.skin) {
    cfg.skin = aj.skin;
    // Nos bichos a "pele" é o pelo: orelha, rabo e a touca de cima saem da mesma
    // cor, senão a cabeça troca de cor e as orelhas ficam da cor antiga.
    if (base.bicho) {
      cfg.bicho = { ...base.bicho, orelha: mult(aj.skin, 0.88), rabo: base.bicho.rabo.map((_, i) => (i % 2 ? mult(aj.skin, 0.87) : aj.skin)) };
      if (!aj.cabelo) cfg.cabelo = aj.skin;
    }
  }
  if (aj.semChapeu) CHAPEUS.forEach((peca) => delete cfg[peca]);
  return cfg;
};

/** A receita final do boneco: base escolhida + ajustes, pronta para montar. */
export const configFinal = (characterId?: string, ajustes?: VoxelAjustes): VoxelConfig | undefined => {
  const base = configBase(characterId, ajustes);
  return base && ajustes ? aplicarAjustes(base, ajustes) : base;
};
