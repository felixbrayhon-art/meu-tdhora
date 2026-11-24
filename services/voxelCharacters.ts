// Receita de cada companheiro em cubos, para o mascote 3D do canto da tela.
// As cores saíram das próprias artes em public/character-assets/to-dahora-2d/
// (amostradas por faixa de altura: cabelo, rosto, tronco, perna, pé), para o
// boneco não divergir do desenho que o aluno escolheu no onboarding.
export type VoxelCabelo = 'curto' | 'cacheado' | 'afro' | 'longo' | 'careca' | 'moicano' | 'coque' | 'rabo' | 'chanel' | 'trancas' | 'ondulado' | 'coques' | 'espetado' | 'topete' | 'raspado' | 'dreads' | 'chiquinhas';
/** Formato da orelha do bicho. Sem valor, fica a orelha dos personagens prontos. */
export type VoxelOrelha = 'ponta' | 'caida' | 'redonda' | 'comprida';
export type VoxelAdereco =
  | 'prancheta' | 'tablet' | 'caneta' | 'vaso' | 'radio' | 'vara' | 'peixe'
  | 'violao' | 'guitarra' | 'rifle' | 'chave' | 'livro' | 'martelo' | 'passaro' | 'celular' | 'garrafa' | 'pincel' | 'nada';

export interface VoxelBicho {
  especie?: 'cachorro' | 'gato' | 'raposa' | 'guaxinim' | 'urso' | 'coelho' | 'rato' | 'capivara' | 'onca' | 'arara';
  orelha: string;
  dentro: string;
  focinho: string;
  nariz: string;
  rabo: string[];
  /** Faixa escura em volta dos olhos (guaxinim). */
  mascara?: string;
  orelhaTipo?: VoxelOrelha;
}

export interface VoxelConfig {
  nome: string;
  skin: string;
  cabelo: string;
  estilo: VoxelCabelo;
  /** O aluno mexeu no cabelo: use só o penteado da tabela, sem mechas à mão. */
  cabeloLivre?: boolean;
  torso: string;
  pernas: string;
  sapato: string;
  faixa?: string;
  iris?: string;
  // chapelaria
  bone?: string;
  boneAba?: string;
  fivePanel?: string;
  balde?: string;
  quepe?: string;
  capacete?: string;
  touca?: string;
  boina?: string;
  viseira?: string;
  palha?: string;
  bandana?: string;
  // roupa
  roupaEstudio?: 'camiseta' | 'listrada' | 'social' | 'regata' | 'moletom' | 'jaleco' | 'terno' | 'colete' | 'toga' | 'polo' | 'jaqueta' | 'jardineira' | 'golaAlta' | 'xadrez' | 'futebol' | 'farda' | 'cardiga' | 'sem';
  parteBaixoEstudio?: 'comprida' | 'bermuda' | 'saia';
  calcadoEstudio?: 'sapato' | 'tenis' | 'tenisCanoAlto' | 'tenisEsportivo' | 'tenisCasual' | 'bota' | 'chinelo' | 'descalco';
  detalheCalcadoEstudio?: string;
  detalheRoupa?: 'polo' | 'jaqueta' | 'jardineira' | 'golaAlta' | 'xadrez' | 'futebol' | 'farda' | 'cardiga';
  corDetalheRoupa?: string;
  jaleco?: boolean;
  lapela?: string;
  gravata?: string;
  toga?: boolean;
  colete?: string;
  bolsosColete?: boolean;
  bolso?: boolean;
  estetoscopio?: boolean;
  cinto?: string;
  fivela?: string;
  dragona?: string;
  listrasT?: string;
  listra?: string;
  bainha?: string;
  meia?: string;
  regata?: boolean;
  /** Saia ou vestido, por cima da cintura. */
  vestido?: string;
  /** Moletom: capuz atrás da cabeça, gola e bolso canguru. */
  capuz?: string;
  semCamisa?: boolean;
  bermuda?: string;
  curto?: boolean;
  descalco?: boolean;
  // rosto
  sobr?: string;
  bigode?: string;
  barba?: string;
  oculos?: string;
  oculosEstudio?: 'armacao' | 'escuros' | 'redondo' | 'aviador' | 'gatinho';
  lente?: string;
  mascara?: string;
  pinta?: boolean;
  /** Cílios: traço por cima do olho e pontinho no canto de fora. */
  cilios?: string;
  // extras
  bicho?: VoxelBicho;
  aquario?: boolean;
  relogio?: string;
  pranchaLado?: boolean;
  dir?: VoxelAdereco;
  esq?: VoxelAdereco;
}

export const VOXEL_CHARACTERS: Record<string, VoxelConfig> = {
  'biomedica': { nome: 'Biomédica', skin: '#f0b070', cabelo: '#f0d090', estilo: 'longo', torso: '#fdfbf7', faixa: '#2060d0', pernas: '#2060d0', sapato: '#30a0f0', jaleco: true, estetoscopio: true, bolso: true, dir: 'tablet', esq: 'caneta' },
  'detetive-planta': { nome: 'Detetive', skin: '#f0a050', cabelo: '#403030', estilo: 'cacheado', torso: '#c9a87c', faixa: '#4c4c52', pernas: '#c9a87c', sapato: '#6b4529', bainha: '#d6b98f', meia: '#fdfbf7', lapela: '#d6b98f', gravata: '#2a2a2e', bigode: '#241a14', sobr: '#241a14', dir: 'vaso', esq: 'radio' },
  'diplomata-petrobras': { nome: 'Diplomata', skin: '#e08040', cabelo: '#302020', estilo: 'cacheado', torso: '#f05000', faixa: '#f3ece0', pernas: '#f05000', sapato: '#302010', listra: '#f3ece0', oculos: '#2a2a2e', dir: 'radio', esq: 'nada' },
  'engenheiro': { nome: 'Engenheiro', skin: '#f0a060', cabelo: '#603020', estilo: 'cacheado', torso: '#3060a0', faixa: '#e9b949', pernas: '#305090', sapato: '#503020', capacete: '#e9b949', oculos: '#2a2a2e', dir: 'livro', esq: 'chave' },
  'fisioterapeuta': { nome: 'Fisioterapeuta', skin: '#f0a070', cabelo: '#603010', estilo: 'cacheado', torso: '#40a0a0', faixa: '#36908f', pernas: '#309090', sapato: '#502010', bigode: '#4a2a12', dir: 'nada', esq: 'nada' },
  'garoto-aquario': { nome: 'Garoto do Aquário', skin: '#f0a060', cabelo: '#6b4a2f', estilo: 'cacheado', torso: '#e8a81f', pernas: '#707070', sapato: '#e8ddc4', bone: '#2e2b2a', listrasT: '#c98c12', cinto: '#2e2b2a', fivela: '#e9b949', bigode: '#241a14', sobr: '#241a14', pinta: true, aquario: true, relogio: '#2e2b2a' },
  'gato-jaqueta': { nome: 'Gato Estiloso', skin: '#f08010', cabelo: '#f08010', estilo: 'careca', torso: '#604030', faixa: '#f3ece0', pernas: '#d8d8e4', sapato: '#f0e0b0', bone: '#3f6fb5', iris: '#4a8a3a', bicho: { orelha: '#e06f0a', dentro: '#f0c9a0', focinho: '#f0e0c0', nariz: '#c25a3a', rabo: ['#f08010', '#e06f0a', '#f08010', '#e06f0a'] }, dir: 'nada', esq: 'nada' },
  'guaxinim-pescador': { nome: 'Guaxinim Pescador', skin: '#bdb3a8', cabelo: '#bdb3a8', estilo: 'careca', torso: '#ded3c4', pernas: '#44474c', sapato: '#f5c518', bone: '#8a4f2a', colete: '#5f7a46', bolsosColete: true, curto: true, iris: '#5a3a1f', bicho: { orelha: '#8a8078', dentro: '#ded3c4', focinho: '#ded3c4', nariz: '#241f27', rabo: ['#ded3c4', '#4a4a50', '#ded3c4', '#4a4a50'], mascara: '#4a4a50' }, dir: 'peixe', esq: 'vara' },
  'homem-jaqueta-jeans': { nome: 'Homem de Jaqueta Jeans', skin: '#c06030', cabelo: '#302010', estilo: 'curto', torso: '#406090', faixa: '#f3ece0', pernas: '#406080', sapato: '#f0e0d0', dir: 'nada', esq: 'nada' },
  'jorge-do-bem': { nome: 'Jorge do Bem', skin: '#e07030', cabelo: '#302010', estilo: 'cacheado', torso: '#f04030', pernas: '#90b0d0', sapato: '#402010', oculos: '#2a2a2e', lente: '#2a2a2e', dir: 'violao', esq: 'nada' },
  'juiz': { nome: 'Juiz', skin: '#e07030', cabelo: '#402020', estilo: 'cacheado', torso: '#303030', faixa: '#f3ece0', pernas: '#302020', sapato: '#302020', toga: true, barba: '#2a1c14', dir: 'martelo', esq: 'livro' },
  'marinheiro': { nome: 'Marinheiro', skin: '#a05030', cabelo: '#2a1c14', estilo: 'curto', torso: '#f0f0f0', faixa: '#202040', pernas: '#202030', sapato: '#303030', quepe: '#f0f0f0', dragona: '#1f2a52', dir: 'nada', esq: 'nada' },
  'medica': { nome: 'Médica', skin: '#f0a050', cabelo: '#4a3326', estilo: 'longo', torso: '#fdfbf7', faixa: '#2f6fd0', pernas: '#2070d0', sapato: '#f0e0e0', jaleco: true, estetoscopio: true, bolso: true, dir: 'prancheta', esq: 'caneta' },
  'militar': { nome: 'Militar', skin: '#8a7a5a', cabelo: '#2e2e2e', estilo: 'careca', torso: '#4a5a34', faixa: '#39462a', pernas: '#4a5a34', sapato: '#503020', capacete: '#39462a', mascara: '#2e2e2e', colete: '#39462a', dir: 'rifle', esq: 'nada' },
  'nutricionista': { nome: 'Nutricionista', skin: '#f0b080', cabelo: '#b05010', estilo: 'curto', torso: '#fdfbf7', faixa: '#b07040', pernas: '#404050', sapato: '#402010', jaleco: true, estetoscopio: true, bolso: true, barba: '#b05010', dir: 'prancheta', esq: 'nada' },
  'policial': { nome: 'Policial', skin: '#f0a060', cabelo: '#2a2a2e', estilo: 'careca', torso: '#303038', faixa: '#23232a', pernas: '#404060', sapato: '#2a2a2e', quepe: '#304060', colete: '#23232a', bigode: '#2a2a2e', dir: 'rifle', esq: 'nada' },
  'rapaz-regata': { nome: 'Rapaz de Regata', skin: '#e08040', cabelo: '#302020', estilo: 'cacheado', torso: '#404040', pernas: '#e08040', sapato: '#302020', regata: true, curto: true, bermuda: '#e88c9a', bigode: '#241a14', dir: 'nada', esq: 'nada' },
  'raposa': { nome: 'Raposa Estilosa', skin: '#f09030', cabelo: '#f09030', estilo: 'careca', torso: '#704030', faixa: '#e0d0b0', pernas: '#e0d0b0', sapato: '#f0d0b0', bone: '#3f6fb5', iris: '#6a8a3a', bicho: { orelha: '#e06010', dentro: '#f0e0c0', focinho: '#f0e0c0', nariz: '#2a1f1a', rabo: ['#f09030', '#e06010', '#f09030', '#f0e0c0'] }, dir: 'nada', esq: 'nada' },
  'roqueiro': { nome: 'Roqueiro', skin: '#e07030', cabelo: '#302020', estilo: 'afro', torso: '#4080c0', faixa: '#f0e0c0', pernas: '#e04020', sapato: '#302020', oculos: '#2a2a2e', lente: '#2a2a2e', dir: 'guitarra', esq: 'nada' },
  'senhor-bone': { nome: 'Senhor de Boné', skin: '#f0a060', cabelo: '#d8d2c8', estilo: 'curto', torso: '#f0e0d0', pernas: '#80a0a0', sapato: '#604040', bone: '#f0e0d0', boneAba: '#d8c8b8', bigode: '#8a7f72', dir: 'nada', esq: 'nada' },
  'surfista': { nome: 'Surfista', skin: '#f0a050', cabelo: '#e9c46a', estilo: 'cacheado', torso: '#f0a050', pernas: '#602070', sapato: '#f0a050', bone: '#0050b0', semCamisa: true, descalco: true, pranchaLado: true, dir: 'nada', esq: 'nada' },
  'nativo': { nome: 'Nativo', skin: '#c07a42', cabelo: '#2a1c14', estilo: 'curto', torso: '#c9a87c', faixa: '#8a6a4f', pernas: '#c9a87c', sapato: '#5a3a22', lapela: '#d6b98f', dir: 'passaro', esq: 'nada' },
  'vira-lata-caramelo': { nome: 'Vira-Lata Caramelo', skin: '#d07030', cabelo: '#d07030', estilo: 'careca', torso: '#c0d0f0', faixa: '#a8c0e8', pernas: '#303030', sapato: '#6b4529', balde: '#f0f0d0', iris: '#4a2f1a', bicho: { orelha: '#a85a22', dentro: '#e8b88a', focinho: '#f0d8b8', nariz: '#2a1f1a', rabo: ['#d07030', '#c06828', '#d07030'] }, dir: 'nada', esq: 'nada' },
};

/**
 * As animações do boneco. Moram aqui, e não no componente que desenha, porque
 * o mascote guarda qual delas o aluno escolheu — e um serviço não pode
 * depender de um componente sem fechar um ciclo entre os dois.
 */
export type VoxelPose = 'parado' | 'estudando' | 'tchau' | 'dormindo' | 'andando' | 'voltando' | 'festejando' | 'dancando' | 'distraido-olhar' | 'distraido-maos' | 'distraido-pes' | 'lendo';

/** As que dá para escolher na tela. 'andando' fica de fora: é a saída. */
export const POSES_ESCOLHIVEIS: { pose: VoxelPose; rotulo: string }[] = [
  { pose: 'estudando', rotulo: 'Estudando' },
  { pose: 'lendo', rotulo: 'Lendo' },
  { pose: 'parado', rotulo: 'De boa' },
  { pose: 'tchau', rotulo: 'Acenando' },
  { pose: 'festejando', rotulo: 'Comemorando' },
  { pose: 'dancando', rotulo: 'Dançando' },
  { pose: 'distraido-olhar', rotulo: 'Olhando em volta' },
  { pose: 'distraido-maos', rotulo: 'Brincando com as mãos' },
  { pose: 'distraido-pes', rotulo: 'Balançando os pés' },
  { pose: 'dormindo', rotulo: 'Dormindo' },
];

export const getVoxelConfig = (id?: string): VoxelConfig | undefined =>
  id ? VOXEL_CHARACTERS[id] : undefined;
