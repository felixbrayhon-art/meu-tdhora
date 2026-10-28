import { getStroke } from 'perfect-freehand';
import type { InkPage, InkStroke, PageSize, PaperColor, PaperTemplate, PenKind } from './types';

// Desenho no canvas: papéis, canetas e traços. Sem estado; quem chama aplica a transformação de zoom/posição antes.

export const PAGE_SIZES: Record<PageSize, { w: number; h: number; label: string }> = {
  letter: { w: 612, h: 792, label: 'Carta' },
  a4: { w: 595, h: 842, label: 'A4' },
  a5: { w: 420, h: 595, label: 'A5' },
  wide: { w: 960, h: 540, label: 'Widescreen' },
  whiteboard: { w: 2600, h: 1800, label: 'Quadro branco' },
};

export const PAPERS: Record<PaperColor, { bg: string; line: string; dark: boolean; label: string }> = {
  white: { bg: '#ffffff', line: '#cdd6e2', dark: false, label: 'Branco' },
  cream: { bg: '#fbf4e4', line: '#d9ccb0', dark: false, label: 'Creme' },
  yellow: { bg: '#fff6c8', line: '#e3d58f', dark: false, label: 'Amarelo' },
  green: { bg: '#e6f4e1', line: '#b9d3b1', dark: false, label: 'Verde' },
  blue: { bg: '#e3effb', line: '#b3cbe6', dark: false, label: 'Azul' },
  pink: { bg: '#fde8ee', line: '#e8bccb', dark: false, label: 'Rosa' },
  grey: { bg: '#e9e9ea', line: '#c1c1c4', dark: false, label: 'Cinza' },
  dark: { bg: '#2b2520', line: '#4a4037', dark: true, label: 'Escuro' },
  black: { bg: '#111111', line: '#303030', dark: true, label: 'Preto' },
};

export const TEMPLATES: { id: PaperTemplate; label: string }[] = [
  { id: 'blank', label: 'Em branco' }, { id: 'lined', label: 'Pautado' }, { id: 'lined-wide', label: 'Pautado largo' },
  { id: 'grid', label: 'Quadriculado' }, { id: 'grid-large', label: 'Quadriculado grande' }, { id: 'dots', label: 'Pontilhado' },
  { id: 'cornell', label: 'Cornell' }, { id: 'music', label: 'Partitura' }, { id: 'storyboard', label: 'Storyboard' },
  { id: 'planner-weekly', label: 'Planejador semanal' }, { id: 'planner-daily', label: 'Planejador diário' }, { id: 'todo', label: 'Lista de tarefas' },
  { id: 'isometric', label: 'Isométrico' }, { id: 'graph', label: 'Milimetrado' }, { id: 'handwriting', label: 'Caligrafia' },
];

export const PEN_LABELS: Record<PenKind, string> = {
  pen: 'Caneta', fineliner: 'Ponta fina', fountain: 'Tinteiro', calligraphy: 'Caligráfica', pencil: 'Lápis', highlighter: 'Marca-texto', crayon: 'Giz de cera', watercolour: 'Aquarela',
};

const line = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); };

export const drawPaper = (ctx: CanvasRenderingContext2D, w: number, h: number, template: PaperTemplate, color: PaperColor) => {
  const paper = PAPERS[color];
  ctx.save();
  ctx.fillStyle = paper.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = paper.line; ctx.fillStyle = paper.line; ctx.lineWidth = 0.7;
  ctx.beginPath();
  const hLines = (step: number, top = 0, bottom = h, left = 0, right = w) => { for (let y = top; y <= bottom; y += step) line(ctx, left, y, right, y); };
  const vLines = (step: number, left = 0, right = w, top = 0, bottom = h) => { for (let x = left; x <= right; x += step) line(ctx, x, top, x, bottom); };
  switch (template) {
    case 'lined': hLines(26, 70); break;
    case 'lined-wide': hLines(34, 80); break;
    case 'grid': hLines(20); vLines(20); break;
    case 'grid-large': hLines(34); vLines(34); break;
    case 'graph': { ctx.stroke(); ctx.beginPath(); ctx.lineWidth = 0.35; hLines(7.2); vLines(7.2); ctx.stroke(); ctx.beginPath(); ctx.lineWidth = 0.9; hLines(36); vLines(36); break; }
    case 'dots': {
      ctx.stroke(); ctx.beginPath();
      for (let y = 30; y < h; y += 24) for (let x = 30; x < w; x += 24) { ctx.moveTo(x + 1.1, y); ctx.arc(x, y, 1.1, 0, Math.PI * 2); }
      ctx.fill(); ctx.beginPath(); break;
    }
    case 'cornell': {
      const cue = w * 0.28, summary = h * 0.82;
      hLines(26, 70, summary - 6, cue, w); line(ctx, cue, 0, cue, summary); line(ctx, 0, summary, w, summary); line(ctx, 0, 60, w, 60);
      break;
    }
    case 'music': {
      for (let top = 70; top + 60 < h - 30; top += 100) for (let i = 0; i < 5; i++) line(ctx, 36, top + i * 11, w - 36, top + i * 11);
      break;
    }
    case 'storyboard': {
      const cols = w > h ? 3 : 2, rows = w > h ? 2 : 3, gx = 24, gy = 24;
      const fw = (w - gx * (cols + 1)) / cols, fh = (h - gy * (rows + 1) - rows * 40) / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = gx + c * (fw + gx), y = gy + r * (fh + gy + 40);
        ctx.rect(x, y, fw, fh); line(ctx, x, y + fh + 16, x + fw, y + fh + 16); line(ctx, x, y + fh + 32, x + fw, y + fh + 32);
      }
      break;
    }
    case 'planner-weekly': {
      const top = 70, rowH = (h - top - 24) / 7;
      for (let i = 0; i <= 7; i++) line(ctx, 24, top + i * rowH, w - 24, top + i * rowH);
      line(ctx, 90, top, 90, h - 24);
      break;
    }
    case 'planner-daily': {
      const top = 70, rowH = 30;
      for (let y = top, n = 0; y < h - 20 && n < 24; y += rowH, n++) line(ctx, 60, y, w - 24, y);
      line(ctx, 60, top, 60, Math.min(h - 20, top + rowH * 24));
      break;
    }
    case 'todo': {
      for (let y = 70; y < h - 20; y += 34) { line(ctx, 62, y, w - 30, y); ctx.rect(30, y - 22, 18, 18); }
      break;
    }
    case 'isometric': {
      const s = 26, hh = s * Math.sqrt(3) / 2;
      for (let y = 0; y <= h + hh; y += hh) line(ctx, 0, y, w, y);
      for (let x = -h; x <= w + h; x += s) { line(ctx, x, 0, x + h / Math.tan(Math.PI / 3), h); line(ctx, x, 0, x - h / Math.tan(Math.PI / 3), h); }
      break;
    }
    case 'handwriting': {
      for (let y = 80; y + 60 < h - 20; y += 78) { line(ctx, 30, y, w - 30, y); line(ctx, 30, y + 40, w - 30, y + 40); line(ctx, 30, y + 60, w - 30, y + 60); }
      ctx.stroke(); ctx.beginPath(); ctx.setLineDash([4, 4]);
      for (let y = 80; y + 60 < h - 20; y += 78) line(ctx, 30, y + 20, w - 30, y + 20);
      ctx.stroke(); ctx.setLineDash([]); ctx.beginPath();
      break;
    }
    default: break;
  }
  ctx.stroke();
  ctx.restore();
};

// ---- Canetas ----

const mulberry = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hashId = (id: string) => { let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

const outlinePath = (pts: number[][]): Path2D => {
  if (pts.length === 0) return new Path2D();
  const d: (string | number)[] = ['M', pts[0][0], pts[0][1], 'Q'];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    d.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  d.push('Z');
  return new Path2D(d.join(' '));
};

const toTriples = (flat: number[]): number[][] => { const out: number[][] = []; for (let i = 0; i + 2 < flat.length + 0; i += 3) out.push([flat[i], flat[i + 1], flat[i + 2]]); return out; };

interface Style { size: number; thinning: number; smoothing: number; streamline: number; taper: number; alpha: number; blend?: GlobalCompositeOperation }
const styleOf = (kind: PenKind, width: number): Style => {
  switch (kind) {
    case 'fineliner': return { size: width * 0.75, thinning: 0, smoothing: 0.5, streamline: 0.4, taper: 0, alpha: 1 };
    case 'fountain': return { size: width * 1.5, thinning: 0.78, smoothing: 0.62, streamline: 0.55, taper: width * 4, alpha: 1 };
    case 'pencil': return { size: width * 0.95, thinning: 0.3, smoothing: 0.5, streamline: 0.4, taper: 0, alpha: 0.55 };
    case 'highlighter': return { size: width * 4, thinning: 0, smoothing: 0.6, streamline: 0.5, taper: 0, alpha: 0.38, blend: 'multiply' };
    case 'crayon': return { size: width * 1.6, thinning: 0.1, smoothing: 0.4, streamline: 0.3, taper: 0, alpha: 0.5 };
    case 'watercolour': return { size: width * 2.6, thinning: 0.2, smoothing: 0.7, streamline: 0.6, taper: 0, alpha: 0.14 };
    default: return { size: width, thinning: 0.42, smoothing: 0.6, streamline: 0.5, taper: 0, alpha: 1 };
  }
};

// Tinta escura some em papel escuro (e tinta clara em papel claro): na tela a cor se adapta; o traço salvo não muda.
const luminance = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};
export const adaptInk = (color: string, darkPaper: boolean): string => {
  const l = luminance(color);
  if (darkPaper && l < 0.28) return '#f1e6d6';
  if (!darkPaper && l > 0.92) return '#2b2118';
  return color;
};

const cache = new WeakMap<InkStroke, Path2D[]>();

const outlineFor = (s: InkStroke, size: number, st: Style, jitter = 0, rnd?: () => number): Path2D => {
  const pts = toTriples(s.points);
  const uniform = pts.every((p) => Math.abs(p[2] - pts[0][2]) < 0.001);
  const input = jitter && rnd ? pts.map((p) => [p[0] + (rnd() - 0.5) * jitter, p[1] + (rnd() - 0.5) * jitter, p[2]]) : pts;
  const outline = getStroke(input, {
    size, thinning: st.thinning, smoothing: st.smoothing, streamline: st.streamline, simulatePressure: uniform,
    start: { taper: st.taper, cap: true }, end: { taper: st.taper, cap: true },
  });
  return outlinePath(outline);
};

/** Desenha um traço. `darkPaper` evita o "multiply" do marca-texto, que some sobre papel escuro; `live` desliga o cache do contorno. */
export const drawStroke = (ctx: CanvasRenderingContext2D, s: InkStroke, darkPaper = false, live = false) => {
  if (s.points.length < 3) return;
  const st = styleOf(s.kind, s.width);
  ctx.save();
  const ink = adaptInk(s.color, darkPaper);
  ctx.fillStyle = ink; ctx.strokeStyle = ink;
  const baseAlpha = s.opacity * st.alpha;
  ctx.globalCompositeOperation = st.blend && !darkPaper ? st.blend : 'source-over';

  if (s.straight) {
    ctx.globalAlpha = baseAlpha; ctx.lineWidth = st.size; ctx.lineCap = s.kind === 'highlighter' ? 'butt' : 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i + 2 < s.points.length + 0; i += 3) { if (i === 0) ctx.moveTo(s.points[0], s.points[1]); else ctx.lineTo(s.points[i], s.points[i + 1]); }
    ctx.stroke(); ctx.restore(); return;
  }

  if (s.kind === 'calligraphy') {
    ctx.globalAlpha = baseAlpha;
    const a = -Math.PI / 4, nx = Math.cos(a) * s.width * 0.95, ny = Math.sin(a) * s.width * 0.95;
    const p = s.points;
    if (p.length < 6) { ctx.beginPath(); ctx.arc(p[0], p[1], s.width * 0.5, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i + 5 < p.length; i += 3) {
      ctx.beginPath();
      ctx.moveTo(p[i] - nx, p[i + 1] - ny); ctx.lineTo(p[i] + nx, p[i + 1] + ny);
      ctx.lineTo(p[i + 3] + nx, p[i + 4] + ny); ctx.lineTo(p[i + 3] - nx, p[i + 4] - ny); ctx.closePath(); ctx.fill();
    }
    ctx.restore(); return;
  }

  // O traço em andamento é o mesmo objeto sendo alterado: nele o contorno não pode ficar em cache.
  let paths = live ? undefined : cache.get(s);
  if (!paths) {
    const rnd = mulberry(hashId(s.id));
    if (s.kind === 'pencil') paths = [outlineFor(s, st.size, st, 0.8, rnd), outlineFor(s, st.size * 0.8, st, 1.4, rnd)];
    else if (s.kind === 'crayon') paths = [outlineFor(s, st.size, st, 1.6, rnd), outlineFor(s, st.size * 0.85, st, 2.4, rnd), outlineFor(s, st.size * 0.6, st, 3, rnd)];
    else if (s.kind === 'watercolour') paths = [outlineFor(s, st.size, st), outlineFor(s, st.size * 0.72, st, 1.5, rnd), outlineFor(s, st.size * 0.45, st, 2.5, rnd)];
    else paths = [outlineFor(s, st.size, st)];
    if (!live) cache.set(s, paths);
  }
  const perPass = paths.length > 1 ? Math.min(1, baseAlpha * (s.kind === 'watercolour' ? 1.3 : 0.9)) : baseAlpha;
  ctx.globalAlpha = perPass;
  for (const path of paths) ctx.fill(path);
  ctx.restore();
};

export const drawPage = (ctx: CanvasRenderingContext2D, page: InkPage, strokes: InkStroke[], bg?: CanvasImageSource | null) => {
  const { w, h } = PAGE_SIZES[page.size];
  drawPaper(ctx, w, h, page.template, page.paper);
  if (bg) ctx.drawImage(bg, 0, 0, w, h);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  const dark = PAPERS[page.paper].dark;
  for (const s of strokes) drawStroke(ctx, s, dark);
  ctx.restore();
};

/** Miniatura da página (para o navegador de páginas e a capa). */
export const renderThumbnail = (page: InkPage, maxSide: number, bg?: CanvasImageSource | null): HTMLCanvasElement => {
  const { w, h } = PAGE_SIZES[page.size];
  const k = maxSide / Math.max(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * k)); canvas.height = Math.max(1, Math.round(h * k));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(k, k);
  drawPage(ctx, page, page.strokes, bg);
  return canvas;
};
