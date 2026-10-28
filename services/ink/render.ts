import { getStroke } from 'perfect-freehand';
import type { InkPage, InkStroke, PageSize, PaperColor, PaperTemplate, PenKind } from './types';
import { PAPER_RGB, drawTemplate, isDarkPaper, paperCss } from './templates';

// Desenho no canvas: papéis, canetas e traços. Sem estado; quem chama aplica a transformação de zoom/posição antes.

export const PAGE_SIZES: Record<PageSize, { w: number; h: number; label: string }> = {
  letter: { w: 612, h: 792, label: 'Carta' },
  a4: { w: 595.28, h: 841.89, label: 'A4' },
  a5: { w: 419.53, h: 595.28, label: 'A5' },
  widescreen: { w: 960, h: 540, label: 'Widescreen' },
  whiteboard: { w: 2600, h: 1800, label: 'Quadro branco' },
};

const PAPER_LABELS: Record<PaperColor, string> = {
  white: 'Branco', ivory: 'Marfim', yellow: 'Bloco amarelo', kraft: 'Kraft', sage: 'Sálvia', blush: 'Rosado', gray: 'Cinza', charcoal: 'Carvão', chalkboard: 'Lousa',
};
export const PAPERS = Object.fromEntries((Object.keys(PAPER_RGB) as PaperColor[]).map((c) => [c, { bg: paperCss(c), dark: isDarkPaper(c), label: PAPER_LABELS[c] }])) as Record<PaperColor, { bg: string; dark: boolean; label: string }>;

/** Modelos agrupados como no OwlLuna (PaperFamily). */
export const TEMPLATE_FAMILIES: { label: string; items: { id: PaperTemplate; label: string }[] }[] = [
  { label: 'Escrita', items: [{ id: 'blank', label: 'Em branco' }, { id: 'narrowRuled', label: 'Pautado estreito' }, { id: 'wideRuled', label: 'Pautado largo' }, { id: 'penmanship', label: 'Caligrafia' }, { id: 'checklist', label: 'Lista de tarefas' }] },
  { label: 'Grades', items: [{ id: 'grid', label: 'Quadriculado' }, { id: 'engineering', label: 'Engenharia' }, { id: 'dotted', label: 'Pontilhado' }, { id: 'isometric', label: 'Isométrico' }] },
  { label: 'Planejamento', items: [{ id: 'cornell', label: 'Cornell' }, { id: 'dayPlanner', label: 'Planejador diário' }, { id: 'weekPlanner', label: 'Planejador semanal' }] },
  { label: 'Criativo', items: [{ id: 'music', label: 'Pauta de música' }, { id: 'storyboard', label: 'Storyboard' }] },
];

export const PEN_LABELS: Record<PenKind, string> = {
  pen: 'Caneta', fineliner: 'Ponta fina', fountain: 'Tinteiro', calligraphy: 'Caligráfica', pencil: 'Lápis', highlighter: 'Marca-texto', crayon: 'Giz de cera', watercolour: 'Aquarela',
};

export const drawPaper = (ctx: CanvasRenderingContext2D, w: number, h: number, template: PaperTemplate, color: PaperColor, board = false) => {
  ctx.save();
  ctx.fillStyle = paperCss(color);
  ctx.fillRect(0, 0, w, h);
  // O quadro branco é só "pautado" com as medidas de uma página Carta (unidade 1), sem margens.
  drawTemplate(ctx, template, color, w, h, board ? 1 : undefined);
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
  drawPaper(ctx, w, h, page.template, page.paper, page.size === 'whiteboard');
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
