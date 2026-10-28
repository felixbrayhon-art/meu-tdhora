// Papéis do caderno: port para TypeScript de OwlLuna/Models/Paper.swift e OwlLuna/Canvas/PaperTemplates.swift
// (github.com/owaisazmal/OwlLuna, licença MIT, © 2024-2026 Owais Khan). As medidas, cores e a ordem dos traços seguem o original;
// o que mudou foi trocar CoreGraphics/CoreText por Canvas 2D e os rótulos do planejador por português.
import type { PaperColor, PaperTemplate } from './types';

export interface Rgba { r: number; g: number; b: number; a: number }
const rgba = (r: number, g: number, b: number, a: number): Rgba => ({ r, g, b, a });
const css = (c: Rgba) => `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
const withAlpha = (c: Rgba, a: number): Rgba => ({ ...c, a });
const faded = (c: Rgba, f: number): Rgba => ({ ...c, a: Math.min(1, c.a * f) });

/** Cor do papel (Paper.swift: PaperColor.rgb). */
export const PAPER_RGB: Record<PaperColor, [number, number, number]> = {
  white: [1, 1, 1], ivory: [0.992, 0.976, 0.925], yellow: [1, 0.973, 0.765], gray: [0.925, 0.929, 0.937], charcoal: [0.165, 0.169, 0.184],
  kraft: [0.851, 0.769, 0.627], sage: [0.867, 0.898, 0.843], blush: [0.965, 0.894, 0.878], chalkboard: [0.169, 0.243, 0.212],
};
export const paperCss = (c: PaperColor) => css(rgba(...PAPER_RGB[c], 1));
export const isDarkPaper = (c: PaperColor) => c === 'charcoal' || c === 'chalkboard';

interface TemplateInk { line: Rgba; accent: Rgba; strong: Rgba; grid: number; dots: number }

/** TemplateInk.for(_:): as cores com que cada modelo é desenhado sobre cada papel. */
const inkFor = (color: PaperColor): TemplateInk => {
  switch (color) {
    case 'charcoal': return { line: rgba(1, 1, 1, 0.16), accent: rgba(1, 0.45, 0.45, 0.35), strong: rgba(1, 1, 1, 0.3), grid: 0.12, dots: 0.35 };
    case 'kraft': return { line: rgba(0.42, 0.31, 0.19, 0.45), accent: rgba(0.72, 0.24, 0.18, 0.45), strong: rgba(0.3, 0.21, 0.12, 0.72), grid: 0.3, dots: 0.6 };
    case 'sage': return { line: rgba(0.3, 0.45, 0.35, 0.45), accent: rgba(0.75, 0.3, 0.3, 0.4), strong: rgba(0.2, 0.3, 0.23, 0.72), grid: 0.3, dots: 0.7 };
    case 'blush': return { line: rgba(0.7, 0.42, 0.44, 0.4), accent: rgba(0.78, 0.28, 0.3, 0.45), strong: rgba(0.42, 0.22, 0.24, 0.72), grid: 0.32, dots: 0.7 };
    case 'chalkboard': return { line: rgba(1, 1, 1, 0.2), accent: rgba(0.91, 0.69, 0.14, 0.45), strong: rgba(1, 1, 1, 0.5), grid: 0.12, dots: 0.35 };
    default: return { line: rgba(0.55, 0.68, 0.84, 0.55), accent: rgba(0.9, 0.35, 0.35, 0.45), strong: rgba(0.35, 0.35, 0.35, 0.7), grid: 0.35, dots: 0.9 };
  }
};

/** Distância entre as pautas, em unidades de uma página de 800 de largura (PaperTemplate.lineGap). */
const lineGap = (t: PaperTemplate): number => (t === 'grid' || t === 'dotted' ? 26 : t === 'narrowRuled' ? 28 : t === 'cornell' ? 30 : t === 'wideRuled' || t === 'checklist' ? 38 : 0);

class Rules {
  constructor(readonly ctx: CanvasRenderingContext2D, readonly w: number, readonly h: number) { ctx.beginPath(); }
  steps(from: number, by: number, cond: (v: number) => boolean): number[] { const out: number[] = []; for (let v = from; cond(v); v += by) out.push(v); return out; }
  multiples(step: number, below: number): number[] { const n = Math.max(1, Math.ceil(below / step)); return Array.from({ length: n - 1 }, (_, i) => (i + 1) * step); }
  hLines(ys: number[], x0: number, x1: number) { for (const y of ys) { this.ctx.moveTo(x0, y); this.ctx.lineTo(x1, y); } }
  vLines(xs: number[], y0: number, y1: number) { for (const x of xs) { this.ctx.moveTo(x, y0); this.ctx.lineTo(x, y1); } }
  dotGrid(xs: number[], ys: number[], r: number) { for (const y of ys) for (const x of xs) { this.ctx.moveTo(x + r, y); this.ctx.arc(x, y, r, 0, Math.PI * 2); } }
  boxes(rects: { x: number; y: number; w: number; h: number }[], corner: number) {
    for (const r of rects) {
      if (corner > 0 && typeof this.ctx.roundRect === 'function') { this.ctx.roundRect(r.x, r.y, r.w, r.h, corner); } else this.ctx.rect(r.x, r.y, r.w, r.h);
    }
  }
  /** Diagonais de inclinação `angle` com espaçamento horizontal `spacing`, recortadas na página. */
  diagonalFamily(angle: number, spacing: number) {
    const slope = Math.tan(angle), step = spacing / Math.cos(angle);
    if (!(step > 0) || slope === 0) return;
    const low = 0 - Math.max(0 * slope, this.w * slope), high = this.h - Math.min(0 * slope, this.w * slope);
    for (let i = Math.ceil(low / step); i <= Math.floor(high / step); i++) {
      const c = i * step;
      const top = (0 - c) / slope, bottom = (this.h - c) / slope;
      const x0 = Math.max(0, Math.min(top, bottom)), x1 = Math.min(this.w, Math.max(top, bottom));
      if (x0 < x1) { this.ctx.moveTo(x0, x0 * slope + c); this.ctx.lineTo(x1, x1 * slope + c); }
    }
  }
  stroke(color: Rgba) { this.ctx.strokeStyle = css(color); this.ctx.stroke(); this.ctx.beginPath(); }
}

const lw = (ctx: CanvasRenderingContext2D, v: number) => { ctx.lineWidth = v; };

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Rótulos do planejador: horas das 7 às 21 e a semana a partir do domingo, mais "Notas". */
export const plannerLabels = () => {
  const hours = Array.from({ length: 15 }, (_, i) => String(7 + i));
  let days: string[];
  try {
    const f = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
    days = Array.from({ length: 7 }, (_, i) => capital(f.format(new Date(Date.UTC(2023, 0, 1 + i))).replace('.', '')));
  } catch { days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']; }
  return { hours, days: [...days, 'Notas'] };
};

const text = (ctx: CanvasRenderingContext2D, s: string, size: number, color: Rgba, x: number, y: number, align: 'left' | 'right') => {
  ctx.save(); ctx.fillStyle = css(color); ctx.font = `${size}px Manrope, system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y); ctx.restore();
};

/** Desenha o modelo de papel na página (w × h pontos). `unitOverride` fixa a unidade (quadro branco usa 1). */
export const drawTemplate = (ctx: CanvasRenderingContext2D, template: PaperTemplate, color: PaperColor, w: number, h: number, unitOverride?: number) => {
  const u = unitOverride ?? w / 800;
  const ink = inkFor(color);
  ctx.save();
  ctx.lineCap = 'butt';
  lw(ctx, Math.max(0.5, u));
  const r = new Rules(ctx, w, h);

  switch (template) {
    case 'blank': break;
    case 'narrowRuled': case 'wideRuled':
      r.hLines(r.steps(120 * u, lineGap(template) * u, (v) => v < h - 20 * u), 0, w); r.stroke(ink.line);
      r.vLines([104 * u], 0, h); r.stroke(ink.accent);
      break;
    case 'grid': {
      const s = 26 * u;
      r.vLines(r.steps(s, s, (v) => v < w), 0, h); r.hLines(r.steps(s, s, (v) => v < h), 0, w);
      r.stroke(withAlpha(ink.line, ink.grid));
      break;
    }
    case 'dotted': {
      const s = 26 * u;
      ctx.fillStyle = css(withAlpha(ink.line, ink.dots));
      r.dotGrid(r.steps(s, s, (v) => v < w), r.steps(s, s, (v) => v < h), Math.max(0.8, 1.6 * u));
      ctx.fill(); ctx.beginPath();
      break;
    }
    case 'cornell': {
      const summaryTop = h * 0.8, cueRight = 240 * u;
      r.hLines(r.steps(120 * u, lineGap(template) * u, (v) => v < summaryTop), cueRight, w); r.stroke(ink.line);
      lw(ctx, Math.max(1, 2 * u));
      r.hLines([90 * u], 0, w); r.vLines([cueRight], 90 * u, summaryTop); r.hLines([summaryTop], 0, w); r.stroke(ink.accent);
      break;
    }
    case 'music': {
      const gap = 10 * u, height = gap * 4;
      const tops = r.steps(100 * u, height + 60 * u, (v) => v + height < h - 60 * u);
      r.hLines(tops.flatMap((top) => [0, 1, 2, 3, 4].map((i) => top + i * gap)), 60 * u, w - 60 * u); r.stroke(ink.strong);
      break;
    }
    case 'engineering': {
      const step = 18 * u, left = 40 * u, top = 80 * u;
      const rows = Math.max(1, Math.trunc((h - 40 * u - top) / step));
      const xs = Array.from({ length: 41 }, (_, i) => left + i * step), ys = Array.from({ length: rows + 1 }, (_, i) => top + i * step);
      const right = xs[xs.length - 1], bottom = ys[ys.length - 1];
      const major = (i: number, n: number) => i % 5 === 0 || i === n - 1;
      r.vLines(xs.filter((_, i) => !major(i, xs.length)), top, bottom); r.hLines(ys.filter((_, i) => !major(i, ys.length)), left, right); r.stroke(faded(ink.line, 0.5));
      r.vLines(xs.filter((_, i) => major(i, xs.length)), top, bottom); r.hLines(ys.filter((_, i) => major(i, ys.length)), left, right); r.stroke(ink.line);
      lw(ctx, Math.max(0.75, 1.5 * u));
      r.hLines([60 * u], left, right); r.stroke(ink.accent);
      break;
    }
    case 'isometric': {
      const s = 24.25 * u;
      r.vLines(r.multiples(s, w), 0, h); r.diagonalFamily(Math.PI / 6, s); r.diagonalFamily(-Math.PI / 6, s);
      r.stroke(withAlpha(ink.line, ink.grid));
      break;
    }
    case 'checklist': {
      const ys = r.steps(120 * u, lineGap(template) * u, (v) => v < h - 20 * u);
      r.hLines(ys, 0, w); r.stroke(ink.line);
      r.boxes(ys.map((y) => ({ x: 36 * u, y: y - 20 * u, w: 14 * u, h: 14 * u })), 2.5 * u);
      lw(ctx, Math.max(0.75, 1.25 * u)); r.stroke(ink.strong);
      lw(ctx, Math.max(0.5, u));
      r.vLines([72 * u], 0, h); r.stroke(ink.accent);
      break;
    }
    case 'penmanship': {
      const band = 20 * u;
      const groups = r.steps(110 * u, band * 3 + 24 * u, (v) => v + band * 3 < h - 20 * u);
      r.hLines(groups, 0, w); r.stroke(faded(ink.line, 0.9));
      r.hLines(groups.map((g) => g + band * 3), 0, w); r.stroke(faded(ink.line, 0.64));
      lw(ctx, Math.max(0.75, 1.5 * u));
      r.hLines(groups.map((g) => g + band * 2), 0, w); r.stroke(ink.line);
      ctx.save(); lw(ctx, Math.max(0.5, u)); ctx.setLineDash([6 * u, 4 * u]);
      r.hLines(groups.map((g) => g + band), 0, w); r.stroke(ink.line);
      ctx.restore();
      r.vLines([72 * u], 0, h); r.stroke(ink.accent);
      break;
    }
    case 'dayPlanner': {
      const top = 130 * u, bottom = h - 40 * u, hour = (bottom - top) / 15;
      const hourRules = Array.from({ length: 16 }, (_, i) => top + i * hour);
      r.hLines(hourRules, 104 * u, 540 * u); r.vLines([560 * u], 100 * u, bottom);
      const boxRules = Array.from({ length: 6 }, (_, i) => 150 * u + i * 38 * u);
      const notesTop = boxRules[boxRules.length - 1] + 68 * u;
      r.hLines([...boxRules, ...r.steps(notesTop, 30 * u, (v) => v <= bottom)], 576 * u, 776 * u);
      r.stroke(ink.line);
      ctx.save(); ctx.lineCap = 'round'; lw(ctx, Math.max(0.75, 1.25 * u)); ctx.setLineDash([0, 5 * u]);
      r.hLines(Array.from({ length: 15 }, (_, i) => top + (i + 0.5) * hour), 104 * u, 540 * u); r.stroke(ink.line);
      ctx.restore();
      lw(ctx, Math.max(0.75, 1.25 * u));
      r.boxes(boxRules.map((y) => ({ x: 576 * u, y: y - 20 * u, w: 14 * u, h: 14 * u })), 2.5 * u); r.stroke(ink.strong);
      lw(ctx, Math.max(1, 2 * u));
      r.hLines([100 * u], 0, w); r.stroke(ink.accent);
      const labels = plannerLabels();
      hourRules.slice(0, -1).forEach((y, i) => text(ctx, labels.hours[i], 13 * u, ink.strong, 88 * u, y + 14 * u, 'right'));
      break;
    }
    case 'weekPlanner': {
      const [columns, rows] = h >= w ? [2, 4] : [4, 2];
      const margin = 32 * u, gap = 16 * u, header = 30 * u;
      const bw = (w - margin * 2 - gap * (columns - 1)) / columns, bh = (h - margin * 2 - gap * (rows - 1)) / rows;
      const boxes = Array.from({ length: 8 }, (_, i) => ({ x: margin + (i % columns) * (bw + gap), y: margin + Math.floor(i / columns) * (bh + gap), w: bw, h: bh }));
      ctx.fillStyle = css(faded(ink.line, 0.18));
      boxes.forEach((b) => ctx.fillRect(b.x, b.y, bw, header));
      boxes.forEach((b) => r.hLines(r.steps(b.y + header * 2, 30 * u, (v) => v < b.y + b.h - 8 * u), b.x + 8 * u, b.x + b.w - 8 * u));
      r.stroke(ink.line);
      boxes.forEach((b) => { r.boxes([b], 0); r.hLines([b.y + header], b.x, b.x + b.w); });
      r.stroke(faded(ink.line, 0.8 / 0.55));
      const days = plannerLabels().days;
      boxes.forEach((b, i) => text(ctx, days[i], 12 * u, ink.strong, b.x + 10 * u, b.y + 19.5 * u, 'left'));
      break;
    }
    case 'storyboard': {
      const [columns, rows] = h >= w ? [2, 3] : [3, 2];
      const margin = 40 * u, gap = 28 * u, captions = 44 * u;
      let fw = (w - margin * 2 - gap * (columns - 1)) / columns;
      const tallest = (h - margin * 2 - gap * (rows - 1)) / rows - captions;
      fw = Math.min(fw, (tallest * 16) / 9);
      const fh = (fw * 9) / 16;
      const gridW = fw * columns + gap * (columns - 1), gridH = (fh + captions) * rows + gap * (rows - 1);
      const ox = (w - gridW) / 2, oy = (h - gridH) / 2;
      const frames = Array.from({ length: columns * rows }, (_, i) => ({ x: ox + (i % columns) * (fw + gap), y: oy + Math.floor(i / columns) * (fh + captions + gap), w: fw, h: fh }));
      frames.forEach((f) => r.hLines([f.y + f.h + 22 * u, f.y + f.h + captions], f.x, f.x + f.w));
      r.stroke(ink.line);
      lw(ctx, Math.max(0.75, 1.5 * u));
      r.boxes(frames, 0); r.stroke(ink.strong);
      break;
    }
  }
  ctx.restore();
};
