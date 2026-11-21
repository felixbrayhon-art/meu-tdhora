import React, { useEffect, useRef } from 'react';
import { VoxelConfig, getVoxelConfig } from '../services/voxelCharacters';
import { Mascote, aplicarMascote, configDoMascote } from '../services/mascote';

// Mascote 3D feito de cubos CSS: nenhuma imagem, só divs com transform.
// Cada cubo são seis faces; o tom de cada face é o mesmo multiplicado por um
// fator fixo (topo mais claro, fundo mais escuro), o que imita luz sem calcular
// iluminação. Os membros penduram de juntas, então girar a junta leva a mão junto.

const tom = (hex: string, k: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${((1 << 24) + (c(n >> 16) << 16) + (c((n >> 8) & 255) << 8) + c(n & 255)).toString(16).slice(1)}`;
};

// Toda face é montada com a frente virada para fora do cubo, e com
// backface-visibility:hidden: quem está de costas para a câmera o navegador
// descarta sozinho, a cada quadro e em qualquer rotação. Tentar adivinhar isso
// na montagem (não criar a face de trás e a de baixo) deixava o boneco vazado,
// porque as partes giram em juntas próprias — a cabeça inclina, as pernas
// abrem e dormindo o corpo inteiro deita a 82°, e aí a face que faltava era
// justamente a que apontava para quem olha.
const criarFace = (w: number, h: number, t: string, cor: string, op: number) => {
  const f = document.createElement('div');
  f.style.cssText = `position:absolute;width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h / 2}px;background:${cor};transform:${t};opacity:${op};backface-visibility:hidden`;
  return f;
};

type Pai = HTMLElement;

const B = (p: Pai, w: number, h: number, d: number, x: number, y: number, z: number, cor: string, op = 1, rot = ''): HTMLElement => {
  const b = document.createElement('div');
  b.style.cssText = 'position:absolute;transform-style:preserve-3d';
  b.style.transform = `translate3d(${x}px,${y}px,${z}px)${rot}`;
  b.appendChild(criarFace(w, h, `translateZ(${d / 2}px)`, cor, op));
  b.appendChild(criarFace(w, h, `rotateY(180deg) translateZ(${d / 2}px)`, tom(cor, 0.8), op));
  b.appendChild(criarFace(d, h, `rotateY(90deg) translateZ(${w / 2}px)`, tom(cor, 0.88), op));
  b.appendChild(criarFace(d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, tom(cor, 0.72), op));
  b.appendChild(criarFace(w, d, `rotateX(90deg) translateZ(${h / 2}px)`, tom(cor, 1.16), op));
  b.appendChild(criarFace(w, d, `rotateX(-90deg) translateZ(${h / 2}px)`, tom(cor, 0.58), op));
  p.appendChild(b);
  return b;
};

const J = (p: Pai, x: number, y: number, z: number): HTMLElement => {
  const j = document.createElement('div');
  j.style.cssText = 'position:absolute;transform-style:preserve-3d';
  j.style.transform = `translate3d(${x}px,${y}px,${z}px)`;
  p.appendChild(j);
  return j;
};

const CABELO: Record<string, (h: Pai, c: string) => void> = {
  curto: (h, c) => { B(h, 94, 20, 94, 0, -80, 0, c); B(h, 94, 30, 14, 0, -58, -44, c); B(h, 12, 26, 80, -43, -64, -4, c); B(h, 12, 26, 80, 43, -64, -4, c); B(h, 92, 12, 16, 0, -70, 43, c); },
  cacheado: (h, c) => {
    B(h, 96, 24, 96, 0, -78, 0, c); B(h, 94, 34, 16, 0, -54, -44, c);
    B(h, 22, 22, 22, -45, -58, 8, c); B(h, 20, 20, 20, -44, -54, -20, c);
    B(h, 22, 22, 22, 45, -58, 8, c); B(h, 20, 20, 20, 44, -54, -20, c);
    B(h, 38, 16, 38, -20, -92, 0, c); B(h, 32, 14, 32, 24, -94, -12, c); B(h, 90, 12, 16, 0, -66, 43, c);
  },
  afro: (h, c) => {
    B(h, 112, 42, 108, 0, -80, 0, c); B(h, 96, 30, 96, 0, -56, -20, c);
    B(h, 40, 20, 40, -44, -62, 6, c); B(h, 40, 20, 40, 44, -62, 6, c);
    B(h, 46, 20, 46, -16, -100, -6, c); B(h, 40, 18, 40, 22, -100, 8, c); B(h, 90, 12, 16, 0, -64, 43, c);
  },
  longo: (h, c) => {
    B(h, 98, 26, 98, 0, -78, 0, c); B(h, 98, 48, 18, 0, -48, -44, c);
    B(h, 18, 66, 86, -42, -50, -2, c); B(h, 18, 66, 86, 42, -50, -2, c); B(h, 96, 16, 20, 0, -68, 42, c);
    B(h, 40, 16, 40, -24, -92, 2, tom(c, 1.18)); B(h, 34, 14, 34, 26, -94, -10, tom(c, 1.18));
  },
  careca: (h, c) => { B(h, 92, 10, 92, 0, -84, 0, tom(c, 0.9)); },
  // Penteados do estúdio. Seguem a mesma caixa dos outros: topo em -80, nuca
  // em -58 e franja encostando no rosto em z 43, para caberem sob os chapéus.
  moicano: (h, c) => {
    B(h, 92, 12, 92, 0, -82, 0, tom(c, 0.55));
    B(h, 26, 34, 92, 0, -98, 0, c);
    B(h, 18, 14, 86, 0, -118, 2, tom(c, 1.12));
    B(h, 90, 12, 16, 0, -66, -44, tom(c, 0.8));
  },
  coque: (h, c) => {
    B(h, 94, 22, 94, 0, -79, 0, c);
    B(h, 94, 30, 16, 0, -57, -44, c);
    B(h, 12, 20, 76, -43, -62, -6, c); B(h, 12, 20, 76, 43, -62, -6, c);
    B(h, 92, 12, 16, 0, -70, 43, c);
    B(h, 40, 36, 36, 0, -102, -34, tom(c, 1.1));
    B(h, 14, 10, 14, 0, -84, -46, tom(c, 0.86));
  },
  rabo: (h, c) => {
    B(h, 94, 22, 94, 0, -79, 0, c);
    B(h, 94, 32, 16, 0, -56, -44, c);
    B(h, 12, 24, 78, -43, -62, -4, c); B(h, 12, 24, 78, 43, -62, -4, c);
    B(h, 92, 12, 16, 0, -70, 43, c);
    // O rabo de cavalo cai por trás, com uma leve inclinação.
    B(h, 22, 20, 22, 0, -74, -52, tom(c, 1.08));
    B(h, 20, 54, 20, 0, -44, -58, c, 1, ' rotateX(-10deg)');
    B(h, 16, 16, 16, 0, -16, -62, tom(c, 1.12));
  },
  chanel: (h, c) => {
    B(h, 96, 24, 96, 0, -78, 0, c);
    B(h, 96, 56, 18, 0, -44, -44, c);
    B(h, 16, 56, 92, -44, -44, -2, c); B(h, 16, 56, 92, 44, -44, -2, c);
    B(h, 94, 14, 20, 0, -68, 42, tom(c, 1.1));
    B(h, 30, 10, 18, -26, -74, 42, tom(c, 1.16));
  },
};

const ADERECO: Record<string, (a: Pai, cor?: string) => void> = {
  prancheta: (a, c) => { B(a, 31, 40, 6, -9, 34, 14, c || '#8a6a4f'); B(a, 31, 36, 4, -9, 34, 17, '#d8cdbb'); B(a, 13, 7, 6, -9, 14, 18, '#b9bec4'); },
  tablet: (a) => { B(a, 28, 36, 6, -8, 34, 14, '#2e2e33'); B(a, 24, 30, 4, -8, 34, 17, '#5d8fd0'); },
  caneta: (a) => { B(a, 5, 20, 5, 3, 54, 4, '#2f4fa8'); },
  vaso: (a) => {
    const p = J(a, 0, 56, 6);
    B(p, 27, 22, 27, 0, 0, 0, '#c2693a'); B(p, 32, 8, 32, 0, -13, 0, '#d87c48');
    B(p, 10, 28, 9, 0, -30, 0, '#5aa83f'); B(p, 10, 26, 9, -13, -26, 2, '#5aa83f', 1, ' rotateZ(28deg)');
    B(p, 10, 26, 9, 13, -26, 2, '#76c257', 1, ' rotateZ(-28deg)');
    B(p, 9, 24, 9, -7, -24, -13, '#76c257', 1, ' rotateZ(16deg) rotateX(22deg)');
    B(p, 9, 24, 9, 8, -23, 14, '#5aa83f', 1, ' rotateZ(-16deg) rotateX(-22deg)');
  },
  radio: (a) => { B(a, 13, 24, 9, 2, 56, 2, '#2e2e33'); B(a, 9, 8, 4, 2, 52, 7, '#6fbf3f'); B(a, 4, 14, 4, -3, 40, 2, '#1f1f24'); },
  vara: (a) => { B(a, 6, 104, 6, 0, 32, 10, '#2e2e33'); B(a, 7, 9, 7, 0, 8, 10, '#e9b949'); B(a, 7, 9, 7, 0, 44, 10, '#e9b949'); B(a, 11, 13, 9, 4, 52, 10, '#5c5a57'); },
  peixe: (a) => { B(a, 19, 38, 15, 0, 56, 0, '#e96f34'); B(a, 13, 13, 11, 0, 78, 0, '#d85a22'); B(a, 15, 14, 6, 0, 36, 0, '#f08c4a'); B(a, 5, 5, 4, 5, 76, 7, '#fdfbf7'); },
  violao: (a) => {
    const g = J(a, 0, 48, 18);
    B(g, 44, 52, 16, 0, 0, 0, '#e8b45a', 1, ' rotateZ(14deg)'); B(g, 34, 40, 17, 0, -36, 0, '#e8b45a', 1, ' rotateZ(14deg)');
    B(g, 18, 18, 6, 0, -6, 10, '#5a3a1f', 1, ' rotateZ(14deg)'); B(g, 12, 70, 9, 22, -74, 0, '#6b4529', 1, ' rotateZ(14deg)');
  },
  guitarra: (a) => {
    const g = J(a, 0, 46, 18);
    B(g, 40, 54, 14, 0, 0, 0, '#8a2be2', 1, ' rotateZ(-20deg)');
    B(g, 26, 22, 14, -4, -28, 0, '#8a2be2', 1, ' rotateZ(-20deg)');
    B(g, 11, 72, 8, -20, -62, 0, '#4c302f', 1, ' rotateZ(-20deg)');
    B(g, 18, 14, 9, -34, -96, 0, '#5b3a35', 1, ' rotateZ(-20deg)');
    B(g, 16, 14, 6, 4, -10, 9, '#e5dfd4', 1, ' rotateZ(-20deg)');
    B(g, 3, 74, 3, -17, -46, 10, '#e8d7b4', 1, ' rotateZ(-20deg)');
    B(g, 10, 4, 4, 3, 8, 10, '#b9bec4', 1, ' rotateZ(-20deg)');
  },
  rifle: (a) => { B(a, 10, 78, 12, 0, 46, 14, '#2e2e33', 1, ' rotateX(72deg)'); B(a, 9, 24, 10, 0, 34, 6, '#3f3228'); },
  chave: (a) => { B(a, 8, 34, 8, 0, 52, 2, '#b9bec4'); B(a, 18, 12, 9, 0, 70, 2, '#b9bec4'); },
  livro: (a, c) => { B(a, 30, 38, 10, -6, 34, 12, c || '#8a3b2a'); B(a, 26, 34, 4, -6, 34, 18, '#f3ece0'); },
  martelo: (a) => { B(a, 7, 30, 7, 0, 52, 2, '#8a6a4f'); B(a, 26, 12, 12, 0, 70, 2, '#6b5440'); },
  passaro: (a) => {
    const p = J(a, 0, 44, 8);
    B(p, 20, 30, 16, 0, -18, 0, '#2f6fd0'); B(p, 15, 15, 15, 0, -38, 2, '#2f6fd0'); B(p, 9, 7, 9, 0, -38, 12, '#2a2a2e');
    B(p, 12, 26, 8, 0, 4, -6, '#e9b949'); B(p, 10, 14, 6, -11, -20, 0, '#e9b949'); B(p, 10, 14, 6, 11, -20, 0, '#e9b949');
    B(p, 6, 6, 4, -4, -40, 10, '#fffaf2'); B(p, 3, 3, 3, -4, -40, 13, '#252525');
    B(p, 7, 10, 5, -12, -17, 4, '#6da5e0'); B(p, 7, 10, 5, 12, -17, 4, '#6da5e0');
  },
  nada: () => { },
};

interface Partes { raiz: HTMLElement; corpo: HTMLElement; cabeca: HTMLElement; bracoE: HTMLElement; bracoD: HTMLElement; pernaE: HTMLElement; pernaD: HTMLElement; rabo?: HTMLElement; fone: HTMLElement; adEsq: HTMLElement; adDir: HTMLElement; aquario?: HTMLElement; olhos?: HTMLElement; cronometro: HTMLElement; livro: HTMLElement }

const montar = (cfg: VoxelConfig, cena: Pai, variantePescador: 1 | 2 | 3 = 3, varianteNutricionista: 1 | 2 | 3 = 1, variantePolicial: 1 | 2 | 3 = 1, varianteRegata: 1 | 2 | 3 = 1, varianteRaposa: 1 | 2 | 3 = 1, varianteRoqueiro: 1 | 2 | 3 = 1, varianteSenhor: 1 | 2 | 3 = 1, varianteSurfista: 1 | 2 | 3 = 1, varianteNativo: 1 | 2 | 3 = 1, varianteCaramelo: 1 | 2 | 3 = 1, varianteBiomedica: 1 | 2 | 3 = 1): Partes => {
  const alturaPerna = cfg.curto ? 20 : 28;
  const pescador = cfg.nome === 'Guaxinim Pescador';
  const regataOriginal = cfg.nome === 'Rapaz de Regata' && varianteRegata === 1;
  const raposaOriginal = cfg.nome === 'Raposa Estilosa' && varianteRaposa === 1;
  const roqueiroOriginal = cfg.nome === 'Roqueiro' && varianteRoqueiro === 1;
  const senhorOriginal = cfg.nome === 'Senhor de Boné' && varianteSenhor === 1;
  const surfistaOriginal = cfg.nome === 'Surfista' && varianteSurfista === 1;
  const nativoOriginal = cfg.nome === 'Nativo' && varianteNativo === 1;
  const carameloOriginal = cfg.nome === 'Vira-Lata Caramelo' && varianteCaramelo === 1;
  const biomedicaOriginal = cfg.nome === 'Biomédica' && varianteBiomedica === 1;
  const gato = cfg.nome === 'Gato Estiloso';
  // Mechas desenhadas à mão combinam com o cabelo de origem; se o aluno trocou
  // o penteado ou a cor no editor, elas saem e fica só o penteado da tabela.
  const cabeloProprio = !cfg.cabeloLivre;
  const rostoRefinado = ['Detetive', 'Diplomata', 'Engenheiro', 'Fisioterapeuta', 'Garoto do Aquário', 'Gato Estiloso', 'Homem de Jaqueta Jeans', 'Jorge do Bem', 'Juiz', 'Marinheiro', 'Médica'].includes(cfg.nome);
  if (cfg.pranchaLado) {
    if (surfistaOriginal) {
      // Degraus em cubos afinam o bico e a rabeta da prancha.
      B(cena, 28, 101, 13, 56, -27, -6, '#f3ece0');
      B(cena, 22, 12, 13, 56, -83, -6, '#f3ece0');
      B(cena, 14, 9, 13, 56, -93, -6, '#f3ece0');
      B(cena, 22, 12, 13, 56, 29, -6, '#e0d6c4');
      B(cena, 8, 88, 4, 56, -24, 2, '#e96f34');
      B(cena, 22, 6, 4, 56, -72, 2, '#4a9ea7');
      B(cena, 27, 6, 4, 56, -61, 2, '#4a9ea7');
      B(cena, 25, 6, 4, 56, 12, 2, '#4a9ea7');
      B(cena, 15, 5, 4, 56, 24, 2, '#4a9ea7');
    } else {
      B(cena, 30, 132, 13, 56, -28, -6, '#f3ece0');
      B(cena, 17, 78, 5, 56, -40, 2, '#e96f34'); B(cena, 11, 40, 5, 56, 6, 2, '#f5b84b');
      B(cena, 30, 13, 13, 56, 32, -6, '#e0d6c4');
    }
  }
  const raiz = J(cena, 0, 0, 0);
  const pernaE = J(raiz, -13, -4, 0);
  const pernaD = J(raiz, 13, -4, 0);
  [pernaE, pernaD].forEach((L) => {
    if (cfg.bermuda) { B(L, 20, 16, 20, 0, 8, 0, cfg.bermuda); B(L, 18, 16, 18, 0, 24, 0, cfg.skin); }
    else B(L, 19, alturaPerna, 19, 0, alturaPerna / 2, 0, cfg.pernas);
    if (cfg.bainha) B(L, 22, 8, 22, 0, alturaPerna + 2, 0, cfg.bainha);
    if (cfg.meia) B(L, 18, 8, 18, 0, alturaPerna + 10, 0, cfg.meia);
    const yPe = alturaPerna + (cfg.bainha ? 12 : cfg.bermuda ? 10 : 6);
    if (cfg.descalco) B(L, 21, 10, 28, 0, yPe, 4, cfg.skin);
    else B(L, 23, 12, 30, 0, yPe, 4, cfg.sapato);
    if (regataOriginal) {
      B(L, 20, 4, 21, 0, 15, 0, '#ca7081');
      B(L, 24, 4, 31, 0, yPe + 5, 4, '#eee4d4');
      B(L, 12, 3, 3, 0, yPe - 1, 20, '#eee4d4');
    }
    if (roqueiroOriginal) {
      B(L, 24, 4, 31, 0, yPe + 5, 4, '#e4d8c8');
      B(L, 12, 3, 3, 0, yPe - 1, 20, '#d7cbbb');
    }
    if (surfistaOriginal) {
      B(L, 20, 4, 21, 0, 13, 0, '#9470a2');
      B(L, 5, 11, 3, 6, 7, 11, '#e1c7de');
      B(L, 19, 3, 22, 0, 0, 0, '#432157');
    }
  });
  const corpo = J(raiz, 0, 0, 0);
  if (cfg.estilo === 'longo') {
    B(corpo, 86, 44, 18, 0, -38, -28, cfg.cabelo); B(corpo, 66, 26, 18, 0, -8, -28, tom(cfg.cabelo, 1.14));
    B(corpo, 18, 34, 16, -40, -34, -18, tom(cfg.cabelo, 1.14)); B(corpo, 18, 34, 16, 40, -34, -18, tom(cfg.cabelo, 1.14));
  }
  if (cfg.semCamisa) {
    B(corpo, 52, 50, 38, 0, -28, 0, cfg.skin);
    if (!surfistaOriginal) B(corpo, 22, 20, 8, 0, -20, 19, tom(cfg.skin, 0.92));
  }
  else if (cfg.regata) {
    B(corpo, 52, 50, 38, 0, -28, 0, cfg.skin);
    B(corpo, 16, 50, 40, -15, -28, 0, cfg.torso); B(corpo, 16, 50, 40, 15, -28, 0, cfg.torso); B(corpo, 52, 50, 12, 0, -28, -14, cfg.torso);
  } else B(corpo, 54, 50, 40, 0, -28, 0, cfg.torso);
  if (regataOriginal) {
    B(corpo, 52, 35, 4, 0, -22, 21, cfg.torso);
    B(corpo, 28, 5, 4, 0, -35, 21, '#69605a');
    B(corpo, 52, 4, 42, 0, -5, 0, '#282d2e');
    B(corpo, 10, 11, 3, -15, -22, 22, '#505554');
    B(corpo, 10, 3, 4, -15, -27, 23, '#777873');
  }
  if (raposaOriginal) {
    B(corpo, 5, 46, 4, 0, -27, 22, '#4b2c23');
    B(corpo, 14, 12, 5, -17, -20, 22, '#8d5637'); B(corpo, 14, 12, 5, 17, -20, 22, '#8d5637');
    B(corpo, 15, 4, 5, -17, -26, 25, '#ad7048'); B(corpo, 15, 4, 5, 17, -26, 25, '#ad7048');
  }
  if (roqueiroOriginal) {
    B(corpo, 14, 47, 5, -15, -28, 22, '#30649c'); B(corpo, 14, 47, 5, 15, -28, 22, '#30649c');
    B(corpo, 13, 16, 5, -15, -43, 25, '#72a0c5', 1, ' rotateZ(-18deg)');
    B(corpo, 13, 16, 5, 15, -43, 25, '#72a0c5', 1, ' rotateZ(18deg)');
    B(corpo, 4, 46, 5, 0, -28, 23, '#d9c5a8');
    B(corpo, 12, 11, 5, -16, -20, 25, '#275482'); B(corpo, 12, 11, 5, 16, -20, 25, '#275482');
    B(corpo, 12, 3, 5, -16, -25, 27, '#8db3cf'); B(corpo, 12, 3, 5, 16, -25, 27, '#8db3cf');
  }
  if (senhorOriginal) {
    B(corpo, 16, 13, 4, -15, -23, 21, '#ddc9b2');
    B(corpo, 17, 4, 5, -15, -29, 23, '#cdb69d');
    B(corpo, 4, 42, 4, 0, -25, 22, '#ddc9b2');
    B(corpo, 3, 3, 3, 0, -35, 25, '#9e8874'); B(corpo, 3, 3, 3, 0, -22, 25, '#9e8874');
    B(corpo, 15, 12, 4, -8, -47, 22, '#e9d7bf', 1, ' rotateZ(-16deg)');
    B(corpo, 15, 12, 4, 8, -47, 22, '#e9d7bf', 1, ' rotateZ(16deg)');
  }
  if (surfistaOriginal) {
    B(corpo, 26, 3, 3, 0, -47, 21, '#e8d5ad');
    B(corpo, 3, 7, 3, 0, -43, 21, '#e8d5ad');
    B(corpo, 5, 6, 3, 0, -39, 22, '#c49c5d');
  }
  // Saia: três degraus que alargam para baixo e passam do joelho, senão o
  // recorte fica na altura de uma bermuda e ninguém lê como saia.
  if (cfg.vestido) {
    B(corpo, 58, 12, 44, 0, -6, 0, cfg.vestido);
    B(corpo, 70, 14, 54, 0, 4, 0, cfg.vestido);
    B(corpo, 80, 16, 62, 0, 16, 0, tom(cfg.vestido, 1.07));
  }
  // Moletom: capuz caído atrás da cabeça, gola e bolso canguru na frente. O
  // capuz fica atrás do bloco da cabeça (que vai de z -46 a 46): mais para
  // dentro ele é desenhado, mas some inteiro dentro dela.
  if (cfg.capuz) {
    // O capuz é mais largo que a cabeça (92) de propósito: atrás dela, só
    // aparece o que passar das laterais. Mais estreito, some inteiro.
    B(corpo, 106, 40, 26, 0, -78, -56, tom(cfg.capuz, 0.84));
    B(corpo, 98, 18, 22, 0, -54, -54, tom(cfg.capuz, 0.66));
    B(corpo, 62, 12, 46, 0, -50, -2, tom(cfg.capuz, 1.1));
    // Cordões em creme e bolso canguru: é por eles que o moletom se lê de
    // frente. Creme fixo porque um tom do próprio moletom some nele.
    B(corpo, 4, 22, 4, -9, -41, 22, '#f3ece0'); B(corpo, 4, 17, 4, 9, -44, 22, '#f3ece0');
    B(corpo, 38, 17, 6, 0, -10, 21, tom(cfg.capuz, 0.8));
  }
  if (cfg.listrasT) { B(corpo, 55, 5, 41, 0, -42, 0, cfg.listrasT); B(corpo, 55, 5, 41, 0, -30, 0, cfg.listrasT); B(corpo, 55, 5, 41, 0, -18, 0, cfg.listrasT); }
  if (cfg.listra) { B(corpo, 56, 6, 42, 0, -36, 0, cfg.listra); B(corpo, 56, 6, 42, 0, -16, 0, cfg.listra); }
  if (cfg.faixa && !cfg.regata && !cfg.semCamisa) B(corpo, 22, 50, 7, 0, -28, 20, cfg.faixa);
  if (cfg.jaleco) B(corpo, 13, 10, 5, 0, -48, 22, cfg.skin);
  if (cfg.lapela) { B(corpo, 14, 44, 8, -16, -30, 20, cfg.lapela); B(corpo, 14, 44, 8, 16, -30, 20, cfg.lapela); }
  if (biomedicaOriginal) {
    B(corpo, 12, 38, 5, -18, -29, 22, '#ebe7de'); B(corpo, 12, 38, 5, 18, -29, 22, '#ebe7de');
    B(corpo, 11, 14, 5, -14, -43, 25, '#fffdf7', 1, ' rotateZ(-17deg)');
    B(corpo, 11, 14, 5, 14, -43, 25, '#fffdf7', 1, ' rotateZ(17deg)');
    B(corpo, 11, 11, 4, -18, -19, 26, '#faf8f1'); B(corpo, 11, 3, 4, -18, -24, 28, '#c9d8e2');
    B(corpo, 10, 8, 4, 17, -38, 26, '#d7e8ee'); B(corpo, 6, 2, 3, 17, -38, 29, '#5793af');
  }
  if (nativoOriginal) {
    B(corpo, 12, 15, 5, -16, -21, 26, '#b8956e'); B(corpo, 12, 15, 5, 16, -21, 26, '#b8956e');
    B(corpo, 13, 4, 5, -16, -28, 28, '#e1caa4'); B(corpo, 13, 4, 5, 16, -28, 28, '#e1caa4');
    B(corpo, 4, 41, 4, 0, -27, 24, '#8a6a4f');
    B(corpo, 3, 3, 3, 0, -38, 27, '#e7d4ae'); B(corpo, 3, 3, 3, 0, -26, 27, '#e7d4ae');
  }
  if (carameloOriginal) {
    B(corpo, 14, 12, 4, -16, -22, 21, '#a8bfdf');
    B(corpo, 15, 4, 4, -16, -28, 23, '#dbe7f4');
    B(corpo, 5, 5, 3, -16, -23, 24, '#7c9ac1');
    B(corpo, 54, 4, 41, 0, -4, 0, '#8ba8d1');
  }
  if (cfg.gravata) { B(corpo, 9, 28, 5, 0, -28, 24, cfg.gravata); B(corpo, 11, 9, 6, 0, -46, 24, cfg.gravata); }
  if (cfg.toga) { B(corpo, 58, 16, 44, 0, -50, 0, '#2a2a2a'); B(corpo, 14, 26, 7, -8, -46, 21, '#f3ece0'); B(corpo, 14, 26, 7, 8, -46, 21, '#f3ece0'); }
  if (cfg.colete) { B(corpo, 17, 50, 42, -18, -28, 0, cfg.colete); B(corpo, 17, 50, 42, 18, -28, 0, cfg.colete); B(corpo, 54, 50, 10, 0, -28, -16, cfg.colete); }
  if (cfg.nome === 'Policial' && variantePolicial === 1) {
    B(corpo, 35, 37, 6, 0, -29, 22, '#2e3542');
    B(corpo, 13, 14, 7, -12, -20, 26, '#465161'); B(corpo, 13, 14, 7, 12, -20, 26, '#465161');
    B(corpo, 14, 4, 8, -12, -26, 27, '#697685'); B(corpo, 14, 4, 8, 12, -26, 27, '#697685');
    B(corpo, 10, 12, 4, -12, -41, 26, '#cba75b'); B(corpo, 5, 6, 4, -12, -41, 29, '#f1d88d');
    B(corpo, 56, 8, 43, 0, -3, 0, '#20252a'); B(corpo, 11, 7, 5, 0, -3, 23, '#b9bec4');
  }
  if (cfg.nome === 'Militar' && cfg.mascara && cfg.colete) {
    // Placa central, alças e bolsos em camadas sobre o uniforme.
    B(corpo, 35, 37, 7, 0, -29, 21, '#35462d');
    B(corpo, 11, 24, 6, -18, -39, 24, '#536344');
    B(corpo, 11, 24, 6, 18, -39, 24, '#536344');
    B(corpo, 12, 14, 8, -12, -20, 27, '#61724c');
    B(corpo, 12, 14, 8, 12, -20, 27, '#61724c');
    B(corpo, 13, 4, 9, -12, -26, 28, '#78865d');
    B(corpo, 13, 4, 9, 12, -26, 28, '#78865d');
    B(corpo, 5, 4, 4, -12, -23, 32, '#34412b');
    B(corpo, 5, 4, 4, 12, -23, 32, '#34412b');
    B(corpo, 23, 5, 5, 0, -41, 27, '#6f7f58');
    B(corpo, 56, 8, 43, 0, -3, 0, '#303b29');
    B(corpo, 11, 8, 5, 0, -3, 23, '#93906c');
  }
  if (cfg.bolsosColete && cfg.colete) {
    B(corpo, 13, 12, 5, -18, -22, 22, tom(cfg.colete, 0.86)); B(corpo, 13, 12, 5, 18, -22, 22, tom(cfg.colete, 0.86));
    B(corpo, 13, 12, 5, -18, -40, 22, tom(cfg.colete, 0.86)); B(corpo, 13, 12, 5, 18, -40, 22, tom(cfg.colete, 0.86));
    if (pescador && variantePescador === 3) {
      for (const x of [-18, 18]) {
        B(corpo, 15, 4, 6, x, -27, 25, '#8b934e');
        B(corpo, 15, 4, 6, x, -45, 25, '#8b934e');
        B(corpo, 3, 3, 3, x, -25, 29, '#d3ae60');
        B(corpo, 3, 3, 3, x, -43, 29, '#d3ae60');
      }
      B(corpo, 4, 45, 4, 0, -27, 22, '#3c4b31');
      B(corpo, 9, 10, 7, -9, -12, 27, '#f0e5ca');
      B(corpo, 10, 4, 8, -9, -12, 28, '#bd5940');
    }
  }
  if (cfg.bolso) { B(corpo, 16, 13, 6, -16, -6, 21, '#e4e0d8'); B(corpo, 16, 13, 6, 16, -6, 21, '#e4e0d8'); }
  if (cfg.estetoscopio) {
    B(corpo, 36, 7, 28, 0, -50, 2, '#2e2e33'); B(corpo, 6, 20, 6, -11, -38, 18, '#2e2e33');
    B(corpo, 6, 20, 6, 11, -38, 18, '#2e2e33'); B(corpo, 11, 11, 7, 11, -26, 20, '#b9bec4');
  }
  if (cfg.cinto) { B(corpo, 56, 9, 42, 0, -4, 0, cfg.cinto); B(corpo, 12, 9, 7, 0, -4, 22, cfg.fivela || '#e9b949'); }
  if (cfg.dragona) B(corpo, 58, 10, 44, 0, -50, 0, cfg.dragona);
  // Acabamentos próprios dos personagens restantes, preservando suas cores e acessórios.
  switch (cfg.nome) {
    case 'Detetive':
      B(corpo, 14, 13, 5, -17, -20, 26, '#b3916e'); B(corpo, 14, 4, 5, -17, -26, 28, '#ebd5b2');
      B(corpo, 3, 30, 4, 17, -30, 26, '#a6815f');
      B(corpo, 12, 17, 5, -15, -41, 26, '#e3c8a3', 1, ' rotateZ(-18deg)');
      B(corpo, 12, 17, 5, 15, -41, 26, '#e3c8a3', 1, ' rotateZ(18deg)');
      B(corpo, 3, 3, 3, -17, -23, 30, '#74573e'); break;
    case 'Diplomata':
      B(corpo, 12, 14, 5, -18, -20, 22, '#c53d0c'); B(corpo, 12, 4, 5, -18, -26, 25, '#f9c58d');
      B(corpo, 4, 36, 4, 0, -27, 25, '#d6c5ab');
      B(corpo, 14, 5, 4, 17, -38, 22, '#d23e0b'); B(corpo, 6, 5, 3, 17, -38, 25, '#f7d18d'); break;
    case 'Engenheiro':
      B(corpo, 56, 6, 43, 0, -18, 0, '#e9b949'); B(corpo, 11, 11, 5, -17, -36, 23, '#254a77');
      B(corpo, 6, 3, 4, -17, -37, 27, '#f5d47b');
      B(corpo, 10, 14, 5, 17, -34, 22, '#28558b'); B(corpo, 11, 4, 5, 17, -41, 25, '#e9b949');
      B(corpo, 4, 35, 5, 0, -27, 25, '#edc957'); break;
    case 'Fisioterapeuta':
      B(corpo, 13, 11, 5, -17, -35, 22, '#348887'); B(corpo, 13, 3, 5, -17, -40, 25, '#aedbd3');
      B(corpo, 4, 41, 4, 0, -27, 24, '#8acbc3');
      B(corpo, 13, 10, 5, 17, -17, 22, '#399191'); B(corpo, 13, 3, 5, 17, -22, 25, '#a2d9d0');
      B(corpo, 4, 3, 3, 0, -36, 27, '#d4e9df'); B(corpo, 4, 3, 3, 0, -25, 27, '#d4e9df'); break;
    case 'Garoto do Aquário':
      B(corpo, 56, 4, 43, 0, -9, 0, '#c48a1c'); B(corpo, 9, 8, 4, -17, -40, 22, '#f8d26d');
      B(corpo, 12, 4, 4, 17, -40, 22, '#9d6b10'); break;
    case 'Gato Estiloso':
      B(corpo, 4, 42, 4, 0, -27, 24, '#e6d1af');
      B(corpo, 13, 11, 5, -17, -20, 22, '#7b5039'); B(corpo, 13, 11, 5, 17, -20, 22, '#7b5039');
      B(corpo, 13, 4, 4, -17, -25, 25, '#aa7956'); B(corpo, 13, 4, 4, 17, -25, 25, '#aa7956');
      B(corpo, 10, 10, 4, -13, -43, 23, '#a77352', 1, ' rotateZ(-15deg)'); B(corpo, 10, 10, 4, 13, -43, 23, '#a77352', 1, ' rotateZ(15deg)'); break;
    case 'Homem de Jaqueta Jeans':
      B(corpo, 14, 43, 5, -18, -29, 22, '#35557d'); B(corpo, 14, 43, 5, 18, -29, 22, '#35557d');
      B(corpo, 4, 39, 4, 0, -28, 24, '#d8c7ac'); B(corpo, 12, 9, 4, -17, -36, 25, '#6c90b4');
      B(corpo, 12, 9, 4, 17, -36, 25, '#6c90b4');
      B(corpo, 12, 3, 4, -17, -40, 27, '#b1c7d6'); B(corpo, 12, 3, 4, 17, -40, 27, '#b1c7d6');
      B(corpo, 10, 12, 4, -14, -46, 25, '#85a3be', 1, ' rotateZ(-15deg)'); B(corpo, 10, 12, 4, 14, -46, 25, '#85a3be', 1, ' rotateZ(15deg)'); break;
    case 'Jorge do Bem':
      B(corpo, 15, 10, 4, -17, -20, 22, '#c9352c'); B(corpo, 4, 37, 4, 0, -27, 22, '#f09b77');
      B(corpo, 10, 5, 4, 16, -39, 22, '#f2cf91');
      B(corpo, 12, 12, 4, -14, -46, 23, '#fa7254', 1, ' rotateZ(-15deg)'); B(corpo, 12, 12, 4, 14, -46, 23, '#fa7254', 1, ' rotateZ(15deg)'); break;
    case 'Juiz':
      B(corpo, 5, 37, 4, 0, -25, 22, '#555050');
      B(corpo, 15, 4, 4, -19, -19, 22, '#555050'); B(corpo, 15, 4, 4, 19, -19, 22, '#555050');
      B(corpo, 14, 18, 4, -9, -40, 26, '#f3ece0'); B(corpo, 14, 18, 4, 9, -40, 26, '#f3ece0');
      B(corpo, 2, 14, 3, 0, -40, 29, '#b8b3ac'); break;
    case 'Marinheiro':
      B(corpo, 48, 4, 4, 0, -38, 22, '#304775'); B(corpo, 48, 4, 4, 0, -29, 22, '#304775');
      B(corpo, 13, 10, 4, 0, -47, 23, '#304775'); B(corpo, 12, 11, 4, -14, -44, 23, '#d6e2eb');
      B(corpo, 12, 11, 4, 14, -44, 23, '#d6e2eb'); B(corpo, 8, 8, 4, 17, -20, 23, '#e3b85a'); break;
    case 'Médica':
      B(corpo, 12, 38, 5, -18, -29, 22, '#ebe7de'); B(corpo, 12, 38, 5, 18, -29, 22, '#ebe7de');
      B(corpo, 10, 8, 4, 17, -38, 26, '#d7e8ee'); B(corpo, 6, 2, 3, 17, -38, 29, '#5793af');
      B(corpo, 11, 14, 5, -14, -43, 25, '#fffdf7', 1, ' rotateZ(-17deg)'); B(corpo, 11, 14, 5, 14, -43, 25, '#fffdf7', 1, ' rotateZ(17deg)');
      B(corpo, 11, 11, 4, -18, -19, 26, '#faf8f1'); break;
  }
  let rabo: HTMLElement | undefined;
  if (cfg.bicho?.rabo) {
    rabo = J(corpo, raposaOriginal ? 32 : carameloOriginal || gato ? 25 : 0, -12, -19);
    const esc = raposaOriginal ? [27, 34, 36, 32] : pescador ? (variantePescador === 2 ? [36, 38, 35, 30] : [30, 32, 30, 26]) : [24, 22, 20, 18];
    cfg.bicho.rabo.forEach((cor, i) => B(rabo as Pai, esc[i], esc[i], esc[i] + 2, 0, 2 - i * 13, -14 - i * 17, cor));
  }
  const manga = cfg.regata || cfg.semCamisa ? cfg.skin : cfg.torso;
  const bracoE = J(corpo, -34, -48, 0);
  const bracoD = J(corpo, 34, -48, 0);
  // O que está na mão mora numa junta própria, separada do braço, para poder
  // sumir sozinho nas poses em que a mão precisa ficar livre.
  const naMao: HTMLElement[] = [];
  ([[bracoE, cfg.esq], [bracoD, cfg.dir]] as [HTMLElement, string | undefined][]).forEach(([a, prop]) => {
    B(a, 15, cfg.regata || cfg.semCamisa ? 34 : 30, 15, 0, 16, 0, manga);
    if (!(cfg.regata || cfg.semCamisa)) B(a, 16, 10, 16, 0, 34, 0, tom(manga, 1.1));
    B(a, 17, 15, 17, 0, 44, 0, cfg.bicho ? tom(cfg.skin, 0.72) : cfg.skin);
    const g = J(a, 0, 0, 0);
    g.style.transition = 'opacity 220ms ease';
    (ADERECO[prop || 'nada'] || ADERECO.nada)(g, cfg.lapela);
    naMao.push(g);
  });
  const [adEsq, adDir] = naMao;
  if (cfg.nome === 'Militar' && cfg.mascara) {
    B(bracoE, 17, 11, 18, 0, 13, 0, '#657351');
    B(bracoD, 17, 11, 18, 0, 13, 0, '#657351');
    B(bracoE, 12, 8, 4, 0, 13, 10, '#39492f');
    B(bracoD, 12, 8, 4, 0, 13, 10, '#39492f');
  }
  if (cfg.relogio) B(bracoD, 19, 8, 19, 0, 30, 0, cfg.relogio);
  if (carameloOriginal) {
    B(bracoD, 11, 10, 4, 0, 30, 10, '#d4a83b');
    B(bracoD, 7, 6, 3, 0, 30, 13, '#f4efe4');
    B(bracoD, 2, 4, 2, 0, 29, 15, '#4b4a46');
  }
  let aquario: HTMLElement | undefined;
  if (cfg.aquario) {
    aquario = J(corpo, 0, -14, 36);
    aquario.style.transition = 'opacity 220ms ease';
    B(aquario, 18, 11, 11, 2, 2, 0, '#e96f34'); B(aquario, 9, 9, 8, -9, 2, 0, '#bf4f1b'); B(aquario, 8, 16, 7, -15, 6, -6, '#5aa83f');
    B(aquario, 46, 42, 42, 0, 0, 0, '#bfe3ef', 0.45);
  }
  // Despertador que ele segura quando o cronômetro está rodando. Prende no
  // tronco, e não na mão, para não brigar com o que cada animação faz com os
  // braços; nas poses calmas os braços vêm à frente e o abraçam.
  const cronometro = J(corpo, 0, -22, 30);
  cronometro.style.display = 'none';
  B(cronometro, 40, 40, 11, 0, 0, -3, '#e96f34');
  B(cronometro, 30, 30, 12, 0, 0, 2, '#f7f3ed');
  B(cronometro, 4, 13, 5, 0, -5, 8, '#473c33');
  B(cronometro, 11, 4, 5, 4, 1, 8, '#473c33');
  B(cronometro, 9, 9, 9, -14, -22, -2, '#b9bec4'); B(cronometro, 9, 9, 9, 14, -22, -2, '#b9bec4');
  B(cronometro, 7, 6, 7, 0, -24, -2, '#8f8375');

  // Livro aberto, preso ao tronco para ficar entre as duas mãos.
  const livro = J(corpo, 0, -72, 72);
  livro.style.transform += ' rotateX(-30deg)';
  livro.style.display = 'none';
  B(livro, 60, 35, 5, 0, 0, 0, '#8a3b2a');
  // As páginas ficam do lado do leitor (-Z); a capa fica voltada para fora.
  B(livro, 27, 30, 4, -15, 0, -4, '#f3ece0', 1, ' rotateY(8deg)');
  B(livro, 27, 30, 4, 15, 0, -4, '#f3ece0', 1, ' rotateY(-8deg)');
  B(livro, 2, 28, 3, 0, 0, -7, '#c9bba6');

  const cabeca = J(corpo, 0, -52, 0);
  let olhos: HTMLElement | undefined;
  if (biomedicaOriginal) {
    B(cabeca, 84, 80, 92, 0, -48, 0, cfg.skin);
    B(cabeca, 72, 14, 92, 0, -7, 0, cfg.skin);
  } else {
    B(cabeca, 92, 88, 92, 0, -44, 0, cfg.skin);
  }
  if (cfg.bicho) {
    const orelhaX = raposaOriginal || gato ? 45 : pescador ? (variantePescador === 2 ? 50 : 46) : 33;
    const larguraOrelha = raposaOriginal ? 25 : gato ? 26 : pescador && variantePescador === 2 ? 38 : pescador ? 30 : 27;
    const alturaOrelha = raposaOriginal ? 45 : gato ? 36 : pescador && variantePescador === 2 ? 42 : pescador ? 34 : 27;
    const dentroOrelha = pescador && variantePescador === 2 ? 23 : pescador ? 17 : 15;
    // O estúdio escolhe o formato da orelha: é o que separa um gato de um
    // coelho quando o resto do corpo é o mesmo. Sem escolha, fica a orelha
    // padrão que os personagens prontos já usavam.
    const formato = cfg.bicho.orelhaTipo;
    if (formato) {
      const orelha = cfg.bicho.orelha;
      const dentro = cfg.bicho.dentro;
      [-1, 1].forEach((lado) => {
        const x = lado * 34;
        if (formato === 'ponta') {
          B(cabeca, 24, 30, 16, x, -102, -4, orelha);
          B(cabeca, 14, 14, 14, x + lado * 3, -122, -4, orelha);
          B(cabeca, 13, 16, 10, x, -100, 4, dentro);
        } else if (formato === 'caida') {
          B(cabeca, 22, 20, 18, x + lado * 10, -92, -2, orelha);
          B(cabeca, 20, 30, 16, x + lado * 16, -70, 0, orelha, 1, ` rotateZ(${lado * 14}deg)`);
          B(cabeca, 11, 22, 9, x + lado * 15, -72, 7, dentro, 1, ` rotateZ(${lado * 14}deg)`);
        } else if (formato === 'redonda') {
          B(cabeca, 30, 26, 18, x, -100, -4, orelha);
          B(cabeca, 17, 15, 11, x, -98, 5, dentro);
        } else {
          // comprida: a orelha de coelho, levemente aberta para fora.
          B(cabeca, 18, 54, 16, x + lado * 4, -116, -4, orelha, 1, ` rotateZ(${lado * 7}deg)`);
          B(cabeca, 9, 36, 9, x + lado * 6, -114, 3, dentro, 1, ` rotateZ(${lado * 7}deg)`);
        }
      });
    } else if (!carameloOriginal) {
      B(cabeca, larguraOrelha, alturaOrelha, 19, -orelhaX, -99, -4, cfg.bicho.orelha); B(cabeca, larguraOrelha, alturaOrelha, 19, orelhaX, -99, -4, cfg.bicho.orelha);
      B(cabeca, dentroOrelha, dentroOrelha, 11, -orelhaX, -97, 4, cfg.bicho.dentro); B(cabeca, dentroOrelha, dentroOrelha, 11, orelhaX, -97, 4, cfg.bicho.dentro);
    }
    if (raposaOriginal) {
      B(cabeca, 15, 8, 20, -orelhaX, -120, -4, '#9c421e'); B(cabeca, 15, 8, 20, orelhaX, -120, -4, '#9c421e');
      B(cabeca, 13, 25, 10, -orelhaX, -101, 5, cfg.bicho.dentro); B(cabeca, 13, 25, 10, orelhaX, -101, 5, cfg.bicho.dentro);
      B(cabeca, 21, 15, 6, -31, -16, 46, cfg.bicho.focinho); B(cabeca, 21, 15, 6, 31, -16, 46, cfg.bicho.focinho);
      B(cabeca, 15, 8, 6, -33, -25, 46, cfg.bicho.focinho); B(cabeca, 15, 8, 6, 33, -25, 46, cfg.bicho.focinho);
    }
    if (carameloOriginal) {
      B(cabeca, 22, 47, 20, -43, -53, 38, cfg.bicho.orelha, 1, ' rotateZ(-8deg)');
      B(cabeca, 22, 47, 20, 43, -53, 38, cfg.bicho.orelha, 1, ' rotateZ(8deg)');
      B(cabeca, 16, 12, 19, -45, -27, 37, tom(cfg.bicho.orelha, 0.9));
      B(cabeca, 16, 12, 19, 45, -27, 37, tom(cfg.bicho.orelha, 0.9));
      B(cabeca, 20, 13, 5, -26, -17, 47, cfg.bicho.focinho);
      B(cabeca, 20, 13, 5, 26, -17, 47, cfg.bicho.focinho);
    }
    if (gato) {
      B(cabeca, 13, 7, 19, -orelhaX, -117, -4, '#c55d17'); B(cabeca, 13, 7, 19, orelhaX, -117, -4, '#c55d17');
      B(cabeca, 12, 4, 4, -31, -22, 48, '#f8e6c8'); B(cabeca, 12, 4, 4, 31, -22, 48, '#f8e6c8');
    }
    if (cfg.bicho.mascara) {
      B(cabeca, 94, 28, 10, 0, -46, 44, cfg.bicho.mascara);
      B(cabeca, 30, 20, 8, -21, -62, 45, cfg.bicho.mascara); B(cabeca, 30, 20, 8, 21, -62, 45, cfg.bicho.mascara);
      if (pescador) {
        B(cabeca, 25, 5, 7, -22, -63, 49, '#eee0ca', 1, ' rotateZ(-5deg)');
        B(cabeca, 25, 5, 7, 22, -63, 49, '#eee0ca', 1, ' rotateZ(5deg)');
      }
    }
  } else {
    if (biomedicaOriginal && cabeloProprio) {
      // Camadas separadas desenham a risca, a franja e as mechas laterais.
      B(cabeca, 94, 17, 94, 0, -83, 0, '#e7c582');
      B(cabeca, 94, 52, 16, 0, -51, -43, '#d7af70');
      B(cabeca, 13, 55, 45, -42, -53, -18, '#e9ca8c');
      B(cabeca, 13, 55, 45, 42, -53, -18, '#e9ca8c');
      // Preenche a ligação entre a parte traseira e as mechas da frente.
      B(cabeca, 13, 55, 23, -42, -53, 14, '#e9ca8c');
      B(cabeca, 13, 55, 23, 42, -53, 14, '#e9ca8c');
      B(cabeca, 36, 12, 16, -24, -73, 43, '#f4d79e');
      B(cabeca, 25, 16, 16, 7, -71, 43, '#ecca8d');
      B(cabeca, 24, 21, 16, 31, -68, 42, '#f0d19a');
      B(cabeca, 11, 43, 13, -42, -52, 30, '#f2d59c');
      B(cabeca, 8, 23, 13, -40, -64, 39, '#e9c88e');
      B(cabeca, 11, 43, 13, 42, -52, 30, '#e8c78d');
      B(cabeca, 8, 27, 13, 40, -62, 39, '#f2d59c');
      B(cabeca, 25, 6, 72, -20, -94, -2, '#f4d9a4');
      B(cabeca, 27, 7, 72, 20, -93, -2, '#edd09a');
    } else CABELO[cfg.estilo](cabeca, cfg.cabelo);
    if (regataOriginal && cabeloProprio) {
      B(cabeca, 24, 14, 22, -27, -87, 30, tom(cfg.cabelo, 1.15));
      B(cabeca, 22, 12, 20, 2, -92, 28, tom(cfg.cabelo, 1.12));
      B(cabeca, 20, 13, 22, 28, -87, 28, tom(cfg.cabelo, 1.18));
    }
    if (surfistaOriginal && cabeloProprio) {
      B(cabeca, 20, 12, 18, -30, -83, 35, '#f2d57f');
      B(cabeca, 20, 11, 18, -4, -87, 37, '#e9c46a');
      B(cabeca, 21, 13, 18, 23, -83, 35, '#f2d57f');
    }
    if (nativoOriginal && cabeloProprio) {
      B(cabeca, 22, 8, 18, -29, -84, 36, '#38271e');
      B(cabeca, 22, 8, 18, 0, -87, 36, '#38271e');
      B(cabeca, 22, 8, 18, 29, -84, 36, '#38271e');
    }
    if (roqueiroOriginal && cabeloProprio) {
      B(cabeca, 26, 18, 28, -39, -89, 24, '#392722');
      B(cabeca, 26, 19, 28, -12, -99, 25, '#3d2924');
      B(cabeca, 26, 17, 28, 16, -99, 25, '#392722');
      B(cabeca, 26, 18, 28, 40, -88, 20, '#3d2924');
      B(cabeca, 22, 16, 26, -30, -99, -12, '#392722');
      B(cabeca, 24, 16, 25, 27, -100, -12, '#392722');
    }
    B(cabeca, 13, 20, 10, -46, -38, 4, cfg.skin); B(cabeca, 13, 20, 10, 46, -38, 4, cfg.skin);
  }
  if (cfg.bone) {
    if (pescador) {
      B(cabeca, 80, variantePescador === 2 ? 19 : 24, 82, 0, -84, 0, cfg.bone);
      B(cabeca, 68, 9, 70, 0, variantePescador === 2 ? -96 : -99, -2, tom(cfg.bone, 1.12));
      B(cabeca, 80, 5, 83, 0, -76, 0, tom(cfg.bone, 0.72));
      B(cabeca, variantePescador === 1 ? 84 : 74, 7, variantePescador === 1 ? 36 : 26, 0, -73, 49, tom(cfg.bone, 0.78));
      if (variantePescador !== 1) {
        B(cabeca, 28, 14, 4, 0, -87, 42, '#d8bd87');
        B(cabeca, 16, 5, 3, 0, -87, 45, '#78512e');
        B(cabeca, 7, 7, 3, 7, -87, 45, '#78512e');
      }
    } else if (raposaOriginal) {
      B(cabeca, 76, 22, 78, 0, -99, 0, cfg.bone);
      B(cabeca, 70, 7, 24, 0, -88, 48, tom(cfg.bone, 0.78));
      B(cabeca, 22, 10, 4, 0, -100, 40, '#d9c395');
    } else if (senhorOriginal) {
      B(cabeca, 84, 22, 84, 0, -98, 0, cfg.bone);
      B(cabeca, 78, 7, 27, 0, -87, 50, cfg.boneAba || tom(cfg.bone, 0.78));
      B(cabeca, 28, 10, 3, 0, -99, 43, '#c8b5a0');
    } else if (surfistaOriginal) {
      B(cabeca, 84, 22, 84, 0, -98, 0, cfg.bone);
      B(cabeca, 76, 7, 27, 0, -87, 50, tom(cfg.bone, 0.78));
      B(cabeca, 22, 9, 4, 0, -99, 43, '#b9dce2');
    } else if (gato) {
      B(cabeca, 76, 22, 78, 0, -99, 0, cfg.bone);
      B(cabeca, 70, 7, 24, 0, -88, 48, tom(cfg.bone, 0.78));
      B(cabeca, 22, 9, 4, 0, -100, 40, '#d9c395');
    } else {
      B(cabeca, 96, 26, 96, 0, -80, 0, cfg.bone);
      B(cabeca, 90, 11, 38, 0, -70, 60, cfg.boneAba || tom(cfg.bone, 0.78));
    }
  }
  if (cfg.balde) {
    if (carameloOriginal) {
      B(cabeca, 80, 22, 82, 0, -98, 0, cfg.balde);
      B(cabeca, 94, 6, 94, 0, -87, 0, tom(cfg.balde, 0.92));
      B(cabeca, 80, 4, 83, 0, -91, 0, '#9bb4cf');
    } else { B(cabeca, 96, 26, 96, 0, -80, 0, cfg.balde); B(cabeca, 116, 10, 116, 0, -66, 0, tom(cfg.balde, 0.92)); }
  }
  if (cfg.quepe) {
    B(cabeca, 94, 24, 94, 0, -82, 0, cfg.quepe); B(cabeca, 96, 10, 96, 0, -69, 0, '#2a2a30'); B(cabeca, 88, 8, 36, 0, -64, 58, '#2a2a30');
    if (cfg.nome === 'Policial' && variantePolicial === 1) {
      B(cabeca, 18, 15, 4, 0, -82, 48, '#d8b663');
      B(cabeca, 10, 8, 3, 0, -82, 51, '#f5df9c');
    }
  }
  if (cfg.capacete) {
    if (cfg.nome === 'Militar' && cfg.mascara) {
      B(cabeca, 98, 30, 98, 0, -79, 0, cfg.capacete);
      B(cabeca, 103, 7, 103, 0, -64, 0, tom(cfg.capacete, 0.82));
      B(cabeca, 28, 10, 4, 0, -80, 50, '#586846');
      B(cabeca, 18, 4, 3, 0, -80, 53, '#899675');
    } else if (cfg.nome === 'Engenheiro') {
      B(cabeca, 100, 30, 100, 0, -99, 0, cfg.capacete);
      B(cabeca, 106, 8, 106, 0, -84, 0, tom(cfg.capacete, 0.82));
    } else {
      B(cabeca, 100, 40, 100, 0, -72, 0, cfg.capacete);
      B(cabeca, 106, 10, 106, 0, -54, 0, tom(cfg.capacete, 0.82));
    }
  }
  if (cfg.nome === 'Engenheiro') {
    B(cabeca, 6, 6, 88, 0, -116, -2, '#f6cd53');
    B(cabeca, 20, 9, 4, 0, -99, 51, '#f8dc7d');
  }
  if (cfg.nome === 'Marinheiro') {
    B(cabeca, 17, 12, 4, 0, -82, 48, '#d7ba6b');
    B(cabeca, 5, 8, 3, 0, -82, 51, '#354e76');
  }
  if (cfg.mascara) {
    // Abertura contínua para os olhos; as peças laterais e a faixa inferior
    // formam a balaclava sem cobrir a face inteira com um bloco opaco.
    B(cabeca, 94, 27, 94, 0, -14, 0, cfg.mascara);
    B(cabeca, 94, 10, 94, 0, -62, 0, cfg.mascara);
    B(cabeca, 15, 25, 94, -39, -45, 0, cfg.mascara); B(cabeca, 15, 25, 94, 39, -45, 0, cfg.mascara);
    B(cabeca, 64, 20, 5, 0, -46, 46, cfg.skin);
    B(cabeca, 20, 13, 5, -20, -46, 50, '#f2e9da'); B(cabeca, 20, 13, 5, 20, -46, 50, '#f2e9da');
    B(cabeca, 9, 10, 4, -20, -45, 54, '#342c25'); B(cabeca, 9, 10, 4, 20, -45, 54, '#342c25');
    B(cabeca, 3, 3, 3, -22, -48, 57, '#fffaf2'); B(cabeca, 3, 3, 3, 18, -48, 57, '#fffaf2');
    B(cabeca, 20, 3, 5, -20, -56, 50, '#39362f'); B(cabeca, 20, 3, 5, 20, -56, 50, '#39362f');
    // Sobreposições finas sugerem tecido e costuras, sem projetar um segundo
    // bloco sobre a face.
    B(cabeca, 64, 3, 3, 0, -28, 48, tom(cfg.mascara, 1.28));
    B(cabeca, 2, 18, 3, 0, -14, 48, tom(cfg.mascara, 1.3));
    B(cabeca, 54, 2, 3, 0, -4, 48, tom(cfg.mascara, 0.75));
  } else {
    const sobr = cfg.sobr || tom(cfg.cabelo, 0.9);
    if (!pescador && !raposaOriginal && !nativoOriginal && !biomedicaOriginal) { B(cabeca, 26, 8, 6, -20, -58, 47, sobr); B(cabeca, 26, 8, 6, 20, -58, 47, sobr); }
    if (biomedicaOriginal) { B(cabeca, 21, 5, 6, -20, -58, 47, '#b99360'); B(cabeca, 21, 5, 6, 20, -58, 47, '#b99360'); }
    if (nativoOriginal) { B(cabeca, 21, 5, 6, -20, -58, 47, sobr); B(cabeca, 21, 5, 6, 20, -58, 47, sobr); }
    if (raposaOriginal) { B(cabeca, 22, 5, 6, -20, -59, 48, '#b65e24'); B(cabeca, 22, 5, 6, 20, -59, 48, '#b65e24'); }
    const base = cfg.bicho ? cfg.bicho.focinho : cfg.skin;
    B(cabeca, 19, 17, 5, -20, -45, 47, '#fdfbf7'); B(cabeca, 19, 17, 5, 20, -45, 47, '#fdfbf7');
    if (!pescador && !raposaOriginal && !nativoOriginal && !biomedicaOriginal) { B(cabeca, 19, 7, 6, -20, -51, 48, base); B(cabeca, 19, 7, 6, 20, -51, 48, base); }
    B(cabeca, 10, 10, 4, -20, pescador ? -44 : -42, 50, cfg.iris || '#2a1f1a'); B(cabeca, 10, 10, 4, 20, pescador ? -44 : -42, 50, cfg.iris || '#2a1f1a');
    if (pescador) { B(cabeca, 4, 4, 3, -22, -47, 53, '#fffaf2'); B(cabeca, 4, 4, 3, 18, -47, 53, '#fffaf2'); }
    if (nativoOriginal) { B(cabeca, 4, 4, 3, -22, -45, 53, '#fffaf2'); B(cabeca, 4, 4, 3, 18, -45, 53, '#fffaf2'); }
    if (rostoRefinado) { B(cabeca, 4, 4, 3, -22, -45, 53, '#fffaf2'); B(cabeca, 4, 4, 3, 18, -45, 53, '#fffaf2'); }
    if (cfg.nome === 'Médica') {
      B(cabeca, 20, 3, 3, -20, -53, 52, '#6d5144'); B(cabeca, 20, 3, 3, 20, -53, 52, '#6d5144');
      B(cabeca, 4, 5, 3, -30, -54, 52, '#6d5144'); B(cabeca, 4, 5, 3, 30, -54, 52, '#6d5144');
    }
    // Os mesmos cílios da Médica, agora como peça que o estúdio liga em
    // qualquer boneco: traço por cima do olho e um pontinho no canto de fora.
    if (cfg.cilios) {
      B(cabeca, 20, 3, 3, -20, -53, 52, cfg.cilios); B(cabeca, 20, 3, 3, 20, -53, 52, cfg.cilios);
      B(cabeca, 4, 5, 3, -30, -54, 52, cfg.cilios); B(cabeca, 4, 5, 3, 30, -54, 52, cfg.cilios);
    }
    if (biomedicaOriginal) {
      B(cabeca, 4, 4, 3, -22, -45, 53, '#fffaf2'); B(cabeca, 4, 4, 3, 18, -45, 53, '#fffaf2');
      B(cabeca, 20, 3, 3, -20, -53, 52, '#745644'); B(cabeca, 20, 3, 3, 20, -53, 52, '#745644');
      B(cabeca, 4, 5, 3, -30, -54, 52, '#745644'); B(cabeca, 4, 5, 3, 30, -54, 52, '#745644');
      B(cabeca, 10, 4, 3, -31, -27, 48, '#e59b83'); B(cabeca, 10, 4, 3, 31, -27, 48, '#e59b83');
    }
    if (nativoOriginal) {
      B(cabeca, 12, 3, 3, -31, -28, 48, '#b3422f'); B(cabeca, 12, 3, 3, 31, -28, 48, '#b3422f');
      B(cabeca, 9, 3, 3, -31, -23, 48, '#e5c69a'); B(cabeca, 9, 3, 3, 31, -23, 48, '#e5c69a');
    }
    // Pálpebras: tampam o olho aberto quando ele dorme. Ficam numa junta à parte,
    // escondida, pelo mesmo motivo do fone — aparecer não pode remontar o boneco.
    // Nos bichos a cor é a da máscara em volta do olho, não a da pele.
    olhos = J(cabeca, 0, 0, 0);
    olhos.style.display = 'none';
    const palpebra = cfg.bicho?.mascara || cfg.skin;
    B(olhos, 21, 19, 4, -20, -45, 49, palpebra); B(olhos, 21, 19, 4, 20, -45, 49, palpebra);
    B(olhos, 19, 3, 5, -20, -43, 51, tom(palpebra, 0.55)); B(olhos, 19, 3, 5, 20, -43, 51, tom(palpebra, 0.55));
    if (cfg.bicho) {
      B(cabeca, pescador || carameloOriginal ? 44 : raposaOriginal ? 42 : 36, 26, raposaOriginal || carameloOriginal ? 21 : 17, 0, -19, 48, cfg.bicho.focinho); B(cabeca, carameloOriginal ? 17 : 14, 11, 9, 0, -27, raposaOriginal || carameloOriginal ? 59 : 57, cfg.bicho.nariz);
      B(cabeca, 16, 5, 6, 0, -13, 56, tom(cfg.bicho.nariz, 1.6));
      if (carameloOriginal) {
        B(cabeca, 3, 8, 3, 0, -19, 61, '#5c3b2e');
        B(cabeca, 10, 3, 3, -4, -13, 61, '#5c3b2e', 1, ' rotateZ(12deg)');
        B(cabeca, 10, 3, 3, 4, -13, 61, '#5c3b2e', 1, ' rotateZ(-12deg)');
      }
      if (gato) {
        B(cabeca, 13, 2, 3, -23, -20, 58, '#f8ead4'); B(cabeca, 13, 2, 3, 23, -20, 58, '#f8ead4');
        B(cabeca, 10, 2, 3, -23, -15, 58, '#f8ead4'); B(cabeca, 10, 2, 3, 23, -15, 58, '#f8ead4');
      }
      if (pescador) B(cabeca, 10, 4, 5, 0, -9, 57, '#b86858');
      B(cabeca, 15, 24, 17, -47, -30, 16, cfg.bicho.focinho); B(cabeca, 15, 24, 17, 47, -30, 16, cfg.bicho.focinho);
    } else {
      B(cabeca, 14, 12, 11, 0, -31, 48, tom(cfg.skin, 0.88));
      const pelo = cfg.barba || cfg.bigode;
      const barbaNutri = cfg.nome === 'Nutricionista' && varianteNutricionista === 1 && cfg.barba;
      if (barbaNutri) {
        B(cabeca, 68, 15, 8, 0, -8, 45, cfg.barba!);
        B(cabeca, 19, 26, 8, -25, -20, 45, cfg.barba!); B(cabeca, 19, 26, 8, 25, -20, 45, cfg.barba!);
        B(cabeca, 16, 22, 20, -40, -20, 32, cfg.barba!); B(cabeca, 16, 22, 20, 40, -20, 32, cfg.barba!);
        B(cabeca, 22, 8, 6, -11, -22, 49, cfg.barba!); B(cabeca, 22, 8, 6, 11, -22, 49, cfg.barba!);
        B(cabeca, 14, 4, 4, 0, -13, 51, '#884434');
        B(cabeca, 18, 3, 3, -21, -7, 50, tom(cfg.barba!, 1.18)); B(cabeca, 18, 3, 3, 21, -7, 50, tom(cfg.barba!, 1.18));
      } else {
        if (cfg.barba) { B(cabeca, 84, 26, 20, 0, -14, 40, cfg.barba); B(cabeca, 20, 30, 22, -40, -24, 32, cfg.barba); B(cabeca, 20, 30, 22, 40, -24, 32, cfg.barba); }
        if (senhorOriginal && pelo) {
          B(cabeca, 19, 7, 7, -9, -22, 49, pelo); B(cabeca, 19, 7, 7, 9, -22, 49, pelo);
          B(cabeca, 9, 4, 5, -17, -20, 50, tom(pelo, 1.22)); B(cabeca, 9, 4, 5, 17, -20, 50, tom(pelo, 1.22));
          B(cabeca, 13, 3, 4, 0, -12, 49, '#a86554');
        } else if (pelo) { B(cabeca, 10, 7, 7, 0, -21, 49, pelo); B(cabeca, 17, 7, 7, -12, -23, 47, pelo); B(cabeca, 17, 7, 7, 12, -23, 47, pelo); }
        else B(cabeca, 15, 5, 5, 0, -14, 47, '#a8452a');
        if (roqueiroOriginal) { B(cabeca, 6, 5, 3, 3, -14, 51, '#bfc8cb'); B(cabeca, 3, 2, 2, 2, -15, 53, '#f7faf7'); }
        if (nativoOriginal) B(cabeca, 13, 3, 4, 0, -13, 51, '#c37a64');
        if (biomedicaOriginal) { B(cabeca, 15, 5, 4, 0, -14, 51, '#ba6a64'); B(cabeca, 8, 2, 3, 0, -13, 54, '#e6a198'); }
        if (cfg.nome === 'Médica') { B(cabeca, 15, 5, 4, 0, -14, 51, '#ba6a64'); B(cabeca, 8, 2, 3, 0, -13, 54, '#e6a198'); }
      }
    }
  }
  if (cfg.pinta) B(cabeca, 5, 5, 4, 27, -28, 46, '#3a2a1d');
  if (cfg.oculos) {
    if (roqueiroOriginal) {
      B(cabeca, 27, 19, 5, -20, -45, 50, '#17181d'); B(cabeca, 27, 19, 5, 20, -45, 50, '#17181d');
      B(cabeca, 21, 13, 3, -20, -45, 53, '#34404d'); B(cabeca, 21, 13, 3, 20, -45, 53, '#34404d');
      B(cabeca, 10, 3, 2, -23, -49, 55, '#788995', 1, ' rotateZ(-18deg)');
      B(cabeca, 10, 3, 2, 17, -49, 55, '#788995', 1, ' rotateZ(-18deg)');
      B(cabeca, 12, 4, 4, 0, -46, 52, '#17181d');
    } else {
      B(cabeca, 24, 20, 4, -20, -45, 50, cfg.oculos); B(cabeca, 24, 20, 4, 20, -45, 50, cfg.oculos);
      B(cabeca, 19, 15, 3, -20, -45, 52, cfg.lente || '#cfe9f5'); B(cabeca, 19, 15, 3, 20, -45, 52, cfg.lente || '#cfe9f5');
      B(cabeca, 12, 4, 3, 0, -45, 51, cfg.oculos);
    }
    B(cabeca, 10, 4, 24, -42, -45, 38, cfg.oculos); B(cabeca, 10, 4, 24, 42, -45, 38, cfg.oculos);
  }
  // O fone entra montado desde o começo e fica escondido: aparecer é só trocar o
  // display, sem remontar o boneco no meio da caminhada de volta.
  const fone = J(cabeca, 0, 0, 0);
  fone.style.display = 'none';
  // Grafite claro, e não preto: metade dos personagens tem cabelo escuro e o fone
  // sumia dentro dele. A concha ainda ganha um disco laranja virado para fora.
  const FONE = '#55504a';
  // Cabelo afro e capacete ocupam o alto da cabeça; o arco sobe para passar por cima.
  const yArco = cfg.estilo === 'afro' ? -116 : cfg.capacete || cfg.balde ? -106 : -98;
  B(fone, 106, 13, 27, 0, yArco, 0, FONE);
  B(fone, 94, 9, 23, 0, yArco + 10, 0, '#e8e2d6');
  [-50, 50].forEach((x) => {
    B(fone, 13, -46 - yArco, 19, x, (yArco - 46) / 2, 0, FONE);
    B(fone, 20, 36, 34, x + Math.sign(x) * 5, -40, 2, FONE);
    B(fone, 10, 30, 30, x + Math.sign(x) * 16, -40, 2, '#e96f34');
  });
  return { raiz, corpo, cabeca, bracoE, bracoD, pernaE, pernaD, rabo, fone, adEsq, adDir, aquario, olhos, cronometro, livro };
};

export type VoxelPose = 'parado' | 'estudando' | 'tchau' | 'dormindo' | 'andando' | 'voltando' | 'festejando' | 'dancando' | 'distraido-olhar' | 'distraido-maos' | 'distraido-pes' | 'lendo';

/** As animações que dá para escolher na tela. 'andando' fica de fora: é a saída. */
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

interface VoxelAvatarProps {
  characterId?: string;
  /** Altura do palco em px. O boneco é escalado para caber nela. */
  altura?: number;
  pose?: VoxelPose;
  /** Mostra o fone de ouvido na cabeça e faz ele balançar no ritmo. */
  fone?: boolean;
  /** Põe o despertador nas mãos dele: o cronômetro está rodando. */
  cronometro?: boolean;
  /** O tempo acabou: ele treme junto com o despertador tocando. */
  alarme?: boolean;
  /** Chamado uma vez quando ele termina de andar para fora da tela. */
  onSaiuDaTela?: () => void;
  /** Chamado uma vez quando ele termina de andar de volta para o lugar. */
  onChegou?: () => void;
  /** O mascote do aluno: um personagem pronto retocado ou um criado no estúdio. */
  mascote?: Mascote;
  /** 'rosto' mostra só a cabeça, enquadrada: é o avatar redondo pequeno. */
  recorte?: 'inteiro' | 'rosto';
  /** Monta, posiciona e para. Para listas com muitos bonecos na tela de uma vez. */
  estatico?: boolean;
  /** Giro de descanso em graus: 0 de frente, -90 de perfil, 180 de costas. */
  angulo?: number;
  className?: string;
}

const VoxelAvatar: React.FC<VoxelAvatarProps> = ({ characterId, altura = 132, pose = 'estudando', fone = false, cronometro = false, alarme = false, onSaiuDaTela, onChegou, mascote, recorte = 'inteiro', estatico = false, angulo, className = '' }) => {
  // No modo 'criado' não existe personagem de origem: a receita sai inteira das
  // peças que o aluno escolheu no estúdio.
  const criado = mascote?.modo === 'criado';
  const idBase = criado ? undefined : mascote?.base || characterId;
  const chaveMascote = JSON.stringify(mascote || {});
  const mascoteRef = useRef(mascote);
  mascoteRef.current = mascote;
  const variantePescador = 3, varianteNutricionista = 1, variantePolicial = 1, varianteRegata = 1, varianteRaposa = 1, varianteRoqueiro = 1, varianteSenhor = 1, varianteSurfista = 1, varianteNativo = 1, varianteCaramelo = 1;
  const palcoRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const foneRef = useRef(fone);
  foneRef.current = fone;
  const cronometroRef = useRef(cronometro);
  cronometroRef.current = cronometro;
  const alarmeRef = useRef(alarme);
  alarmeRef.current = alarme;
  const saidaRef = useRef(onSaiuDaTela);
  saidaRef.current = onSaiuDaTela;
  const chegadaRef = useRef(onChegou);
  chegadaRef.current = onChegou;

  useEffect(() => {
    // O estúdio pode trocar a receita de base, então os retoques por personagem
    // seguem o id da base escolhida, não o do avatar do onboarding. Eles entram
    // antes das escolhas do aluno: são parte do desenho original, não por cima.
    const original = getVoxelConfig(idBase);
    const retocado = original && idBase === 'vira-lata-caramelo'
      ? { ...original, skin: '#d99443', cabelo: '#d99443', relogio: '#c99b30', bicho: original.bicho && { ...original.bicho, orelha: '#b87532', focinho: '#f4d4a2', rabo: ['#d99443', '#c47d32', '#d99443'] } }
      : original && idBase === 'surfista' ? { ...original, bermuda: '#602070' } : original;
    const cfg = criado
      ? configDoMascote(characterId, mascoteRef.current)
      : retocado && mascoteRef.current ? aplicarMascote(retocado, mascoteRef.current) : retocado;
    const palco = palcoRef.current;
    if (!cfg || !palco) return;
    palco.textContent = '';
    const pivot = document.createElement('div');
    pivot.style.cssText = 'position:absolute;transform-style:preserve-3d';
    palco.appendChild(pivot);
    const cena = J(pivot, 0, 48, 0);
    const sombra = document.createElement('div');
    sombra.style.cssText = 'position:absolute;width:132px;height:72px;left:-66px;top:-36px;background:#8f8375;opacity:.26;border-radius:50%;transform:translate3d(0,40px,0) rotateX(90deg);transition:transform 320ms ease';
    cena.appendChild(sombra);
    const p = montar(cfg, cena, variantePescador, varianteNutricionista, variantePolicial, varianteRegata, varianteRaposa, varianteRoqueiro, varianteSenhor, varianteSurfista, varianteNativo, varianteCaramelo);

    // Só a cabeça: esconde o corpo e enquadra. Os cubos continuam montados —
    // `display:none` já tira o custo de pintar, e separar a montagem em duas
    // dobraria um código que é uma receita linear de 500 linhas.
    const soRosto = recorte === 'rosto';
    if (soRosto) {
      sombra.style.display = 'none';
      [p.pernaE, p.pernaD, p.bracoE, p.bracoD, p.rabo].forEach((parte) => { if (parte) parte.style.display = 'none'; });
      Array.from(p.corpo.children).forEach((filho) => { if (filho !== p.cabeca) (filho as HTMLElement).style.display = 'none'; });
    }

    const menosMovimento = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // De corpo inteiro a figura tem 212 de altura; a cabeça sozinha, com cabelo
    // e chapéu, cabe em 112 — e fica a 48 acima do centro do palco.
    const escala = altura / (soRosto ? 112 : 212);
    // Parado ele fica de três quartos, virado para quem lê. Não gira: girar sem
    // parar puxava o olho do aluno e obrigava a desenhar as costas de cada cubo.
    const DESCANSO = angulo ?? -20;
    let ry = DESCANSO;
    let quadro = 0;
    let inicio = 0;
    let anterior = 0;
    let desloc = 0;
    let avisou = false;
    let poseAnterior: VoxelPose | null = null;
    let foneAnterior: boolean | null = null;
    let guardaAnterior: string | null = null;
    let cronoAnterior: string | null = null;
    const PERCURSO = 280;

    const desenhar = (ms: number) => {
      if (!inicio) inicio = ms;
      const t = (ms - inicio) / 1000;
      // Tudo que avança (giro e caminhada) anda por segundo, não por quadro: em aba
      // de fundo ou aparelho fraco o navegador entrega menos quadros, e por quadro
      // a despedida levaria meio minuto.
      const dt = anterior ? Math.min((ms - anterior) / 1000, 0.05) : 0.016;
      anterior = ms;
      const pose = poseRef.current;
      const andando = pose === 'andando';
      const voltando = pose === 'voltando';
      const caminhando = andando || voltando;
      const dormindo = pose === 'dormindo';
      const tchau = pose === 'tchau';
      const estudando = pose === 'estudando';
      const festa = pose === 'festejando';
      const danca = pose === 'dancando';
      const olhar = pose === 'distraido-olhar';
      const maos = pose === 'distraido-maos';
      const pes = pose === 'distraido-pes';
      const lendo = pose === 'lendo';
      const movimento = menosMovimento ? 0 : 1;
      // Cada distração tem um pequeno ciclo com pausas e gestos desencontrados.
      const curiosidade = Math.sin(t * 0.72) * movimento;
      const olharLado = Math.tanh(curiosidade * 3) * 35;
      const mexeMaos = Math.sin(t * 2.6) * movimento;
      const inquieto = Math.sin(t * 1.65) * movimento;

      if (pose !== poseAnterior) {
        // Sair começa no lugar e vai embora; voltar começa fora e vem andando.
        if (voltando) desloc = PERCURSO;
        if (andando) desloc = 0;
        avisou = false;
        poseAnterior = pose;
      }

      // Só escreve no display quando muda: por quadro seria uma recalculada de
      // layout de graça em 20 cubos que ninguém pediu.
      const comFone = foneRef.current;
      if (comFone !== foneAnterior) {
        foneAnterior = comFone;
        p.fone.style.display = comFone ? '' : 'none';
      }
      const comCrono = cronometroRef.current;
      const mostraAlarme = comCrono && (!lendo || alarmeRef.current);
      const mostraLivro = lendo && !alarmeRef.current;
      const objetos = `${mostraAlarme}-${mostraLivro}`;
      if (objetos !== cronoAnterior) {
        cronoAnterior = objetos;
        p.cronometro.style.display = mostraAlarme ? '' : 'none';
        p.livro.style.display = mostraLivro ? '' : 'none';
      }

      // O que está na mão acompanha o braço. Acenando, o braço direito sobe a
      // 150° e levaria o objeto por cima da cabeça; deitado, os dois braços
      // dobram para dentro e o objeto atravessa o corpo e o chão. Nessas poses
      // ele guarda o item, com um desvanecer curto para não sumir num estalo.
      // Segurando o despertador com os dois braços ele não tem como continuar
      // com o vaso e o rádio na mão: guarda os dois enquanto o relógio está ali.
      const maosNoRelogio = comCrono && !dormindo && !caminhando && !tchau && !festa && !danca && !maos;
      const guarda = dormindo || danca || maos || lendo || maosNoRelogio ? 'ambos' : tchau ? 'direita' : 'nenhum';
      if (guarda !== guardaAnterior) {
        guardaAnterior = guarda;
        p.adDir.style.opacity = guarda === 'nenhum' ? '1' : '0';
        p.adEsq.style.opacity = guarda === 'ambos' ? '0' : '1';
        if (p.olhos) p.olhos.style.display = dormindo ? '' : 'none';
      }
      if (p.aquario) p.aquario.style.opacity = dormindo || lendo ? '0' : '1';

      // Andando ele vira de perfil para o lado em que caminha; acenando e dormindo,
      // de frente; no resto do tempo volta para o descanso de três quartos.
      const alvo = andando ? 76 : voltando ? -76 : tchau || dormindo ? 0 : DESCANSO;
      ry += (alvo - ry) * (1 - Math.exp(-7.5 * dt));

      const salto = festa ? Math.abs(Math.sin(t * 3)) : 0;
      // Dança: uma batida e a mesma batida meio tempo atrás. Tudo no corpo sai
      // de uma das duas, para braços, quadril e cabeça andarem no mesmo compasso
      // em vez de cada um no seu, que é o que faz parecer travamento.
      // Passinho: o corpo inteiro vai de um lado para o outro, com os pés
      // trocando. O balanço do ombro é o dobro do passo, como quem marca o
      // tempo -- um só ritmo para tudo deixaria o boneco mole.
      const lado = danca ? Math.sin(t * 5) : 0;
      const ombro = danca ? Math.abs(Math.sin(t * 10)) * 6 : 0;
      const passo = caminhando ? Math.sin(t * 7.5) : 0;
      const sobe = salto * 26 + ombro + (caminhando ? Math.abs(passo) * 5 : 0);
      const balanco = festa || caminhando || danca ? 0 : Math.sin(t * (dormindo ? 0.9 : 2)) * (dormindo ? 4.5 : 2.5);
      // Deitado de costas as pernas ficam esticadas; em pé elas só andam ou dobram no pulo.
      const perna = caminhando ? passo * 30 : dormindo ? 0 : danca ? lado * 24 : pes ? inquieto * 22 : -salto * 22;

      let zE = 6;
      let zD = -6;
      let bE = 6;
      let bD = 8;
      if (cfg.aquario) { zE = -26; zD = 26; bE = 62; bD = 62; }
      // Segurando o despertador os dois braços vêm à frente. Só nas poses
      // paradas: acenando, andando e comemorando os braços têm outro trabalho,
      // e o relógio fica encostado no peito como quem carrega debaixo do braço.
      if (comCrono && !dormindo && !caminhando && !tchau && !festa) { zE = -22; zD = 22; bE = 58; bD = 58; }
      if (cfg.dir === 'vaso') { zD = -34; bD = 46; }
      if (cfg.dir === 'prancheta') bD = 22;
      if (cfg.dir === 'rifle') bD = 30;
      if (cfg.esq === 'vara') { zE = 9; bE = 4; }
      if (caminhando) { bE += passo * 22; bD -= passo * 22; }
      if (tchau) { zD = -150 + Math.sin(t * 9) * 22; bD = 0; }
      // De barriga para cima os braços descansam ao longo do corpo, abertos o
      // bastante para não sumirem dentro do tronco.
      if (dormindo) { bE = 0; bD = 0; zE = 16; zD = -16; }
      // Um braço sobe enquanto o outro desce, e as mãos vêm à frente do corpo
      // no contratempo: é o que dá a leitura de dança, e não de ginástica.
      if (danca) { zE = 24 + lado * 16; zD = -24 + lado * 16; bE = 14 - lado * 10; bD = 14 + lado * 10; }
      if (olhar) { zE = 10 + curiosidade * 6; zD = -10 + curiosidade * 6; bE = 12; bD = 12; }
      if (maos) { zE = -24 + mexeMaos * 10; zD = 24 + mexeMaos * 10; bE = 58 + Math.sin(t * 3.4) * 14 * movimento; bD = 58 - Math.sin(t * 3.4 + 0.6) * 14 * movimento; }
      if (pes) { zE = 10 + inquieto * 6; zD = -10 + inquieto * 6; bE = 12 - inquieto * 10; bD = 12 + inquieto * 10; }
      if (lendo) { zE = -8; zD = 8; bE = 100; bD = 100; }
      zE -= salto * 12;
      zD += salto * 12;

      // O rosto aponta para +Z: rotação X negativa faz o olhar descer para o livro.
      const inclinaCabeca = dormindo ? 0 : lendo ? -14 + Math.sin(t * 0.7) * 2 * movimento : estudando ? 16 : maos ? 19 + Math.sin(t * 1.3) * 5 * movimento : olhar ? 4 + Math.sin(t * 1.44) * 5 * movimento : danca ? 4 : -salto * 6;
      // Com o fone na cabeça ele marca o ritmo. Dormindo ou andando, não: um já
      // tem inclinação própria e o outro já balança por conta do passo.
      const tombaCabeca = (dormindo ? 14 : 0) + lado * 7 + (olhar ? -curiosidade * 10 : maos ? mexeMaos * 4 : pes ? -inquieto * 8 : 0) + (comFone && !dormindo && !caminhando && !danca ? Math.sin(t * 5.5) * 7 : 0);
      const olhaEmVolta = dormindo || estudando || caminhando ? 0 : lendo ? Math.sin(t * 0.8) * 12 * movimento : olhar ? olharLado : maos ? mexeMaos * 7 : pes ? inquieto * 12 : danca ? lado * 10 : Math.sin(t * 0.7) * 9;

      // Dormindo ele deita de barriga para cima, de cabeça à esquerda: rotateZ
      // (-90) põe o corpo na horizontal e rotateX(20) rola um pouco para as
      // costas. Só um pouco — a 52° o boneco virava um amontoado de cubos, por
      // causa do encurtamento, e com 130px de altura não dava para reconhecer
      // ninguém. O deslocamento em x recentra o corpo, que deitado passa a se
      // estender para a esquerda da origem.
      const deitado = dormindo ? ' rotateX(20deg) rotateZ(-90deg)' : '';
      // Alarme: a 6,7 Hz o corpo inteiro vibra, e o despertador vai junto porque
      // está preso no tronco. Para quem pediu menos movimento no sistema não há
      // tremor nenhum -- o relógio sumindo das mãos já avisa que o tempo acabou.
      const tocando = alarmeRef.current && !menosMovimento;
      const treme = tocando ? Math.sin(t * 42) * 3.5 : 0;
      const tremeX = tocando ? Math.sin(t * 37) * 3 : 0;
      p.raiz.style.transform = `translate3d(${(dormindo ? 46 : 0) + tremeX}px,${-sobe + (dormindo ? -4 : 0)}px,0)${deitado}${tocando ? ` rotateZ(${treme}deg)` : ''}`;
      // Em pé a respiração sobe e desce; deitado ela tem de ir na direção da
      // barriga, que agora é o eixo z do corpo, senão ele escorrega para o lado.
      p.corpo.style.transform = dormindo
        ? `translate3d(0,0,${balanco}px)`
        : danca
          ? `translate3d(${lado * 17}px,0,0) rotateZ(${-lado * 6}deg)`
          : `translate3d(${pes ? inquieto * 8 : olhar ? curiosidade * 3 : 0}px,${-balanco}px,0) rotateX(${estudando ? 6 : maos ? 5 : 0}deg) rotateZ(${pes ? -inquieto * 5 : olhar ? -curiosidade * 3 : 0}deg)`;
      // Deitado ele ocupa mais chão do que em pé: a sombra acompanha.
      sombra.style.transform = `translate3d(0,40px,0) rotateX(90deg)${dormindo ? ' scale(1.4,0.78)' : ''}`;
      p.cabeca.style.transform = `translate3d(0,-52px,0) rotateY(${olhaEmVolta}deg) rotateX(${inclinaCabeca}deg) rotateZ(${tombaCabeca + treme * 1.6}deg)`;
      p.bracoE.style.transform = `translate3d(-34px,-48px,0) rotateZ(${zE}deg) rotateX(${bE}deg)${lendo ? ' scaleY(1.7)' : ''}`;
      p.bracoD.style.transform = `translate3d(34px,-48px,0) rotateZ(${zD}deg) rotateX(${bD}deg)${lendo ? ' scaleY(1.7)' : ''}`;
      p.pernaE.style.transform = `translate3d(-13px,-4px,0) rotateX(${perna}deg)`;
      p.pernaD.style.transform = `translate3d(13px,-4px,0) rotateX(${-perna}deg)`;
      if (p.rabo) p.rabo.style.transform = `translate3d(${idBase === 'raposa' && varianteRaposa === 1 ? 32 : (idBase === 'vira-lata-caramelo' && varianteCaramelo === 1) || idBase === 'gato-jaqueta' ? 25 : 0}px,-12px,-19px) rotateY(${Math.sin(t * 1.6) * 14}deg)`;
      pivot.style.transform = soRosto
        ? `translateY(${48 * escala}px) scale(${escala}) rotateX(-6deg) rotateY(${ry}deg)`
        : `scale(${escala}) rotateX(-10deg) rotateY(${ry}deg)`;

      if (caminhando) {
        const passoPx = (menosMovimento ? 700 : 200) * dt;
        if (andando) {
          desloc += passoPx;
          if (desloc > PERCURSO && !avisou) { avisou = true; saidaRef.current?.(); }
        } else {
          desloc = Math.max(0, desloc - passoPx);
          if (desloc === 0 && !avisou) { avisou = true; chegadaRef.current?.(); }
        }
        palco.style.transform = `translateX(${desloc}px)`;
      } else if (desloc !== 0) {
        desloc = 0;
        palco.style.transform = '';
      }
      if (!estatico) quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => { cancelAnimationFrame(quadro); palco.textContent = ''; palco.style.transform = ''; };
    // `chaveAjustes` entra como dependência no lugar do objeto: a cada render o
    // pai cria um objeto novo, e comparar por identidade remontaria o boneco
    // inteiro sem nada ter mudado.
  }, [idBase, criado, altura, chaveMascote, recorte, estatico, angulo]);

  if (!criado && !getVoxelConfig(idBase)) return null;
  return (
    // Os zzz ficam fora do palco: o palco é limpo com textContent no efeito, e
    // qualquer filho que o React pusesse ali seria apagado na primeira montagem.
    <div aria-hidden="true" className={`relative ${className}`} style={{ height: altura, width: altura * 0.78 }}>
      {/* O flex centraliza o ponto de origem do 3D. Sem ele o boneco é desenhado
          a partir do canto de cima e sobe para fora da caixa. */}
      <div ref={palcoRef} className="absolute inset-0 flex items-center justify-center" style={{ perspective: 900 }} />
      {pose === 'dormindo' && (
        // Deitado, a cabeça fica à esquerda e a cerca de 70% da altura do
        // palco: é de lá que os zzz sobem, e não do alto da caixa, onde
        // flutuariam soltos por cima do texto da página. Laranja do app porque
        // precisam aparecer no creme da tela e no fundo escuro da roda.
        [0, 1, 2].map((i) => (
          <span
            key={i}
            className="pointer-events-none absolute select-none font-black lowercase text-[#e96f34]"
            style={{
              left: `${13 + i * 6}%`,
              top: `${56 - i * 6}%`,
              fontSize: 11 + i * 4,
              opacity: 0,
              textShadow: '0 1px 3px rgba(42,31,24,0.45)',
              animation: `mascote-zzz 2.7s ${i * 0.9}s infinite ease-out`,
            }}
          >
            z
          </span>
        ))
      )}
    </div>
  );
};

export default VoxelAvatar;
