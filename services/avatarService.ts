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
};

export const getFaceZoom = (characterId?: string): FaceZoom => {
  const id = resolveCharacterId(characterId);
  return (id && FACE_ZOOM_OVERRIDES[id]) || DEFAULT_FACE_ZOOM;
};

export interface CharacterOption {
  id: string;
  name: string;
  poses: Record<CharacterPose, string>;
  baseId?: string; // Original character used for style pairing and scene assets.
}

// 2D characters redrawn from a single turnaround sheet. Each view is cropped
// from public/character-assets/to-dahora-2d/turnaround4-<id>.png.
const REDRAWN_2D_CHARACTER_IDS = new Set([
  'medica', 'guaxinim-pescador', 'detetive-planta', 'garoto-aquario',
  'gato-jaqueta', 'surfista', 'roqueiro', 'engenheiro', 'juiz',
  'biomedica', 'nutricionista', 'fisioterapeuta', 'jorge-do-bem', 'raposa',
]);

const posesFor = (id: string): Record<CharacterPose, string> => {
  if (id === 'diplomata-petrobras') {
    const base = `/character-assets/to-dahora-2d/${id}`;
    return { frente: `${base}-frente.png`, lado: `${base}-lado-direito.png`, costas: `${base}-costas.svg` };
  }
  if (id === 'militar' || id === 'policial' || id === 'marinheiro') {
    const base = `/character-assets/to-dahora-2d/${id}`;
    return { frente: `${base}-frente.png`, lado: `${base}-lado-direito.png`, costas: `${base}-costas.png` };
  }
  if (REDRAWN_2D_CHARACTER_IDS.has(id)) {
    const base = `/character-assets/to-dahora-2d/${id}`;
    return { frente: `${base}-frente.webp`, lado: `${base}-lado-direito.webp`, costas: `${base}-costas.webp` };
  }
  return {
    frente: `/character-assets/${id}-frente.png`,
    lado: `/character-assets/${id}-lado.png`,
    costas: `/character-assets/${id}-costas.png`,
  };
};

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
  { id: 'raposa', name: 'Raposa Estilosa', poses: posesFor('raposa') },
  { id: 'militar', name: 'Militar', poses: posesFor('militar') },
  { id: 'policial', name: 'Policial', poses: posesFor('policial') },
  { id: 'marinheiro', name: 'Marinheiro', poses: posesFor('marinheiro') },
  { id: 'diplomata-petrobras', name: 'Diplomata da Petrobras', poses: posesFor('diplomata-petrobras') },
];

export const defaultCharacterId = CHARACTERS[0].id;

// The 3D characters were retired. Profiles that saved one keep their character
// in its 2D version (e.g. 'roqueiro-3d' -> 'roqueiro').
const RETIRED_3D_TO_2D: Record<string, string> = {
  'enfermeiro-3d': 'fisioterapeuta',
};

export const resolveCharacterId = (id?: string): string | undefined => {
  if (!id) return id;
  if (RETIRED_3D_TO_2D[id]) return RETIRED_3D_TO_2D[id];
  if (id.endsWith('-3d')) {
    const base = id.slice(0, -3);
    if (CHARACTERS.some((c) => c.id === base)) return base;
  }
  return id;
};

export const getCharacter = (id?: string): CharacterOption => {
  const resolved = resolveCharacterId(id);
  return CHARACTERS.find(c => c.id === resolved) ?? CHARACTERS[0];
};

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
  'jorge-do-bem': EXPRESSIONS_JORGE,
};

export const hasExpressions = (characterId?: string): boolean => {
  const id = resolveCharacterId(characterId);
  return !!id && !!CHARACTERS_WITH_EXPRESSIONS[id];
};

export const getAvailableExpressions = (characterId?: string): Expression[] => {
  const id = resolveCharacterId(characterId);
  return (id && CHARACTERS_WITH_EXPRESSIONS[id]) || [];
};

// Returns undefined when this character has no asset for that expression —
// callers should fall back to getCharacterSrc(id, 'frente') in that case.
export const getExpressionSrc = (rawCharacterId?: string, expression?: Expression): string | undefined => {
  const characterId = resolveCharacterId(rawCharacterId);
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

export const getLoadingSrc = (rawCharacterId?: string): string | undefined => {
  const characterId = resolveCharacterId(rawCharacterId);
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
};

export const getPeaceSrc = (rawCharacterId?: string): string | undefined => {
  const characterId = resolveCharacterId(rawCharacterId);
  if (!characterId) return undefined;
  return PEACE_POSE_OVERRIDES[characterId] ?? getExpressionSrc(characterId, 'pensativo') ?? getCharacterSrc(characterId, 'frente');
};

// Themed backdrop scene for the loading screen — a room/place matching each
// character's profession or hobby (clinic, aquarium, garage stage, etc).
export const getSceneSrc = (characterId?: string): string | undefined => {
  const resolved = resolveCharacterId(characterId);
  const character = CHARACTERS.find(c => c.id === resolved);
  if (!character) return undefined;
  // The fox has no 2D scene of its own yet; it reuses the old 3D fox scene file.
  const sceneId = character.id === 'raposa' ? 'raposa-3d' : (character.baseId ?? character.id);
  return `/character-assets/scenarios/${sceneId}.jpg`;
};

// Short reaction clip played once on the character reveal screen. Each clip is
// rendered on the reveal screen's sand background with the tilted card, so it
// replaces the static art in place. Characters without one show the still art.
const REACTION_VIDEOS: Record<string, string> = Object.fromEntries(
  [
    'medica',
    'guaxinim-pescador',
    'detetive-planta',
    'garoto-aquario',
    'gato-jaqueta',
    'surfista',
    'roqueiro',
    'engenheiro',
    'juiz',
    'biomedica',
    'nutricionista',
    'fisioterapeuta',
    'jorge-do-bem',
    'raposa',
    'militar',
    'policial',
    'marinheiro',
    'diplomata-petrobras',
  ].map((id) => [id, `/character-assets/animations/${id}-reacao.mp4`]),
);

export const getReactionVideoSrc = (characterId?: string): string | undefined => {
  const id = resolveCharacterId(characterId);
  return id ? REACTION_VIDEOS[id] : undefined;
};
