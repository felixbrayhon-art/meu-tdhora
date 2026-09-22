export type CharacterPose = 'frente' | 'lado' | 'costas';

// Face-closeup crop used by AvatarDisplay for small avatar icons (header, sidebar,
// character list, etc). Default works well for most characters; a couple with
// unusual head proportions (e.g. cat ears pushing the bounding box up) need a
// custom zoom/vertical anchor to actually land on the face instead of the hat/ears.
export interface FaceZoom {
  scale: number;
  positionY: string; // CSS object-position Y value, e.g. '0%'
  originX: string; // CSS transform-origin X value, e.g. '50%'
}

// positionYFrac: 0-1, fraction of the vertical overflow to crop from the top (like object-position Y%).
// shiftXFrac: -1..1, horizontal nudge — positive shifts the visible window right (use when the
// character's face sits left of their own bounding-box center, e.g. a prop sticking out on the right).
const zoomFor = (scale: number, positionYFrac: number, shiftXFrac = 0): FaceZoom => ({
  scale,
  positionY: `${Math.round(positionYFrac * 100)}%`,
  originX: `${Math.round(50 + 100 * (scale / (scale - 1)) * shiftXFrac)}%`,
});

const DEFAULT_FACE_ZOOM: FaceZoom = zoomFor(1.5, 0);

const FACE_ZOOM_OVERRIDES: Record<string, FaceZoom> = {
  'gato-jaqueta': zoomFor(1.6, 0.13),
  'guaxinim-pescador': zoomFor(1.5, 0, 0.05),
  surfista: zoomFor(1.5, 0, 0.06),
  roqueiro: zoomFor(1.5, 0, 0.09),
  'jorge-do-bem': zoomFor(1.5, 0, -0.08),
  'raposa-3d': zoomFor(1.5, 0.18),
  'garoto-aquario-3d': zoomFor(1.5, 0.08),
  'enfermeiro-3d': zoomFor(1.5, 0.10),
};

export const getFaceZoom = (characterId?: string): FaceZoom =>
  (characterId && FACE_ZOOM_OVERRIDES[characterId]) || DEFAULT_FACE_ZOOM;

export interface CharacterOption {
  id: string;
  name: string;
  poses: Record<CharacterPose, string>;
  is3D?: boolean; // Rendered in 3D instead of the default flat-vector style
  baseId?: string; // Original character used for style pairing and scene assets.
}

const posesFor = (id: string): Record<CharacterPose, string> => ({
  frente: `/character-assets/${id}-frente.png`,
  lado: `/character-assets/${id}-lado.png`,
  costas: `/character-assets/${id}-costas.png`,
});

// New 3D turnarounds are added as they become available. Until a side/back
// render exists, keep the picker usable with the original pose instead of a
// broken image URL.
const posesFor3D = (id: string, baseId: string, generated: CharacterPose[] = []): Record<CharacterPose, string> => ({
  frente: `/character-assets/${id}-frente.png`,
  lado: generated.includes('lado') ? `/character-assets/${id}-lado.png` : `/character-assets/${baseId}-lado.png`,
  costas: generated.includes('costas') ? `/character-assets/${id}-costas.png` : `/character-assets/${baseId}-costas.png`,
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
  { id: 'jorge-do-bem', name: 'Jorge do Bem', poses: posesFor('jorge-do-bem') },
  { id: 'raposa-3d', name: 'Raposa Estilosa', poses: posesFor('raposa-3d'), is3D: true },
  { id: 'garoto-aquario-3d', name: 'Garoto do Aquário 3D', poses: posesFor('garoto-aquario-3d'), is3D: true, baseId: 'garoto-aquario' },
  { id: 'enfermeiro-3d', name: 'Fisioterapeuta 3D', poses: posesFor('enfermeiro-3d'), is3D: true, baseId: 'fisioterapeuta' },
  { id: 'roqueiro-3d', name: 'Roqueiro 3D', poses: posesFor('roqueiro-3d'), is3D: true, baseId: 'roqueiro' },
  { id: 'medica-3d', name: 'Médica 3D', poses: posesFor3D('medica-3d', 'medica', ['lado']), is3D: true, baseId: 'medica' },
  { id: 'guaxinim-pescador-3d', name: 'Guaxinim Pescador 3D', poses: posesFor3D('guaxinim-pescador-3d', 'guaxinim-pescador', ['lado']), is3D: true, baseId: 'guaxinim-pescador' },
  { id: 'detetive-planta-3d', name: 'Detetive 3D', poses: posesFor3D('detetive-planta-3d', 'detetive-planta', ['lado', 'costas']), is3D: true, baseId: 'detetive-planta' },
  { id: 'gato-jaqueta-3d', name: 'Gato Estiloso 3D', poses: posesFor3D('gato-jaqueta-3d', 'gato-jaqueta', ['lado']), is3D: true, baseId: 'gato-jaqueta' },
  { id: 'surfista-3d', name: 'Surfista 3D', poses: posesFor3D('surfista-3d', 'surfista'), is3D: true, baseId: 'surfista' },
  { id: 'engenheiro-3d', name: 'Engenheiro 3D', poses: posesFor3D('engenheiro-3d', 'engenheiro', ['lado', 'costas']), is3D: true, baseId: 'engenheiro' },
  { id: 'juiz-3d', name: 'Juiz 3D', poses: posesFor3D('juiz-3d', 'juiz'), is3D: true, baseId: 'juiz' },
  { id: 'biomedica-3d', name: 'Biomédica 3D', poses: posesFor3D('biomedica-3d', 'biomedica', ['lado']), is3D: true, baseId: 'biomedica' },
  { id: 'nutricionista-3d', name: 'Nutricionista 3D', poses: posesFor('nutricionista-3d'), is3D: true, baseId: 'nutricionista' },
  { id: 'jorge-do-bem-3d', name: 'Jorge do Bem 3D', poses: posesFor('jorge-do-bem-3d'), is3D: true, baseId: 'jorge-do-bem' },
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

// Jorge do Bem only has a handful of custom action poses (not the full 12-shot
// sheet), mapped to the closest matching expressions: cantando->comemorando,
// apontando->explicando, ajoelhado->focado.
const EXPRESSIONS_JORGE: Expression[] = ['comemorando', 'explicando', 'focado'];

// Raposa Estilosa has the full 12-shot expression sheet.
const EXPRESSIONS_RAPOSA: Expression[] = EXPRESSIONS_12;

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
  'raposa-3d': EXPRESSIONS_RAPOSA,
  'roqueiro-3d': EXPRESSIONS_12,
  'garoto-aquario-3d': EXPRESSIONS_12,
  'jorge-do-bem': EXPRESSIONS_JORGE,
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
  'jorge-do-bem': '/character-assets/expressoes/jorge-do-bem/carregando.png',
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
  'jorge-do-bem': '/character-assets/expressoes/jorge-do-bem/paz.png',
  'raposa-3d': '/character-assets/expressoes/raposa-3d/com-sono.png',
  'roqueiro-3d': '/character-assets/expressoes/roqueiro-3d/com-sono.png',
  'garoto-aquario-3d': '/character-assets/expressoes/garoto-aquario-3d/com-sono.png',
};

export const getPeaceSrc = (characterId?: string): string | undefined => {
  if (!characterId) return undefined;
  return PEACE_POSE_OVERRIDES[characterId] ?? getExpressionSrc(characterId, 'pensativo') ?? getCharacterSrc(characterId, 'frente');
};

// Themed backdrop scene for the loading screen — a room/place matching each
// character's profession or hobby (clinic, aquarium, garage stage, etc).
export const getSceneSrc = (characterId?: string): string | undefined => {
  const character = CHARACTERS.find(c => c.id === characterId);
  if (!character) return undefined;
  return `/character-assets/scenarios/${character.baseId ?? character.id}.jpg`;
};

// A short idle-loop video shown in the character picker's "frente" preview,
// for characters that have one. Only a couple of characters have this so far.
const SELECT_ANIMATIONS: Record<string, string> = {
  'roqueiro-3d': '/character-assets/animations/roqueiro-3d.mp4',
  'raposa-3d': '/character-assets/animations/raposa-3d.mp4',
  'enfermeiro-3d': '/character-assets/animations/enfermeiro-3d.mp4',
  'garoto-aquario-3d': '/character-assets/animations/garoto-aquario-3d.mp4',
};

export const getSelectAnimationSrc = (characterId?: string): string | undefined => {
  if (!characterId) return undefined;
  return SELECT_ANIMATIONS[characterId];
};
