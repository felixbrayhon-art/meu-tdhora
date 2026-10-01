import React, { useEffect, useRef } from 'react';
import { eraseAlong, type DrawingTool, type InkElement, type NotePage, type Point } from '../../services/digital-notebook/model';
import { drawElement, drawPaper } from '../../services/digital-notebook/render';

interface Props {
  page: NotePage;
  tool: DrawingTool;
  color: string;
  width: number;
  zoom: number;
  penOnly: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onChange: (elements: InkElement[]) => void;
  onText: (point: Point) => void;
}
type Gesture = { pointerId: number; previous: Point; element?: InkElement; erased?: InkElement[]; pan?: { x: number; y: number; left: number; top: number } };

export default function NotebookCanvas({ page, tool, color, width, zoom, penOnly, scrollRef, onChange, onText }: Props) {
  const paperRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const draftRef = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef<number>(0);
  const ratio = 2;

  const contextFor = (canvas: HTMLCanvasElement | null) => {
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(ratio, ratio);
    return ctx;
  };
  const paintInk = (elements: InkElement[]) => {
    const ctx = contextFor(inkRef.current);
    if (ctx) elements.forEach(element => drawElement(ctx, element));
  };
  useEffect(() => {
    const ctx = contextFor(paperRef.current);
    if (ctx) drawPaper(ctx, page);
  }, [page.width, page.height, page.paper]);
  useEffect(() => { paintInk(page.elements); }, [page]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const pointAt = (event: { clientX: number; clientY: number; pressure: number; pointerType: string }): Point => {
    const rect = draftRef.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(page.width, (event.clientX - rect.left) * page.width / rect.width)),
      y: Math.max(0, Math.min(page.height, (event.clientY - rect.top) * page.height / rect.height)),
      pressure: event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 0.5 };
  };
  const paintDraft = () => {
    const ctx = contextFor(draftRef.current);
    const current = gesture.current;
    if (ctx && current?.element) drawElement(ctx, current.element);
    if (current?.erased) paintInk(current.erased);
  };
  const schedulePaint = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paintDraft);
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (gesture.current || (event.pointerType === 'mouse' && event.button !== 0) || (penOnly && event.pointerType === 'touch')) return;
    const point = pointAt(event);
    if (tool === 'text') { onText(point); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'hand') {
      const scroller = scrollRef.current;
      gesture.current = { pointerId: event.pointerId, previous: point,
        pan: { x: event.clientX, y: event.clientY, left: scroller?.scrollLeft || 0, top: scroller?.scrollTop || 0 } };
    } else if (tool === 'eraser') {
      gesture.current = { pointerId: event.pointerId, previous: point, erased: eraseAlong(page.elements, point, point, 12 / zoom) };
    } else {
      gesture.current = { pointerId: event.pointerId, previous: point,
        element: { id: crypto.randomUUID(), tool, color, width: tool === 'highlighter' ? width * 5 : width, points: [point] } };
    }
    schedulePaint();
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.pan) {
      const scroller = scrollRef.current;
      if (scroller) {
        scroller.scrollLeft = current.pan.left - event.clientX + current.pan.x;
        scroller.scrollTop = current.pan.top - event.clientY + current.pan.y;
      }
      return;
    }
    const events = event.nativeEvent.getCoalescedEvents?.();
    for (const sample of events?.length ? events : [event.nativeEvent]) {
      const point = pointAt(sample);
      if (current.erased) current.erased = eraseAlong(current.erased, current.previous, point, 12 / zoom);
      else if (current.element) {
        if (['line', 'rectangle', 'ellipse'].includes(current.element.tool)) current.element.points = [current.element.points[0], point];
        else current.element.points.push(point);
      }
      current.previous = point;
    }
    schedulePaint();
  };
  const end = (event: React.PointerEvent<HTMLCanvasElement>, cancelled = false) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!cancelled && !current.pan) move(event);
    cancelAnimationFrame(frame.current);
    gesture.current = null;
    contextFor(draftRef.current);
    if (!cancelled && current.element) onChange([...page.elements, current.element]);
    else if (!cancelled && current.erased && current.erased.length !== page.elements.length) onChange(current.erased);
    else paintInk(page.elements);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const size = { width: Math.ceil(page.width * ratio), height: Math.ceil(page.height * ratio) };
  return (
    <div className="dn-paper" style={{ width: page.width * zoom, height: page.height * zoom }}>
      <canvas ref={paperRef} {...size} aria-hidden="true" />
      {page.background && <img className="dn-page-background" src={page.background} alt={page.sourceName || 'Documento importado'} draggable={false} />}
      <canvas ref={inkRef} {...size} aria-hidden="true" />
      <canvas ref={draftRef} {...size} aria-label="Área de desenho do caderno" data-testid="notebook-canvas"
        style={{ touchAction: penOnly ? 'pan-x pan-y' : 'none', cursor: tool === 'hand' ? 'grab' : tool === 'text' ? 'text' : 'crosshair' }}
        onPointerDown={start} onPointerMove={move} onPointerUp={event => end(event)}
        onPointerCancel={event => end(event, true)} onLostPointerCapture={event => end(event, true)}
        onContextMenu={event => event.preventDefault()} />
    </div>
  );
}
