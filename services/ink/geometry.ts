import type { InkStroke, Pt } from './types';

// Funções puras (sem DOM) do motor de tinta: acerto, borracha, laço e reconhecimento de formas.

export const uid = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const strokePoints = (s: InkStroke): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < s.points.length; i += 3) out.push({ x: s.points[i], y: s.points[i + 1] });
  return out;
};

export const strokeBounds = (s: InkStroke) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < s.points.length; i += 3) {
    const x = s.points[i], y = s.points[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const pad = s.width;
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
};

export const distToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/** O ponto (x, y) com raio r toca o traço? */
export const hitStroke = (s: InkStroke, x: number, y: number, r: number): boolean => {
  const p = s.points, reach = r + s.width / 2;
  if (p.length < 6) return p.length >= 2 && Math.hypot(x - p[0], y - p[1]) <= reach;
  for (let i = 0; i + 5 < p.length; i += 3) {
    if (distToSegment(x, y, p[i], p[i + 1], p[i + 3], p[i + 4]) <= reach) return true;
  }
  return false;
};

/** Borracha de traço inteiro: ids dos traços tocados. */
export const eraseWhole = (strokes: InkStroke[], x: number, y: number, r: number): string[] =>
  strokes.filter((s) => hitStroke(s, x, y, r)).map((s) => s.id);

/** Borracha parcial: corta os pontos dentro do raio e devolve os pedaços que sobram (ou null se nada foi tocado). */
export const erasePartial = (s: InkStroke, x: number, y: number, r: number, newId: () => string = uid): InkStroke[] | null => {
  if (!hitStroke(s, x, y, r)) return null;
  const reach = r + s.width / 2;
  const pieces: number[][] = [];
  let cur: number[] = [];
  const p = s.points;
  const n = p.length / 3;
  // Pontos longe do raio ficam; os segmentos que cruzam o raio também cortam (testa o segmento, não só os pontos).
  for (let i = 0; i < n; i++) {
    const px = p[i * 3], py = p[i * 3 + 1];
    const near = Math.hypot(px - x, py - y) <= reach
      || (i > 0 && distToSegment(x, y, p[(i - 1) * 3], p[(i - 1) * 3 + 1], px, py) <= reach && Math.hypot(px - x, py - y) <= reach * 1.6);
    if (near) { if (cur.length >= 6) pieces.push(cur); cur = []; } else cur.push(px, py, p[i * 3 + 2]);
  }
  if (cur.length >= 6) pieces.push(cur);
  return pieces.map((pts) => ({ ...s, id: newId(), points: pts }));
};

export const pointInPolygon = (x: number, y: number, poly: Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
};

/** Traços com ao menos 60% dos pontos dentro do laço. */
export const strokesInLasso = (strokes: InkStroke[], poly: Pt[]): string[] => {
  if (poly.length < 3) return [];
  return strokes.filter((s) => {
    const pts = strokePoints(s);
    if (!pts.length) return false;
    const dentro = pts.filter((q) => pointInPolygon(q.x, q.y, poly)).length;
    return dentro / pts.length >= 0.6;
  }).map((s) => s.id);
};

export const translateStroke = (s: InkStroke, dx: number, dy: number): InkStroke => {
  const pts = s.points.slice();
  for (let i = 0; i + 1 < pts.length; i += 3) { pts[i] += dx; pts[i + 1] += dy; }
  return { ...s, points: pts };
};

export const scaleStrokeAround = (s: InkStroke, cx: number, cy: number, k: number): InkStroke => {
  const pts = s.points.slice();
  for (let i = 0; i + 1 < pts.length; i += 3) { pts[i] = cx + (pts[i] - cx) * k; pts[i + 1] = cy + (pts[i + 1] - cy) * k; }
  return { ...s, points: pts, width: s.width * k };
};

// ---- Reconhecimento de formas ("desenhe e segure") ----

const pathLength = (pts: Pt[]) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; };

/** Ramer–Douglas–Peucker. */
const simplify = (pts: Pt[], eps: number): Pt[] => {
  if (pts.length < 3) return pts;
  let dmax = 0, idx = 0;
  const a = pts[0], b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSegment(pts[i].x, pts[i].y, a.x, a.y, b.x, b.y);
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= eps) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
};

export type RecognizedShape =
  | { type: 'line'; points: Pt[] }
  | { type: 'arrow'; points: Pt[] }
  | { type: 'ellipse'; points: Pt[] }
  | { type: 'polygon'; points: Pt[] };

const ellipsePoints = (cx: number, cy: number, rx: number, ry: number, n = 64): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: cx + rx * Math.cos((i / n) * Math.PI * 2), y: cy + ry * Math.sin((i / n) * Math.PI * 2) }));

const arrowPoints = (a: Pt, b: Pt): Pt[] => {
  const ang = Math.atan2(b.y - a.y, b.x - a.x), len = Math.max(10, Math.hypot(b.x - a.x, b.y - a.y) * 0.18);
  const h1 = { x: b.x - len * Math.cos(ang - Math.PI / 7), y: b.y - len * Math.sin(ang - Math.PI / 7) };
  const h2 = { x: b.x - len * Math.cos(ang + Math.PI / 7), y: b.y - len * Math.sin(ang + Math.PI / 7) };
  return [a, b, h1, b, h2];
};

/** Reconhece linha reta, seta, elipse/círculo, triângulo e retângulo a partir de um traço à mão; null se não parece forma. */
export const recognizeShape = (raw: Pt[]): RecognizedShape | null => {
  if (raw.length < 6) return null;
  const L = pathLength(raw);
  if (L < 24) return null;
  const first = raw[0], last = raw[raw.length - 1];
  const chord = Math.hypot(last.x - first.x, last.y - first.y);
  const xs = raw.map((p) => p.x), ys = raw.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const w = x1 - x0, h = y1 - y0, diag = Math.hypot(w, h);
  const closed = chord < L * 0.22 && L > diag * 1.6;

  if (!closed) {
    // Seta: reta seguida de um gancho curto no fim (o traço volta sobre si mesmo).
    const cut = Math.floor(raw.length * 0.85);
    const body = raw.slice(0, cut);
    if (body.length > 4) {
      const bc = Math.hypot(body[body.length - 1].x - body[0].x, body[body.length - 1].y - body[0].y);
      const dev = Math.max(...body.map((p) => distToSegment(p.x, p.y, body[0].x, body[0].y, body[body.length - 1].x, body[body.length - 1].y)));
      const tail = raw.slice(cut - 1);
      const tailLen = pathLength(tail);
      const hook = tail.length > 2 && Math.hypot(last.x - body[body.length - 1].x, last.y - body[body.length - 1].y) < tailLen * 0.8 && tailLen > bc * 0.06 && tailLen < bc * 0.5;
      if (bc > 30 && dev < bc * 0.08 && hook) return { type: 'arrow', points: arrowPoints(body[0], body[body.length - 1]) };
    }
    const dev = Math.max(...raw.map((p) => distToSegment(p.x, p.y, first.x, first.y, last.x, last.y)));
    if (chord > 30 && dev < Math.max(4, chord * 0.06)) return { type: 'line', points: [first, last] };
    return null;
  }

  const eps = Math.max(5, diag * 0.075);
  const poly = simplify([...raw, raw[0]], eps);
  const corners = poly.length - 1;
  if (corners === 3) return { type: 'polygon', points: [...poly.slice(0, 3), poly[0]] };
  if (corners === 4) {
    const quad = poly.slice(0, 4);
    const horizVert = quad.every((p, i) => { const q = quad[(i + 1) % 4]; const dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y); return Math.min(dx, dy) < Math.max(dx, dy) * 0.25; });
    if (horizVert) return { type: 'polygon', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }] };
    return { type: 'polygon', points: [...quad, quad[0]] };
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = w / 2, ry = h / 2;
  if (rx > 8 && ry > 8) {
    const errs = raw.map((p) => Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1));
    const meanErr = errs.reduce((a, b) => a + b, 0) / errs.length;
    if (meanErr < 0.14) {
      const circle = Math.abs(w - h) < Math.max(w, h) * 0.18;
      const r = (rx + ry) / 2;
      return { type: 'ellipse', points: circle ? ellipsePoints(cx, cy, r, r) : ellipsePoints(cx, cy, rx, ry) };
    }
  }
  return null;
};

export const pointsToFlat = (pts: Pt[], pressure = 0.5): number[] => pts.flatMap((p) => [p.x, p.y, pressure]);

/** Forma geométrica arrastada pelo aluno (ferramenta de formas): de a até b. */
export const shapeFromDrag = (kind: 'line' | 'arrow' | 'ellipse' | 'rect' | 'triangle', a: Pt, b: Pt): Pt[] => {
  if (kind === 'line') return [a, b];
  if (kind === 'arrow') return arrowPoints(a, b);
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  if (kind === 'rect') return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }];
  if (kind === 'triangle') return [{ x: (x0 + x1) / 2, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: (x0 + x1) / 2, y: y0 }];
  return ellipsePoints((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2);
};
