import React, { useEffect, useRef } from 'react';
import { POSES_ESCOLHIVEIS, VoxelConfig, VoxelPose, getVoxelConfig } from '../services/voxelCharacters';
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

// Boneco parado, câmera fixa: das seis faces de cada cubo, três nunca aparecem.
// Deixar de criá-las é o que faz a diferença numa tela com muitos bonecos — o
// caro não é criar os divs (3.500 saem em 10 ms), é o navegador compor cada um
// como contexto 3D próprio (1.700 ms para os mesmos 3.500). Cortar metade
// corta metade desse tempo.
//
// A escolha é por ângulo de descanso: o topo sempre aparece (a câmera olha de
// cima), a frente até um quarto de volta e, depois disso, as costas; a lateral
// é a do lado para onde o boneco virou. É estado de módulo porque a montagem é
// uma receita linear e síncrona de 500 linhas, e enfiar o modo em cada uma das
// centenas de chamadas de B() só ia esconder a regra.
let faceCortada: ((lado: 'frente' | 'tras' | 'dir' | 'esq' | 'topo' | 'base') => boolean) | null = null;

const cortarFacesPara = (angulo: number) => {
  const g = ((angulo % 360) + 360) % 360;
  const deCostas = g > 90 && g < 270;
  // Em CSS, rotateY negativo traz o lado +X do boneco para a frente.
  const ladoVisivel = g > 180 ? 'dir' : 'esq';
  faceCortada = (lado) =>
    lado === 'base' ||
    (lado === 'frente' && deCostas) ||
    (lado === 'tras' && !deCostas) ||
    (lado !== 'topo' && lado !== 'frente' && lado !== 'tras' && lado !== ladoVisivel);
};

const B = (p: Pai, w: number, h: number, d: number, x: number, y: number, z: number, cor: string, op = 1, rot = ''): HTMLElement => {
  const b = document.createElement('div');
  b.style.cssText = 'position:absolute;transform-style:preserve-3d';
  b.style.transform = `translate3d(${x}px,${y}px,${z}px)${rot}`;
  const corta = faceCortada;
  if (!corta || !corta('frente')) b.appendChild(criarFace(w, h, `translateZ(${d / 2}px)`, cor, op));
  if (!corta || !corta('tras')) b.appendChild(criarFace(w, h, `rotateY(180deg) translateZ(${d / 2}px)`, tom(cor, 0.8), op));
  if (!corta || !corta('dir')) b.appendChild(criarFace(d, h, `rotateY(90deg) translateZ(${w / 2}px)`, tom(cor, 0.88), op));
  if (!corta || !corta('esq')) b.appendChild(criarFace(d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, tom(cor, 0.72), op));
  if (!corta || !corta('topo')) b.appendChild(criarFace(w, d, `rotateX(90deg) translateZ(${h / 2}px)`, tom(cor, 1.16), op));
  if (!corta || !corta('base')) b.appendChild(criarFace(w, d, `rotateX(-90deg) translateZ(${h / 2}px)`, tom(cor, 0.58), op));
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
  curto: (h, c) => {
    B(h, 94, 20, 94, 0, -80, 0, c); B(h, 94, 30, 14, 0, -58, -44, c);
    B(h, 12, 26, 80, -43, -64, -4, c); B(h, 12, 26, 80, 43, -64, -4, c);
    B(h, 92, 12, 16, 0, -70, 43, c);
    // Risca de lado, costeletas e a ponta da franja mais clara: é o que separa
    // um corte curto de uma touca lisa da cor do cabelo.
    // Risca, costeletas e ponta da franja em cubos de 4 a 8: o detalhe fino
    // some se for feito com a mesma peça grande que monta o volume.
    [-14, -2, 10, 22].forEach((z) => B(h, 4, 8, 8, -18, -87, z, tom(c, 0.66)));
    [-1, 1].forEach((lado) => [0, 7].forEach((d) => B(h, 7, 7, 7, lado * 43, -50 - d, 18, tom(c, 0.86))));
    [-33, -20, -7, 7, 20, 33].forEach((x) => B(h, 8, 4, 5, x, -64, 47, tom(c, x % 2 ? 1.1 : 1.2)));
    [-26, 0, 26].forEach((x) => [-20, 8].forEach((z) => B(h, 16, 4, 16, x, -89, z, tom(c, 1.12))));
  },
  cacheado: (h, c) => {
    B(h, 96, 24, 96, 0, -78, 0, c); B(h, 94, 34, 16, 0, -54, -44, c);
    B(h, 22, 22, 22, -45, -58, 8, c); B(h, 20, 20, 20, -44, -54, -20, c);
    B(h, 22, 22, 22, 45, -58, 8, c); B(h, 20, 20, 20, 44, -54, -20, c);
    B(h, 38, 16, 38, -20, -92, 0, c); B(h, 32, 14, 32, 24, -94, -12, c); B(h, 90, 12, 16, 0, -66, 43, c);
    // Cachos soltos de tamanhos diferentes por cima, em dois tons: cacho é
    // volume irregular, e um bloco liso com dois caroços não lê como cacho.
    // Cada cacho é um punhado de cubos de 7 a 11, não um cubo de 20: é o
    // tamanho do cubo que faz a diferença entre cacho e caroço.
    ([[-34, 26], [-6, 34], [22, 28], [36, -2], [-40, -8], [8, -6], [-18, -30], [28, -32], [-44, 18], [44, 16]] as const)
      .forEach(([x, z], i) => {
        const d = 7 + (i % 3) * 2;
        B(h, d, d, d, x, -96 + (i % 3) * 4, z, tom(c, i % 2 ? 1.16 : 0.86));
        B(h, d - 2, d - 2, d - 2, x + (i % 2 ? 7 : -7), -90 + (i % 2) * 5, z + 5, tom(c, i % 2 ? 0.88 : 1.12));
      });
    [-1, 1].forEach((lado) => [0, 9].forEach((d) => B(h, 9, 9, 9, lado * 47, -76 + d, 24, tom(c, d ? 0.9 : 1.1))));
  },
  afro: (h, c) => {
    B(h, 112, 42, 108, 0, -80, 0, c); B(h, 96, 30, 96, 0, -56, -20, c);
    B(h, 40, 20, 40, -44, -62, 6, c); B(h, 40, 20, 40, 44, -62, 6, c);
    B(h, 46, 20, 46, -16, -100, -6, c); B(h, 40, 18, 40, 22, -100, 8, c); B(h, 90, 12, 16, 0, -64, 43, c);
    // Textura: caroços claros e escuros na superfície da bola, e a linha do
    // cabelo marcada na testa.
    // Textura de cubos de 8 a 10 espalhados pela bola, em dois tons.
    ([[-40, 34], [-10, 44], [24, 36], [46, 6], [-50, 4], [38, -28], [-34, -34], [4, -46], [-24, 46], [30, 44], [-52, -22], [52, 26]] as const)
      .forEach(([x, z], i) => {
        const d = 8 + (i % 2) * 2;
        B(h, d, d, d, x, -78 - (i % 4) * 10, z, tom(c, i % 2 ? 1.18 : 0.82));
      });
    [-30, -10, 10, 30].forEach((x) => B(h, 16, 5, 8, x, -58, 45, tom(c, 0.7)));
    [-24, 0, 24].forEach((x) => [-18, 10].forEach((z) => B(h, 18, 5, 18, x, -103, z, tom(c, 1.14))));
  },
  longo: (h, c) => {
    B(h, 98, 26, 98, 0, -78, 0, c); B(h, 98, 48, 18, 0, -48, -44, c);
    B(h, 18, 66, 86, -42, -50, -2, c); B(h, 18, 66, 86, 42, -50, -2, c); B(h, 96, 16, 20, 0, -68, 42, c);
    B(h, 40, 16, 40, -24, -92, 2, tom(c, 1.18)); B(h, 34, 14, 34, 26, -94, -10, tom(c, 1.18));
    // Risca no meio e sulcos descendo pelas mechas; pontas mais claras.
    [-6, 6, 18, 30].forEach((z) => B(h, 4, 8, 8, 0, -89, z, tom(c, 0.68)));
    [-1, 1].forEach((lado) => {
      // Sulcos curtos empilhados em vez de uma barra inteira, e as pontas
      // feitas de cubinhos de 9, que é o que dá fio em vez de bloco.
      [-24, 0, 24].forEach((z) => [0, 20, 40].forEach((d) => B(h, 4, 14, 4, lado * 44, -72 + d, z, tom(c, 0.76))));
      [-34, -17, 0, 17, 34].forEach((z) => B(h, 19, 9, 9, lado * 42, -16 + (z % 2 ? 4 : 0), z, tom(c, z % 2 ? 1.08 : 1.18)));
    });
    [-36, -18, 0, 18, 36].forEach((x) => B(h, 16, 8, 18, x, -15, -44, tom(c, x % 2 ? 1.08 : 1.18)));
  },
  careca: (h, c) => {
    B(h, 92, 10, 92, 0, -84, 0, tom(c, 0.9));
    // Brilho no alto e a sombra do cabelo que foi raspado nas laterais.
    [-20, -8, 4].forEach((x) => [-6, 8].forEach((z) => B(h, 11, 4, 12, x, -88, z, tom(c, 1.22))));
    [-1, 1].forEach((lado) => [-26, -10, 6, 22].forEach((z) => B(h, 5, 16, 13, lado * 45, -66, z, tom(c, z % 2 ? 0.8 : 0.86))));
    B(h, 90, 10, 14, 0, -60, -44, tom(c, 0.84));
  },
  // Penteados do estúdio. Seguem a mesma caixa dos outros: topo em -80, nuca
  // em -58 e franja encostando no rosto em z 43, para caberem sob os chapéus.
  moicano: (h, c) => {
    B(h, 92, 12, 92, 0, -82, 0, tom(c, 0.45));
    // Crista em três degraus, mais alta no meio, e as pontas separadas.
    B(h, 26, 28, 92, 0, -96, 0, c);
    B(h, 22, 16, 80, 0, -116, 0, tom(c, 1.08));
    ([[-30, 14], [-10, 20], [10, 18], [30, 12]] as const).forEach(([z, alt], i) =>
      B(h, 16, alt, 16, 0, -126 - alt / 2, z, tom(c, i % 2 ? 1.18 : 1.02)));
    // Lateral raspada com cara de máquina, não de careca.
    [-1, 1].forEach((lado) => B(h, 4, 14, 76, lado * 45, -76, -4, tom(c, 0.3)));
    B(h, 90, 12, 16, 0, -66, -44, tom(c, 0.72));
  },
  coque: (h, c) => {
    B(h, 94, 22, 94, 0, -79, 0, c);
    B(h, 94, 30, 16, 0, -57, -44, c);
    B(h, 12, 20, 76, -43, -62, -6, c); B(h, 12, 20, 76, 43, -62, -6, c);
    B(h, 92, 12, 16, 0, -70, 43, c);
    B(h, 40, 36, 36, 0, -102, -34, tom(c, 1.1));
    B(h, 14, 10, 14, 0, -84, -46, tom(c, 0.86));
    // Mechas enroladas no coque, o elástico e um fio solto na frente.
    // Mecha enrolada = fila de cubinhos de 8 acompanhando a curva do coque.
    [-1, 1].forEach((lado) => [0, 1, 2, 3].forEach((i) =>
      B(h, 8, 8, 8, lado * (14 + i * 3), -114 + i * 9, -40 + (i % 2) * 4, tom(c, i % 2 ? 0.78 : 0.9))));
    [-14, 0, 14].forEach((x) => B(h, 14, 6, 34, x, -86, -34, tom(c, 0.66)));
    [0, 9, 18].forEach((d) => B(h, 6, 9, 6, -40, -68 + d, 26, tom(c, 1.12)));
    [-4, 6, 16].forEach((z) => B(h, 4, 8, 8, 14, -87, z, tom(c, 0.72)));
  },
  rabo: (h, c) => {
    B(h, 94, 22, 94, 0, -79, 0, c);
    B(h, 94, 32, 16, 0, -56, -44, c);
    B(h, 12, 24, 78, -43, -62, -4, c); B(h, 12, 24, 78, 43, -62, -4, c);
    B(h, 92, 12, 16, 0, -70, 43, c);
    // O rabo de cavalo cai por trás, com uma leve inclinação.
    B(h, 24, 12, 24, 0, -76, -52, tom(c, 0.62));
    B(h, 22, 20, 22, 0, -66, -54, tom(c, 1.08));
    B(h, 20, 54, 20, 0, -42, -58, c, 1, ' rotateX(-10deg)');
    [-24, -8, 8].forEach((y) => [-6, 6].forEach((x) => B(h, 9, 4, 21, x, y - 20, -58, tom(c, x < 0 ? 0.74 : 0.86))));
    B(h, 16, 16, 16, 0, -12, -62, tom(c, 1.14));
    // Fios puxados para trás no alto e o fiozinho solto da têmpora.
    [-20, 0, 20].forEach((x) => [-28, -10, 8, 26].forEach((z) => B(h, 4, 9, 14, x, -87, z, tom(c, z % 2 ? 0.72 : 0.8))));
    [0, 8, 16].forEach((d) => B(h, 5, 8, 5, -42, -68 + d, 24, tom(c, 1.08), 1, ' rotateZ(10deg)'));
  },
  trancas: (h, c) => {
    B(h, 96, 25, 96, 0, -80, 0, c);
    B(h, 96, 45, 18, 0, -52, -44, c);
    B(h, 94, 12, 18, 0, -70, 42, c);
    // As tranças nascem no couro: cinco carreiras marcadas no alto da cabeça.
    // Carreira trançada: cubinhos de 6 alternando tom ao longo do couro.
    [-32, -16, 0, 16, 32].forEach((x, i) => {
      // Quatro gomos por carreira: oito dobrariam o boneco de divs por uma
      // diferença que não aparece no tamanho em que ele é visto.
      B(h, 5, 8, 92, x, -89, -2, tom(c, 0.62));
      [-30, -10, 10, 30].forEach((z, j) => B(h, 9, 7, 16, x + 7, -88, z, tom(c, (i + j) % 2 ? 1.16 : 0.92)));
    });
    [-1, 1].forEach((lado) => {
      B(h, 18, 60, 20, lado * 44, -47, 22, c);
      for (let i = 0; i < 4; i++) {
        B(h, 18, 8, 21, lado * 44, -64 + i * 14, 22, tom(c, i % 2 ? 0.82 : 1.14));
      }
      B(h, 19, 5, 21, lado * 44, -15, 22, '#d7a947');
    });
  },
  ondulado: (h, c) => {
    B(h, 96, 24, 96, 0, -80, 0, c);
    B(h, 96, 62, 18, 0, -41, -44, c);
    B(h, 94, 14, 18, 0, -69, 43, c);
    [-1, 1].forEach((lado) => {
      B(h, 17, 63, 72, lado * 44, -42, -3, c);
      for (let i = 0; i < 5; i++) B(h, 11, 11, 13, lado * (45 + (i % 2) * 6), -60 + i * 13, 38, tom(c, i % 2 ? 0.88 : 1.14));
      // A onda continua atrás e nas pontas, senão só a frente ondula.
      for (let i = 0; i < 5; i++) B(h, 11, 10, 13, lado * (44 + ((i + 1) % 2) * 6), -56 + i * 13, -40, tom(c, i % 2 ? 1.14 : 0.88));
      [-28, -14, 0, 14, 28].forEach((z) => B(h, 18, 9, 10, lado * 44, -9 + (z % 2 ? 3 : 0), z, tom(c, z % 2 ? 1.1 : 1.2)));
    });
    [-4, 8, 20].forEach((z) => B(h, 5, 9, 9, -14, -89, z, tom(c, 0.7)));
  },
  coques: (h, c) => {
    B(h, 94, 22, 94, 0, -80, 0, c);
    B(h, 94, 32, 16, 0, -56, -44, c);
    B(h, 92, 12, 16, 0, -70, 43, c);
    [-1, 1].forEach((lado) => {
      B(h, 32, 29, 32, lado * 38, -99, -12, c);
      B(h, 22, 9, 24, lado * 38, -116, -12, tom(c, 1.12));
      // Base do coque, elástico e o fio solto que escapa de cada lado.
      [-7, 7].forEach((d) => B(h, 9, 8, 20, lado * 36 + d, -86, -12, tom(c, d < 0 ? 0.62 : 0.72)));
      [-11, 0, 11].forEach((d) => B(h, 11, 6, 11, lado * 38 + d, -92, -12 + d, tom(c, d ? 0.82 : 0.92)));
      [0, 7, 14].forEach((d) => B(h, 5, 7, 5, lado * 46, -70 + d, 22, tom(c, 1.1), 1, ` rotateZ(${lado * 10}deg)`));
    });
    [-6, 6, 18].forEach((z) => B(h, 5, 9, 9, 0, -89, z, tom(c, 0.7)));
  },
  // Espetado: base curta e pontas puxadas para cima, cada uma inclinada para
  // fora, senão viram uma crista só e o penteado lê como moicano.
  espetado: (h, c) => {
    B(h, 94, 18, 94, 0, -82, 0, tom(c, 0.82));
    B(h, 94, 26, 14, 0, -60, -44, c);
    B(h, 12, 22, 78, -43, -66, -4, c); B(h, 12, 22, 78, 43, -66, -4, c);
    B(h, 92, 10, 16, 0, -72, 43, c);
    // Oito pontas de alturas diferentes: todas iguais viram escova, e as mais
    // baixas no fundo dão a profundidade que uma fileira só não dá.
    ([[-31, -8, 26], [0, 10, 30], [31, -6, 24], [-16, 26, 28], [17, -26, 22], [-34, 20, 18], [34, 18, 20], [0, -30, 17]] as const)
      .forEach(([x, z, alt], i) => {
        // A ponta afina em três cubos cada vez menores, em vez de um bloco só.
        const giro = ` rotateZ(${x < 0 ? -14 : 14}deg)`;
        B(h, 13, alt - 8, 13, x, -88 - (alt - 8) / 2, z, tom(c, i % 2 ? 1.12 : 0.92), 1, giro);
        B(h, 9, 7, 9, x, -92 - alt + 8, z, tom(c, i % 2 ? 1.2 : 1.02), 1, giro);
        B(h, 6, 5, 6, x, -97 - alt + 8, z, tom(c, 1.26), 1, giro);
      });
  },
  topete: (h, c) => {
    B(h, 94, 20, 94, 0, -80, 0, c);
    B(h, 94, 26, 14, 0, -58, -44, c);
    // Lados na máquina, topo comprido: é o contraste que faz o topete.
    B(h, 10, 24, 76, -44, -62, -6, tom(c, 0.62)); B(h, 10, 24, 76, 44, -62, -6, tom(c, 0.62));
    B(h, 11, 5, 78, -43, -76, -6, tom(c, 0.8)); B(h, 11, 5, 78, 43, -76, -6, tom(c, 0.8));
    // A onda sobe em degraus cada vez menores e mais à frente. Um bloco só,
    // da largura da cabeça, lia como caixa em cima do boneco, não como cabelo.
    B(h, 84, 18, 44, 0, -94, 16, c);
    B(h, 68, 16, 36, 0, -108, 26, tom(c, 1.06), 1, ' rotateX(-14deg)');
    B(h, 50, 13, 28, 0, -120, 34, tom(c, 1.12), 1, ' rotateX(-22deg)');
    B(h, 30, 9, 20, 0, -129, 40, tom(c, 1.18), 1, ' rotateX(-30deg)');
    // Mechas: três sulcos acompanhando a subida.
    [-18, 0, 18].forEach((x) => [-8, 2, 12].forEach((d) =>
      B(h, 4, 9, 10, x, -107, 28 + d, tom(c, d > 0 ? 0.72 : 0.8), 1, ' rotateX(-16deg)')));
    [-30, -15, 0, 15, 30].forEach((x) => B(h, 14, 7, 12, x, -88, 45, tom(c, x % 2 ? 0.7 : 0.78)));
  },
  // Raspado: os lados são o mesmo cabelo num tom bem mais escuro — é o degradê
  // da máquina, não outra cor de cabelo.
  raspado: (h, c) => {
    B(h, 92, 22, 92, 0, -74, 0, tom(c, 0.5));
    B(h, 94, 16, 14, 0, -64, -44, tom(c, 0.5));
    // Degradê em dois degraus, não um corte seco: raspado, meio e topo.
    B(h, 94, 8, 94, 0, -81, 0, tom(c, 0.72));
    // O topo é mais estreito que a cabeça de propósito: é o que deixa o
    // degradê aparecer de frente, em vez de virar um bloco só.
    B(h, 84, 16, 88, 0, -90, -2, c);
    B(h, 76, 6, 14, 0, -86, 42, c);
    // O risco feito na navalha, de um lado só, como se usa.
    [-2, 8, 18].forEach((z) => B(h, 4, 13, 8, -46, -74, z, tom(c, 0.28)));
    B(h, 78, 5, 84, 0, -98, -2, tom(c, 1.14));
  },
  dreads: (h, c) => {
    B(h, 96, 22, 96, 0, -80, 0, c);
    B(h, 96, 28, 16, 0, -59, -44, c);
    B(h, 92, 12, 16, 0, -70, 43, c);
    [-36, -12, 12, 36].forEach((x) => {
      B(h, 12, 54, 12, x, -46, -50, c);
      for (let i = 0; i < 4; i++) B(h, 13, 6, 13, x, -66 + i * 15, -50, tom(c, i % 2 ? 0.82 : 1.14));
    });
    ([[-47, 16, 50], [-45, -16, 42], [47, 16, 46], [45, -16, 54]] as const).forEach(([x, z, comp]) => {
      B(h, 13, comp, 13, x, -74 + comp / 2, z, c);
      for (let i = 0; i < Math.round(comp / 10); i++) B(h, 14, 4, 14, x, -68 + i * 10, z, tom(c, i % 2 ? 0.82 : 1.14));
      B(h, 11, 6, 11, x, -72 + comp, z, tom(c, 1.2));
    });
  },
  chiquinhas: (h, c) => {
    B(h, 94, 22, 94, 0, -80, 0, c);
    B(h, 94, 32, 16, 0, -56, -44, c);
    B(h, 92, 14, 18, 0, -71, 43, c);
    // Risca no meio: é dela que as duas chiquinhas saem.
    [6, 18, 30, 42].forEach((z) => B(h, 5, 9, 10, 0, -89, z, tom(c, z % 4 ? 0.7 : 0.78)));
    [-1, 1].forEach((lado) => {
      // O cabelo puxado da têmpora até o elástico, depois o laço e o rabo.
      B(h, 16, 26, 60, lado * 42, -70, -4, c);
      B(h, 15, 11, 15, lado * 47, -60, -10, '#d7a947');
      B(h, 16, 5, 16, lado * 47, -64, -10, tom('#d7a947', 0.78));
      // O rabo desce em gomos de 7 a 10, afinando até a ponta.
      [0, 1, 2, 3, 4].forEach((i) => {
        const d = 24 - i * 3;
        B(h, d, 9, d, lado * (51 + i), -54 + i * 10, -12, tom(c, i % 2 ? 1.06 : 0.94));
      });
      B(h, 9, 7, 9, lado * 56, -8, -12, tom(c, 1.22));
    });
  },
  chanel: (h, c) => {
    B(h, 96, 24, 96, 0, -78, 0, c);
    B(h, 96, 56, 18, 0, -44, -44, c);
    B(h, 16, 56, 92, -44, -44, -2, c); B(h, 16, 56, 92, 44, -44, -2, c);
    B(h, 94, 14, 20, 0, -68, 42, tom(c, 1.1));
    B(h, 30, 10, 18, -26, -74, 42, tom(c, 1.16));
    // Pontas viradas para dentro e brilho no alto: o chanel é o corte reto na
    // ponta, e sem marcar a ponta ele vira capacete.
    [-1, 1].forEach((lado) => {
      [-32, -16, 0, 16, 32].forEach((z) => B(h, 14, 9, 9, lado * 44, -14, z, tom(c, z % 2 ? 1.12 : 1.22), 1, ` rotateZ(${lado * 10}deg)`));
      [0, 16, 32].forEach((d) => B(h, 4, 12, 5, lado * 46, -54 + d, 32, tom(c, 0.76)));
    });
    [-28, 0, 28].forEach((x) => [-20, 12].forEach((z) => B(h, 18, 5, 18, x, -88, z, tom(c, 1.14))));
    [-34, -11, 11, 34].forEach((x) => B(h, 18, 5, 20, x, -16, -44, tom(c, x % 2 ? 1.12 : 1.22)));
  },
};

const ADERECO: Record<string, (a: Pai, cor?: string) => void> = {
  prancheta: (a, c) => { B(a, 31, 40, 6, -9, 34, 14, c || '#8a6a4f'); B(a, 31, 36, 4, -9, 34, 17, '#d8cdbb'); B(a, 13, 7, 6, -9, 14, 18, '#b9bec4'); },
  tablet: (a) => { B(a, 28, 36, 6, -8, 34, 14, '#2e2e33'); B(a, 24, 30, 4, -8, 34, 17, '#5d8fd0'); },
  celular: (a) => { B(a, 17, 29, 5, 0, 44, 9, '#2b3039'); B(a, 13, 23, 3, 0, 43, 13, '#78a8bf'); B(a, 4, 2, 2, 0, 53, 15, '#d4d9dc'); },
  garrafa: (a) => { B(a, 15, 26, 15, 0, 49, 7, '#4d9eae'); B(a, 11, 7, 11, 0, 32, 7, '#4d9eae'); B(a, 12, 4, 12, 0, 27, 7, '#e6ece5'); B(a, 15, 4, 16, 0, 49, 7, '#d2e7e6'); },
  pincel: (a) => { B(a, 5, 31, 5, 0, 48, 7, '#9a663e', 1, ' rotateZ(-12deg)'); B(a, 7, 8, 7, -4, 29, 7, '#c8beb0', 1, ' rotateZ(-12deg)'); B(a, 6, 9, 6, -6, 21, 7, '#e58243', 1, ' rotateZ(-12deg)'); },
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

interface Partes { raiz: HTMLElement; corpo: HTMLElement; cabeca: HTMLElement; bracoE: HTMLElement; bracoD: HTMLElement; cotoveloE: HTMLElement; cotoveloD: HTMLElement; pernaE: HTMLElement; pernaD: HTMLElement; rabo?: HTMLElement; fone: HTMLElement; adEsq: HTMLElement; adDir: HTMLElement; aquario?: HTMLElement; olhos?: HTMLElement; sobrancelhas?: HTMLElement; cronometro: HTMLElement; livro: HTMLElement }

const montar = (cfg: VoxelConfig, cena: Pai, variantePescador: 1 | 2 | 3 = 3, varianteNutricionista: 1 | 2 | 3 = 1, variantePolicial: 1 | 2 | 3 = 1, varianteRegata: 1 | 2 | 3 = 1, varianteRaposa: 1 | 2 | 3 = 1, varianteRoqueiro: 1 | 2 | 3 = 1, varianteSenhor: 1 | 2 | 3 = 1, varianteSurfista: 1 | 2 | 3 = 1, varianteNativo: 1 | 2 | 3 = 1, varianteCaramelo: 1 | 2 | 3 = 1, varianteBiomedica: 1 | 2 | 3 = 1): Partes => {
  const alturaPerna = cfg.curto ? 20 : 28;
  const militarOriginal = cfg.nome === 'Militar' && !!cfg.mascara && !!cfg.colete && !cfg.roupaEstudio;
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
  const onca = cfg.bicho?.especie === 'onca';
  const capivara = cfg.bicho?.especie === 'capivara';
  const arara = cfg.bicho?.especie === 'arara';
  const especie = cfg.bicho?.especie;
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
    if (cfg.descalco || cfg.calcadoEstudio === 'chinelo') {
      B(L, 21, 10, 28, 0, yPe, 4, cfg.skin);
      if (capivara) [-6, 0, 6].forEach((x) => B(L, 3, 3, 3, x, yPe + 2, 19, tom(cfg.skin, 0.48)));
    }
    else B(L, 23, 12, 30, 0, yPe, 4, cfg.sapato);
    if (!cfg.descalco && !cfg.calcadoEstudio && !militarOriginal && !regataOriginal && !roqueiroOriginal && !surfistaOriginal) {
      // Sola e biqueira discretas também valorizam os personagens prontos.
      B(L, 23.5, 2.5, 30.5, 0, yPe + 5, 4, tom(cfg.sapato, 0.68));
      B(L, 17, 2, 2, 0, yPe - 1, 20, tom(cfg.sapato, 1.18));
    }
    if (militarOriginal) {
      // Joelheiras e tiras acompanham cada perna durante o movimento.
      B(L, 20, 4, 20, 0, 9, 0, tom(cfg.pernas, 0.72));
      B(L, 17, 12, 4, 0, 11, 11, tom(cfg.pernas, 1.3));
      B(L, 13, 8, 3, 0, 11, 14, tom(cfg.pernas, 1.12));
      B(L, 19, 3, 20, 0, 23, 0, tom(cfg.pernas, 0.78));
      B(L, 23, 3, 30, 0, yPe + 5, 4, tom(cfg.sapato, 0.65));
      B(L, 20, 7, 21, 0, yPe - 7, 0, cfg.sapato);
      B(L, 17, 2, 2, 0, yPe - 2, 20, tom(cfg.sapato, 1.22));
    }
    if (cfg.roupaEstudio === 'armadura') {
      const metal = cfg.torso;
      // Joelheira e caneleira presas à perna, com duas camadas metálicas.
      B(L, 25, 12, 24, 0, 8, 0, tom(metal, 0.86));
      B(L, 21, 15, 22, 0, 20, 1, metal);
      B(L, 17, 3, 3, 0, 14, 13, tom(metal, 1.2));
      B(L, 14, 2, 3, 0, 24, 13, tom(metal, 0.72));
    }
    if (cfg.parteBaixoEstudio) {
      const costura = tom(cfg.parteBaixoEstudio === 'bermuda' ? (cfg.bermuda || cfg.pernas) : cfg.pernas, 0.78);
      if (cfg.parteBaixoEstudio !== 'saia') {
        B(L, 2, cfg.parteBaixoEstudio === 'bermuda' ? 12 : 23, 2, 7, cfg.parteBaixoEstudio === 'bermuda' ? 8 : 14, 10, costura);
        B(L, 18, 2, 3, 0, cfg.parteBaixoEstudio === 'bermuda' ? 15 : 27, 10, tom(costura, 1.15));
      }
    }
    if (cfg.calcadoEstudio && cfg.calcadoEstudio !== 'descalco') {
      const sola = tom(cfg.sapato, 0.65);
      B(L, 24, 3, 31, 0, yPe + 5, 4, sola);
      const detalhe = cfg.detalheCalcadoEstudio || '#ede6d9';
      if (['tenis', 'tenisCanoAlto', 'tenisEsportivo', 'tenisCasual'].includes(cfg.calcadoEstudio)) {
        // O contorno e as peças acompanham cada pé quando ele anda.
        B(L, 24, 3, 31, 0, yPe + 5, 4, detalhe);
        B(L, 18, 4, 3, 0, yPe - 1, 20, detalhe);
        // Linha fina separa a borracha do tecido e define o contorno da sola.
        B(L, 24.5, 1, 31.5, 0, yPe + 3, 4, tom(detalhe, 0.82));
        B(L, 15, 2, 2, 0, yPe + 2, 20.5, tom(detalhe, 0.78));
        if (cfg.calcadoEstudio === 'tenisCanoAlto') {
          B(L, 21, 16, 21, 0, yPe - 10, 0, cfg.sapato);
          B(L, 21, 3, 22, 0, yPe - 17, 0, detalhe);
          [-12, -8, -4].forEach((y) => B(L, 9, 2, 3, 0, yPe + y, 12, detalhe));
          B(L, 4, 5, 4, 11, yPe - 9, 0, detalhe);
          B(L, 16, 2, 3, 0, yPe - 13, 12, tom(cfg.sapato, 0.75));
        } else if (cfg.calcadoEstudio === 'tenisEsportivo') {
          B(L, 25, 3, 28, 0, yPe + 3, 3, tom(detalhe, 0.85));
          [-1, 1].forEach((lado) => {
            B(L, 3, 5, 15, lado * 12, yPe - 1, 3, detalhe, 1, ` rotateY(${lado * 12}deg)`);
            B(L, 3, 3, 6, lado * 12, yPe + 2, 10, tom(cfg.sapato, 1.25));
          });
          [-5, -2].forEach((y) => B(L, 11, 2, 3, 0, yPe + y, 18, detalhe));
        } else if (cfg.calcadoEstudio === 'tenisCasual') {
          B(L, 20, 5, 4, 0, yPe - 1, 19, detalhe);
          B(L, 13, 7, 4, 0, yPe - 5, 17, tom(cfg.sapato, 0.85));
          B(L, 10, 2, 3, 0, yPe - 5, 20, detalhe);
        } else {
          [-5, -2].forEach((y) => B(L, 10, 2, 3, 0, yPe + y, 18, detalhe));
        }
      } else if (cfg.calcadoEstudio === 'chinelo') {
        // Pé descoberto com sola fina e a tira em V por cima dos dedos.
        // Sola em duas camadas: palmilha clara sobre a borracha, como chinelo.
        B(L, 24, 3, 31, 0, yPe + 5, 4, tom(detalhe, 0.6));
        B(L, 23, 3, 30, 0, yPe + 2, 4, detalhe);
        B(L, 15, 4, 5, -3, yPe - 4, 12, tom(detalhe, 0.75), 1, ' rotateZ(26deg)');
        B(L, 15, 4, 5, 3, yPe - 4, 12, tom(detalhe, 0.75), 1, ' rotateZ(-26deg)');
        B(L, 5, 5, 5, 0, yPe - 3, 19, tom(detalhe, 0.5));
        // Dedos: três sulcos na ponta do pé, como no descalço da capivara.
        [-6, 0, 6].forEach((x) => B(L, 3, 3, 3, x, yPe + 1, 19, tom(cfg.skin, 0.52)));
      } else if (cfg.calcadoEstudio === 'bota') {
        // Cano, lingueta e costuras acompanham a perna durante a caminhada.
        B(L, 20, 12, 21, 0, yPe - 10, 0, cfg.sapato);
        B(L, 21, 3, 22, 0, yPe - 15, 0, tom(cfg.sapato, 0.76));
        B(L, 12, 9, 3, 0, yPe - 8, 12, tom(cfg.sapato, 1.12));
        [-11, -8, -5].forEach((y) => B(L, 9, 1.5, 2, 0, yPe + y, 14, tom(cfg.sapato, 0.7)));
        B(L, 17, 2, 2, 0, yPe - 2, 20, tom(cfg.sapato, 1.25));
      } else {
        B(L, 16, 3, 3, 0, yPe - 3, 20, tom(cfg.sapato, 1.2));
        B(L, 13, 2, 3, 0, yPe - 5, 16, tom(cfg.sapato, 0.72));
        B(L, 3, 3, 11, 11, yPe - 1, 0, tom(cfg.sapato, 1.12));
      }
    }
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
    B(corpo, 50, 36, 4, 0, -20, 19, cfg.torso);
  } else B(corpo, 54, 50, 40, 0, -28, 0, cfg.torso);
  if (cfg.roupaEstudio === 'estampada') {
    const cor = cfg.corDetalheRoupa || '#f3ece0';
    B(corpo, 17, 17, 3, 0, -26, 22, cor);
    B(corpo, 23, 7, 3, 0, -26, 22, cor);
    B(corpo, 7, 23, 3, 0, -26, 22, cor);
  } else if (cfg.roupaEstudio === 'jaquetaCapuz') {
    const cor = cfg.corDetalheRoupa || '#f3ece0';
    B(corpo, 4, 38, 3, 0, -27, 26, cor);
    [-1, 1].forEach((lado) => { B(corpo, 13, 10, 4, lado * 16, -18, 23, tom(cfg.torso, 0.85)); B(corpo, 12, 2, 3, lado * 16, -23, 26, cor); });
  } else if (cfg.roupaEstudio === 'esportiva') {
    const cor = cfg.corDetalheRoupa || '#f3ece0';
    B(corpo, 52, 5, 4, 0, -40, 22, cor);
    B(corpo, 9, 10, 3, 0, -25, 23, cor);
    B(corpo, 3, 18, 3, -25, -21, 23, tom(cor, 0.85));
    B(corpo, 3, 18, 3, 25, -21, 23, tom(cor, 0.85));
  } else if (cfg.roupaEstudio === 'vestido') {
    B(corpo, 52, 4, 3, 0, -7, 22, cfg.corDetalheRoupa || tom(cfg.torso, 0.8));
  }
  if (cfg.roupaEstudio && cfg.roupaEstudio !== 'sem') {
    const tecido = cfg.torso;
    const sombra = tom(tecido, 0.76);
    const luz = tom(tecido, 1.18);
    // Acabamentos planos e de baixo relevo seguem o corpo sem cobrir a peça.
    B(corpo, 50, 3, 3, 0, -5, 21, sombra);
    if (['camiseta', 'listrada'].includes(cfg.roupaEstudio)) {
      B(corpo, 24, 5, 4, 0, -49, 21, sombra);
      B(corpo, 17, 2, 3, 0, -48, 24, luz);
      B(corpo, 12, 9, 4, -16, -30, 21, tom(tecido, 0.92));
      B(corpo, 12, 2, 3, -16, -35, 24, luz);
    } else if (cfg.roupaEstudio === 'regata') {
      B(corpo, 51, 3, 3, 0, -5, 21, sombra);
      B(corpo, 14, 3, 3, -15, -49, 22, luz);
      B(corpo, 14, 3, 3, 15, -49, 22, luz);
    } else if (cfg.roupaEstudio === 'social' || cfg.roupaEstudio === 'jaleco' || cfg.roupaEstudio === 'terno') {
      B(corpo, 13, 10, 4, -8, -47, 25, luz, 1, ' rotateZ(-18deg)');
      B(corpo, 13, 10, 4, 8, -47, 25, luz, 1, ' rotateZ(18deg)');
      if (cfg.roupaEstudio !== 'terno') {
        B(corpo, 3, 40, 3, 0, -28, 26, sombra);
        [-39, -28, -17].forEach((y) => B(corpo, 3, 3, 3, 0, y, 28, luz));
      }
      if (cfg.roupaEstudio === 'jaleco') {
        [-1, 1].forEach((lado) => { B(corpo, 13, 11, 3, lado * 17, -16, 24, tom(tecido, 0.9)); B(corpo, 13, 2, 3, lado * 17, -22, 26, luz); });
      }
    } else if (cfg.roupaEstudio === 'moletom') {
      B(corpo, 42, 3, 3, 0, -7, 26, luz);
      B(corpo, 3, 13, 3, -19, -20, 27, sombra);
      B(corpo, 3, 13, 3, 19, -20, 27, sombra);
    } else if (cfg.roupaEstudio === 'colete') {
      B(corpo, 4, 40, 3, 0, -29, 27, sombra);
      [-39, -28, -17].forEach((y) => B(corpo, 3, 3, 3, 0, y, 29, luz));
    } else if (cfg.roupaEstudio === 'toga') {
      [-17, 0, 17].forEach((x) => B(corpo, 3, 38, 3, x, -25, 24, sombra));
      B(corpo, 50, 3, 3, 0, -46, 24, luz);
    }
  }
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
  if (cfg.detalheRoupa) {
    const detalhe = cfg.corDetalheRoupa || '#f3ece0';
    if (cfg.detalheRoupa === 'polo') {
      B(corpo, 15, 9, 5, -8, -47, 22, detalhe, 1, ' rotateZ(-18deg)');
      B(corpo, 15, 9, 5, 8, -47, 22, detalhe, 1, ' rotateZ(18deg)');
      B(corpo, 4, 16, 4, 0, -38, 23, detalhe);
      B(corpo, 3, 3, 3, 0, -35, 26, tom(cfg.torso, 0.55));
    } else if (cfg.detalheRoupa === 'jaqueta') {
      B(corpo, 5, 46, 5, 0, -27, 22, detalhe);
      [-1, 1].forEach((lado) => { B(corpo, 13, 9, 5, lado * 17, -20, 22, tom(cfg.torso, 0.85)); B(corpo, 14, 3, 4, lado * 17, -26, 25, detalhe); });
      B(corpo, 52, 5, 5, 0, -3, 22, detalhe);
    } else if (cfg.detalheRoupa === 'jardineira') {
      B(corpo, 38, 29, 6, 0, -21, 22, detalhe);
      [-1, 1].forEach((lado) => { B(corpo, 8, 32, 5, lado * 15, -41, 22, detalhe); B(corpo, 5, 5, 4, lado * 15, -34, 26, '#e4bd6e'); });
      B(corpo, 18, 10, 4, 0, -17, 26, tom(detalhe, 0.82));
    } else if (cfg.detalheRoupa === 'xadrez') {
      // Xadrez é só isto: as mesmas listras duas vezes, uma deitada e outra em
      // pé. Onde se cruzam o tom escurece sozinho, porque são dois blocos.
      [-44, -30, -16, -2].forEach((y) => B(corpo, 55, 4, 43, 0, y, 0, detalhe));
      [-21, -7, 7, 21].forEach((x) => B(corpo, 4, 50, 44, x, -26, 0, tom(detalhe, 0.86)));
      // Fio fino entre as listras grossas: é o que separa um xadrez de uma
      // grade. Vai em tom claro, no meio de cada vão.
      [-37, -23, -9].forEach((y) => B(corpo, 56, 2, 44, 0, y, 0, tom(detalhe, 1.18)));
      [-14, 0, 14].forEach((x) => B(corpo, 2, 50, 45, x, -26, 0, tom(detalhe, 1.18)));
      // Colarinho aberto e carcela com dois botões: camisa, não pijama.
      B(corpo, 16, 9, 6, -9, -47, 21, tom(detalhe, 0.7), 1, ' rotateZ(-20deg)');
      B(corpo, 16, 9, 6, 9, -47, 21, tom(detalhe, 0.7), 1, ' rotateZ(20deg)');
      B(corpo, 6, 40, 5, 0, -28, 23, tom(detalhe, 0.7));
      [-36, -22].forEach((y) => B(corpo, 3, 3, 3, 0, y, 26, tom(detalhe, 1.3)));
    } else if (cfg.detalheRoupa === 'futebol') {
      // Gola esportiva e acabamento discreto nas laterais; a frente continua
      // na cor da camisa para o escudo não parecer um painel suspenso.
      B(corpo, 12, 4, 3, -6, -48, 23, detalhe, 1, ' rotateZ(-18deg)');
      B(corpo, 12, 4, 3, 6, -48, 23, detalhe, 1, ' rotateZ(18deg)');
      B(corpo, 4, 4, 3, 0, -44, 24, detalhe);
      [-1, 1].forEach((lado) => {
        B(corpo, 3, 26, 3, lado * 24, -25, 21, tom(detalhe, 0.9));
      });
      // Escudo pequeno, em duas camadas, com as cores do conjunto.
      B(corpo, 9, 10, 3, -15, -37, 23, detalhe);
      B(corpo, 5, 6, 2, -15, -37, 25, tom(cfg.torso, 0.65));
      B(corpo, 3, 2, 2, -15, -39, 27, detalhe);
    } else if (cfg.detalheRoupa === 'farda') {
      B(corpo, 5, 46, 5, 0, -27, 22, tom(cfg.torso, 0.78));
      [-1, 1].forEach((lado) => {
        // Dragona com o vinco no meio, bolso com pala e botão.
        B(corpo, 18, 7, 16, lado * 19, -47, 6, tom(detalhe, 0.95));
        B(corpo, 4, 8, 16, lado * 19, -47, 6, tom(detalhe, 0.7));
        B(corpo, 18, 16, 4, lado * 14, -20, 22, tom(cfg.torso, 0.8));
        B(corpo, 19, 4, 5, lado * 14, -28, 23, detalhe);
        B(corpo, 3, 3, 3, lado * 14, -25, 25, tom(detalhe, 0.6));
        B(corpo, 14, 2, 4, lado * 14, -14, 23, tom(cfg.torso, 0.62));
      });
      // Tarjeta do nome de um lado, distintivo do outro.
      B(corpo, 22, 6, 4, 0, -39, 23, detalhe);
      [-8, 0, 8].forEach((x) => B(corpo, 3, 2, 3, x, -39, 25, tom(detalhe, 0.45)));
      B(corpo, 10, 12, 4, -20, -38, 20, tom(detalhe, 0.8));
      B(corpo, 6, 6, 3, -20, -38, 23, tom(detalhe, 1.2));
      // Cinto com fivela.
      B(corpo, 57, 8, 44, 0, -6, 0, tom(cfg.torso, 0.62));
      B(corpo, 12, 9, 5, 0, -6, 22, '#d9b25c');
      B(corpo, 6, 5, 3, 0, -6, 25, tom('#d9b25c', 0.68));
    } else if (cfg.detalheRoupa === 'cardiga') {
      // Casaco aberto: duas bandas na frente e a barra embaixo. O meio fica
      // com a cor da camisa de baixo, que é o que faz ele parecer aberto.
      [-1, 1].forEach((lado) => {
        B(corpo, 16, 48, 7, lado * 21, -26, 20, detalhe);
        B(corpo, 4, 48, 8, lado * 13, -26, 21, tom(detalhe, 0.78));
        // Gola rolê e o bolso de baixo, um de cada lado.
        B(corpo, 18, 9, 8, lado * 20, -49, 19, tom(detalhe, 1.1));
        B(corpo, 12, 10, 4, lado * 21, -14, 24, tom(detalhe, 0.8));
        // Canelado do tricô: sulcos em pé na frente de cada banda.
        [-5, 0, 5].forEach((d) => B(corpo, 2, 44, 3, lado * 21 + d, -26, 24, tom(detalhe, 0.9)));
      });
      // Barra e punhos canelados, no mesmo tom da gola.
      B(corpo, 56, 7, 45, 0, -3, 0, tom(detalhe, 0.88));
      [-44, -32, -20].forEach((y) => B(corpo, 4, 4, 4, 10, y, 25, tom(detalhe, 1.25)));
    } else {
      B(corpo, 41, 10, 44, 0, -54, 0, detalhe);
      B(corpo, 41, 3, 45, 0, -55, 0, tom(detalhe, 0.8));
    }
  }
  // Saia: três degraus que alargam para baixo e passam do joelho, senão o
  // recorte fica na altura de uma bermuda e ninguém lê como saia.
  if (cfg.vestido) {
    if (cfg.roupaEstudio === 'vestido') {
      // A saia abre gradualmente, sem uma barra grossa sobre os pés.
      B(corpo, 54, 10, 42, 0, -6, 0, cfg.vestido);
      B(corpo, 60, 10, 46, 0, 3, 0, cfg.vestido);
      B(corpo, 66, 10, 50, 0, 12, 0, cfg.vestido);
      B(corpo, 70, 5, 53, 0, 19, 0, tom(cfg.vestido, 0.91));
      [-21, -10, 10, 21].forEach((x) => B(corpo, 2, 9, 2, x, 12, 26, tom(cfg.vestido!, 0.85)));
      B(corpo, 64, 2, 2, 0, 18, 27, tom(cfg.vestido, 1.14));
    } else {
      B(corpo, 58, 12, 44, 0, -6, 0, cfg.vestido);
      B(corpo, 70, 14, 54, 0, 4, 0, cfg.vestido);
      B(corpo, 80, 16, 62, 0, 16, 0, tom(cfg.vestido, 1.07));
      if (cfg.parteBaixoEstudio === 'saia') {
        [-22, 0, 22].forEach((x) => B(corpo, 3, 14, 3, x, 16, 32, tom(cfg.vestido!, 0.8)));
        B(corpo, 76, 2, 3, 0, 23, 32, tom(cfg.vestido, 0.82));
      }
    }
  }
  // Moletom: capuz caído atrás da cabeça, gola e bolso canguru na frente. O
  // capuz fica atrás do bloco da cabeça (que vai de z -46 a 46): mais para
  // dentro ele é desenhado, mas some inteiro dentro dela.
  if (cfg.capuz) {
    // O capuz é mais largo que a cabeça (92) de propósito: atrás dela, só
    // aparece o que passar das laterais. Mais estreito, some inteiro.
    if (cfg.roupaEstudio === 'jaquetaCapuz' || cfg.roupaEstudio === 'moletom') {
      B(corpo, 92, 25, 17, 0, -64, -51, tom(cfg.capuz, 0.84));
      B(corpo, 82, 10, 17, 0, -52, -51, tom(cfg.capuz, 0.72));
    } else {
      B(corpo, 106, 40, 26, 0, -78, -56, tom(cfg.capuz, 0.84));
      B(corpo, 98, 18, 22, 0, -54, -54, tom(cfg.capuz, 0.66));
    }
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
  if (cfg.toga) { B(corpo, 58, 16, 44, 0, -50, 0, cfg.roupaEstudio === 'toga' ? tom(cfg.torso, 0.8) : '#2a2a2a'); B(corpo, 14, 26, 7, -8, -46, 21, '#f3ece0'); B(corpo, 14, 26, 7, 8, -46, 21, '#f3ece0'); }
  if (cfg.colete) { B(corpo, 17, 50, 42, -18, -28, 0, cfg.colete); B(corpo, 17, 50, 42, 18, -28, 0, cfg.colete); B(corpo, 54, 50, 10, 0, -28, -16, cfg.colete); }
  if (cfg.nome === 'Policial' && variantePolicial === 1) {
    B(corpo, 35, 37, 6, 0, -29, 22, '#2e3542');
    B(corpo, 13, 14, 7, -12, -20, 26, '#465161'); B(corpo, 13, 14, 7, 12, -20, 26, '#465161');
    B(corpo, 14, 4, 8, -12, -26, 27, '#697685'); B(corpo, 14, 4, 8, 12, -26, 27, '#697685');
    B(corpo, 10, 12, 4, -12, -41, 26, '#cba75b'); B(corpo, 5, 6, 4, -12, -41, 29, '#f1d88d');
    B(corpo, 56, 8, 43, 0, -3, 0, '#20252a'); B(corpo, 11, 7, 5, 0, -3, 23, '#b9bec4');
  }
  if (militarOriginal) {
    const tecido = cfg.torso;
    const sombra = tom(tecido, 0.68);
    // Colete com placa central e alças sobre os ombros.
    B(corpo, 43, 37, 5, 0, -29, 22, sombra);
    B(corpo, 37, 31, 4, 0, -30, 25, tom(tecido, 1.06));
    B(corpo, 8, 23, 5, -19, -40, 25, tom(tecido, 1.17));
    B(corpo, 8, 23, 5, 19, -40, 25, tom(tecido, 1.17));
    B(corpo, 29, 15, 3, 0, -32, 28, sombra);
    B(corpo, 25, 11, 3, 0, -32, 30, tom(tecido, 1.15));
    B(corpo, 23, 2, 2, 0, -36, 32, tom(tecido, 1.35));
    B(corpo, 3, 3, 2, 0, -31, 32, sombra);
    // Três bolsos com abas e fechos, como no uniforme de referência.
    [-14, 0, 14].forEach((x) => {
      B(corpo, 13, 12, 5, x, -15, 27, sombra);
      B(corpo, 11, 10, 4, x, -15, 30, tom(tecido, 1.12));
      B(corpo, 12, 3, 3, x, -19, 32, tom(tecido, 1.3));
      B(corpo, 3, 2, 2, x, -17, 34, sombra);
    });
    B(corpo, 56, 7, 43, 0, -3, 0, '#252a23');
    B(corpo, 12, 7, 4, 0, -3, 23, '#aaa99a');
    B(corpo, 7, 4, 2, 0, -3, 26, '#30352d');
    B(corpo, 3, 2, 2, 0, -3, 27, '#c1c1b3');
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
  if (cfg.bolso) { const bolso = cfg.roupaEstudio === 'jaleco' ? tom(cfg.torso, 0.9) : '#e4e0d8'; B(corpo, 16, 13, 6, -16, -6, 21, bolso); B(corpo, 16, 13, 6, 16, -6, 21, bolso); }
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
  if (cfg.roupaEstudio && cfg.roupaEstudio !== 'sem') {
    const modelo = cfg.roupaEstudio;
    const tecido = cfg.torso;
    const sombra = tom(tecido, 0.72);
    const luz = tom(tecido, 1.2);
    const detalhe = cfg.corDetalheRoupa || cfg.faixa || cfg.gravata || cfg.colete || luz;
    const ponto = (x: number, y: number, cor = luz) => B(corpo, 2, 2, 2, x, y, 29, cor);
    // As peças recebem costuras e pequenos relevos próprios, sem mudar a silhueta do personagem.
    if (modelo === 'camiseta' || modelo === 'listrada' || modelo === 'estampada') {
      B(corpo, 26, 3, 3, 0, -49, 23, sombra);
      B(corpo, 18, 2, 2, 0, -47, 26, luz);
      [-20, -12, -4, 4, 12, 20].forEach((x) => ponto(x, -7, sombra));
      if (modelo === 'estampada') { B(corpo, 5, 5, 3, 0, -26, 25, tom(detalhe, 0.78)); B(corpo, 3, 3, 3, -4, -31, 25, detalhe); }
    } else if (modelo === 'regata') {
      B(corpo, 18, 3, 3, 0, -38, 22, sombra);
      [-21, 21].forEach((x) => B(corpo, 2, 27, 2, x, -22, 22, sombra));
      [-16, -8, 0, 8, 16].forEach((x) => ponto(x, -6, sombra));
    } else if (modelo === 'social' || modelo === 'jaleco' || modelo === 'terno') {
      [-1, 1].forEach((lado) => {
        B(corpo, 11, 2, 3, lado * 15, -42, 28, luz);
        B(corpo, 12, 3, 3, lado * 15, -17, 28, sombra);
      });
      if (modelo === 'social') {
        B(corpo, 13, 6, 3, -8, -47, 28, detalhe, 1, ' rotateZ(-18deg)');
        B(corpo, 13, 6, 3, 8, -47, 28, detalhe, 1, ' rotateZ(18deg)');
        B(corpo, 11, 9, 3, -16, -28, 27, tom(tecido, 0.88));
        B(corpo, 10, 2, 2, -16, -33, 29, luz);
      }
      if (modelo === 'jaleco') { B(corpo, 11, 7, 3, -17, -38, 27, tom(tecido, 0.85)); B(corpo, 6, 2, 2, -17, -39, 29, detalhe); }
      if (modelo === 'terno') {
        B(corpo, 9, 20, 3, -12, -40, 28, tom(tecido, 1.2), 1, ' rotateZ(-20deg)');
        B(corpo, 9, 20, 3, 12, -40, 28, tom(tecido, 1.2), 1, ' rotateZ(20deg)');
        B(corpo, 3, 3, 3, 8, -22, 29, sombra);
        B(corpo, 11, 2, 3, -18, -37, 28, detalhe);
      }
    } else if (modelo === 'moletom' || modelo === 'jaquetaCapuz') {
      [-18, 18].forEach((x) => B(corpo, 2, 11, 2, x, -18, 27, sombra));
      [-15, -9, -3, 3, 9, 15].forEach((x) => ponto(x, -8, luz));
      B(corpo, 4, 6, 3, 0, -27, 29, tom(detalhe, 0.8));
    } else if (modelo === 'colete') {
      [-1, 1].forEach((lado) => { B(corpo, 12, 2, 3, lado * 18, -27, 27, luz); ponto(lado * 18, -24, sombra); });
      B(corpo, 3, 33, 2, 0, -26, 28, sombra);
    } else if (modelo === 'toga') {
      [-18, -9, 9, 18].forEach((x) => B(corpo, 2, 24, 2, x, -21, 26, sombra));
      B(corpo, 20, 3, 3, 0, -39, 27, luz);
    } else if (modelo === 'polo') {
      ponto(0, -38, sombra); ponto(0, -31, sombra);
      B(corpo, 9, 6, 3, -17, -32, 25, tom(tecido, 0.87));
      B(corpo, 9, 2, 2, -17, -36, 27, luz);
    } else if (modelo === 'jaqueta') {
      B(corpo, 2, 34, 2, 0, -27, 27, sombra);
      [-35, -29, -23, -17].forEach((y) => ponto(2, y, luz));
      [-1, 1].forEach((lado) => { B(corpo, 12, 2, 2, lado * 17, -25, 28, luz); ponto(lado * 17, -20, sombra); });
    } else if (modelo === 'jardineira') {
      B(corpo, 21, 2, 2, 0, -22, 29, luz);
      [-1, 1].forEach((lado) => { B(corpo, 2, 14, 2, lado * 17, -17, 29, tom(detalhe, 0.72)); ponto(lado * 15, -35, '#f5d27d'); });
    } else if (modelo === 'golaAlta') {
      [-12, -6, 0, 6, 12].forEach((x) => B(corpo, 2, 8, 2, x, -54, 24, tom(detalhe, 0.8)));
      B(corpo, 48, 2, 2, 0, -7, 24, luz);
    } else if (modelo === 'xadrez') {
      B(corpo, 11, 8, 3, -17, -27, 27, tom(detalhe, 0.78));
      B(corpo, 11, 2, 2, -17, -31, 29, luz);
      ponto(0, -16, luz);
    } else if (modelo === 'esportiva') {
      B(corpo, 8, 8, 3, -17, -40, 27, detalhe);
      B(corpo, 4, 4, 2, -17, -40, 29, tom(tecido, 0.7));
      [-21, 21].forEach((x) => B(corpo, 2, 21, 2, x, -25, 27, tom(detalhe, 0.8)));
    } else if (modelo === 'farda') {
      [-1, 1].forEach((lado) => { ponto(lado * 14, -22, luz); B(corpo, 13, 2, 3, lado * 14, -12, 27, sombra); });
      B(corpo, 11, 2, 2, 0, -39, 28, sombra);
    } else if (modelo === 'cardiga') {
      [-1, 1].forEach((lado) => { B(corpo, 11, 2, 3, lado * 21, -19, 28, luz); B(corpo, 2, 8, 2, lado * 22, -13, 28, sombra); });
      [-37, -26, -15].forEach((y) => ponto(10, y, luz));
    } else if (modelo === 'vestido') {
      B(corpo, 24, 3, 3, 0, -48, 23, sombra);
      B(corpo, 5, 5, 3, 0, -6, 25, detalhe);
      B(corpo, 11, 2, 2, 0, -6, 27, tom(detalhe, 0.75));
    }
  }
  if (cfg.roupaEstudio === 'armadura') {
    const metal = cfg.torso;
    const escuro = tom(metal, 0.7);
    const claro = tom(metal, 1.23);
    // Peitoral em placas com vinco central, filetes e rebites nas bordas.
    B(corpo, 52, 42, 6, 0, -29, 22, metal);
    B(corpo, 50, 5, 7, 0, -48, 23, claro);
    B(corpo, 48, 4, 7, 0, -10, 23, escuro);
    B(corpo, 4, 34, 3, 0, -29, 27, escuro);
    B(corpo, 3, 34, 3, 4, -29, 27, claro);
    [-1, 1].forEach((lado) => {
      B(corpo, 17, 24, 3, lado * 13, -28, 27, tom(metal, 1.08));
      B(corpo, 2, 23, 3, lado * 23, -28, 28, escuro);
      [-41, -18].forEach((y) => B(corpo, 3, 3, 3, lado * 21, y, 29, claro));
    });
    // Cinturão e lâminas curtas de proteção na cintura.
    B(corpo, 57, 7, 44, 0, -5, 0, escuro);
    B(corpo, 9, 7, 4, 0, -5, 24, claro);
    [-20, -10, 0, 10, 20].forEach((x) => {
      B(corpo, 10, 12, 4, x, 4, 22, metal);
      B(corpo, 8, 2, 3, x, 9, 25, claro);
    });
  }
  if (cfg.bicho && cfg.acessorioAnimal && cfg.acessorioAnimal !== 'nenhum') {
    const cor = cfg.corAcessorioAnimal || '#d77a3d';
    B(corpo, 56, 9, 43, 0, -49, 0, cor);
    B(corpo, 53, 2, 3, 0, -44, 23, tom(cor, 0.72));
    if (cfg.acessorioAnimal === 'bandana') {
      B(corpo, 32, 10, 5, 0, -40, 23, cor);
      B(corpo, 23, 9, 5, 0, -32, 24, cor);
      B(corpo, 12, 8, 5, 0, -25, 24, tom(cor, 0.9));
      B(corpo, 5, 4, 3, 0, -34, 28, tom(cor, 1.25));
    }
    if (cfg.acessorioAnimal === 'placa') {
      B(corpo, 5, 6, 4, 0, -41, 25, '#d9b65c');
      B(corpo, 31, 13, 5, 0, -32, 26, '#d9b65c');
      const nome = document.createElement('div');
      nome.textContent = cfg.nome;
      nome.style.cssText = 'position:absolute;left:-14px;top:-36px;width:28px;height:8px;overflow:hidden;text-align:center;white-space:nowrap;font:700 5px sans-serif;color:#4a3520;transform:translateZ(30px);backface-visibility:hidden';
      corpo.appendChild(nome);
    }
  }
  let rabo: HTMLElement | undefined;
  if (cfg.bicho?.rabo.length) {
    rabo = J(corpo, raposaOriginal ? 32 : carameloOriginal || gato ? 25 : 0, -12, -19);
    const esc = raposaOriginal ? [27, 34, 36, 32] : pescador ? (variantePescador === 2 ? [36, 38, 35, 30] : [30, 32, 30, 26]) : [24, 22, 20, 18];
    if (arara) {
      // Penas compridas e afiladas: acompanham a junta que balança na animação.
      [-1, 0, 1].forEach((lado) => {
        B(rabo as Pai, 13, 58, 8, lado * 11, 14, -20, lado === 0 ? cfg.skin : '#247cac', 1, ` rotateX(-32deg) rotateZ(${lado * 9}deg)`);
        B(rabo as Pai, 9, 30, 7, lado * 14, 46, -37, lado === 0 ? '#e6b83b' : '#175882', 1, ` rotateX(-32deg) rotateZ(${lado * 9}deg)`);
      });
    } else if (especie === 'coelho' || especie === 'urso') {
      B(rabo, especie === 'coelho' ? 20 : 15, 16, 16, 0, 1, -15, cfg.bicho.rabo[0]);
    } else if (especie === 'rato') {
      cfg.bicho.rabo.forEach((_, i) => B(rabo as Pai, 7 - i, 7 - i, 18, 0, 3 - i * 4, -17 - i * 14, tom(cfg.skin, 1.2)));
    } else if (especie === 'raposa') {
      [24, 30, 34, 29].forEach((tamanho, i) => B(rabo as Pai, tamanho, tamanho, tamanho + 5, 0, 2 - i * 13, -14 - i * 17, cfg.bicho!.rabo[i]));
    } else if (especie === 'guaxinim') {
      // Rabo grosso e comprido, com os anéis bem marcados e a ponta escura.
      // Os gomos quase não afinam: é um rabo de guaxinim, não de raposa.
      // Gomos encostados um no outro: com folga entre eles o rabo virava uma
      // corrente de caixas soltas no ar atrás do boneco.
      [27, 26, 25, 23, 20].forEach((tamanho, i) =>
        B(rabo as Pai, tamanho, tamanho, tamanho + 2, 0, 4 - i * 6, -12 - i * 13, cfg.bicho!.rabo[i] || cfg.bicho!.rabo[0], 1, ' rotateX(-12deg)'));
    } else {
      cfg.bicho.rabo.forEach((cor, i) => B(rabo as Pai, esc[i], esc[i], esc[i] + 2, 0, 2 - i * 13, -14 - i * 17, cor));
    }
  }
  const manga = cfg.regata || cfg.semCamisa ? cfg.skin : cfg.torso;
  const bracoE = J(corpo, -34, -48, 0);
  const bracoD = J(corpo, 34, -48, 0);
  // O que está na mão mora numa junta própria, separada do braço, para poder
  // sumir sozinho nas poses em que a mão precisa ficar livre.
  const naMao: HTMLElement[] = [];
  const cotovelos: HTMLElement[] = [];
  ([[bracoE, cfg.esq], [bracoD, cfg.dir]] as [HTMLElement, string | undefined][]).forEach(([a, prop]) => {
    // O antebraço gira no cotovelo; a junta interna conserva as coordenadas
    // originais das roupas, mãos e acessórios.
    const cotovelo = J(a, 0, 20, 0);
    const antebraco = J(cotovelo, 0, -20, 0);
    cotovelos.push(cotovelo);
    // Um núcleo no pivô preenche a dobra em qualquer ângulo, sem uma
    // abertura entre a manga superior e o antebraço.
    B(a, 15, 22, 15, 0, 10, 0, manga);
    B(cotovelo, 14, 14, 14, 0, 0, 0, manga);
    B(antebraco, 15, 16, 15, 0, 27, 0, manga);
    if (!(cfg.regata || cfg.semCamisa)) {
      B(a, 16, 8, 16, 0, 2, 0, manga);
      B(antebraco, 16, 8, 16, 0, 33, 0, tom(manga, 1.06));
    }
    if (!cfg.regata && !cfg.semCamisa) {
      B(a, 17, 3, 17, 0, 5, 0, tom(manga, 0.85));
      B(antebraco, 16.5, 2, 16.5, 0, 35, 0, tom(manga, 0.86));
    }
    if (cfg.roupaEstudio === 'armadura') {
      const metal = cfg.torso;
      // Ombreira e braçadeira acompanham a rotação do braço.
      B(a, 25, 12, 23, 0, 2, 0, metal);
      B(a, 27, 4, 24, 0, -4, 0, tom(metal, 1.18));
      B(a, 22, 5, 22, 0, 9, 0, tom(metal, 0.76));
      B(cotovelo, 17, 14, 17, 0, 0, 0, tom(metal, 0.82));
      B(antebraco, 20, 16, 20, 0, 24, 0, metal);
      B(antebraco, 21, 3, 21, 0, 30, 0, tom(metal, 0.72));
      B(antebraco, 11, 2, 3, 0, 20, 11, tom(metal, 1.2));
    }
    if (cfg.roupaEstudio === 'futebol' || cfg.roupaEstudio === 'esportiva') {
      B(a, 17, 4, 17, 0, 9, 0, cfg.corDetalheRoupa || tom(manga, 1.25));
      B(a, 17, 2, 17, 0, 15, 0, tom(cfg.corDetalheRoupa || manga, 0.85));
    } else if (cfg.roupaEstudio === 'jaqueta' || cfg.roupaEstudio === 'jaquetaCapuz') {
      B(antebraco, 3, 17, 2, 5, 19, 9, tom(manga, 0.75));
      B(antebraco, 7, 3, 2, 0, 33, 10, tom(manga, 0.7));
    }
    const corMao = cfg.bicho ? tom(cfg.skin, 0.72) : cfg.skin;
    // A palma compacta mantém a silhueta; pequenos vincos sugerem os dedos.
    B(antebraco, 17, 15, 17, 0, 44, 0, corMao);
    if (cfg.bicho && cfg.roupaEstudio && !arara) {
      // Uma almofada discreta diferencia a pata sem alterar o tamanho da mão.
      B(antebraco, 9, 4, 2, 0, 43, 9, tom(corMao, 1.14));
    }
    const vincos = cfg.bicho ? [-3, 3] : [-4, 0, 4];
    vincos.forEach((x) => B(antebraco, 1, 4, 1, x, 49, 9, tom(corMao, 0.78)));
    const g = J(antebraco, 0, 0, 0);
    g.style.transition = 'opacity 220ms ease';
    (ADERECO[prop || 'nada'] || ADERECO.nada)(g, cfg.lapela);
    naMao.push(g);
  });
  const [adEsq, adDir] = naMao;
  const [cotoveloE, cotoveloD] = cotovelos;
  if (arara) [bracoE, bracoD].forEach((braco, i) => {
    const lado = i === 0 ? -1 : 1;
    // As camadas ficam atrás da mão, deixando roupas e adereços utilizáveis.
    B(braco, 25, 37, 8, lado * 5, 13, -10, cfg.skin, 1, ` rotateZ(${lado * 7}deg)`);
    B(braco, 27, 11, 7, lado * 6, 27, -13, '#e6ba3a', 1, ` rotateZ(${lado * 7}deg)`);
    B(braco, 24, 22, 8, lado * 7, 36, -15, '#247cac', 1, ` rotateZ(${lado * 9}deg)`);
    [-1, 0, 1].forEach((pena) => B(braco, 7, 20, 7, lado * 7 + pena * 7, 47, -15, '#175882', 1, ` rotateZ(${lado * 9}deg)`));
  });
  if (militarOriginal) {
    [bracoE, bracoD].forEach((braco, i) => {
      // Ombreira, emblema e punho presos ao braço, sem atingir a mão.
      B(braco, 19, 13, 20, 0, 12, 0, tom(cfg.torso, 1.15));
      B(braco, 13, 9, 3, 0, 13, 11, tom(cfg.torso, 0.7));
      B(braco, 9, 6, 2, 0, 13, 13, tom(cfg.torso, 1.05));
      B(cotovelos[i].firstElementChild as HTMLElement, 17, 4, 18, 0, 32, 0, tom(cfg.torso, 0.75));
    });
  }
  const antebracoD = cotoveloD.firstElementChild as HTMLElement;
  if (cfg.relogio) B(antebracoD, 19, 8, 19, 0, 30, 0, cfg.relogio);
  if (carameloOriginal) {
    B(antebracoD, 11, 10, 4, 0, 30, 10, '#d4a83b');
    B(antebracoD, 7, 6, 3, 0, 30, 13, '#f4efe4');
    B(antebracoD, 2, 4, 2, 0, 29, 15, '#4b4a46');
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
  let sobrancelhas: HTMLElement | undefined;
  if (capivara) {
    // A cabeça é baixa e comprida, com as laterais levemente arredondadas em degraus.
    B(cabeca, 86, 68, 108, 0, -47, -8, cfg.skin);
    B(cabeca, 102, 47, 96, 0, -44, -8, cfg.skin);
    B(cabeca, 76, 8, 86, 0, -84, -12, tom(cfg.skin, 1.04));
    // Pelagem discreta nas laterais, mantendo a cabeça maciça da capivara.
    [-1, 1].forEach((lado) => {
      B(cabeca, 3, 3, 18, lado * 52, -54, 7, tom(cfg.skin, 0.86));
      B(cabeca, 3, 3, 13, lado * 52, -40, -8, tom(cfg.skin, 1.1));
      B(cabeca, 3, 3, 14, lado * 52, -27, 10, tom(cfg.skin, 0.87));
    });
  } else if (biomedicaOriginal) {
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
    if (arara) {
      // Áreas claras de pele ao redor dos olhos, com as linhas finas da arara.
      [-1, 1].forEach((lado) => {
        B(cabeca, 34, 36, 4, lado * 25, -43, 47, '#f7ecda');
        B(cabeca, 19, 2, 3, lado * 29, -61, 50, '#b5433a');
        B(cabeca, 15, 2, 3, lado * 31, -56, 50, '#b5433a');
        B(cabeca, 12, 2, 3, lado * 32, -29, 50, '#b5433a');
      });
      B(cabeca, 53, 8, 8, 0, -84, 7, tom(cfg.skin, 1.12));
    } else if (capivara) {
      // Orelhas pequenas e baixas, distintas das orelhas de urso.
      [-1, 1].forEach((lado) => {
        B(cabeca, 20, 14, 18, lado * 34, -90, 6, cfg.bicho!.orelha);
        B(cabeca, 14, 6, 16, lado * 34, -99, 6, cfg.bicho!.orelha);
        B(cabeca, 10, 6, 4, lado * 34, -91, 17, tom(cfg.skin, 0.64));
        B(cabeca, 6, 3, 3, lado * 34, -94, 20, tom(cfg.skin, 0.79));
      });
    } else if (formato) {
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
          // No guaxinim a orelha é debruada de branco na borda de cima.
          if (especie === 'guaxinim') B(cabeca, 26, 5, 14, x, -111, -2, tom(cfg.skin, 1.34));
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
    if (especie === 'rato') {
      // Orelhas maiores, arredondadas em degraus, visíveis acima da cabeça.
      [-1, 1].forEach((lado) => {
        B(cabeca, 36, 25, 13, lado * 37, -105, -2, cfg.bicho!.orelha);
        B(cabeca, 23, 14, 8, lado * 37, -118, -2, cfg.bicho!.orelha);
        B(cabeca, 22, 18, 5, lado * 37, -105, 7, tom(cfg.skin, 1.38));
      });
    }
    if (especie === 'raposa') {
      [-1, 1].forEach((lado) => {
        B(cabeca, 24, 18, 5, lado * 33, -23, 47, cfg.bicho!.focinho);
        B(cabeca, 15, 12, 4, lado * 39, -34, 47, cfg.bicho!.focinho);
      });
    }
    if (onca) {
      // Rosetas com centro dourado e manchas menores na testa e nas laterais.
      [[-34, -71], [-13, -76], [13, -76], [34, -71], [-39, -30], [39, -30], [-31, -19], [31, -19]].forEach(([x, y]) => {
        B(cabeca, 11, 10, 3, x, y, 47, '#56341f');
        B(cabeca, 5, 4, 3, x, y, 49, tom(cfg.skin, 0.82));
      });
      [-1, 1].forEach((lado) => {
        B(cabeca, 5, 7, 4, lado * 25, -63, 48, '#56341f');
        B(cabeca, 4, 6, 4, lado * 6, -67, 48, '#56341f');
        B(cabeca, 15, 12, 5, lado * 31, -22, 47, '#f4e4bf');
        B(cabeca, 4, 12, 13, lado * 48, -56, 3, '#56341f');
        B(cabeca, 4, 9, 10, lado * 48, -34, -16, '#56341f');
        B(cabeca, 4, 5, 5, lado * 50, -56, 3, tom(cfg.skin, 0.82));
        B(cabeca, 4, 10, 12, lado * 48, -18, -2, '#56341f');
        B(cabeca, 3, 4, 5, lado * 50, -18, -2, tom(cfg.skin, 0.82));
      });
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
    if (cfg.bicho.mascara && especie === 'guaxinim') {
      // A máscara do guaxinim não é uma faixa de ponta a ponta: são duas
      // manchas, uma em volta de cada olho, separadas por uma listra clara que
      // desce da testa até o focinho. Sem essa listra ele vira um bandido de
      // antifaz; com ela, guaxinim.
      const escuro = cfg.bicho.mascara;
      const claro = tom(cfg.skin, 1.3);
      [-1, 1].forEach((lado) => {
        B(cabeca, 34, 30, 10, lado * 24, -48, 44, escuro);
        B(cabeca, 16, 14, 9, lado * 38, -62, 45, escuro, 1, ` rotateZ(${lado * 18}deg)`);
        B(cabeca, 30, 7, 8, lado * 24, -66, 46, claro);
        B(cabeca, 20, 6, 8, lado * 28, -31, 46, escuro);
      });
      B(cabeca, 13, 46, 9, 0, -46, 45, claro);
      // Touca escura entre as orelhas, que é por onde o cinza do guaxinim
      // escurece antes de virar máscara.
      B(cabeca, 92, 12, 90, 0, -84, 0, tom(cfg.skin, 0.7));
    } else if (cfg.bicho.mascara) {
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
  if (cfg.boneTras) {
    const cor = cfg.boneTras;
    B(cabeca, 96, 24, 94, 0, -99, 0, cor);
    B(cabeca, 90, 5, 90, 0, -113, 0, tom(cor, 1.1));
    B(cabeca, 84, 6, 34, 0, -87, -60, tom(cor, 0.85));
    B(cabeca, 28, 7, 3, 0, -98, 49, tom(cor, 0.75));
    B(cabeca, 15, 3, 3, 0, -98, 51, tom(cor, 1.2));
  }
  if (cfg.faixaCabeca) {
    B(cabeca, 98, 10, 98, 0, -80, 0, cfg.faixaCabeca);
    B(cabeca, 94, 2, 3, 0, -74, 51, tom(cfg.faixaCabeca, 0.78));
  }
  if (cfg.lacoCabeca) {
    const cor = cfg.lacoCabeca;
    B(cabeca, 32, 9, 8, 27, -91, 28, cor);
    B(cabeca, 14, 16, 8, 15, -93, 28, cor, 1, ' rotateZ(-12deg)');
    B(cabeca, 14, 16, 8, 39, -93, 28, cor, 1, ' rotateZ(12deg)');
    B(cabeca, 8, 10, 10, 27, -92, 32, tom(cor, 0.76));
  }
  if (cfg.elmoMedieval) {
    const metal = cfg.elmoMedieval;
    const claro = tom(metal, 1.22);
    const escuro = tom(metal, 0.65);
    // Copa e viseira sobre a parte superior do rosto, com aberturas visíveis.
    B(cabeca, 99, 27, 98, 0, -86, 0, metal);
    B(cabeca, 90, 7, 90, 0, -102, 0, claro);
    B(cabeca, 100, 34, 9, 0, -52, 50, metal);
    B(cabeca, 101, 4, 10, 0, -69, 50, claro);
    B(cabeca, 101, 4, 10, 0, -35, 50, escuro);
    [-33, -11, 11, 33].forEach((x) => B(cabeca, 8, 20, 3, x, -52, 56, '#34383b'));
    B(cabeca, 4, 12, 100, -49, -55, 0, tom(metal, 0.83));
    B(cabeca, 4, 12, 100, 49, -55, 0, tom(metal, 0.83));
    // Penacho em blocos, usando a cor do detalhe quando o conjunto foi escolhido.
    const penacho = cfg.corDetalheRoupa || '#963c3c';
    B(cabeca, 20, 24, 38, 0, -116, -4, penacho);
    B(cabeca, 15, 8, 34, 0, -130, -4, tom(penacho, 1.12));
    B(cabeca, 7, 17, 25, 0, -109, -29, tom(penacho, 0.75));
  }
  if (cfg.fivePanel) {
    const tecido = cfg.fivePanel;
    const costura = tom(tecido, 0.7);
    // Copa baixa com painel frontal inteiro e faixas nas laterais e no topo.
    B(cabeca, 96, 24, 94, 0, -99, 0, tecido);
    B(cabeca, 92, 5, 90, 0, -113, 0, tom(tecido, 1.08));
    B(cabeca, 96, 4, 95, 0, -87, 0, tom(tecido, 0.84));
    B(cabeca, 70, 18, 3, 0, -99, 48, tom(tecido, 1.08));
    [-1, 1].forEach((lado) => {
      B(cabeca, 2, 18, 3, lado * 35, -99, 50, costura);
      B(cabeca, 2, 3, 76, lado * 24, -116, -3, costura);
      B(cabeca, 3, 3, 4, lado * 49, -101, 9, tom(tecido, 0.62));
    });
    // Aba plana projetada à frente, com uma costura na borda.
    B(cabeca, 86, 6, 34, 0, -86, 60, tecido);
    B(cabeca, 82, 2, 3, 0, -89, 75, costura);
    B(cabeca, 18, 8, 3, 0, -100, 51, tom(tecido, 0.82));
  }
  if (cfg.balde) {
    if (carameloOriginal) {
      B(cabeca, 80, 22, 82, 0, -98, 0, cfg.balde);
      B(cabeca, 94, 6, 94, 0, -87, 0, tom(cfg.balde, 0.92));
      B(cabeca, 80, 4, 83, 0, -91, 0, '#9bb4cf');
    } else { B(cabeca, 96, 26, 96, 0, -80, 0, cfg.balde); B(cabeca, 116, 10, 116, 0, -66, 0, tom(cfg.balde, 0.92)); }
  }
  if (cfg.touca) {
    B(cabeca, 96, 25, 96, 0, -89, 0, cfg.touca);
    B(cabeca, 100, 9, 100, 0, -77, 0, tom(cfg.touca, 0.82));
    B(cabeca, 78, 9, 78, 0, -106, 0, cfg.touca);
    B(cabeca, 19, 15, 19, 0, -119, 0, tom(cfg.touca, 1.12));
  }
  if (cfg.boina) {
    B(cabeca, 105, 12, 96, 4, -87, 0, cfg.boina);
    B(cabeca, 89, 12, 80, 7, -97, 0, cfg.boina);
    B(cabeca, 9, 6, 9, 10, -106, 0, tom(cfg.boina, 0.8));
  }
  if (cfg.viseira) {
    // Viseira: aro e aba, sem copa — o cabelo passa por cima e aparece.
    B(cabeca, 96, 11, 96, 0, -87, 0, cfg.viseira);
    B(cabeca, 92, 5, 93, 0, -80, 0, tom(cfg.viseira, 0.68));
    B(cabeca, 90, 6, 34, 0, -85, 60, tom(cfg.viseira, 0.8));
    // Aba com a borda mais escura e um friso claro no meio da testeira.
    B(cabeca, 84, 2, 3, 0, -87, 76, tom(cfg.viseira, 0.55));
    B(cabeca, 20, 5, 3, 0, -87, 50, tom(cfg.viseira, 1.2));
    // Regulador atrás, com a tira que sobra.
    B(cabeca, 26, 9, 4, 0, -87, -50, tom(cfg.viseira, 0.62));
    B(cabeca, 10, 6, 4, 12, -87, -52, tom(cfg.viseira, 0.9));
  }
  if (cfg.palha) {
    B(cabeca, 86, 24, 86, 0, -92, 0, cfg.palha);
    B(cabeca, 82, 6, 82, 0, -104, 0, tom(cfg.palha, 1.14));
    B(cabeca, 128, 8, 128, 0, -76, 0, tom(cfg.palha, 1.1));
    // Trançado: faixas alternadas na aba e na copa, claro e escuro, que é o
    // que distingue palha de um chapéu de feltro liso.
    [-1, 1].forEach((lado) => {
      B(cabeca, 130, 3, 26, 0, -74, lado * 40, tom(cfg.palha, 0.86));
      B(cabeca, 26, 3, 130, lado * 40, -74, 0, tom(cfg.palha, 0.86));
    });
    B(cabeca, 132, 3, 132, 0, -71, 0, tom(cfg.palha, 0.72));
    // Fita em volta da copa, com o nó de lado.
    B(cabeca, 88, 7, 88, 0, -81, 0, tom(cfg.palha, 0.46));
    B(cabeca, 14, 9, 12, -45, -81, 18, tom(cfg.palha, 0.34));
  }
  if (cfg.bandana) {
    B(cabeca, 98, 17, 98, 0, -84, 0, cfg.bandana);
    B(cabeca, 95, 5, 96, 0, -75, 0, tom(cfg.bandana, 0.8));
    B(cabeca, 93, 4, 94, 0, -92, 0, tom(cfg.bandana, 1.12));
    // Estampa: pontinhos claros espalhados pela frente e pelos lados.
    ([[-28, 48], [0, 49], [28, 48], [-49, 24], [49, 24], [-49, -16], [49, -16]] as const)
      .forEach(([x, z], i) => B(cabeca, 5, 5, 5, x, i % 2 ? -86 : -81, z, tom(cfg.bandana!, 1.35)));
    // Nó atrás, com as duas pontas caindo.
    B(cabeca, 16, 14, 14, -34, -78, -48, tom(cfg.bandana, 0.9));
    B(cabeca, 13, 24, 12, -40, -70, -44, tom(cfg.bandana, 0.92), 1, ' rotateZ(13deg)');
    B(cabeca, 10, 18, 10, -47, -54, -48, tom(cfg.bandana, 1.1), 1, ' rotateZ(22deg)');
    B(cabeca, 9, 16, 9, -26, -62, -50, tom(cfg.bandana, 0.78), 1, ' rotateZ(-10deg)');
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
    sobrancelhas = J(cabeca, 0, 0, 0);
    B(sobrancelhas, 20, 3, 5, -20, -56, 50, '#39362f'); B(sobrancelhas, 20, 3, 5, 20, -56, 50, '#39362f');
    olhos = J(cabeca, 0, 0, 0);
    olhos.style.display = 'none';
    [-20, 20].forEach((x) => {
      B(olhos!, 20, 14, 4, x, -46, 60, cfg.skin);
      B(olhos!, 16, 2, 3, x, -44, 63, tom(cfg.skin, 0.55));
    });
    // Sobreposições finas sugerem tecido e costuras, sem projetar um segundo
    // bloco sobre a face.
    B(cabeca, 64, 3, 3, 0, -28, 48, tom(cfg.mascara, 1.28));
    B(cabeca, 2, 18, 3, 0, -14, 48, tom(cfg.mascara, 1.3));
    B(cabeca, 54, 2, 3, 0, -4, 48, tom(cfg.mascara, 0.75));
  } else {
    const sobr = cfg.sobr || tom(cfg.cabelo, 0.9);
    sobrancelhas = J(cabeca, 0, 0, 0);
    if (!pescador && !raposaOriginal && !nativoOriginal && !biomedicaOriginal && !arara && !capivara && !onca) {
      const formato = cfg.sobrancelhaEstudio || 'natural';
      [-1, 1].forEach((lado) => {
        const altura = formato === 'fina' ? 3 : formato === 'marcada' ? 9 : 6;
        B(sobrancelhas!, 23, altura, 5, lado * 20, -58, 48, sobr, 1, formato === 'arqueada' ? ` rotateZ(${lado * 9}deg)` : '');
      });
    }
    if (biomedicaOriginal) { B(sobrancelhas, 21, 5, 6, -20, -58, 47, '#b99360'); B(sobrancelhas, 21, 5, 6, 20, -58, 47, '#b99360'); }
    if (nativoOriginal) { B(sobrancelhas, 21, 5, 6, -20, -58, 47, sobr); B(sobrancelhas, 21, 5, 6, 20, -58, 47, sobr); }
    if (raposaOriginal) { B(sobrancelhas, 22, 5, 6, -20, -59, 48, '#b65e24'); B(sobrancelhas, 22, 5, 6, 20, -59, 48, '#b65e24'); }
    const base = cfg.bicho ? cfg.bicho.focinho : cfg.skin;
    if (capivara) {
      // Olhos pequenos, escuros e posicionados no alto da cabeça; sem o branco humano.
      [-1, 1].forEach((lado) => {
        B(cabeca, 12, 10, 5, lado * 32, -65, 48, tom(cfg.skin, 0.68));
        B(cabeca, 7, 7, 4, lado * 32, -65, 52, cfg.iris || '#241b16');
        B(cabeca, 2, 2, 2, lado * 32 - 1, -67, 55, '#f7ead7');
      });
    } else {
      B(cabeca, 19, 17, 5, -20, -45, 47, '#fdfbf7'); B(cabeca, 19, 17, 5, 20, -45, 47, '#fdfbf7');
      if (!pescador && !raposaOriginal && !nativoOriginal && !biomedicaOriginal && !arara && !onca) { B(cabeca, 19, 7, 6, -20, -51, 48, base); B(cabeca, 19, 7, 6, 20, -51, 48, base); }
      B(cabeca, 10, 10, 4, -20, pescador ? -44 : -42, 50, cfg.iris || '#2a1f1a'); B(cabeca, 10, 10, 4, 20, pescador ? -44 : -42, 50, cfg.iris || '#2a1f1a');
    }
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
    if (capivara) {
      [-1, 1].forEach((lado) => {
        B(olhos, 14, 12, 5, lado * 32, -65, 54, palpebra);
        B(olhos, 9, 2, 3, lado * 32, -64, 58, tom(palpebra, 0.55));
      });
    } else {
      B(olhos, 21, 19, 4, -20, -45, 57, palpebra); B(olhos, 21, 19, 4, 20, -45, 57, palpebra);
      B(olhos, 19, 3, 3, -20, -43, 60, tom(palpebra, 0.55)); B(olhos, 19, 3, 3, 20, -43, 60, tom(palpebra, 0.55));
    }
    if (arara) {
      // Bico curvo em degraus: maxila clara com ponta escura voltada para baixo.
      B(cabeca, 31, 23, 22, 0, -25, 51, '#e7d2ae');
      B(cabeca, 27, 18, 24, 0, -17, 56, '#cfb68d');
      B(cabeca, 21, 13, 20, 0, -8, 62, '#343636');
      B(cabeca, 13, 11, 15, 0, 0, 65, '#202629');
      B(cabeca, 4, 4, 3, -9, -29, 64, '#57483d');
      B(cabeca, 4, 4, 3, 9, -29, 64, '#57483d');
      B(cabeca, 13, 3, 3, 0, -28, 65, '#f3e6c9');
      // Pequenos degraus de cor dão volume ao bico e às penas da testa.
      B(cabeca, 15, 3, 3, 0, -15, 70, '#a28b72');
      [-1, 1].forEach((lado) => B(cabeca, 12, 3, 3, lado * 19, -76, 48, tom(cfg.skin, 1.15)));
    } else if (capivara && cfg.bicho) {
      // Focinho pesado, arredondado em degraus e projetado à frente dos olhos.
      B(cabeca, 76, 37, 31, 0, -25, 53, cfg.skin);
      B(cabeca, 68, 33, 18, 0, -24, 69, tom(cfg.skin, 0.94));
      B(cabeca, 58, 27, 8, 0, -24, 80, tom(cfg.skin, 0.87));
      B(cabeca, 48, 8, 7, 0, -9, 77, tom(cfg.skin, 0.76));
      // Nariz em camadas curtas; dois pontos indicam as narinas.
      B(cabeca, 30, 8, 4, 0, -31, 85, tom(cfg.skin, 0.38));
      B(cabeca, 22, 3, 3, 0, -35, 87, tom(cfg.skin, 0.48));
      B(cabeca, 4, 3, 2, -9, -31, 88, tom(cfg.skin, 0.25));
      B(cabeca, 4, 3, 2, 9, -31, 88, tom(cfg.skin, 0.25));
      B(cabeca, 24, 2, 2, 0, -13, 85, tom(cfg.skin, 0.48));
      [-1, 1].forEach((lado) => {
        B(cabeca, 3, 3, 2, lado * 22, -22, 85, tom(cfg.skin, 0.58));
        B(cabeca, 3, 3, 2, lado * 19, -17, 85, tom(cfg.skin, 0.58));
        B(cabeca, 8, 2, 2, lado * 24, -26, 84, tom(cfg.skin, 1.02));
      });
    } else if (onca && cfg.bicho) {
      // Focinho felino, nariz triangular em degraus e bigodes nos dois lados.
      B(cabeca, 27, 19, 19, -12, -17, 51, '#f2dfb9');
      B(cabeca, 27, 19, 19, 12, -17, 51, '#f2dfb9');
      B(cabeca, 16, 8, 7, 0, -27, 63, '#39251d');
      B(cabeca, 9, 5, 7, 0, -22, 64, '#39251d');
      B(cabeca, 3, 8, 3, 0, -16, 64, '#5a3b29');
      [-1, 1].forEach((lado) => {
        B(cabeca, 13, 2, 3, lado * 24, -18, 63, '#634b35');
        B(cabeca, 11, 2, 3, lado * 25, -13, 63, '#634b35');
        B(cabeca, 3, 3, 3, lado * 12, -19, 63, '#634b35');
      });
    } else if (especie === 'gato' || especie === 'coelho' || especie === 'rato') {
      // Bochechas separadas e bigodes realçam os focinhos pequenos.
      const bochecha = cfg.bicho!.focinho;
      B(cabeca, 22, 15, 13, -10, -18, 50, bochecha);
      B(cabeca, 22, 15, 13, 10, -18, 50, bochecha);
      B(cabeca, 10, 7, 6, 0, -26, 58, especie === 'gato' ? '#a96559' : cfg.bicho!.nariz);
      B(cabeca, 3, 6, 3, 0, -19, 60, tom(cfg.skin, 0.45));
      [-1, 1].forEach((lado) => {
        B(cabeca, 16, 2, 3, lado * 24, -20, 59, tom(cfg.skin, 1.38));
        B(cabeca, 13, 2, 3, lado * 24, -15, 59, tom(cfg.skin, 1.38));
      });
      if (especie === 'coelho') {
        B(cabeca, 7, 8, 4, -4, -9, 60, '#f9f2df');
        B(cabeca, 7, 8, 4, 4, -9, 60, '#f9f2df');
      }
    } else if (especie === 'cachorro' || especie === 'urso' || especie === 'raposa' || especie === 'guaxinim') {
      const focinho = cfg.bicho!.focinho;
      const largura = especie === 'urso' ? 44 : especie === 'cachorro' ? 42 : 34;
      const profundidade = especie === 'raposa' ? 25 : 19;
      B(cabeca, largura, 23, profundidade, 0, -20, 50, focinho);
      B(cabeca, especie === 'urso' ? 18 : 14, 9, 7, 0, -27, 51 + profundidade / 2, cfg.bicho!.nariz);
      B(cabeca, 3, 8, 3, 0, -19, 53 + profundidade / 2, tom(cfg.skin, 0.45));
      B(cabeca, 13, 3, 3, 0, -13, 53 + profundidade / 2, tom(cfg.skin, 0.48));
      if (cfg.roupaEstudio) {
        [-1, 1].forEach((lado) => {
          B(cabeca, 3, 3, 2, lado * 10, -21, 53 + profundidade / 2, tom(focinho, 0.72));
          B(cabeca, 3, 3, 2, lado * 14, -17, 53 + profundidade / 2, tom(focinho, 0.72));
        });
      }
    } else if (cfg.bicho) {
      B(cabeca, pescador || carameloOriginal || capivara ? 44 : raposaOriginal ? 42 : 36, 26, raposaOriginal || carameloOriginal ? 21 : 17, 0, -19, 48, cfg.bicho.focinho); B(cabeca, carameloOriginal ? 17 : 14, 11, 9, 0, -27, raposaOriginal || carameloOriginal ? 59 : 57, cfg.bicho.nariz);
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
  if (cfg.sardas) [-1, 1].forEach((lado) => {
    [[24, -31], [30, -29], [26, -26]].forEach(([x, y]) => B(cabeca, 3, 3, 3, lado * x, y, 48, tom(cfg.skin, 0.62)));
  });
  if (cfg.covinhas) [-1, 1].forEach((lado) => B(cabeca, 4, 4, 3, lado * 17, -13, 51, tom(cfg.skin, 0.68)));
  if (cfg.aparelho) {
    B(cabeca, 20, 8, 3, 0, -14, 54, '#f4eee4');
    B(cabeca, 20, 2, 3, 0, -14, 56, '#82959f');
    [-6, 0, 6].forEach((x) => B(cabeca, 3, 4, 3, x, -14, 57, '#bbc7cb'));
  }
  if (cfg.oculos) {
    const suporteOculos = capivara ? J(cabeca, 0, -20, 5) : cabeca;
    if (capivara) suporteOculos.style.transform += ' scaleX(1.6)';
    if (roqueiroOriginal) {
      B(suporteOculos, 27, 19, 5, -20, -45, 50, '#17181d'); B(suporteOculos, 27, 19, 5, 20, -45, 50, '#17181d');
      B(suporteOculos, 21, 13, 3, -20, -45, 53, '#34404d'); B(suporteOculos, 21, 13, 3, 20, -45, 53, '#34404d');
      B(suporteOculos, 10, 3, 2, -23, -49, 55, '#788995', 1, ' rotateZ(-18deg)');
      B(suporteOculos, 10, 3, 2, 17, -49, 55, '#788995', 1, ' rotateZ(-18deg)');
      B(suporteOculos, 12, 4, 4, 0, -46, 52, '#17181d');
    } else if (cfg.oculosEstudio === 'redondo' || cfg.oculosEstudio === 'gatinho' || cfg.oculosEstudio === 'aviador') {
      const modelo = cfg.oculosEstudio;
      [-1, 1].forEach((lado) => {
        const x = lado * 20;
        // Molduras em segmentos deixam o olhar visível e criam uma borda em relevo.
        if (modelo === 'aviador') B(suporteOculos, 19, 13, 2, x, -45, 52, cfg.lente || '#526779');
        B(suporteOculos, modelo === 'gatinho' ? 23 : 17, 3, 3, x, -55, 54, cfg.oculos!);
        B(suporteOculos, modelo === 'aviador' ? 13 : 17, 3, 3, x, -35, 54, cfg.oculos!);
        B(suporteOculos, 3, 14, 3, x - 11, -45, 54, cfg.oculos!);
        B(suporteOculos, 3, 14, 3, x + 11, -45, 54, cfg.oculos!);
        if (modelo === 'gatinho') B(suporteOculos, 7, 6, 3, x + lado * 10, -57, 54, cfg.oculos!, 1, ` rotateZ(${lado * -18}deg)`);
        if (modelo === 'aviador') B(suporteOculos, 7, 2, 2, x - 4, -50, 56, '#aabdc5', 1, ' rotateZ(-18deg)');
      });
      B(suporteOculos, 14, 3, 3, 0, -48, 54, cfg.oculos);
      if (modelo === 'aviador') B(suporteOculos, 18, 2, 3, 0, -55, 54, cfg.oculos);
    } else {
      B(suporteOculos, 24, 20, 4, -20, -45, 50, cfg.oculos); B(suporteOculos, 24, 20, 4, 20, -45, 50, cfg.oculos);
      B(suporteOculos, 19, 15, 3, -20, -45, 52, cfg.lente || '#cfe9f5'); B(suporteOculos, 19, 15, 3, 20, -45, 52, cfg.lente || '#cfe9f5');
      B(suporteOculos, 12, 4, 3, 0, -45, 51, cfg.oculos);
    }
    B(suporteOculos, 10, 4, 24, -42, -45, 38, cfg.oculos); B(suporteOculos, 10, 4, 24, 42, -45, 38, cfg.oculos);
  }
  // O fone entra montado desde o começo e fica escondido: aparecer é só trocar o
  // display, sem remontar o boneco no meio da caminhada de volta.
  const fone = J(cabeca, 0, 0, 0);
  fone.style.display = 'none';
  // Grafite claro, e não preto: metade dos personagens tem cabelo escuro e o fone
  // sumia dentro dele. A concha ainda ganha um disco laranja virado para fora.
  const FONE = '#55504a';
  // Cabelo afro e capacete ocupam o alto da cabeça; o arco sobe para passar por cima.
  const yArco = cfg.elmoMedieval ? -136 : cfg.fivePanel ? -120 : cfg.estilo === 'afro' ? -116 : cfg.capacete || cfg.balde || cfg.touca || cfg.boina || cfg.palha ? -106 : -98;
  B(fone, 106, 13, 27, 0, yArco, 0, FONE);
  B(fone, 94, 9, 23, 0, yArco + 10, 0, '#e8e2d6');
  [-50, 50].forEach((x) => {
    B(fone, 13, -46 - yArco, 19, x, (yArco - 46) / 2, 0, FONE);
    B(fone, 20, 36, 34, x + Math.sign(x) * 5, -40, 2, FONE);
    B(fone, 10, 30, 30, x + Math.sign(x) * 16, -40, 2, '#e96f34');
  });
  return { raiz, corpo, cabeca, bracoE, bracoD, cotoveloE, cotoveloD, pernaE, pernaD, rabo, fone, adEsq, adDir, aquario, olhos, sobrancelhas, cronometro, livro };
};

// A lista de animações mora em services/voxelCharacters.ts: o mascote guarda
// qual delas ficou escolhida, e serviço não importa componente.
export type { VoxelPose };
export { POSES_ESCOLHIVEIS };

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
  /** Monta, posiciona e para, e ainda deixa de criar as três faces de cada
   *  cubo que a câmera não vê. Só vale com o boneco em repouso: com uma pose
   *  que gire as juntas, a face que faltava é justamente a que aparece, e o
   *  boneco sai vazado. Para listas com muitos bonecos na tela de uma vez. */
  estatico?: boolean;
  /** Para a animação sem cortar face nenhuma: o boneco fica igual, só não se
   *  mexe. É o que serve quando a pose não é de repouso. */
  parado?: boolean;
  /** Giro de descanso em graus: 0 de frente, -90 de perfil, 180 de costas. */
  angulo?: number;
  className?: string;
}

const VoxelAvatar: React.FC<VoxelAvatarProps> = ({ characterId, altura = 132, pose = 'estudando', fone = false, cronometro = false, alarme = false, onSaiuDaTela, onChegou, mascote, recorte = 'inteiro', estatico = false, parado = false, angulo, className = '' }) => {
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
    // O boneco é montado solto, fora do documento, e só entra na página
    // pronto. Montado dentro dela, cada um dos ~700 cubos entrava sozinho numa
    // árvore 3D já viva e obrigava o navegador a recalcular tudo de novo a
    // cada peça: numa tela com 23 bonecos isso virava um quadro de 3 segundos,
    // com a página inteira congelada.
    const pivot = document.createElement('div');
    pivot.style.cssText = 'position:absolute;transform-style:preserve-3d';
    const cena = J(pivot, 0, 48, 0);
    const sombra = document.createElement('div');
    sombra.style.cssText = 'position:absolute;width:132px;height:72px;left:-66px;top:-36px;background:#8f8375;opacity:.26;border-radius:50%;transform:translate3d(0,40px,0) rotateX(90deg);transition:transform 320ms ease';
    cena.appendChild(sombra);
    // Parado a câmera não muda, então as faces escondidas nem são criadas.
    // Animado elas precisam existir: o boneco gira, anda e deita.
    if (estatico) cortarFacesPara(angulo ?? -20);
    const p = montar(cfg, cena, variantePescador, varianteNutricionista, variantePolicial, varianteRegata, varianteRaposa, varianteRoqueiro, varianteSenhor, varianteSurfista, varianteNativo, varianteCaramelo);

    // Só a cabeça: o corpo é montado e depois tirado do documento. Esconder
    // com `display:none` bastava para não pintar, mas cada cubo é um contexto
    // 3D próprio e continuava pesando na composição — numa tela com 23 bonecos
    // isso é a diferença entre rolar liso e travar. Montar em duas receitas
    // separadas seria melhor ainda, e dobraria 500 linhas de montagem.
    const soRosto = recorte === 'rosto';
    if (soRosto) {
      // A sombra e os objetos de chão (a prancha do surfista, o aquário)
      // penduram da cena, não do corpo: sem esta primeira volta a prancha
      // continuava de pé ao lado de um rosto flutuando.
      Array.from(cena.children).forEach((filho) => { if (filho !== p.raiz) filho.remove(); });
      [p.pernaE, p.pernaD, p.bracoE, p.bracoD, p.rabo].forEach((parte) => parte?.remove());
      Array.from(p.corpo.children).forEach((filho) => { if (filho !== p.cabeca) filho.remove(); });
    }
    faceCortada = null;
    palco.appendChild(pivot);

    const menosMovimento = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // De corpo inteiro a figura tem 212 de altura; a cabeça sozinha, com cabelo
    // e chapéu, cabe em 112 — e fica a 48 acima do centro do palco.
    const escala = altura / (soRosto ? 112 : 212);
    // Parado ele fica de três quartos, virado para quem lê. Não gira: girar sem
    // parar puxava o olho do aluno e obrigava a desenhar as costas de cada cubo.
    // Proporções por espécie preservam juntas e acessórios, que ficam
    // dentro da mesma cabeça. Personagens prontos mantêm o desenho aprovado.
    const proporcoesCabeca: Record<string, [number, number, number]> = {
      capivara: [1.04, 0.96, 1.04], onca: [1.04, 0.98, 1], arara: [0.94, 1.02, 1],
      cachorro: [1.02, 1, 1.04], gato: [0.96, 1, 1], raposa: [0.94, 1, 1.05],
      guaxinim: [1.04, 0.98, 1], urso: [1.07, 0.97, 1], coelho: [0.94, 1, 1], rato: [0.94, 0.96, 1],
    };
    const proporcao = cfg.roupaEstudio && cfg.bicho?.especie ? proporcoesCabeca[cfg.bicho.especie] : undefined;
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
    let olhosFechadosAnterior: boolean | null = null;
    let bracosSuaves: { zE: number; zD: number; bE: number; bD: number; dobraE: number; dobraD: number; escala: number } | null = null;
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
      }
      // Uma piscada breve com pausas longas; dormir mantém os olhos fechados.
      const fasePiscar = t % 5.7;
      const olhosFechados = dormindo || (!menosMovimento && !estatico && fasePiscar > 4.1 && fasePiscar < 4.24);
      if (p.olhos && olhosFechados !== olhosFechadosAnterior) {
        olhosFechadosAnterior = olhosFechados;
        p.olhos.style.display = olhosFechados ? '' : 'none';
      }
      if (p.sobrancelhas) {
        const expressao = dormindo || menosMovimento ? 0 : olhar ? -1.8 * Math.max(0, curiosidade) : festa ? -2 : maos ? -0.8 : 0;
        p.sobrancelhas.style.transform = `translate3d(0,${expressao}px,0)`;
      }
      if (p.aquario) p.aquario.style.opacity = dormindo || lendo ? '0' : '1';

      // Andando ele vira de perfil para o lado em que caminha; acenando e dormindo,
      // de frente; no resto do tempo volta para o descanso de três quartos.
      const alvo = andando ? 76 : voltando ? -76 : tchau || dormindo ? 0 : DESCANSO;
      ry += (alvo - ry) * (1 - Math.exp(-7.5 * dt));

      const salto = festa && !menosMovimento ? Math.pow(Math.max(0, Math.sin(t * 3)), 1.4) : 0;
      // Dança: uma batida e a mesma batida meio tempo atrás. Tudo no corpo sai
      // de uma das duas, para braços, quadril e cabeça andarem no mesmo compasso
      // em vez de cada um no seu, que é o que faz parecer travamento.
      // Passinho: o corpo inteiro vai de um lado para o outro, com os pés
      // trocando. O balanço do ombro é o dobro do passo, como quem marca o
      // tempo -- um só ritmo para tudo deixaria o boneco mole.
      const lado = danca ? Math.sin(t * 4.2) * movimento : 0;
      const ombro = danca ? Math.pow(Math.max(0, Math.sin(t * 8.4)), 2) * 4 * movimento : 0;
      const passo = caminhando ? Math.sin(t * 7.5) * movimento : 0;
      const sobe = salto * 26 + ombro + (caminhando ? Math.abs(passo) * 5 : 0);
      const balanco = festa || caminhando || danca ? 0 : Math.sin(t * (dormindo ? 0.9 : 1.6)) * (dormindo ? 2.5 : 1.5) * movimento;
      // Deitado de costas as pernas ficam esticadas; em pé elas só andam ou dobram no pulo.
      // Saias e vestidos acompanham o tronco: passos menores mantêm as pernas
      // dentro da peça enquanto a barra continua visível durante o movimento.
      const amplitudePerna = cfg.vestido ? 0.55 : 1;
      const perna = (caminhando ? passo * 30 : dormindo ? 0 : danca ? lado * 24 : pes ? inquieto * 22 : -salto * 22) * amplitudePerna;

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
      if (tchau) { zD = -145 + Math.sin(t * 5.5) * 13 * movimento; bD = 0; }
      // De barriga para cima os braços descansam ao longo do corpo, abertos o
      // bastante para não sumirem dentro do tronco.
      if (dormindo) { bE = 0; bD = 0; zE = 16; zD = -16; }
      // Um braço sobe enquanto o outro desce, e as mãos vêm à frente do corpo
      // no contratempo: é o que dá a leitura de dança, e não de ginástica.
      if (danca) { zE = 24 + lado * 16; zD = -24 + lado * 16; bE = 14 - lado * 10; bD = 14 + lado * 10; }
      if (olhar) { zE = 10 + curiosidade * 6; zD = -10 + curiosidade * 6; bE = 12; bD = 12; }
      if (maos) {
        // Mangas volumosas e saias precisam de espaço ao lado do tronco.
        const aproxima = cfg.vestido || cfg.roupaEstudio === 'armadura' ? 12 : 20;
        zE = -aproxima + mexeMaos * 8; zD = aproxima + mexeMaos * 8;
        bE = 58 + Math.sin(t * 3.4) * 14 * movimento; bD = 58 - Math.sin(t * 3.4 + 0.6) * 14 * movimento;
      }
      if (pes) { zE = 10 + inquieto * 6; zD = -10 + inquieto * 6; bE = 12 - inquieto * 10; bD = 12 + inquieto * 10; }
      if (lendo) { zE = -8; zD = 8; bE = 100; bD = 100; }
      zE -= salto * 12;
      zD += salto * 12;

      // O rosto aponta para +Z: rotação X negativa faz o olhar descer para o livro.
      const inclinaCabeca = dormindo ? 0 : lendo ? -14 + Math.sin(t * 0.7) * 2 * movimento : estudando ? 16 : maos ? 19 + Math.sin(t * 1.3) * 5 * movimento : olhar ? 4 + Math.sin(t * 1.44) * 5 * movimento : danca ? 4 : -salto * 6;
      // Com o fone na cabeça ele marca o ritmo. Dormindo ou andando, não: um já
      // tem inclinação própria e o outro já balança por conta do passo.
      const tombaCabeca = (dormindo ? 14 : 0) + lado * 7 + (olhar ? -curiosidade * 10 : maos ? mexeMaos * 4 : pes ? -inquieto * 8 : 0) + (comFone && !dormindo && !caminhando && !danca ? Math.sin(t * 5.5) * 7 : 0);
      const olhaEmVolta = dormindo || estudando || caminhando ? 0 : lendo ? Math.sin(t * 0.8) * 8 * movimento : olhar ? olharLado : maos ? mexeMaos * 7 : pes ? inquieto * 12 : danca ? lado * 10 : Math.sin(t * 0.7) * 6 * movimento;

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
          ? `translate3d(${lado * (cfg.vestido ? 7 : 17)}px,0,0) rotateZ(${-lado * (cfg.vestido ? 3 : 6)}deg)`
          : `translate3d(${pes ? inquieto * 8 : olhar ? curiosidade * 3 : 0}px,${-balanco}px,0) rotateX(${estudando ? 6 : maos ? 5 : 0}deg) rotateZ(${pes ? -inquieto * 5 : olhar ? -curiosidade * 3 : 0}deg)`;
      // Deitado ele ocupa mais chão do que em pé: a sombra acompanha.
      sombra.style.transform = `translate3d(0,40px,0) rotateX(90deg)${dormindo ? ' scale(1.4,0.78)' : ''}`;
      p.cabeca.style.transform = `translate3d(0,-52px,0) rotateY(${olhaEmVolta}deg) rotateX(${inclinaCabeca}deg) rotateZ(${tombaCabeca + treme * 1.6}deg)${proporcao ? ` scale3d(${proporcao[0]},${proporcao[1]},${proporcao[2]})` : ''}`;
      // A dobra acompanha cada gesto; a interpolação evita saltos ao trocar de pose.
      const dobraE = cfg.bicho?.especie === 'arara' || lendo || dormindo ? 0 : maos ? 24 + Math.sin(t * 2.6) * 7 * movimento : danca ? 20 + lado * 10 : caminhando ? 10 + Math.max(0, passo) * 10 : 7;
      const dobraD = cfg.bicho?.especie === 'arara' || lendo || dormindo ? 0 : tchau ? 25 + Math.sin(t * 5.5 + 0.7) * 8 * movimento : maos ? 24 - Math.sin(t * 2.6 + 0.5) * 7 * movimento : danca ? 20 - lado * 10 : caminhando ? 10 + Math.max(0, -passo) * 10 : 7;
      const alvoBracos = { zE, zD, bE, bD, dobraE, dobraD, escala: lendo ? 1.7 : 1 };
      if (!bracosSuaves || menosMovimento) bracosSuaves = { ...alvoBracos };
      else {
        const ajuste = 1 - Math.exp(-12 * dt);
        for (const chave of Object.keys(alvoBracos) as (keyof typeof alvoBracos)[]) {
          bracosSuaves[chave] += (alvoBracos[chave] - bracosSuaves[chave]) * ajuste;
        }
      }
      p.bracoE.style.transform = `translate3d(-34px,-48px,0) rotateZ(${bracosSuaves.zE}deg) rotateX(${bracosSuaves.bE}deg) scaleY(${bracosSuaves.escala})`;
      p.bracoD.style.transform = `translate3d(34px,-48px,0) rotateZ(${bracosSuaves.zD}deg) rotateX(${bracosSuaves.bD}deg) scaleY(${bracosSuaves.escala})`;
      p.cotoveloE.style.transform = `translate3d(0,20px,0) rotateX(${bracosSuaves.dobraE}deg)`;
      p.cotoveloD.style.transform = `translate3d(0,20px,0) rotateX(${bracosSuaves.dobraD}deg)`;
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
      if (!estatico && !parado) quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => { cancelAnimationFrame(quadro); palco.textContent = ''; palco.style.transform = ''; };
    // `chaveAjustes` entra como dependência no lugar do objeto: a cada render o
    // pai cria um objeto novo, e comparar por identidade remontaria o boneco
    // inteiro sem nada ter mudado.
  }, [idBase, criado, altura, chaveMascote, recorte, estatico, parado, angulo]);

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
