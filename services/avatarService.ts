// Os personagens do app. Cada um é desenhado em cubos pelo VoxelAvatar, a
// partir da receita em services/voxelCharacters.ts — não há mais arte 2D: as
// imagens por pose, as folhas de expressão, os clipes de reação e o recorte de
// rosto saíram daqui quando o boneco 3D passou a servir todas as telas.
//
// O que sobrou é o catálogo: id, nome e o cenário de fundo da tela de carga.

export interface CharacterOption {
  id: string;
  name: string;
}

export const CHARACTERS: CharacterOption[] = [
  { id: 'medica', name: 'Médica' },
  { id: 'guaxinim-pescador', name: 'Guaxinim Pescador' },
  { id: 'detetive-planta', name: 'Detetive' },
  { id: 'garoto-aquario', name: 'Garoto do Aquário' },
  { id: 'gato-jaqueta', name: 'Gato Estiloso' },
  { id: 'surfista', name: 'Surfista' },
  { id: 'roqueiro', name: 'Roqueiro' },
  { id: 'engenheiro', name: 'Engenheiro' },
  { id: 'juiz', name: 'Juiz' },
  { id: 'biomedica', name: 'Biomédica' },
  { id: 'nutricionista', name: 'Nutricionista' },
  { id: 'fisioterapeuta', name: 'Fisioterapeuta' },
  { id: 'jorge-do-bem', name: 'Jorge do Bem' },
  { id: 'raposa', name: 'Raposa Estilosa' },
  { id: 'militar', name: 'Militar' },
  { id: 'policial', name: 'Policial' },
  { id: 'marinheiro', name: 'Marinheiro' },
  { id: 'diplomata-petrobras', name: 'Diplomata da Petrobras' },
  { id: 'nativo', name: 'Nativo' },
  { id: 'homem-jaqueta-jeans', name: 'Homem de Jaqueta Jeans' },
  { id: 'rapaz-regata', name: 'Rapaz de Regata' },
  { id: 'senhor-bone', name: 'Senhor de Boné' },
  { id: 'vira-lata-caramelo', name: 'Vira-Lata Caramelo' },
];

export const defaultCharacterId = CHARACTERS[0].id;

// Perfis antigos guardaram ids que não existem mais; cada um cai no personagem
// que ficou no lugar dele.
const APOSENTADOS: Record<string, string> = {
  'enfermeiro-3d': 'fisioterapeuta',
};

export const resolveCharacterId = (id?: string): string | undefined => {
  if (!id) return id;
  if (APOSENTADOS[id]) return APOSENTADOS[id];
  if (id.endsWith('-3d')) {
    const base = id.slice(0, -3);
    if (CHARACTERS.some((c) => c.id === base)) return base;
  }
  return id;
};

export const getCharacter = (id?: string): CharacterOption => {
  const resolved = resolveCharacterId(id);
  return CHARACTERS.find((c) => c.id === resolved) ?? CHARACTERS[0];
};

// Fundo da tela de carga: o cômodo que combina com a profissão ou o hobby do
// personagem (consultório, aquário, palco de garagem). É cenário, não figura —
// o boneco por cima é o de cubos.
export const getSceneSrc = (characterId?: string): string | undefined => {
  const resolved = resolveCharacterId(characterId);
  const character = CHARACTERS.find((c) => c.id === resolved);
  if (!character) return undefined;
  const sceneId = character.id === 'raposa' ? 'raposa-3d' : character.id;
  return `/character-assets/scenarios/${sceneId}.jpg`;
};
