import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export type InkTool = 'hand' | 'pen' | 'highlighter' | 'eraser';

interface InkStroke {
  tool: 'pen' | 'highlighter';
  color: string;
  width: number;
  // x/y are stored as fractions of the layer width so strokes follow the text when the card resizes.
  points: [number, number, number][];
}

export interface QuestionInkLayerHandle {
  undo: () => void;
  clear: () => void;
}

interface QuestionInkLayerProps {
  storageKey: string;
  // What the Apple Pencil does, and what the mouse does (the mouse only writes while the toolbar is open).
  penTool: InkTool;
  mouseTool: InkTool;
  color: string;
  children: React.ReactNode;
  className?: string;
  onStrokeCountChange?: (count: number) => void;
  onDrawStart?: () => void;
}

const STORAGE_PREFIX = 'tdh_question_ink_v1:';
// A press that moves less than this is a tap: it reaches the alternative underneath.
const TAP_SLOP = 10;
const ERASER_RADIUS = 14;

const loadStrokes = (key: string): InkStroke[] => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStrokes = (key: string, strokes: InkStroke[]) => {
  try {
    if (strokes.length === 0) localStorage.removeItem(STORAGE_PREFIX + key);
    else localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(strokes));
  } catch {
    // Storage full or blocked: the drawing still works for this session.
  }
};

/**
 * Lets the student write over a question like on paper. Fingers never draw (they scroll and
 * tap), the Apple Pencil follows the picked tool, and a short tap still answers the
 * alternative underneath.
 */
const QuestionInkLayer = forwardRef<QuestionInkLayerHandle, QuestionInkLayerProps>(
  ({ storageKey, penTool, mouseTool, color, children, className = '', onStrokeCountChange, onDrawStart }, ref) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<InkStroke[]>([]);
    const activeRef = useRef<{ id: number; stroke: InkStroke | null; erasing: boolean; startX: number; startY: number; tool: Exclude<InkTool, 'hand'> } | null>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const penToolRef = useRef(penTool);
    penToolRef.current = penTool;

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, canvas.height / dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const draw = (s: InkStroke) => {
        const pts = s.points;
        if (pts.length === 0) return;
        ctx.globalAlpha = s.tool === 'highlighter' ? 0.32 : 1;
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
        if (pts.length === 1) {
          ctx.beginPath();
          ctx.arc(pts[0][0] * w, pts[0][1] * w, s.width * (0.4 + pts[0][2]) / 2, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        if (s.tool === 'highlighter') {
          // One path so overlapping segments do not stack up into darker blotches.
          ctx.lineWidth = s.width;
          ctx.beginPath();
          ctx.moveTo(pts[0][0] * w, pts[0][1] * w);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * w, pts[i][1] * w);
          ctx.stroke();
          return;
        }
        // Pen: segment by segment so Pencil pressure changes the line width.
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0, p0] = pts[i - 1];
          const [x1, y1, p1] = pts[i];
          ctx.lineWidth = s.width * (0.4 + (p0 + p1) / 2);
          ctx.beginPath();
          ctx.moveTo(x0 * w, y0 * w);
          ctx.lineTo(x1 * w, y1 * w);
          ctx.stroke();
        }
      };
      strokesRef.current.forEach(draw);
      if (activeRef.current?.stroke) draw(activeRef.current.stroke);
      ctx.globalAlpha = 1;
    }, []);

    const commit = useCallback((next: InkStroke[]) => {
      strokesRef.current = next;
      saveStrokes(storageKey, next);
      onStrokeCountChange?.(next.length);
      redraw();
    }, [storageKey, onStrokeCountChange, redraw]);

    useImperativeHandle(ref, () => ({
      undo: () => commit(strokesRef.current.slice(0, -1)),
      clear: () => commit([]),
    }), [commit]);

    // Each question keeps its own drawing.
    useEffect(() => {
      strokesRef.current = loadStrokes(storageKey);
      activeRef.current = null;
      onStrokeCountChange?.(strokesRef.current.length);
      redraw();
    }, [storageKey, redraw, onStrokeCountChange]);

    useEffect(() => {
      const el = wrapperRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !size.w) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(size.w * dpr);
      canvas.height = Math.round(size.h * dpr);
      redraw();
    }, [size, redraw]);

    // Safari scrolls on Pencil drags unless the move is cancelled. Fingers are left alone,
    // touchstart is not cancelled so a Pencil tap still clicks, and with the hand tool the
    // Pencil scrolls like a finger.
    useEffect(() => {
      const el = wrapperRef.current;
      if (!el) return;
      const stopStylusScroll = (event: TouchEvent) => {
        const touch = event.touches[0] as Touch & { touchType?: string };
        if (touch?.touchType === 'stylus' && penToolRef.current !== 'hand') event.preventDefault();
      };
      el.addEventListener('touchmove', stopStylusScroll, { passive: false });
      return () => el.removeEventListener('touchmove', stopStylusScroll);
    }, []);

    const localPoint = (event: React.PointerEvent): [number, number, number] => {
      const rect = wrapperRef.current!.getBoundingClientRect();
      const w = rect.width || 1;
      const pressure = event.pointerType === 'pen' ? (event.pressure || 0.5) : 0.5;
      return [(event.clientX - rect.left) / w, (event.clientY - rect.top) / w, pressure];
    };

    const eraseAt = (pt: [number, number, number]) => {
      const w = wrapperRef.current?.offsetWidth || 1;
      const r = ERASER_RADIUS / w;
      const keep = strokesRef.current.filter((s) => !s.points.some(([x, y]) => Math.hypot(x - pt[0], y - pt[1]) < r + s.width / w / 2));
      if (keep.length !== strokesRef.current.length) commit(keep);
    };

    const handlePointerDown = (event: React.PointerEvent) => {
      if (event.pointerType === 'touch') return;
      // Sliders, fields and the font-size range keep working normally.
      if ((event.target as HTMLElement).closest('input, select, textarea, [contenteditable="true"]')) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const picked = event.pointerType === 'pen' ? penTool : mouseTool;
      if (picked === 'hand') return;
      const effective = picked;
      activeRef.current = { id: event.pointerId, stroke: null, erasing: effective === 'eraser', startX: event.clientX, startY: event.clientY, tool: effective };
      if (event.pointerType === 'mouse') event.preventDefault();
    };

    const handlePointerMove = (event: React.PointerEvent) => {
      const active = activeRef.current;
      if (!active || active.id !== event.pointerId) return;
      const pt = localPoint(event);
      if (!active.stroke && !active.erasing && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < TAP_SLOP) return;
      if (!wrapperRef.current?.hasPointerCapture(event.pointerId)) {
        // Capturing only after real movement keeps taps landing on the alternative.
        wrapperRef.current?.setPointerCapture(event.pointerId);
      }
      if (active.erasing) {
        eraseAt(pt);
        return;
      }
      if (!active.stroke) {
        onDrawStart?.();
        const startPt = (() => {
          const rect = wrapperRef.current!.getBoundingClientRect();
          return [(active.startX - rect.left) / rect.width, (active.startY - rect.top) / rect.width, pt[2]] as [number, number, number];
        })();
        active.stroke = active.tool === 'highlighter'
          ? { tool: 'highlighter', color: '#f4c430', width: 18, points: [startPt] }
          : { tool: 'pen', color, width: 3, points: [startPt] };
      }
      const coalesced = (event.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
      if (coalesced.length > 1) {
        const rect = wrapperRef.current!.getBoundingClientRect();
        for (const c of coalesced) active.stroke.points.push([(c.clientX - rect.left) / rect.width, (c.clientY - rect.top) / rect.width, c.pointerType === 'pen' ? (c.pressure || 0.5) : 0.5]);
      } else {
        active.stroke.points.push(pt);
      }
      redraw();
    };

    const finish = (event: React.PointerEvent) => {
      const active = activeRef.current;
      if (!active || active.id !== event.pointerId) return;
      activeRef.current = null;
      if (wrapperRef.current?.hasPointerCapture(event.pointerId)) wrapperRef.current.releasePointerCapture(event.pointerId);
      if (active.stroke && active.stroke.points.length > 1) commit([...strokesRef.current, active.stroke]);
      else redraw();
    };

    // A drag ends with a click on the wrapper itself; swallow it so it does not pick an alternative.
    const handleClickCapture = (event: React.MouseEvent) => {
      if (event.target === wrapperRef.current) event.stopPropagation();
    };

    const drawing = mouseTool !== 'hand';

    return (
      <div
        ref={wrapperRef}
        className={`relative ${drawing ? 'select-none' : ''} ${className}`}
        style={{ cursor: mouseTool === 'eraser' ? 'cell' : drawing ? 'crosshair' : undefined, WebkitTouchCallout: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={handleClickCapture}
      >
        {children}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-20"
          style={{ width: size.w, height: size.h }}
        />
      </div>
    );
  },
);

QuestionInkLayer.displayName = 'QuestionInkLayer';

export default QuestionInkLayer;
