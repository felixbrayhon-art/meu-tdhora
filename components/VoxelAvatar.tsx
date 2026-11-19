import React, { useEffect, useRef } from 'react';
import { VoxelConfig, getVoxelConfig } from '../services/voxelCharacters';

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
    const g = J(a, 0, 46, -16);
    B(g, 40, 54, 14, 0, 0, 0, '#8a2be2', 1, ' rotateZ(-20deg)'); B(g, 11, 72, 8, -20, -62, 0, '#2a1f2e', 1, ' rotateZ(-20deg)');
    B(g, 16, 14, 6, 4, -10, 9, '#b9bec4', 1, ' rotateZ(-20deg)');
  },
  rifle: (a) => { B(a, 10, 78, 12, 0, 46, 14, '#2e2e33', 1, ' rotateX(72deg)'); B(a, 9, 24, 10, 0, 34, 6, '#3f3228'); },
  chave: (a) => { B(a, 8, 34, 8, 0, 52, 2, '#b9bec4'); B(a, 18, 12, 9, 0, 70, 2, '#b9bec4'); },
  livro: (a, c) => { B(a, 30, 38, 10, -6, 34, 12, c || '#8a3b2a'); B(a, 26, 34, 4, -6, 34, 18, '#f3ece0'); },
  martelo: (a) => { B(a, 7, 30, 7, 0, 52, 2, '#8a6a4f'); B(a, 26, 12, 12, 0, 70, 2, '#6b5440'); },
  passaro: (a) => {
    const p = J(a, 0, 44, 8);
    B(p, 20, 30, 16, 0, -18, 0, '#2f6fd0'); B(p, 15, 15, 15, 0, -38, 2, '#2f6fd0'); B(p, 9, 7, 9, 0, -38, 12, '#2a2a2e');
    B(p, 12, 26, 8, 0, 4, -6, '#e9b949'); B(p, 10, 14, 6, -11, -20, 0, '#e9b949'); B(p, 10, 14, 6, 11, -20, 0, '#e9b949');
  },
  nada: () => { },
};

interface Partes { raiz: HTMLElement; corpo: HTMLElement; cabeca: HTMLElement; bracoE: HTMLElement; bracoD: HTMLElement; pernaE: HTMLElement; pernaD: HTMLElement; rabo?: HTMLElement; fone: HTMLElement; adEsq: HTMLElement; adDir: HTMLElement; aquario?: HTMLElement; olhos?: HTMLElement; cronometro: HTMLElement }

const montar = (cfg: VoxelConfig, cena: Pai): Partes => {
  const alturaPerna = cfg.curto ? 20 : 28;
  if (cfg.pranchaLado) {
    B(cena, 30, 132, 13, 56, -28, -6, '#f3ece0');
    B(cena, 17, 78, 5, 56, -40, 2, '#e96f34'); B(cena, 11, 40, 5, 56, 6, 2, '#f5b84b');
    B(cena, 30, 13, 13, 56, 32, -6, '#e0d6c4');
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
  });
  const corpo = J(raiz, 0, 0, 0);
  if (cfg.estilo === 'longo') {
    B(corpo, 86, 44, 18, 0, -38, -28, cfg.cabelo); B(corpo, 66, 26, 18, 0, -8, -28, tom(cfg.cabelo, 1.14));
    B(corpo, 18, 34, 16, -40, -34, -18, tom(cfg.cabelo, 1.14)); B(corpo, 18, 34, 16, 40, -34, -18, tom(cfg.cabelo, 1.14));
  }
  if (cfg.semCamisa) { B(corpo, 52, 50, 38, 0, -28, 0, cfg.skin); B(corpo, 22, 20, 8, 0, -20, 19, tom(cfg.skin, 0.92)); }
  else if (cfg.regata) {
    B(corpo, 52, 50, 38, 0, -28, 0, cfg.skin);
    B(corpo, 16, 50, 40, -15, -28, 0, cfg.torso); B(corpo, 16, 50, 40, 15, -28, 0, cfg.torso); B(corpo, 52, 50, 12, 0, -28, -14, cfg.torso);
  } else B(corpo, 54, 50, 40, 0, -28, 0, cfg.torso);
  if (cfg.listrasT) { B(corpo, 55, 5, 41, 0, -42, 0, cfg.listrasT); B(corpo, 55, 5, 41, 0, -30, 0, cfg.listrasT); B(corpo, 55, 5, 41, 0, -18, 0, cfg.listrasT); }
  if (cfg.listra) { B(corpo, 56, 6, 42, 0, -36, 0, cfg.listra); B(corpo, 56, 6, 42, 0, -16, 0, cfg.listra); }
  if (cfg.faixa && !cfg.regata && !cfg.semCamisa) B(corpo, 22, 50, 7, 0, -28, 20, cfg.faixa);
  if (cfg.jaleco) B(corpo, 13, 10, 5, 0, -48, 22, cfg.skin);
  if (cfg.lapela) { B(corpo, 14, 44, 8, -16, -30, 20, cfg.lapela); B(corpo, 14, 44, 8, 16, -30, 20, cfg.lapela); }
  if (cfg.gravata) { B(corpo, 9, 28, 5, 0, -28, 24, cfg.gravata); B(corpo, 11, 9, 6, 0, -46, 24, cfg.gravata); }
  if (cfg.toga) { B(corpo, 58, 16, 44, 0, -50, 0, '#2a2a2a'); B(corpo, 14, 26, 7, -8, -46, 21, '#f3ece0'); B(corpo, 14, 26, 7, 8, -46, 21, '#f3ece0'); }
  if (cfg.colete) { B(corpo, 17, 50, 42, -18, -28, 0, cfg.colete); B(corpo, 17, 50, 42, 18, -28, 0, cfg.colete); B(corpo, 54, 50, 10, 0, -28, -16, cfg.colete); }
  if (cfg.bolsosColete && cfg.colete) {
    B(corpo, 13, 12, 5, -18, -22, 22, tom(cfg.colete, 0.86)); B(corpo, 13, 12, 5, 18, -22, 22, tom(cfg.colete, 0.86));
    B(corpo, 13, 12, 5, -18, -40, 22, tom(cfg.colete, 0.86)); B(corpo, 13, 12, 5, 18, -40, 22, tom(cfg.colete, 0.86));
  }
  if (cfg.bolso) { B(corpo, 16, 13, 6, -16, -6, 21, '#e4e0d8'); B(corpo, 16, 13, 6, 16, -6, 21, '#e4e0d8'); }
  if (cfg.estetoscopio) {
    B(corpo, 36, 7, 28, 0, -50, 2, '#2e2e33'); B(corpo, 6, 20, 6, -11, -38, 18, '#2e2e33');
    B(corpo, 6, 20, 6, 11, -38, 18, '#2e2e33'); B(corpo, 11, 11, 7, 11, -26, 20, '#b9bec4');
  }
  if (cfg.cinto) { B(corpo, 56, 9, 42, 0, -4, 0, cfg.cinto); B(corpo, 12, 9, 7, 0, -4, 22, cfg.fivela || '#e9b949'); }
  if (cfg.dragona) B(corpo, 58, 10, 44, 0, -50, 0, cfg.dragona);
  let rabo: HTMLElement | undefined;
  if (cfg.bicho?.rabo) {
    rabo = J(corpo, 0, -12, -19);
    const esc = [24, 22, 20, 18];
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
  if (cfg.relogio) B(bracoD, 19, 8, 19, 0, 30, 0, cfg.relogio);
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

  const cabeca = J(corpo, 0, -52, 0);
  let olhos: HTMLElement | undefined;
  B(cabeca, 92, 88, 92, 0, -44, 0, cfg.skin);
  if (cfg.bicho) {
    B(cabeca, 27, 27, 19, -33, -99, -4, cfg.bicho.orelha); B(cabeca, 27, 27, 19, 33, -99, -4, cfg.bicho.orelha);
    B(cabeca, 15, 15, 11, -33, -97, 4, cfg.bicho.dentro); B(cabeca, 15, 15, 11, 33, -97, 4, cfg.bicho.dentro);
    if (cfg.bicho.mascara) {
      B(cabeca, 94, 28, 10, 0, -46, 44, cfg.bicho.mascara);
      B(cabeca, 30, 20, 8, -21, -62, 45, cfg.bicho.mascara); B(cabeca, 30, 20, 8, 21, -62, 45, cfg.bicho.mascara);
    }
  } else {
    CABELO[cfg.estilo](cabeca, cfg.cabelo);
    B(cabeca, 13, 20, 10, -46, -38, 4, cfg.skin); B(cabeca, 13, 20, 10, 46, -38, 4, cfg.skin);
  }
  if (cfg.bone) { B(cabeca, 96, 26, 96, 0, -80, 0, cfg.bone); B(cabeca, 90, 11, 38, 0, -70, 60, cfg.boneAba || tom(cfg.bone, 0.78)); }
  if (cfg.balde) { B(cabeca, 96, 26, 96, 0, -80, 0, cfg.balde); B(cabeca, 116, 10, 116, 0, -66, 0, tom(cfg.balde, 0.92)); }
  if (cfg.quepe) { B(cabeca, 94, 24, 94, 0, -82, 0, cfg.quepe); B(cabeca, 96, 10, 96, 0, -69, 0, '#2a2a30'); B(cabeca, 88, 8, 36, 0, -64, 58, '#2a2a30'); }
  if (cfg.capacete) { B(cabeca, 100, 40, 100, 0, -72, 0, cfg.capacete); B(cabeca, 106, 10, 106, 0, -54, 0, tom(cfg.capacete, 0.82)); }
  if (cfg.mascara) {
    B(cabeca, 93, 44, 93, 0, -28, 0, cfg.mascara);
    B(cabeca, 96, 24, 10, 0, -47, 45, tom(cfg.mascara, 0.7));
    B(cabeca, 30, 17, 6, -21, -47, 50, '#8aa6b8'); B(cabeca, 30, 17, 6, 21, -47, 50, '#8aa6b8');
    B(cabeca, 12, 6, 5, 0, -47, 50, tom(cfg.mascara, 0.5));
    B(cabeca, 10, 6, 26, -44, -47, 34, tom(cfg.mascara, 0.5)); B(cabeca, 10, 6, 26, 44, -47, 34, tom(cfg.mascara, 0.5));
  } else {
    const sobr = cfg.sobr || tom(cfg.cabelo, 0.9);
    B(cabeca, 26, 8, 6, -20, -58, 47, sobr); B(cabeca, 26, 8, 6, 20, -58, 47, sobr);
    const base = cfg.bicho ? cfg.bicho.focinho : cfg.skin;
    B(cabeca, 19, 17, 5, -20, -45, 47, '#fdfbf7'); B(cabeca, 19, 17, 5, 20, -45, 47, '#fdfbf7');
    B(cabeca, 19, 7, 6, -20, -51, 48, base); B(cabeca, 19, 7, 6, 20, -51, 48, base);
    B(cabeca, 10, 10, 4, -20, -42, 50, cfg.iris || '#2a1f1a'); B(cabeca, 10, 10, 4, 20, -42, 50, cfg.iris || '#2a1f1a');
    // Pálpebras: tampam o olho aberto quando ele dorme. Ficam numa junta à parte,
    // escondida, pelo mesmo motivo do fone — aparecer não pode remontar o boneco.
    // Nos bichos a cor é a da máscara em volta do olho, não a da pele.
    olhos = J(cabeca, 0, 0, 0);
    olhos.style.display = 'none';
    const palpebra = cfg.bicho?.mascara || cfg.skin;
    B(olhos, 21, 19, 4, -20, -45, 49, palpebra); B(olhos, 21, 19, 4, 20, -45, 49, palpebra);
    B(olhos, 19, 3, 5, -20, -43, 51, tom(palpebra, 0.55)); B(olhos, 19, 3, 5, 20, -43, 51, tom(palpebra, 0.55));
    if (cfg.bicho) {
      B(cabeca, 36, 26, 17, 0, -19, 48, cfg.bicho.focinho); B(cabeca, 14, 11, 9, 0, -27, 57, cfg.bicho.nariz);
      B(cabeca, 16, 5, 6, 0, -13, 56, tom(cfg.bicho.nariz, 1.6));
      B(cabeca, 15, 24, 17, -47, -30, 16, cfg.bicho.focinho); B(cabeca, 15, 24, 17, 47, -30, 16, cfg.bicho.focinho);
    } else {
      B(cabeca, 14, 12, 11, 0, -31, 48, tom(cfg.skin, 0.88));
      const pelo = cfg.barba || cfg.bigode;
      if (cfg.barba) { B(cabeca, 84, 26, 20, 0, -14, 40, cfg.barba); B(cabeca, 20, 30, 22, -40, -24, 32, cfg.barba); B(cabeca, 20, 30, 22, 40, -24, 32, cfg.barba); }
      if (pelo) { B(cabeca, 10, 7, 7, 0, -21, 49, pelo); B(cabeca, 17, 7, 7, -12, -23, 47, pelo); B(cabeca, 17, 7, 7, 12, -23, 47, pelo); }
      else B(cabeca, 15, 5, 5, 0, -14, 47, '#a8452a');
    }
  }
  if (cfg.pinta) B(cabeca, 5, 5, 4, 27, -28, 46, '#3a2a1d');
  if (cfg.oculos) {
    B(cabeca, 24, 20, 4, -20, -45, 50, cfg.oculos); B(cabeca, 24, 20, 4, 20, -45, 50, cfg.oculos);
    B(cabeca, 19, 15, 3, -20, -45, 52, cfg.lente || '#cfe9f5'); B(cabeca, 19, 15, 3, 20, -45, 52, cfg.lente || '#cfe9f5');
    B(cabeca, 12, 4, 3, 0, -45, 51, cfg.oculos);
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
  return { raiz, corpo, cabeca, bracoE, bracoD, pernaE, pernaD, rabo, fone, adEsq, adDir, aquario, olhos, cronometro };
};

export type VoxelPose = 'parado' | 'estudando' | 'tchau' | 'dormindo' | 'andando' | 'voltando' | 'festejando' | 'dancando';

/** As animações que dá para escolher na tela. 'andando' fica de fora: é a saída. */
export const POSES_ESCOLHIVEIS: { pose: VoxelPose; rotulo: string }[] = [
  { pose: 'estudando', rotulo: 'Estudando' },
  { pose: 'parado', rotulo: 'De boa' },
  { pose: 'tchau', rotulo: 'Acenando' },
  { pose: 'festejando', rotulo: 'Comemorando' },
  { pose: 'dancando', rotulo: 'Dançando' },
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
  className?: string;
}

const VoxelAvatar: React.FC<VoxelAvatarProps> = ({ characterId, altura = 132, pose = 'estudando', fone = false, cronometro = false, alarme = false, onSaiuDaTela, onChegou, className = '' }) => {
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
    const cfg = getVoxelConfig(characterId);
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
    const p = montar(cfg, cena);

    const menosMovimento = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const escala = altura / 212;
    // Parado ele fica de três quartos, virado para quem lê. Não gira: girar sem
    // parar puxava o olho do aluno e obrigava a desenhar as costas de cada cubo.
    const DESCANSO = -20;
    let ry = DESCANSO;
    let quadro = 0;
    let inicio = 0;
    let anterior = 0;
    let desloc = 0;
    let avisou = false;
    let poseAnterior: VoxelPose | null = null;
    let foneAnterior: boolean | null = null;
    let guardaAnterior: string | null = null;
    let cronoAnterior: boolean | null = null;
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
      if (comCrono !== cronoAnterior) {
        cronoAnterior = comCrono;
        p.cronometro.style.display = comCrono ? '' : 'none';
      }

      // O que está na mão acompanha o braço. Acenando, o braço direito sobe a
      // 150° e levaria o objeto por cima da cabeça; deitado, os dois braços
      // dobram para dentro e o objeto atravessa o corpo e o chão. Nessas poses
      // ele guarda o item, com um desvanecer curto para não sumir num estalo.
      // Segurando o despertador com os dois braços ele não tem como continuar
      // com o vaso e o rádio na mão: guarda os dois enquanto o relógio está ali.
      const maosNoRelogio = comCrono && !dormindo && !caminhando && !tchau && !festa && !danca;
      const guarda = dormindo || danca || maosNoRelogio ? 'ambos' : tchau ? 'direita' : 'nenhum';
      if (guarda !== guardaAnterior) {
        guardaAnterior = guarda;
        p.adDir.style.opacity = guarda === 'nenhum' ? '1' : '0';
        p.adEsq.style.opacity = guarda === 'ambos' ? '0' : '1';
        if (p.aquario) p.aquario.style.opacity = dormindo ? '0' : '1';
        if (p.olhos) p.olhos.style.display = dormindo ? '' : 'none';
      }

      // Andando ele vira de perfil para o lado em que caminha; acenando e dormindo,
      // de frente; no resto do tempo volta para o descanso de três quartos.
      const alvo = andando ? 76 : voltando ? -76 : tchau || dormindo ? 0 : DESCANSO;
      ry += (alvo - ry) * (1 - Math.exp(-7.5 * dt));

      const salto = festa ? Math.abs(Math.sin(t * 3)) : 0;
      // Dança: uma batida e a mesma batida meio tempo atrás. Tudo no corpo sai
      // de uma das duas, para braços, quadril e cabeça andarem no mesmo compasso
      // em vez de cada um no seu, que é o que faz parecer travamento.
      const bat = danca ? Math.sin(t * 7) : 0;
      const contra = danca ? Math.sin(t * 7 - Math.PI / 2) : 0;
      const pulinho = danca ? Math.abs(Math.sin(t * 7)) * 11 : 0;
      const passo = caminhando ? Math.sin(t * 7.5) : 0;
      const sobe = salto * 26 + pulinho + (caminhando ? Math.abs(passo) * 5 : 0);
      const balanco = festa || caminhando || danca ? 0 : Math.sin(t * (dormindo ? 0.9 : 2)) * (dormindo ? 4.5 : 2.5);
      // Deitado de costas as pernas ficam esticadas; em pé elas só andam ou dobram no pulo.
      const perna = caminhando ? passo * 30 : dormindo ? 0 : danca ? bat * 17 : -salto * 22;

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
      if (danca) { zE = -58 + bat * 52; zD = 58 - bat * 52; bE = 26 + contra * 22; bD = 26 - contra * 22; }
      zE -= salto * 12;
      zD += salto * 12;

      const inclinaCabeca = dormindo ? 0 : estudando ? 16 : danca ? 6 + contra * 7 : -salto * 6;
      // Com o fone na cabeça ele marca o ritmo. Dormindo ou andando, não: um já
      // tem inclinação própria e o outro já balança por conta do passo.
      const tombaCabeca = (dormindo ? 14 : 0) + bat * 10 + (comFone && !dormindo && !caminhando && !danca ? Math.sin(t * 5.5) * 7 : 0);
      const olhaEmVolta = dormindo || estudando || caminhando ? 0 : danca ? contra * 13 : Math.sin(t * 0.7) * 9;

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
          ? `translate3d(${bat * 7}px,0,0) rotateZ(${bat * 8}deg) rotateY(${contra * 16}deg)`
          : `translate3d(0,${-balanco}px,0) rotateX(${estudando ? 6 : 0}deg)`;
      // Deitado ele ocupa mais chão do que em pé: a sombra acompanha.
      sombra.style.transform = `translate3d(0,40px,0) rotateX(90deg)${dormindo ? ' scale(1.4,0.78)' : ''}`;
      p.cabeca.style.transform = `translate3d(0,-52px,0) rotateY(${olhaEmVolta}deg) rotateX(${inclinaCabeca}deg) rotateZ(${tombaCabeca + treme * 1.6}deg)`;
      p.bracoE.style.transform = `translate3d(-34px,-48px,0) rotateZ(${zE}deg) rotateX(${bE}deg)`;
      p.bracoD.style.transform = `translate3d(34px,-48px,0) rotateZ(${zD}deg) rotateX(${bD}deg)`;
      p.pernaE.style.transform = `translate3d(-13px,-4px,0) rotateX(${perna}deg)`;
      p.pernaD.style.transform = `translate3d(13px,-4px,0) rotateX(${-perna}deg)`;
      if (p.rabo) p.rabo.style.transform = `translate3d(0,-12px,-19px) rotateY(${Math.sin(t * 1.6) * 14}deg)`;
      pivot.style.transform = `scale(${escala}) rotateX(-10deg) rotateY(${ry}deg)`;

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
      quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => { cancelAnimationFrame(quadro); palco.textContent = ''; palco.style.transform = ''; };
  }, [characterId, altura]);

  if (!getVoxelConfig(characterId)) return null;
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
