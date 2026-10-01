export type PaperStyle = 'plain' | 'ruled' | 'grid' | 'dots';
export type DrawingTool = 'pen' | 'highlighter' | 'eraser' | 'line' | 'rectangle' | 'ellipse' | 'text' | 'hand';
export interface Point { x: number; y: number; pressure: number }
export interface InkElement {
  id: string;
  tool: Exclude<DrawingTool, 'eraser' | 'hand'>;
  color: string;
  width: number;
  points: Point[];
  text?: string;
}
export interface NotePage {
  id: string;
  width: number;
  height: number;
  paper: PaperStyle;
  background?: string;
  sourceName?: string;
  elements: InkElement[];
}
export interface DigitalNotebook {
  id: string;
  owner: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pages: NotePage[];
}
export const createPage = (paper: PaperStyle = 'ruled'): NotePage => ({
  id: crypto.randomUUID(), width: 794, height: 1123, paper, elements: [],
});
export const createNotebook = (owner: string): DigitalNotebook => ({
  id: crypto.randomUUID(), owner, title: 'Caderno sem título',
  createdAt: Date.now(), updatedAt: Date.now(), pages: [createPage()],
});

export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy);
}

// Erase entire marks, including when the pointer crosses a mark between events.
export function hitsElement(element: InkElement, point: Point, radius: number): boolean {
  const start = element.points[0];
  const end = element.points[element.points.length - 1];
  if (!start || !end) return false;
  const tolerance = radius + element.width / 2;
  if (element.tool === 'text') {
    const fontSize = Math.max(16, element.width * 5);
    const lines = (element.text || '').split('\n');
    const width = Math.max(...lines.map(line => line.length)) * fontSize * 0.65;
    return point.x >= start.x - radius && point.x <= start.x + width + radius &&
      point.y >= start.y - radius && point.y <= start.y + lines.length * fontSize * 1.3 + radius;
  }
  if (element.tool === 'rectangle') {
    const a = { ...start, x: end.x };
    const b = { ...end, x: start.x };
    return [[start, a], [a, end], [end, b], [b, start]].some(([p, q]) => distanceToSegment(point, p, q) <= tolerance);
  }
  if (element.tool === 'ellipse') {
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    if (!rx || !ry) return distanceToSegment(point, start, end) <= tolerance;
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    // Sample the perimeter so very narrow ellipses remain erasable.
    let previous = { x: cx + rx, y: cy, pressure: 0.5 };
    for (let i = 1; i <= 96; i++) {
      const angle = i * Math.PI * 2 / 96;
      const next = { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle), pressure: 0.5 };
      if (distanceToSegment(point, previous, next) <= tolerance) return true;
      previous = next;
    }
    return false;
  }
  if (element.tool === 'line') return distanceToSegment(point, start, end) <= tolerance;
  if (element.points.length === 1) return distanceToSegment(point, start, start) <= tolerance;
  return element.points.slice(1).some((p, i) => distanceToSegment(point, element.points[i], p) <= tolerance);
}

export function eraseAlong(elements: InkElement[], from: Point, to: Point, radius = 12): InkElement[] {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(1, radius)));
  return elements.filter(element => {
    for (let i = 0; i <= steps; i++) {
      if (hitsElement(element, { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps, pressure: 0.5 }, radius)) return false;
    }
    return true;
  });
}
