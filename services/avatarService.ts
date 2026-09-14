export type CharacterPose = 'frente' | 'lado' | 'costas';

export interface CharacterOption {
  id: string;
  name: string;
  poses: Record<CharacterPose, string>;
}

const posesFor = (id: string): Record<CharacterPose, string> => ({
  frente: `/character-assets/${id}-frente.png`,
  lado: `/character-assets/${id}-lado.png`,
  costas: `/character-assets/${id}-costas.png`,
});

export const CHARACTERS: CharacterOption[] = [
  { id: 'medica', name: 'Médica', poses: posesFor('medica') },
  { id: 'guaxinim-pescador', name: 'Guaxinim Pescador', poses: posesFor('guaxinim-pescador') },
  { id: 'detetive-planta', name: 'Detetive', poses: posesFor('detetive-planta') },
  { id: 'garoto-aquario', name: 'Garoto do Aquário', poses: posesFor('garoto-aquario') },
  { id: 'gato-jaqueta', name: 'Gato Estiloso', poses: posesFor('gato-jaqueta') },
  { id: 'surfista', name: 'Surfista', poses: posesFor('surfista') },
  { id: 'roqueiro', name: 'Roqueiro', poses: posesFor('roqueiro') },
  { id: 'engenheiro', name: 'Engenheiro', poses: posesFor('engenheiro') },
  { id: 'juiz', name: 'Juiz', poses: posesFor('juiz') },
  { id: 'biomedica', name: 'Biomédica', poses: posesFor('biomedica') },
  { id: 'nutricionista', name: 'Nutricionista', poses: posesFor('nutricionista') },
  { id: 'fisioterapeuta', name: 'Fisioterapeuta', poses: posesFor('fisioterapeuta') },
];

export const defaultCharacterId = CHARACTERS[0].id;

export const getCharacter = (id?: string): CharacterOption =>
  CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];

export const getCharacterSrc = (id?: string, pose: CharacterPose = 'frente'): string =>
  getCharacter(id).poses[pose];

export type Expression =
  | 'feliz' | 'comemorando' | 'em-duvida' | 'explicando'
  | 'triste' | 'com-sono' | 'surpreso' | 'focado'
  | 'explicando2' | 'serio' | 'orgulhoso' | 'pensativo';

const EXPRESSIONS_12: Expression[] = [
  'feliz', 'comemorando', 'em-duvida', 'explicando',
  'triste', 'com-sono', 'surpreso', 'focado',
  'explicando2', 'serio', 'orgulhoso', 'pensativo',
];

const EXPRESSIONS_10: Expression[] = [
  'feliz', 'comemorando', 'em-duvida', 'explicando',
  'triste', 'com-sono', 'surpreso', 'focado',
  'orgulhoso', 'pensativo',
];

// Only characters with a processed expression sheet are listed here.
// Others (medica, guaxinim-pescador, detetive-planta, surfista, engenheiro, nutricionista)
// don't have expression sets yet.
const CHARACTERS_WITH_EXPRESSIONS: Record<string, Expression[]> = {
  'garoto-aquario': EXPRESSIONS_12,
  'fisioterapeuta': EXPRESSIONS_12,
  'biomedica': EXPRESSIONS_12,
  'roqueiro': EXPRESSIONS_12,
  'juiz': EXPRESSIONS_12,
  'gato-jaqueta': EXPRESSIONS_10,
};

export const hasExpressions = (characterId?: string): boolean =>
  !!characterId && !!CHARACTERS_WITH_EXPRESSIONS[characterId];

export const getAvailableExpressions = (characterId?: string): Expression[] =>
  (characterId && CHARACTERS_WITH_EXPRESSIONS[characterId]) || [];

// Returns undefined when this character has no asset for that expression —
// callers should fall back to getCharacterSrc(id, 'frente') in that case.
export const getExpressionSrc = (characterId?: string, expression?: Expression): string | undefined => {
  if (!characterId || !expression) return undefined;
  const available = CHARACTERS_WITH_EXPRESSIONS[characterId];
  if (!available || !available.includes(expression)) return undefined;
  return `/character-assets/expressoes/${characterId}/${expression}.png`;
};

// Per-character override for loading screens — a dedicated "carregando" pose
// (e.g. sitting and reading a paper) instead of the generic "pensativo" expression.
// Only characters with a processed pose are listed here; others fall back to
// getExpressionSrc(id, 'pensativo') ?? getCharacterSrc(id, 'frente').
const LOADING_POSE_OVERRIDES: Record<string, string> = {
  juiz: '/character-assets/expressoes/juiz/carregando.png',
  medica: '/character-assets/expressoes/medica/carregando.png',
  'guaxinim-pescador': '/character-assets/expressoes/guaxinim-pescador/carregando.png',
  'garoto-aquario': '/character-assets/expressoes/garoto-aquario/carregando.png',
  'gato-jaqueta': '/character-assets/expressoes/gato-jaqueta/carregando.png',
  surfista: '/character-assets/expressoes/surfista/carregando.png',
  engenheiro: '/character-assets/expressoes/engenheiro/carregando.png',
  nutricionista: '/character-assets/expressoes/nutricionista/carregando.png',
};

export const getLoadingSrc = (characterId?: string): string | undefined => {
  if (!characterId) return undefined;
  return LOADING_POSE_OVERRIDES[characterId] ?? getExpressionSrc(characterId, 'pensativo') ?? getCharacterSrc(characterId, 'frente');
};

// Per-character override for the "Momento de Paz" card — a calm/restful pose
// pulled from the reference sheets (sleeping, meditating, leaning back relaxed).
// Characters without a distinct peaceful pose fall back to getExpressionSrc(id, 'pensativo')
// ?? getCharacterSrc(id, 'frente'), same chain as the loading screen.
const PEACE_POSE_OVERRIDES: Record<string, string> = {
  'guaxinim-pescador': '/character-assets/expressoes/guaxinim-pescador/paz.png',
  engenheiro: '/character-assets/expressoes/engenheiro/paz.png',
  medica: '/character-assets/expressoes/medica/paz.png',
  nutricionista: '/character-assets/expressoes/nutricionista/paz.png',
  surfista: '/character-assets/expressoes/surfista/carregando.png', // meditating pose, reused
  'gato-jaqueta': '/character-assets/expressoes/gato-jaqueta/com-sono.png',
};

export const getPeaceSrc = (characterId?: string): string | undefined => {
  if (!characterId) return undefined;
  return PEACE_POSE_OVERRIDES[characterId] ?? getExpressionSrc(characterId, 'pensativo') ?? getCharacterSrc(characterId, 'frente');
};
