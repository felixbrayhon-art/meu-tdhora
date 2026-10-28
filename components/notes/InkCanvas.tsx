import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { InkPage, InkStroke, PenKind, Pt } from '../../services/ink/types';
import { PAGE_SIZES, PAPERS, drawPage, drawStroke } from '../../services/ink/render';
import { eraseWhole, erasePartial, pointsToFlat, recognizeShape, shapeFromDrag, strokeBounds, strokesInLasso, translateStroke, uid } from '../../services/ink/geometry';

export type InkTool = 'pen' | 'eraser' | 'lasso' | 'shape' | 'hand';
export type ShapeKind = 'line' | 'arrow' | 'ellipse' | 'rect' | 'triangle';
export interface ToolState {
  tool: InkTool; kind: PenKind; color: string; width: number; opacity: number;
  eraserMode: 'whole' | 'partial'; eraserSize: number; shape: ShapeKind;
  /** Desenhar com o dedo (sem isso, depois que a Apple Pencil é detectada, o dedo só move e dá zoom). */
  fingerDraws: boolean;
  /** Parar a caneta no fim do traço endireita linhas e formas. */
  holdToShape: boolean;
}

interface Props {
  page: InkPage;
  strokes: InkStroke[];
  tools: ToolState;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  /** Chamado uma vez por gesto concluído, com a lista nova de traços. */
  onCommit: (strokes: InkStroke[]) => void;
  background?: CanvasImageSource | null;
  onScale?: (scale: number) => void;
}

export interface InkCanvasHandle {
  fitWidth: () => void;
  fitPage: () => void;
  zoomBy: (factor: number) => void;
  setScale: (scale: number) => void;
}

const MIN_SCALE = 0.25, MAX_SCALE = 5;
const HOLD_MS = 600;

const InkCanvas = forwardRef<InkCanvasHandle, Props>(({ page, strokes, tools, selectedIds, onSelect, onCommit, background, onScale }, ref) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  const view = useRef({ s: 1, tx: 16, ty: 16 });
  const size = useRef({ w: 800, h: 600, dpr: 1 });
  const work = useRef<InkStroke[]>(strokes);
  const gesture = useRef<{ active: boolean }>({ active: false });
  const cur = useRef<InkStroke | null>(null);
  const shapePreview = useRef<Pt[] | null>(null);
  const lasso = useRef<Pt[] | null>(null);
  const move = useRef<{ ids: Set<string>; sx: number; sy: number; dx: number; dy: number } | null>(null);
  const eraserAt = useRef<Pt | null>(null);
  const erased = useRef(false);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; cx: number; cy: number; s: number; tx: number; ty: number } | null>(null);
  const penSeen = useRef(false);
  const spaceDown = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const snapped = useRef(false);
  const pendingFit = useRef(true);

  const propsRef = useRef({ page, tools, selectedIds, onSelect, onCommit, background, onScale });
  propsRef.current = { page, tools, selectedIds, onSelect, onCommit, background, onScale };

  const isDark = () => PAPERS[propsRef.current.page.paper].dark;

  const applyView = (ctx: CanvasRenderingContext2D) => {
    const { s, tx, ty } = view.current, d = size.current.dpr;
    ctx.setTransform(d * s, 0, 0, d * s, d * tx, d * ty);
  };

  const redrawBase = useCallback(() => {
    const canvas = baseRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { dpr } = size.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const p = propsRef.current.page, dims = PAGE_SIZES[p.size];
    applyView(ctx);
    ctx.save();
    ctx.shadowColor = 'rgba(40, 28, 18, 0.28)'; ctx.shadowBlur = 16 * dpr; ctx.shadowOffsetY = 3;
    ctx.fillStyle = PAPERS[p.paper].bg; ctx.fillRect(0, 0, dims.w, dims.h);
    ctx.restore();
    const moving = move.current?.ids;
    const visible = moving ? work.current.filter((s) => !moving.has(s.id)) : work.current;
    drawPage(ctx, p, visible, propsRef.current.background);
  }, []);

  const redrawLive = useCallback(() => {
    const canvas = liveRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyView(ctx);
    const { s } = view.current;
    const dims = PAGE_SIZES[propsRef.current.page.size];
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, dims.w, dims.h); ctx.clip();
    if (cur.current) drawStroke(ctx, cur.current, isDark(), true);
    if (shapePreview.current) {
      const t = propsRef.current.tools;
      drawStroke(ctx, { id: 'preview', kind: t.kind, color: t.color, width: t.width, opacity: t.opacity, points: pointsToFlat(shapePreview.current), straight: true }, isDark(), true);
    }
    const m = move.current;
    if (m) {
      for (const st of work.current) if (m.ids.has(st.id)) drawStroke(ctx, translateStroke(st, m.dx, m.dy), isDark());
    }
    ctx.restore();

    const ids = m ? [...m.ids] : propsRef.current.selectedIds;
    if (ids.length) {
      const set = new Set(ids);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const st of work.current) if (set.has(st.id)) { const b = strokeBounds(st); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
      if (x0 !== Infinity) {
        const dx = m?.dx ?? 0, dy = m?.dy ?? 0;
        ctx.save(); ctx.strokeStyle = '#2f80ed'; ctx.fillStyle = 'rgba(47,128,237,0.08)'; ctx.lineWidth = 1.5 / s; ctx.setLineDash([6 / s, 4 / s]);
        ctx.fillRect(x0 + dx, y0 + dy, x1 - x0, y1 - y0); ctx.strokeRect(x0 + dx, y0 + dy, x1 - x0, y1 - y0); ctx.restore();
      }
    }
    if (lasso.current && lasso.current.length > 1) {
      ctx.save(); ctx.strokeStyle = '#2f80ed'; ctx.lineWidth = 1.5 / s; ctx.setLineDash([5 / s, 4 / s]);
      ctx.beginPath(); lasso.current.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.restore();
    }
    if (eraserAt.current && propsRef.current.tools.tool === 'eraser') {
      ctx.save(); ctx.strokeStyle = isDark() ? '#f4ebdd' : '#473c33'; ctx.lineWidth = 1.2 / s;
      ctx.beginPath(); ctx.arc(eraserAt.current.x, eraserAt.current.y, propsRef.current.tools.eraserSize, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }, []);

  const redrawAll = useCallback(() => { redrawBase(); redrawLive(); }, [redrawBase, redrawLive]);

  const setView = (s: number, tx: number, ty: number, notify = true) => {
    const dims = PAGE_SIZES[propsRef.current.page.size], { w, h } = size.current;
    const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
    // Mantém ao menos um pedaço da página à vista.
    const minTx = 80 - dims.w * ns, maxTx = w - 80, minTy = 80 - dims.h * ns, maxTy = h - 80;
    view.current = { s: ns, tx: Math.min(maxTx, Math.max(minTx, tx)), ty: Math.min(maxTy, Math.max(minTy, ty)) };
    redrawAll();
    if (notify) propsRef.current.onScale?.(ns);
  };

  const fit = (mode: 'width' | 'page') => {
    const dims = PAGE_SIZES[propsRef.current.page.size], { w, h } = size.current;
    const sw = (w - 32) / dims.w, sh = (h - 32) / dims.h;
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, mode === 'width' ? sw : Math.min(sw, sh)));
    setView(s, (w - dims.w * s) / 2, mode === 'width' ? 16 : (h - dims.h * s) / 2);
  };

  useImperativeHandle(ref, () => ({
    fitWidth: () => fit('width'),
    fitPage: () => fit('page'),
    zoomBy: (f) => { const { w, h } = size.current, v = view.current, ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s * f)); const k = ns / v.s; setView(ns, w / 2 - (w / 2 - v.tx) * k, h / 2 - (h / 2 - v.ty) * k); },
    setScale: (sc) => { const { w, h } = size.current, v = view.current, k = sc / v.s; setView(sc, w / 2 - (w / 2 - v.tx) * k, h / 2 - (h / 2 - v.ty) * k); },
  }));

  // Tamanho do canvas acompanha o contêiner e a densidade de pixels da tela.
  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 3);
      size.current = { w: rect.width, h: rect.height, dpr };
      for (const c of [baseRef.current, liveRef.current]) if (c) { c.width = Math.max(1, Math.round(rect.width * dpr)); c.height = Math.max(1, Math.round(rect.height * dpr)); }
      if (pendingFit.current && rect.width > 50) { pendingFit.current = false; fit('width'); } else redrawAll();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redrawAll]);

  // Página nova: enquadra na largura.
  useEffect(() => { if (size.current.w > 50) fit('width'); else pendingFit.current = true; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page.id, page.size]);

  useEffect(() => { if (!gesture.current.active) { work.current = strokes; redrawAll(); } }, [strokes, page.template, page.paper, background, redrawAll]);
  useEffect(() => { redrawLive(); }, [selectedIds, tools.tool, tools.eraserSize, redrawLive]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { spaceDown.current = true; } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ---- Ponteiro ----
  useEffect(() => {
    const live = liveRef.current; if (!live) return;

    const toPage = (e: { clientX: number; clientY: number }): Pt => {
      const r = live.getBoundingClientRect(), { s, tx, ty } = view.current;
      return { x: (e.clientX - r.left - tx) / s, y: (e.clientY - r.top - ty) / s };
    };
    const local = (e: { clientX: number; clientY: number }) => { const r = live.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const clearHold = () => { if (holdTimer.current !== null) { window.clearTimeout(holdTimer.current); holdTimer.current = null; } };
    const pressureOf = (e: PointerEvent) => (e.pointerType === 'pen' ? Math.max(0.05, e.pressure || 0.5) : 0.5);

    const eraseAt = (p: Pt) => {
      const t = propsRef.current.tools, r = t.eraserSize;
      if (t.eraserMode === 'whole') {
        const ids = new Set(eraseWhole(work.current, p.x, p.y, r));
        if (ids.size) { work.current = work.current.filter((s) => !ids.has(s.id)); erased.current = true; redrawBase(); }
      } else {
        let changed = false; const next: InkStroke[] = [];
        for (const s of work.current) { const pieces = erasePartial(s, p.x, p.y, r, uid); if (pieces) { next.push(...pieces); changed = true; } else next.push(s); }
        if (changed) { work.current = next; erased.current = true; redrawBase(); }
      }
    };

    const finishStroke = () => {
      clearHold();
      const s = cur.current ? { ...cur.current, points: cur.current.points.slice() } : null;
      cur.current = null; shapePreview.current = null;
      if (s) {
        if (s.points.length < 6) s.points = [s.points[0], s.points[1], s.points[2], s.points[0] + 0.01, s.points[1], s.points[2]];
        work.current = [...work.current, s];
        propsRef.current.onCommit(work.current);
      }
      redrawBase(); redrawLive();
    };

    const navigationOnly = (e: PointerEvent) => {
      const t = propsRef.current.tools;
      if (t.tool === 'hand') return true;
      if (e.pointerType === 'mouse') return e.button === 1 || spaceDown.current;
      if (e.pointerType === 'touch') return penSeen.current && !t.fingerDraws;
      return false;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'pen') penSeen.current = true;
      if (e.pointerType === 'mouse' && e.button === 2) return;
      e.preventDefault();
      live.setPointerCapture?.(e.pointerId);

      if (e.pointerType === 'touch') {
        touches.current.set(e.pointerId, local(e));
        if (touches.current.size >= 2) {
          // Segundo dedo: cancela o traço em andamento e passa a dar zoom/mover.
          clearHold(); cur.current = null; shapePreview.current = null; lasso.current = null; move.current = null; gesture.current.active = false;
          const [a, b] = [...touches.current.values()];
          pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, s: view.current.s, tx: view.current.tx, ty: view.current.ty };
          pan.current = null; redrawLive(); return;
        }
      }
      if (navigationOnly(e)) { pan.current = local(e); gesture.current.active = true; return; }

      const t = propsRef.current.tools, p = toPage(e);
      gesture.current.active = true; snapped.current = false;

      if (t.tool === 'pen') {
        cur.current = { id: uid(), kind: t.kind, color: t.color, width: t.width, opacity: t.opacity, points: [p.x, p.y, pressureOf(e)] };
        redrawLive();
        if (t.holdToShape) holdTimer.current = window.setTimeout(snap, HOLD_MS);
      } else if (t.tool === 'eraser') {
        erased.current = false; eraserAt.current = p; eraseAt(p); redrawLive();
      } else if (t.tool === 'shape') {
        shapePreview.current = shapeFromDrag(t.shape, p, p); startShape.current = p; redrawLive();
      } else if (t.tool === 'lasso') {
        const sel = propsRef.current.selectedIds;
        if (sel.length) {
          const set = new Set(sel); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const st of work.current) if (set.has(st.id)) { const b = strokeBounds(st); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
          if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) { move.current = { ids: set, sx: p.x, sy: p.y, dx: 0, dy: 0 }; redrawBase(); redrawLive(); return; }
          propsRef.current.onSelect([]);
        }
        lasso.current = [p]; redrawLive();
      }
    };

    const startShape = { current: null as Pt | null };

    function snap() {
      holdTimer.current = null;
      const s = cur.current; if (!s || snapped.current) return;
      const pts: Pt[] = []; for (let i = 0; i + 1 < s.points.length; i += 3) pts.push({ x: s.points[i], y: s.points[i + 1] });
      const shape = recognizeShape(pts);
      if (!shape) return;
      snapped.current = true;
      cur.current = { ...s, points: pointsToFlat(shape.points, 0.5), straight: true };
      redrawLive();
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
        touches.current.set(e.pointerId, local(e));
        if (pinch.current && touches.current.size >= 2) {
          e.preventDefault();
          const [a, b] = [...touches.current.values()], pi = pinch.current;
          const dist = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
          const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pi.s * (dist / (pi.dist || 1)))), k = ns / pi.s;
          setView(ns, cx - (pi.cx - pi.tx) * k, cy - (pi.cy - pi.ty) * k);
          return;
        }
      }
      const t = propsRef.current.tools;
      if (pan.current && gesture.current.active) {
        e.preventDefault();
        const l = local(e), v = view.current;
        setView(v.s, v.tx + (l.x - pan.current.x), v.ty + (l.y - pan.current.y), false);
        pan.current = l; return;
      }
      if (!gesture.current.active) {
        if (t.tool === 'eraser' && e.pointerType !== 'touch') { eraserAt.current = toPage(e); redrawLive(); }
        return;
      }
      e.preventDefault();
      const events = (e.getCoalescedEvents?.() ?? []).length ? e.getCoalescedEvents() : [e];
      if (t.tool === 'pen' && cur.current && !snapped.current) {
        const s = cur.current, k = view.current.s;
        for (const ev of events) {
          const p = toPage(ev), n = s.points.length;
          if (Math.hypot(p.x - s.points[n - 3], p.y - s.points[n - 2]) * k < 0.6) continue;
          s.points.push(p.x, p.y, pressureOf(ev));
        }
        if (t.holdToShape) { clearHold(); holdTimer.current = window.setTimeout(snap, HOLD_MS); }
        redrawLive();
      } else if (t.tool === 'eraser') {
        for (const ev of events) { const p = toPage(ev); eraserAt.current = p; eraseAt(p); }
        redrawLive();
      } else if (t.tool === 'shape' && startShape.current) {
        shapePreview.current = shapeFromDrag(t.shape, startShape.current, toPage(e)); redrawLive();
      } else if (t.tool === 'lasso') {
        const p = toPage(e);
        if (move.current) { move.current.dx = p.x - move.current.sx; move.current.dy = p.y - move.current.sy; redrawLive(); }
        else if (lasso.current) { lasso.current.push(p); redrawLive(); }
      }
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        touches.current.delete(e.pointerId);
        if (pinch.current) { if (touches.current.size < 2) { pinch.current = null; gesture.current.active = false; pan.current = null; } return; }
      }
      if (!gesture.current.active) return;
      gesture.current.active = false;
      if (pan.current) { pan.current = null; propsRef.current.onScale?.(view.current.s); return; }
      const t = propsRef.current.tools;
      if (t.tool === 'pen') finishStroke();
      else if (t.tool === 'eraser') {
        eraserAt.current = e.pointerType === 'touch' ? null : eraserAt.current;
        if (erased.current) { erased.current = false; propsRef.current.onCommit(work.current); }
        redrawLive();
      } else if (t.tool === 'shape') {
        const pts = shapePreview.current; shapePreview.current = null; startShape.current = null;
        if (pts && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) + (pts.length > 2 ? 1 : 0) > 3) {
          work.current = [...work.current, { id: uid(), kind: t.kind, color: t.color, width: t.width, opacity: t.opacity, points: pointsToFlat(pts), straight: true }];
          propsRef.current.onCommit(work.current);
        }
        redrawBase(); redrawLive();
      } else if (t.tool === 'lasso') {
        if (move.current) {
          const m = move.current; move.current = null;
          if (Math.abs(m.dx) + Math.abs(m.dy) > 0.5) { work.current = work.current.map((s) => (m.ids.has(s.id) ? translateStroke(s, m.dx, m.dy) : s)); propsRef.current.onCommit(work.current); }
          redrawBase(); redrawLive();
        } else if (lasso.current) {
          const ids = strokesInLasso(work.current, lasso.current); lasso.current = null;
          propsRef.current.onSelect(ids); redrawLive();
        }
      }
    };

    const onLeave = () => { if (!gesture.current.active) { eraserAt.current = null; redrawLive(); } };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = view.current, l = local(e);
      if (e.ctrlKey || e.metaKey) {
        const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s * Math.exp(-e.deltaY * 0.01))), k = ns / v.s;
        setView(ns, l.x - (l.x - v.tx) * k, l.y - (l.y - v.ty) * k);
      } else setView(v.s, v.tx - e.deltaX, v.ty - e.deltaY, false);
    };

    live.addEventListener('pointerdown', onDown);
    live.addEventListener('pointermove', onMove);
    live.addEventListener('pointerup', onUp);
    live.addEventListener('pointercancel', onUp);
    live.addEventListener('pointerleave', onLeave);
    live.addEventListener('wheel', onWheel, { passive: false });
    const noMenu = (e: Event) => e.preventDefault();
    live.addEventListener('contextmenu', noMenu);
    return () => {
      clearHold();
      live.removeEventListener('pointerdown', onDown); live.removeEventListener('pointermove', onMove);
      live.removeEventListener('pointerup', onUp); live.removeEventListener('pointercancel', onUp);
      live.removeEventListener('pointerleave', onLeave); live.removeEventListener('wheel', onWheel); live.removeEventListener('contextmenu', noMenu);
    };
  }, [redrawBase, redrawLive]);

  return (
    <div ref={wrapRef} className="ink-stage">
      <canvas ref={baseRef} className="ink-layer" />
      <canvas ref={liveRef} className="ink-layer ink-live" style={{ touchAction: 'none', cursor: tools.tool === 'hand' ? 'grab' : tools.tool === 'eraser' ? 'none' : 'crosshair' }} />
    </div>
  );
});

export default InkCanvas;
