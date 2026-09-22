import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { getStroke } from 'perfect-freehand';
import { DrawStroke, DrawPoint, NotePaperStyle, NotePenType, NoteShapeType } from '../types';

export type NoteTool = 'pen' | 'eraser' | 'move' | 'shape' | 'select' | 'laser' | 'text' | 'vspace';

export interface NoteCanvasHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  exportThumbnail: () => string;
  getStrokes: () => DrawStroke[];
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
}

interface NoteCanvasProps {
  initialStrokes?: DrawStroke[];
  tool: NoteTool;
  penType?: NotePenType;
  shapeType?: NoteShapeType;
  color: string;
  penWidth: number;
  eraserWidth: number;
  opacity?: number;
  paperStyle?: NotePaperStyle;
  onChange?: (strokes: DrawStroke[]) => void;
  onSelectionChange?: (count: number) => void;
}

interface WorldPoint { x: number; y: number; }

interface TextEditorState {
  screenX: number;
  screenY: number;
  world: WorldPoint;
  value: string;
  editingIndex: number | null;
  fontSizeScreen: number;
}

const strokeBounds = (pts: DrawPoint[]) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
};

const rectsIntersect = (a: { minX: number; minY: number; maxX: number; maxY: number }, b: typeof a) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

// Text elements only store a single anchor point, so they need their own
// bounds estimate (from font size + text length) for selection/hit-testing —
// everything else falls back to the plain point-cloud bounds above.
const elementBounds = (el: DrawStroke) => {
  if (el.kind === 'text') {
    const p = el.points[0];
    if (!p) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    const fontSize = el.fontSize ?? 22;
    const lines = (el.text ?? '').split('\n');
    const maxLen = Math.max(1, ...lines.map(l => l.length));
    const w = maxLen * fontSize * 0.58;
    const h = lines.length * fontSize * 1.25;
    return { minX: p.x, minY: p.y, maxX: p.x + w, maxY: p.y + h };
  }
  return strokeBounds(el.points);
};

interface View {
  x: number;
  y: number;
  scale: number;
}

const GRID_SIZE = 32;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';
const RESIZE_OPPOSITE: Record<ResizeCorner, ResizeCorner> = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };
const ROTATE_HANDLE_OFFSET = 28; // screen px above the selection box
const HANDLE_HIT_R = 10; // screen px hit-test radius for corner/rotate handles

// Laser pointer: a non-persistent trail for pointing/explaining, never saved
// to the note. Each stroke fades out and is discarded shortly after it's drawn.
const LASER_COLOR = '#FF3B30';
const LASER_WIDTH = 5;
const LASER_FADE_MS = 650;

interface LaserStroke {
  points: DrawPoint[];
  createdAt: number;
}

// perfect-freehand (MIT, github.com/steveruizok/perfect-freehand) turns raw
// pressure-sensitive points into a tapered outline polygon — used by both
// Excalidraw and tldraw for their ink rendering. Each pen "personality" is
// just a different set of its options rather than a hand-rolled curve:
// 'monoline' gets thinning 0 (pressure doesn't affect width at all); 'brush'
// thins aggressively for calligraphy-style contrast; 'pen' is moderate. Raw
// (unshaped) pressure is stored per point — getStroke does its own response
// curve internally via `thinning`, so pre-curving it ourselves would just
// double up and fight its output.
const FREEHAND_OPTIONS: Record<string, { thinning: number; smoothing: number; streamline: number }> = {
  pen: { thinning: 0.55, smoothing: 0.5, streamline: 0.5 },
  monoline: { thinning: 0, smoothing: 0.5, streamline: 0.5 },
  brush: { thinning: 0.8, smoothing: 0.45, streamline: 0.4 },
};

// Converts getStroke()'s outline points into a fillable Canvas2D path,
// smoothing between them with quadratic curves through each segment's
// midpoint — the same technique perfect-freehand's own canvas examples use.
const outlineToPath2D = (outline: number[][]): Path2D => {
  const path = new Path2D();
  if (outline.length < 3) {
    if (outline.length === 2) {
      path.moveTo(outline[0][0], outline[0][1]);
      path.lineTo(outline[1][0], outline[1][1]);
    }
    return path;
  }
  path.moveTo((outline[0][0] + outline[1][0]) / 2, (outline[0][1] + outline[1][1]) / 2);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
};

const buildFreehandPath = (pts: DrawPoint[], width: number, penType: NotePenType | undefined, simulatePressure: boolean): Path2D => {
  const opts = FREEHAND_OPTIONS[penType ?? 'pen'] ?? FREEHAND_OPTIONS.pen;
  const outline = getStroke(
    pts.map(p => [p.x, p.y, p.pressure]),
    { size: width, thinning: opts.thinning, smoothing: opts.smoothing, streamline: opts.streamline, simulatePressure }
  );
  return outlineToPath2D(outline);
};

// Catmull-Rom → cubic Bezier conversion: the curve between p1 and p2 uses
// the neighboring points p0/p3 to derive its control points, so the tangent
// direction flows naturally through EVERY point instead of just approximating
// it via segment midpoints. This is the same "spline through every point"
// technique Rnote's Curved/Modeled brush builders use, and it stays smooth
// through sharp direction changes where a plain quadratic-through-midpoints
// curve (the old approach here) would still show a faint facet.
const catmullRomTo = (
  ctx: CanvasRenderingContext2D,
  p0: DrawPoint, p1: DrawPoint, p2: DrawPoint, p3: DrawPoint
) => {
  const cp1x = p1.x + (p2.x - p0.x) / 6;
  const cp1y = p1.y + (p2.y - p0.y) / 6;
  const cp2x = p2.x - (p3.x - p1.x) / 6;
  const cp2y = p2.y - (p3.y - p1.y) / 6;
  ctx.moveTo(p1.x, p1.y);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
};

const strokePath = (ctx: CanvasRenderingContext2D, pts: DrawPoint[]) => {
  if (pts.length < 2) return;
  const width = ctx.lineWidth;

  if (pts.length < 3) {
    const p = pts[0];
    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.lineWidth = Math.max(width * last.pressure, 1);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(last.x + 0.01, last.y + 0.01);
    ctx.stroke();
    return;
  }

  // Each segment is stroked separately (rather than one path for the whole
  // stroke) so the line width can follow smoothed pressure point-by-point.
  let smoothedPressure = pts[0].pressure;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    smoothedPressure = smoothedPressure * 0.7 + p2.pressure * 0.3;
    ctx.beginPath();
    ctx.lineWidth = Math.max(width * smoothedPressure, 1);
    catmullRomTo(ctx, p0, p1, p2, p3);
    ctx.stroke();
  }
};

// Shift-to-constrain while dragging a shape's end anchor: squares/circles
// lock to equal width/height, lines/arrows snap their angle to 45° steps.
const applyShapeConstraint = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  shapeType: NoteShapeType | undefined,
  shiftKey: boolean
): { x: number; y: number } => {
  if (!shiftKey) return end;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (shapeType === 'rectangle' || shapeType === 'circle') {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    return { x: start.x + (dx < 0 ? -side : side), y: start.y + (dy < 0 ? -side : side) };
  }
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const dist = Math.hypot(dx, dy);
  return { x: start.x + Math.cos(snapped) * dist, y: start.y + Math.sin(snapped) * dist };
};

const drawShape = (ctx: CanvasRenderingContext2D, stroke: DrawStroke) => {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = stroke.opacity ?? 1;
  ctx.strokeStyle = stroke.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(stroke.width * (pts[pts.length - 1].pressure || 1), 1);

  if (stroke.shapeType === 'polygon' || stroke.shapeType === 'polyline') {
    // These build up an arbitrary number of vertices via repeated clicks
    // instead of a single drag from two anchors, so they render as a plain
    // (optionally closed) path through every point rather than parametrically.
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (stroke.shapeType === 'polygon') ctx.closePath();
    ctx.stroke();
    return;
  }

  const [p0, p1] = pts;
  if (!p0 || !p1) return;
  switch (stroke.shapeType) {
    case 'line': {
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      break;
    }
    case 'arrow': {
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const headLen = Math.max(stroke.width * 3.5, 12);
      ctx.beginPath();
      ctx.moveTo(p1.x - headLen * Math.cos(angle - Math.PI / 7), p1.y - headLen * Math.sin(angle - Math.PI / 7));
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p1.x - headLen * Math.cos(angle + Math.PI / 7), p1.y - headLen * Math.sin(angle + Math.PI / 7));
      ctx.stroke();
      break;
    }
    case 'rectangle': {
      ctx.strokeRect(Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y));
      break;
    }
    case 'circle': {
      const cx = (p0.x + p1.x) / 2;
      const cy = (p0.y + p1.y) / 2;
      const rx = Math.abs(p1.x - p0.x) / 2;
      const ry = Math.abs(p1.y - p0.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(rx, 0.01), Math.max(ry, 0.01), 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }
};

const drawTextElement = (ctx: CanvasRenderingContext2D, el: DrawStroke) => {
  const p = el.points[0];
  if (!p || !el.text) return;
  const fontSize = el.fontSize ?? 22;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = el.opacity ?? 1;
  ctx.fillStyle = el.color;
  ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'top';
  el.text.split('\n').forEach((line, i) => ctx.fillText(line, p.x, p.y + i * fontSize * 1.25));
};

// Element-renderer dispatch, keyed by kind — mirrors the pattern of giving
// each element type its own draw routine instead of one big branching
// function, so adding a new element kind later doesn't mean editing this one.
const drawStroke = (ctx: CanvasRenderingContext2D, stroke: DrawStroke) => {
  if (stroke.kind === 'text') {
    drawTextElement(ctx, stroke);
    return;
  }
  if (stroke.shapeType) {
    drawShape(ctx, stroke);
    return;
  }
  const pts = stroke.points;
  if (pts.length === 0) return;
  const penType = stroke.penType ?? 'pen';

  if (stroke.isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 1;
    ctx.lineWidth = stroke.width;
    strokePath(ctx, pts);
    return;
  }

  // 'highlighter' is no longer a selectable pen type, but old saved notes
  // can still have strokes with penType:'highlighter' — keep rendering those
  // with the multiply blend they were drawn with instead of flattening them
  // to a normal opaque stroke.
  ctx.globalCompositeOperation = (penType as string) === 'highlighter' ? 'multiply' : 'source-over';
  ctx.globalAlpha = stroke.opacity ?? 1;
  ctx.fillStyle = stroke.color;
  ctx.fill(buildFreehandPath(pts, stroke.width, penType, stroke.simulatePressure ?? false));
};

const NoteCanvas = forwardRef<NoteCanvasHandle, NoteCanvasProps>(
  ({ initialStrokes = [], tool, penType = 'pen', shapeType = 'line', color, penWidth, eraserWidth, opacity = 1, paperStyle = 'dots', onChange, onSelectionChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const strokesRef = useRef<DrawStroke[]>(initialStrokes);
    const activeStrokeRef = useRef<DrawStroke | null>(null);
    const viewRef = useRef<View>({ x: 0, y: 0, scale: 1 });
    const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const gestureRef = useRef<{ startDist: number; startScale: number; startMid: { x: number; y: number }; startView: View } | null>(null);
    const panPointerRef = useRef<{ id: number; lastX: number; lastY: number } | null>(null);
    const hasStylusRef = useRef(false);
    const penActiveRef = useRef(false);
    const toolRef = useRef(tool);
    const penTypeRef = useRef(penType);
    const shapeTypeRef = useRef(shapeType);
    const colorRef = useRef(color);
    const penWidthRef = useRef(penWidth);
    const eraserWidthRef = useRef(eraserWidth);
    const opacityRef = useRef(opacity);
    const paperStyleRef = useRef(paperStyle);
    const shapeStartRef = useRef<WorldPoint | null>(null);
    const selectedRef = useRef<Set<number>>(new Set());
    const selectModeRef = useRef<
      | { kind: 'rect'; start: WorldPoint; current: WorldPoint }
      | { kind: 'move'; lastWorld: WorldPoint }
      | { kind: 'resize'; corner: ResizeCorner; anchor: WorldPoint; originalCorner: WorldPoint; snapshot: Map<number, { points: DrawPoint[]; width: number; fontSize?: number }> }
      | { kind: 'rotate'; center: WorldPoint; startAngle: number; snapshot: Map<number, DrawPoint[]> }
      | null
    >(null);
    const laserStrokesRef = useRef<LaserStroke[]>([]);
    const activeLaserRef = useRef<LaserStroke | null>(null);
    const laserRafRef = useRef<number | null>(null);
    const historyRef = useRef<DrawStroke[][]>([]);
    const futureRef = useRef<DrawStroke[][]>([]);
    const polygonPointsRef = useRef<WorldPoint[] | null>(null);
    const vspaceStartRef = useRef<{ y: number; lastDy: number } | null>(null);
    const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
    // Mirrors `textEditor` so commit logic can read the latest value and run
    // its side effects (mutating strokesRef, pushHistory) OUTSIDE of a
    // setState updater — React (in StrictMode/dev) invokes updater functions
    // twice to check purity, which would otherwise double-insert the stroke.
    const textEditorRef = useRef<TextEditorState | null>(null);
    const updateTextEditor = (next: TextEditorState | null) => {
      textEditorRef.current = next;
      setTextEditor(next);
    };
    const [, forceRender] = useState(0);

    toolRef.current = tool;
    penTypeRef.current = penType;
    shapeTypeRef.current = shapeType;
    colorRef.current = color;
    penWidthRef.current = penWidth;
    eraserWidthRef.current = eraserWidth;
    opacityRef.current = opacity;
    paperStyleRef.current = paperStyle;

    const applyTransform = (ctx: CanvasRenderingContext2D) => {
      const dpr = window.devicePixelRatio || 1;
      const v = viewRef.current;
      ctx.setTransform(dpr * v.scale, 0, 0, dpr * v.scale, dpr * v.x, dpr * v.y);
    };

    const HISTORY_LIMIT = 50;
    // Snapshot-based undo/redo: push the array reference BEFORE mutating it
    // (every mutation below replaces strokesRef.current with a new array
    // rather than mutating in place, so old snapshots stay untouched).
    const pushHistory = () => {
      historyRef.current = [...historyRef.current, strokesRef.current].slice(-HISTORY_LIMIT);
      futureRef.current = [];
    };

    const drawGrid = (ctx: CanvasRenderingContext2D) => {
      const canvas = canvasRef.current!;
      const dpr = window.devicePixelRatio || 1;
      const v = viewRef.current;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);

      const style = paperStyleRef.current;
      if (style === 'blank') {
        ctx.restore();
        return;
      }

      const step = GRID_SIZE * v.scale;
      const offsetX = ((v.x % step) + step) % step;
      const offsetY = ((v.y % step) + step) % step;

      if (style === 'dots') {
        ctx.fillStyle = 'rgba(10, 15, 30, 0.08)';
        const dotRadius = Math.max(1, v.scale);
        for (let x = offsetX; x < w; x += step) {
          for (let y = offsetY; y < h; y += step) {
            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (style === 'lines') {
        ctx.strokeStyle = 'rgba(10, 15, 30, 0.12)';
        ctx.lineWidth = 1;
        for (let y = offsetY; y < h; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      } else if (style === 'grid') {
        ctx.strokeStyle = 'rgba(10, 15, 30, 0.1)';
        ctx.lineWidth = 1;
        for (let y = offsetY; y < h; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        for (let x = offsetX; x < w; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    // Union of every selected element's bounds, in world space — the single
    // source of truth for both the dashed selection box and where the
    // resize/rotate handles get placed.
    const getSelectionBounds = () => {
      if (selectedRef.current.size === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selectedRef.current.forEach(i => {
        const s = strokesRef.current[i];
        if (!s) return;
        const b = elementBounds(s);
        minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
      });
      return isFinite(minX) ? { minX, minY, maxX, maxY } : null;
    };

    const getHandlePositions = (b: { minX: number; minY: number; maxX: number; maxY: number }, scale: number) => {
      const pad = 8 / scale;
      const minX = b.minX - pad, minY = b.minY - pad, maxX = b.maxX + pad, maxY = b.maxY + pad;
      const cx = (minX + maxX) / 2;
      return {
        nw: { x: minX, y: minY },
        ne: { x: maxX, y: minY },
        sw: { x: minX, y: maxY },
        se: { x: maxX, y: maxY },
        rotate: { x: cx, y: minY - ROTATE_HANDLE_OFFSET / scale },
        boxTopCenter: { x: cx, y: minY },
      };
    };

    const drawSelectionOverlay = (ctx: CanvasRenderingContext2D) => {
      const v = viewRef.current;
      const mode = selectModeRef.current;
      const bounds = getSelectionBounds();
      ctx.save();
      applyTransform(ctx);
      ctx.lineWidth = 1.5 / v.scale;
      ctx.strokeStyle = '#F59E0B';
      ctx.setLineDash([6 / v.scale, 4 / v.scale]);

      if (bounds) {
        const pad = 8 / v.scale;
        ctx.strokeRect(bounds.minX - pad, bounds.minY - pad, bounds.maxX - bounds.minX + pad * 2, bounds.maxY - bounds.minY + pad * 2);
      }

      if (bounds && (!mode || mode.kind !== 'rect')) {
        const handles = getHandlePositions(bounds, v.scale);
        const r = (HANDLE_HIT_R * 0.55) / v.scale;
        ctx.setLineDash([]);
        ctx.fillStyle = '#F59E0B';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5 / v.scale;
        [handles.nw, handles.ne, handles.sw, handles.se].forEach(p => {
          ctx.beginPath();
          ctx.rect(p.x - r, p.y - r, r * 2, r * 2);
          ctx.fill();
          ctx.stroke();
        });
        ctx.strokeStyle = '#F59E0B';
        ctx.beginPath();
        ctx.moveTo(handles.boxTopCenter.x, handles.boxTopCenter.y);
        ctx.lineTo(handles.rotate.x, handles.rotate.y);
        ctx.stroke();
        ctx.fillStyle = '#F59E0B';
        ctx.strokeStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(handles.rotate.x, handles.rotate.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([6 / v.scale, 4 / v.scale]);
      }

      if (mode && mode.kind === 'rect') {
        const x = Math.min(mode.start.x, mode.current.x);
        const y = Math.min(mode.start.y, mode.current.y);
        const w = Math.abs(mode.current.x - mode.start.x);
        const h = Math.abs(mode.current.y - mode.start.y);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      }
      ctx.restore();
    };

    const drawLaserStrokes = (ctx: CanvasRenderingContext2D) => {
      const now = Date.now();
      const scale = viewRef.current.scale;
      const draw = (ls: LaserStroke) => {
        if (ls.points.length < 2) return;
        const alpha = Math.max(0, 1 - (now - ls.createdAt) / LASER_FADE_MS);
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = LASER_COLOR;
        ctx.shadowColor = LASER_COLOR;
        ctx.shadowBlur = 8 / scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = LASER_WIDTH / scale;
        strokePath(ctx, ls.points);
        ctx.restore();
      };
      laserStrokesRef.current.forEach(draw);
      if (activeLaserRef.current) draw(activeLaserRef.current);
    };

    const redrawAll = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawGrid(ctx);
      applyTransform(ctx);
      for (const s of strokesRef.current) drawStroke(ctx, s);
      if (toolRef.current === 'select') drawSelectionOverlay(ctx);
      applyTransform(ctx);
      drawLaserStrokes(ctx);
    };

    // Renders the vertices placed so far for an in-progress polygon/polyline
    // (plus an optional live cursor point), so each click gives immediate
    // feedback instead of waiting for the next mousemove to draw anything —
    // a plain redrawAll() can't show this since these points aren't part of
    // strokesRef until the shape is finished.
    const drawPolygonPreview = (hoverPoint?: WorldPoint) => {
      const pts = polygonPointsRef.current;
      if (!pts || pts.length === 0) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      redrawAll();
      applyTransform(ctx);
      const preview: DrawStroke = {
        points: [...pts, ...(hoverPoint ? [hoverPoint] : [])].map(p => ({ x: p.x, y: p.y, pressure: 1 })),
        color: colorRef.current,
        width: penWidthRef.current / viewRef.current.scale,
        opacity: opacityRef.current,
        shapeType: shapeTypeRef.current,
      };
      drawShape(ctx, preview);
    };

    const tickLaser = () => {
      const now = Date.now();
      laserStrokesRef.current = laserStrokesRef.current.filter(s => now - s.createdAt < LASER_FADE_MS);
      redrawAll();
      if (laserStrokesRef.current.length > 0 || activeLaserRef.current) {
        laserRafRef.current = requestAnimationFrame(tickLaser);
      } else {
        laserRafRef.current = null;
      }
    };

    const ensureLaserLoop = () => {
      if (laserRafRef.current == null) {
        laserRafRef.current = requestAnimationFrame(tickLaser);
      }
    };

    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      redrawAll();
    };

    useEffect(() => {
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      return () => {
        window.removeEventListener('resize', resizeCanvas);
        if (laserRafRef.current != null) cancelAnimationFrame(laserRafRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      redrawAll();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paperStyle]);

    useEffect(() => {
      if (tool !== 'select') {
        selectedRef.current = new Set();
        onSelectionChange?.(0);
      }
      if (tool !== 'shape') {
        polygonPointsRef.current = null;
      }
      if (tool !== 'text' && textEditorRef.current) {
        commitTextEditor();
      }
      redrawAll();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tool]);

    useEffect(() => {
      polygonPointsRef.current = null;
      redrawAll();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shapeType]);

    const setScaleAround = (newScale: number, screenX: number, screenY: number) => {
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
      const v = viewRef.current;
      const worldX = (screenX - v.x) / v.scale;
      const worldY = (screenY - v.y) / v.scale;
      viewRef.current = {
        scale: clamped,
        x: screenX - worldX * clamped,
        y: screenY - worldY * clamped,
      };
      redrawAll();
    };

    useImperativeHandle(ref, () => ({
      undo: () => {
        if (historyRef.current.length === 0) return;
        futureRef.current = [...futureRef.current, strokesRef.current];
        strokesRef.current = historyRef.current[historyRef.current.length - 1];
        historyRef.current = historyRef.current.slice(0, -1);
        selectedRef.current = new Set();
        onSelectionChange?.(0);
        redrawAll();
        onChange?.(strokesRef.current);
        forceRender(n => n + 1);
      },
      redo: () => {
        if (futureRef.current.length === 0) return;
        historyRef.current = [...historyRef.current, strokesRef.current];
        strokesRef.current = futureRef.current[futureRef.current.length - 1];
        futureRef.current = futureRef.current.slice(0, -1);
        selectedRef.current = new Set();
        onSelectionChange?.(0);
        redrawAll();
        onChange?.(strokesRef.current);
        forceRender(n => n + 1);
      },
      clear: () => {
        pushHistory();
        strokesRef.current = [];
        selectedRef.current = new Set();
        onSelectionChange?.(0);
        redrawAll();
        onChange?.(strokesRef.current);
        forceRender(n => n + 1);
      },
      deleteSelected: () => {
        if (selectedRef.current.size === 0) return;
        pushHistory();
        strokesRef.current = strokesRef.current.filter((_, i) => !selectedRef.current.has(i));
        selectedRef.current = new Set();
        onSelectionChange?.(0);
        redrawAll();
        onChange?.(strokesRef.current);
        forceRender(n => n + 1);
      },
      duplicateSelected: () => {
        if (selectedRef.current.size === 0) return;
        pushHistory();
        const offset = 24 / viewRef.current.scale;
        const base = strokesRef.current.length;
        const clones: DrawStroke[] = [];
        strokesRef.current.forEach((s, i) => {
          if (!selectedRef.current.has(i)) return;
          clones.push({ ...s, points: s.points.map(p => ({ ...p, x: p.x + offset, y: p.y + offset })) });
        });
        strokesRef.current = [...strokesRef.current, ...clones];
        selectedRef.current = new Set(clones.map((_, i) => base + i));
        onSelectionChange?.(selectedRef.current.size);
        redrawAll();
        onChange?.(strokesRef.current);
        forceRender(n => n + 1);
      },
      exportThumbnail: () => {
        const strokes = strokesRef.current;
        if (strokes.length === 0) return canvasRef.current?.toDataURL('image/png', 0.6) ?? '';
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of strokes) {
          for (const p of s.points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          }
        }
        const pad = 40;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        const w = Math.max(maxX - minX, 1);
        const h = Math.max(maxY - minY, 1);
        const off = document.createElement('canvas');
        off.width = 480;
        off.height = 480 * (h / w);
        const octx = off.getContext('2d')!;
        octx.fillStyle = '#FFFFFF';
        octx.fillRect(0, 0, off.width, off.height);
        const scale = off.width / w;
        octx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);
        for (const s of strokes) drawStroke(octx, s);
        return off.toDataURL('image/png', 0.7);
      },
      getStrokes: () => strokesRef.current,
      zoomIn: () => {
        const c = containerRef.current;
        setScaleAround(viewRef.current.scale * 1.25, (c?.clientWidth ?? 0) / 2, (c?.clientHeight ?? 0) / 2);
      },
      zoomOut: () => {
        const c = containerRef.current;
        setScaleAround(viewRef.current.scale / 1.25, (c?.clientWidth ?? 0) / 2, (c?.clientHeight ?? 0) / 2);
      },
      resetView: () => {
        viewRef.current = { x: 0, y: 0, scale: 1 };
        redrawAll();
      },
    }));

    const toWorld = (screenX: number, screenY: number) => {
      const v = viewRef.current;
      return { x: (screenX - v.x) / v.scale, y: (screenY - v.y) / v.scale };
    };

    const getScreenPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Palm rejection: while the pen is actively touching down, ignore any
      // concurrent touch pointer entirely (a resting palm reads as a touch).
      if (e.pointerType === 'touch' && penActiveRef.current) return;

      // Without this, the browser's default mousedown handling blurs
      // whatever element gained focus during this same handler (e.g. the
      // text-tool's just-opened <textarea>) right after it runs, since
      // canvas itself isn't focusable — killing text entry before it starts.
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const screen = getScreenPoint(e);
      pointersRef.current.set(e.pointerId, screen);

      if (e.pointerType === 'pen') {
        hasStylusRef.current = true;
        penActiveRef.current = true;
      }

      if (pointersRef.current.size === 2) {
        // Two simultaneous touches (or a touch + something else): treat as a
        // pinch/pan gesture and cancel any in-progress stroke.
        activeStrokeRef.current = null;
        panPointerRef.current = null;
        const pts = Array.from(pointersRef.current.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        gestureRef.current = { startDist: dist, startScale: viewRef.current.scale, startMid: mid, startView: { ...viewRef.current } };
        return;
      }

      if (pointersRef.current.size > 2) return;

      // Once a stylus has been seen on this device, a single finger always
      // navigates instead of drawing (matches GoodNotes/Notability) — this is
      // what makes an accidental palm touch harmless instead of a stray mark.
      const fingerNavigates = e.pointerType === 'touch' && hasStylusRef.current;

      if (toolRef.current === 'move' || fingerNavigates) {
        panPointerRef.current = { id: e.pointerId, lastX: screen.x, lastY: screen.y };
        return;
      }

      if (toolRef.current === 'shape') {
        if (shapeTypeRef.current === 'polygon' || shapeTypeRef.current === 'polyline') {
          const world = toWorld(screen.x, screen.y);
          if (!polygonPointsRef.current) {
            polygonPointsRef.current = [world];
          } else {
            const first = polygonPointsRef.current[0];
            const closeDist = 12 / viewRef.current.scale;
            if (
              shapeTypeRef.current === 'polygon' &&
              polygonPointsRef.current.length >= 2 &&
              Math.hypot(world.x - first.x, world.y - first.y) < closeDist
            ) {
              finishPolygon();
              return;
            }
            polygonPointsRef.current = [...polygonPointsRef.current, world];
          }
          drawPolygonPreview();
          return;
        }
        shapeStartRef.current = toWorld(screen.x, screen.y);
        return;
      }

      if (toolRef.current === 'laser') {
        const world = toWorld(screen.x, screen.y);
        activeLaserRef.current = { points: [{ x: world.x, y: world.y, pressure: 1 }], createdAt: Date.now() };
        ensureLaserLoop();
        return;
      }

      if (toolRef.current === 'text') {
        const world = toWorld(screen.x, screen.y);
        if (textEditorRef.current) applyTextCommit(textEditorRef.current);
        updateTextEditor({ screenX: screen.x, screenY: screen.y, world, value: '', editingIndex: null, fontSizeScreen: 22 });
        return;
      }

      if (toolRef.current === 'vspace') {
        const world = toWorld(screen.x, screen.y);
        vspaceStartRef.current = { y: world.y, lastDy: 0 };
        return;
      }

      if (toolRef.current === 'select') {
        const world = toWorld(screen.x, screen.y);
        const bounds = getSelectionBounds();

        if (bounds) {
          const handles = getHandlePositions(bounds, viewRef.current.scale);
          const hitR = HANDLE_HIT_R / viewRef.current.scale;
          const hits = (p: WorldPoint) => Math.hypot(world.x - p.x, world.y - p.y) <= hitR;

          if (hits(handles.rotate)) {
            pushHistory();
            const cx = (bounds.minX + bounds.maxX) / 2;
            const cy = (bounds.minY + bounds.maxY) / 2;
            const snapshot = new Map<number, DrawPoint[]>();
            selectedRef.current.forEach(i => {
              const s = strokesRef.current[i];
              if (s) snapshot.set(i, s.points.map(p => ({ ...p })));
            });
            selectModeRef.current = { kind: 'rotate', center: { x: cx, y: cy }, startAngle: Math.atan2(world.y - cy, world.x - cx), snapshot };
            return;
          }

          const corners: [ResizeCorner, WorldPoint][] = [['nw', handles.nw], ['ne', handles.ne], ['sw', handles.sw], ['se', handles.se]];
          for (const [corner, pos] of corners) {
            if (!hits(pos)) continue;
            pushHistory();
            const snapshot = new Map<number, { points: DrawPoint[]; width: number; fontSize?: number }>();
            selectedRef.current.forEach(i => {
              const s = strokesRef.current[i];
              if (!s) return;
              snapshot.set(i, { points: s.points.map(p => ({ ...p })), width: s.width, fontSize: s.fontSize });
            });
            selectModeRef.current = { kind: 'resize', corner, anchor: handles[RESIZE_OPPOSITE[corner]], originalCorner: pos, snapshot };
            return;
          }
        }

        const pad = 8 / viewRef.current.scale;
        const insideSelection = !!bounds && world.x >= bounds.minX - pad && world.x <= bounds.maxX + pad && world.y >= bounds.minY - pad && world.y <= bounds.maxY + pad;
        if (insideSelection) {
          pushHistory();
          selectModeRef.current = { kind: 'move', lastWorld: world };
        } else {
          selectedRef.current = new Set();
          onSelectionChange?.(0);
          selectModeRef.current = { kind: 'rect', start: world, current: world };
        }
        redrawAll();
        return;
      }

      const isEraser = toolRef.current === 'eraser';
      const world = toWorld(screen.x, screen.y);
      const pressure = e.pointerType === 'pen' ? (e.pressure > 0 ? e.pressure : 0.5) : e.pointerType === 'touch' ? 0.6 : 0.5;
      activeStrokeRef.current = {
        points: [{ x: world.x, y: world.y, pressure }],
        color: colorRef.current,
        width: (isEraser ? eraserWidthRef.current : penWidthRef.current) / viewRef.current.scale,
        isEraser,
        opacity: isEraser ? 1 : opacityRef.current,
        penType: isEraser ? undefined : penTypeRef.current,
        // No real pressure sensor on mouse/touch — let perfect-freehand fake
        // a natural taper from point velocity instead of a flat width.
        simulatePressure: !isEraser && e.pointerType !== 'pen',
      };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const screen = getScreenPoint(e);

      // Polygon/polyline building tracks the cursor between discrete clicks,
      // with no pointer ever "down" in between — must run before the
      // active-pointer gate below, which every other tool relies on.
      if (polygonPointsRef.current) {
        drawPolygonPreview(toWorld(screen.x, screen.y));
        return;
      }

      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, screen);

      if (gestureRef.current && pointersRef.current.size === 2) {
        const pts = Array.from(pointersRef.current.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const g = gestureRef.current;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.startScale * (dist / Math.max(g.startDist, 1))));
        const worldAtStart = { x: (g.startMid.x - g.startView.x) / g.startView.scale, y: (g.startMid.y - g.startView.y) / g.startView.scale };
        viewRef.current = {
          scale: newScale,
          x: mid.x - worldAtStart.x * newScale,
          y: mid.y - worldAtStart.y * newScale,
        };
        redrawAll();
        return;
      }

      if (panPointerRef.current && panPointerRef.current.id === e.pointerId) {
        const dx = screen.x - panPointerRef.current.lastX;
        const dy = screen.y - panPointerRef.current.lastY;
        panPointerRef.current.lastX = screen.x;
        panPointerRef.current.lastY = screen.y;
        viewRef.current = { ...viewRef.current, x: viewRef.current.x + dx, y: viewRef.current.y + dy };
        redrawAll();
        return;
      }

      if (shapeStartRef.current) {
        const rawWorld = toWorld(screen.x, screen.y);
        const world = applyShapeConstraint(shapeStartRef.current, rawWorld, shapeTypeRef.current, e.shiftKey);
        const preview: DrawStroke = {
          points: [{ ...shapeStartRef.current, pressure: 1 }, { x: world.x, y: world.y, pressure: 1 }],
          color: colorRef.current,
          width: penWidthRef.current / viewRef.current.scale,
          opacity: opacityRef.current,
          shapeType: shapeTypeRef.current,
        };
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) {
          redrawAll();
          applyTransform(ctx);
          drawShape(ctx, preview);
        }
        return;
      }

      if (activeLaserRef.current) {
        const world = toWorld(screen.x, screen.y);
        activeLaserRef.current.points.push({ x: world.x, y: world.y, pressure: 1 });
        activeLaserRef.current.createdAt = Date.now();
        return;
      }

      if (vspaceStartRef.current) {
        const world = toWorld(screen.x, screen.y);
        const state = vspaceStartRef.current;
        const dy = world.y - state.y;
        state.lastDy = dy;
        redrawAll();
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) {
          applyTransform(ctx);
          ctx.save();
          ctx.globalAlpha = 0.5;
          strokesRef.current.forEach(s => {
            const b = elementBounds(s);
            if (b.minY >= state.y) {
              drawStroke(ctx, { ...s, points: s.points.map(p => ({ ...p, y: p.y + dy })) });
            }
          });
          ctx.restore();
          ctx.save();
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 1.5 / viewRef.current.scale;
          ctx.setLineDash([6 / viewRef.current.scale, 4 / viewRef.current.scale]);
          ctx.beginPath();
          ctx.moveTo(-9999, state.y);
          ctx.lineTo(9999, state.y);
          ctx.stroke();
          ctx.restore();
        }
        return;
      }

      if (selectModeRef.current) {
        const world = toWorld(screen.x, screen.y);
        const mode = selectModeRef.current;
        if (mode.kind === 'rect') {
          mode.current = world;
        } else if (mode.kind === 'move') {
          const dx = world.x - mode.lastWorld.x;
          const dy = world.y - mode.lastWorld.y;
          mode.lastWorld = world;
          strokesRef.current = strokesRef.current.map((s, i) =>
            selectedRef.current.has(i)
              ? { ...s, points: s.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) }
              : s
          );
        } else if (mode.kind === 'resize') {
          // Scale is always computed from the fixed anchor (opposite corner)
          // against the ORIGINAL snapshot, not incrementally — avoids drift
          // and makes dragging past the anchor cleanly mirror the shape.
          const denomX = mode.originalCorner.x - mode.anchor.x || 1;
          const denomY = mode.originalCorner.y - mode.anchor.y || 1;
          const scaleX = (world.x - mode.anchor.x) / denomX;
          const scaleY = (world.y - mode.anchor.y) / denomY;
          const avgScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
          strokesRef.current = strokesRef.current.map((s, i) => {
            const snap = mode.snapshot.get(i);
            if (!snap) return s;
            return {
              ...s,
              points: snap.points.map(p => ({
                ...p,
                x: mode.anchor.x + (p.x - mode.anchor.x) * scaleX,
                y: mode.anchor.y + (p.y - mode.anchor.y) * scaleY,
              })),
              width: Math.max(0.5, snap.width * avgScale),
              fontSize: snap.fontSize != null ? Math.max(4, snap.fontSize * avgScale) : snap.fontSize,
            };
          });
        } else if (mode.kind === 'rotate') {
          const currentAngle = Math.atan2(world.y - mode.center.y, world.x - mode.center.x);
          const delta = currentAngle - mode.startAngle;
          const cos = Math.cos(delta), sin = Math.sin(delta);
          strokesRef.current = strokesRef.current.map((s, i) => {
            const snap = mode.snapshot.get(i);
            if (!snap) return s;
            return {
              ...s,
              points: snap.map(p => {
                const dx = p.x - mode.center.x;
                const dy = p.y - mode.center.y;
                return { ...p, x: mode.center.x + dx * cos - dy * sin, y: mode.center.y + dx * sin + dy * cos };
              }),
            };
          });
        }
        redrawAll();
        return;
      }

      if (!activeStrokeRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      const world = toWorld(screen.x, screen.y);
      const pressure = e.pointerType === 'pen' ? (e.pressure > 0 ? e.pressure : 0.5) : e.pointerType === 'touch' ? 0.6 : 0.5;
      const stroke = activeStrokeRef.current;
      const prevPoint = stroke.points[stroke.points.length - 1];

      // Light exponential smoothing on the raw position (not just pressure)
      // before it's stored — mouse/trackpad input is noisier than a real
      // stylus, and this knocks down that jitter before the spline ever sees
      // it, closer to what a prediction/smoothing input model gives you for
      // free. Skipped for erasing, where lag would feel wrong.
      const point: DrawPoint = stroke.isEraser
        ? { x: world.x, y: world.y, pressure }
        : { x: prevPoint.x * 0.28 + world.x * 0.72, y: prevPoint.y * 0.28 + world.y * 0.72, pressure };
      stroke.points.push(point);

      // Redraw from scratch each move instead of hand-rolling an incremental
      // curve: strokePath is then the ONE place that defines what a stroke
      // looks like, live or finished, so there's no risk of the live preview
      // drifting from the committed render (the select/shape/vspace tools
      // already redraw fully on every move — this just matches that).
      redrawAll();
      applyTransform(ctx);
      if (stroke.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
        ctx.strokeStyle = stroke.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = stroke.width;
        strokePath(ctx, stroke.points);
        return;
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = stroke.opacity ?? 1;
      ctx.fillStyle = stroke.color;
      ctx.fill(buildFreehandPath(stroke.points, stroke.width, stroke.penType, stroke.simulatePressure ?? false));
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // React attaches onWheel as a passive listener, which can't call
      // preventDefault; a native listener is required to stop page scroll.
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        if (e.ctrlKey || e.metaKey) {
          // Trackpad pinch (reported as ctrl+wheel) or Ctrl+scroll: zoom around the cursor.
          setScaleAround(viewRef.current.scale * (1 - e.deltaY * 0.01), screenX, screenY);
          return;
        }

        viewRef.current = { ...viewRef.current, x: viewRef.current.x - e.deltaX, y: viewRef.current.y - e.deltaY };
        redrawAll();
      };

      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const finishPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === 'pen') penActiveRef.current = false;
      pointersRef.current.delete(e.pointerId);

      if (gestureRef.current && pointersRef.current.size < 2) {
        gestureRef.current = null;
      }
      if (panPointerRef.current?.id === e.pointerId) {
        panPointerRef.current = null;
      }

      if (shapeStartRef.current) {
        const start = shapeStartRef.current;
        const screen = getScreenPoint(e);
        const end = applyShapeConstraint(start, toWorld(screen.x, screen.y), shapeTypeRef.current, e.shiftKey);
        shapeStartRef.current = null;
        const dist = Math.hypot(end.x - start.x, end.y - start.y);
        if (dist > 2 / viewRef.current.scale) {
          const shapeStroke: DrawStroke = {
            points: [{ ...start, pressure: 1 }, { ...end, pressure: 1 }],
            color: colorRef.current,
            width: penWidthRef.current / viewRef.current.scale,
            opacity: opacityRef.current,
            shapeType: shapeTypeRef.current,
          };
          pushHistory();
          strokesRef.current = [...strokesRef.current, shapeStroke];
          onChange?.(strokesRef.current);
          forceRender(n => n + 1);
        }
        redrawAll();
        return;
      }

      if (activeLaserRef.current) {
        laserStrokesRef.current = [...laserStrokesRef.current, activeLaserRef.current];
        activeLaserRef.current = null;
        ensureLaserLoop();
        return;
      }

      if (vspaceStartRef.current) {
        const state = vspaceStartRef.current;
        const dy = state.lastDy;
        vspaceStartRef.current = null;
        if (Math.abs(dy) > 1 / viewRef.current.scale) {
          pushHistory();
          strokesRef.current = strokesRef.current.map(s => {
            const b = elementBounds(s);
            return b.minY >= state.y ? { ...s, points: s.points.map(p => ({ ...p, y: p.y + dy })) } : s;
          });
          onChange?.(strokesRef.current);
          forceRender(n => n + 1);
        }
        redrawAll();
        return;
      }

      if (selectModeRef.current) {
        const mode = selectModeRef.current;
        if (mode.kind === 'rect') {
          const sel = {
            minX: Math.min(mode.start.x, mode.current.x),
            minY: Math.min(mode.start.y, mode.current.y),
            maxX: Math.max(mode.start.x, mode.current.x),
            maxY: Math.max(mode.start.y, mode.current.y),
          };
          const hasDragged = sel.maxX - sel.minX > 2 / viewRef.current.scale || sel.maxY - sel.minY > 2 / viewRef.current.scale;
          const next = new Set<number>();
          if (hasDragged) {
            strokesRef.current.forEach((s, i) => {
              if (rectsIntersect(sel, elementBounds(s))) next.add(i);
            });
          }
          selectedRef.current = next;
          onSelectionChange?.(next.size);
        } else {
          // A move/resize/rotate just finished — strokes were already
          // transformed live during pointermove.
          onChange?.(strokesRef.current);
        }
        selectModeRef.current = null;
        redrawAll();
        forceRender(n => n + 1);
        return;
      }

      if (pointersRef.current.size === 0 && activeStrokeRef.current) {
        pushHistory();
        strokesRef.current = [...strokesRef.current, activeStrokeRef.current];
        activeStrokeRef.current = null;
        // Do one full redraw so the finished stroke matches exactly what it
        // will look like every time after.
        redrawAll();
        onChange?.(strokesRef.current);
        forceRender(n => n + 1);
      }
    };

    // Polygon/polyline vertices are built up over several discrete clicks
    // (handlePointerDown above) rather than a single drag — finished either
    // by clicking back near the first vertex (polygon only) or by double-click.
    const finishPolygon = () => {
      const pts = polygonPointsRef.current;
      polygonPointsRef.current = null;
      if (!pts || pts.length < 2) {
        redrawAll();
        return;
      }
      pushHistory();
      const newShape: DrawStroke = {
        points: pts.map(p => ({ x: p.x, y: p.y, pressure: 1 })),
        color: colorRef.current,
        width: penWidthRef.current / viewRef.current.scale,
        opacity: opacityRef.current,
        shapeType: shapeTypeRef.current,
      };
      strokesRef.current = [...strokesRef.current, newShape];
      onChange?.(strokesRef.current);
      redrawAll();
      forceRender(n => n + 1);
    };

    // Shared by every place that closes a text editor (blur, tool switch,
    // opening a different one) — pulled out so a new editor opened while one
    // is already in progress can commit the old one first instead of just
    // overwriting its state and silently discarding whatever was typed.
    // Runs as a plain function call, never inside a setState updater: React
    // invokes updater functions twice in dev/StrictMode to check purity,
    // which would double-insert the stroke since this has side effects.
    const applyTextCommit = (current: TextEditorState) => {
      const trimmed = current.value;
      if (trimmed.trim().length === 0) {
        if (current.editingIndex != null) {
          pushHistory();
          strokesRef.current = strokesRef.current.filter((_, i) => i !== current.editingIndex);
          redrawAll();
          onChange?.(strokesRef.current);
          forceRender(n => n + 1);
        }
        return;
      }
      pushHistory();
      if (current.editingIndex != null) {
        strokesRef.current = strokesRef.current.map((s, i) => (i === current.editingIndex ? { ...s, text: trimmed } : s));
      } else {
        const newEl: DrawStroke = {
          points: [{ x: current.world.x, y: current.world.y, pressure: 1 }],
          color: colorRef.current,
          width: 1,
          opacity: opacityRef.current,
          kind: 'text',
          text: trimmed,
          fontSize: 22 / viewRef.current.scale,
        };
        strokesRef.current = [...strokesRef.current, newEl];
      }
      redrawAll();
      onChange?.(strokesRef.current);
      forceRender(n => n + 1);
    };

    const commitTextEditor = () => {
      const current = textEditorRef.current;
      if (!current) return;
      applyTextCommit(current);
      updateTextEditor(null);
    };

    const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (polygonPointsRef.current) {
        finishPolygon();
        return;
      }
      if (toolRef.current !== 'select') return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const world = toWorld(screen.x, screen.y);
      const idx = strokesRef.current.findIndex(s => {
        if (s.kind !== 'text') return false;
        const b = elementBounds(s);
        return world.x >= b.minX && world.x <= b.maxX && world.y >= b.minY && world.y <= b.maxY;
      });
      if (idx === -1) return;
      const el = strokesRef.current[idx];
      const v = viewRef.current;
      const p = el.points[0];
      if (textEditorRef.current) applyTextCommit(textEditorRef.current);
      updateTextEditor({
        screenX: p.x * v.scale + v.x,
        screenY: p.y * v.scale + v.y,
        world: { x: p.x, y: p.y },
        value: el.text ?? '',
        editingIndex: idx,
        fontSizeScreen: (el.fontSize ?? 22) * v.scale,
      });
    };

    return (
      <div ref={containerRef} className="w-full h-full relative">
        <canvas
          ref={canvasRef}
          className={`w-full h-full touch-none rounded-[24px] shadow-inner ${
            tool === 'move' ? 'cursor-grab' :
            tool === 'select' ? 'cursor-default' :
            tool === 'text' ? 'cursor-text' :
            tool === 'vspace' ? 'cursor-row-resize' :
            'cursor-crosshair'
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          onDoubleClick={handleDoubleClick}
        />
        {textEditor && (
          <textarea
            autoFocus
            value={textEditor.value}
            onChange={e => updateTextEditor(textEditorRef.current ? { ...textEditorRef.current, value: e.target.value } : null)}
            onBlur={commitTextEditor}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                e.preventDefault();
                updateTextEditor(null);
              }
            }}
            style={{
              position: 'absolute',
              left: textEditor.screenX,
              top: textEditor.screenY,
              fontSize: textEditor.fontSizeScreen,
              color: colorRef.current,
              background: 'rgba(255,255,255,0.85)',
              border: '1.5px dashed #F59E0B',
              borderRadius: 4,
              outline: 'none',
              resize: 'none',
              minWidth: 80,
              minHeight: textEditor.fontSizeScreen * 1.4,
              padding: 2,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: 1.25,
              zIndex: 20,
            }}
          />
        )}
      </div>
    );
  }
);

export default NoteCanvas;
