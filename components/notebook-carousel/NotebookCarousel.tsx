import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './notebook-carousel.css';

export interface CarouselNotebook {
  id: string;
  name: string;
  color?: string;
  questionCount: number;
  /** Percentual de acertos (0-100) ou null quando o caderno ainda não tem tentativas. */
  accuracy: number | null;
}

interface NotebookCarouselProps {
  notebooks: CarouselNotebook[];
  /** Caderno que fica aberto no meio ao montar (ex.: o último aberto). */
  initialId?: string | null;
  onOpen: (id: string) => void;
  onEdit?: (id: string) => void;
  onMove?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// Capas antigas foram salvas com cores vivas; mostra na paleta terrosa do app (mesmo mapa do StudyBook3D).
const EARTHY: Record<string, string> = {
  '#f97316': '#d9772b', '#3b82f6': '#2e4a54', '#ef4444': '#a94432', '#22c55e': '#446b4e', '#10b981': '#446b4e',
  '#8b5cf6': '#725442', '#a855f7': '#725442', '#eab308': '#d8a53a', '#f59e0b': '#d8a53a', '#ec4899': '#d98b7b',
  '#14b8a6': '#446b4e', '#06b6d4': '#2e4a54', '#6366f1': '#2e4a54',
};
const toEarthy = (hex: string) => EARTHY[hex.toLowerCase()] ?? hex;

const inkFor = (hex: string) => {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '#fffaf0';
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const luminance = channels
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  return luminance > 0.42 ? '#3b2a20' : '#fffaf0';
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const questionsLabel = (n: number) => `${n} ${n === 1 ? 'questão' : 'questões'}`;

type Drag = { x: number; p: number; moved: number; lastX: number; lastT: number; v: number; index: number | null };

/**
 * Seleção de cadernos em carrossel 3D: o caderno do meio fica aberto; arrastar abre o próximo e fecha o anterior.
 * "Abrir caderno" faz a página da direita crescer até a tela e então chama onOpen.
 */
const NotebookCarousel: React.FC<NotebookCarouselProps> = ({ notebooks, initialId, onOpen, onEdit, onMove, onDelete }) => {
  const N = notebooks.length;
  const startIndex = Math.max(0, notebooks.findIndex((n) => n.id === initialId));
  const [active, setActive] = useState(startIndex);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const coverRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pos = useRef(startIndex);
  const target = useRef(startIndex);
  const raf = useRef(0);
  const busy = useRef(false);
  const drag = useRef<Drag | null>(null);
  const reduce = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);

  const render = useCallback(() => {
    const first = itemRefs.current[0];
    const w = first?.offsetWidth || 220; // largura de layout: não muda com a transformação 3D
    itemRefs.current.forEach((it, i) => {
      const cover = coverRefs.current[i];
      if (!it || !cover) return;
      const d = i - pos.current;
      const a = Math.abs(d);
      const s = d < 0 ? -1 : 1;
      const o = clamp(1 - a, 0, 1);
      const oe = o * o * (3 - 2 * o);
      const x = s * w * 1.9 * Math.min(a, 1) + s * w * 0.75 * Math.max(0, a - 1) + oe * w * 0.5; // vizinhos fecham fora do livro aberto
      const ry = -clamp(d, -1.3, 1.3) * 34 * (1 - oe);
      const z = -Math.min(a, 3) * 90;
      it.style.transform = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${ry.toFixed(1)}deg) scale(${(1 + oe * 0.05).toFixed(3)})`;
      cover.style.transform = `rotateY(${(-168 * oe).toFixed(1)}deg)`;
      it.style.setProperty('--nc-open', oe.toFixed(3));
      it.style.setProperty('--nc-dim', (Math.min(a, 1) * 0.38).toFixed(3));
      it.style.setProperty('--nc-sx', `${(50 + d * 70 + ry * 0.6).toFixed(1)}%`);
      it.style.zIndex = String(100 - Math.round(a * 10));
      it.tabIndex = Math.round(pos.current) === i ? 0 : -1;
    });
    const cur = clamp(Math.round(pos.current), 0, N - 1);
    setActive((prev) => (prev === cur ? prev : cur));
  }, [N]);

  useEffect(() => {
    // lista mudou (apagou/moveu caderno): mantém a posição dentro dos limites
    pos.current = clamp(pos.current, 0, Math.max(0, N - 1));
    target.current = clamp(Math.round(pos.current), 0, Math.max(0, N - 1));
    pos.current = target.current;
    render();
  }, [N, render]);

  // Tela fixa: o carrossel ocupa exatamente o espaço que sobra no painel rolável e o painel não rola enquanto ele estiver na tela.
  // Se a janela for baixa demais para caber (menos de 440 px), mantém a rolagem normal.
  useEffect(() => {
    let scroller: HTMLElement | null = rootRef.current?.parentElement ?? null;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    const previousOverflow = scroller ? scroller.style.overflowY : '';
    const fit = () => {
      const el = rootRef.current;
      if (!el) return;
      if (scroller) scroller.style.overflowY = previousOverflow; // mede com a rolagem original
      const box = scroller ?? document.documentElement;
      const boxTop = scroller ? scroller.getBoundingClientRect().top : 0;
      const offset = el.getBoundingClientRect().top - boxTop + (scroller ? scroller.scrollTop : 0);
      const room = box.clientHeight - offset - 20;
      el.style.height = `${Math.max(440, room)}px`;
      if (scroller && room >= 440) { scroller.scrollTop = 0; scroller.style.overflowY = 'hidden'; }
      render();
    };
    fit();
    const t = window.setTimeout(fit, 350); // depois que o layout da página assenta
    window.addEventListener('resize', fit);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', fit);
      if (scroller) scroller.style.overflowY = previousOverflow;
    };
  }, [render]);

  useEffect(() => {
    const onResize = () => render();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf.current); };
  }, [render]);

  const animateTo = useCallback((to: number) => {
    target.current = clamp(Math.round(to), 0, N - 1);
    cancelAnimationFrame(raf.current);
    if (reduce) { pos.current = target.current; render(); return; }
    const from = pos.current;
    const t0 = performance.now();
    const dur = 520 + Math.min(Math.abs(target.current - from), 2) * 120;
    const tick = (t: number) => {
      const p = clamp((t - t0) / dur, 0, 1);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      pos.current = from + (target.current - from) * e;
      render();
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [N, reduce, render]);

  const go = useCallback((i: number) => { if (!busy.current) animateTo(i); }, [animateTo]);
  const settled = () => Math.abs(pos.current - Math.round(pos.current)) < 0.02;

  /** A página da direita do livro aberto cresce até a tela; ao cobrir tudo, abre o caderno. */
  const enter = useCallback((i: number) => {
    const nb = notebooks[i];
    if (!nb || busy.current || !settled()) return;
    if (reduce) { onOpen(nb.id); return; }
    const pages = itemRefs.current[i]?.querySelector('.nc-pages');
    if (!pages) { onOpen(nb.id); return; }
    busy.current = true;
    const r = pages.getBoundingClientRect();
    // overlay fora do React: sobrevive à troca de tela e some com fade depois que o caderno abre
    const fly = document.createElement('div');
    fly.className = 'nc-fly';
    fly.style.cssText = `top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px`;
    const title = document.createElement('div');
    title.className = 'nc-fly-title';
    title.textContent = nb.name;
    fly.appendChild(title);
    document.body.appendChild(fly);
    void fly.offsetWidth;
    fly.classList.add('is-full');
    window.setTimeout(() => {
      onOpen(nb.id);
      window.setTimeout(() => { fly.classList.add('is-out'); window.setTimeout(() => fly.remove(), 450); }, 280);
    }, 680);
    window.setTimeout(() => { busy.current = false; }, 700);
  }, [notebooks, onOpen, reduce]);

  const tap = (i: number) => { if (i === Math.round(pos.current)) enter(i); else go(i); };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (busy.current) return;
    const el = (e.target as HTMLElement).closest('[data-nc-index]') as HTMLElement | null;
    drag.current = { x: e.clientX, p: pos.current, moved: 0, lastX: e.clientX, lastT: performance.now(), v: 0, index: el ? Number(el.dataset.ncIndex) : null };
    cancelAnimationFrame(raf.current);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const w = itemRefs.current[0]?.offsetWidth || 220;
    const dx = e.clientX - d.x;
    d.moved = Math.max(d.moved, Math.abs(dx));
    const now = performance.now();
    d.v = 0.8 * d.v + 0.2 * ((e.clientX - d.lastX) / Math.max(1, now - d.lastT));
    d.lastX = e.clientX;
    d.lastT = now;
    if (d.moved > 6) stageRef.current?.classList.add('is-dragging');
    pos.current = clamp(d.p - dx / (w * 1.3), -0.25, N - 0.75);
    render();
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    stageRef.current?.classList.remove('is-dragging');
    const w = itemRefs.current[0]?.offsetWidth || 220;
    if (d.moved < 6) { if (d.index != null) tap(d.index); else animateTo(pos.current); return; }
    animateTo(pos.current - (d.v * 300) / (w * 1.3));
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      if (busy.current) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 24) { e.preventDefault(); go(target.current + (e.deltaX > 0 ? 1 : -1)); }
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [go]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(target.current + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(target.current - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(N - 1); }
  };

  if (N === 0) return null;
  const current = notebooks[clamp(active, 0, N - 1)];

  return (
    <section ref={rootRef} className="nc-root" aria-roledescription="carrossel de cadernos" aria-label="Seus cadernos" onKeyDown={onKeyDown}>
      <div
        ref={stageRef}
        className="nc-stage"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="nc-track">
          {notebooks.map((nb, i) => {
            const color = toEarthy(nb.color || '#f97316');
            const meta = nb.accuracy == null ? questionsLabel(nb.questionCount) : `${questionsLabel(nb.questionCount)} · ${nb.accuracy}% de acertos`;
            return (
              <button
                key={nb.id}
                ref={(el) => { itemRefs.current[i] = el; }}
                type="button"
                className="nc-nb"
                data-nc-index={i}
                aria-label={`Caderno ${nb.name}, ${meta}`}
                aria-current={i === active ? 'true' : undefined}
                style={{ '--nc-c': color, '--nc-ink': inkFor(color) } as React.CSSProperties}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); tap(i); } }}
              >
                <span className="nc-shadow" />
                <span className="nc-book">
                  <span className="nc-board" />
                  <span className="nc-edge nc-e-l" /><span className="nc-edge nc-e-r" /><span className="nc-edge nc-e-b" /><span className="nc-edge nc-e-t" />
                  <span className="nc-pages">
                    <span className="nc-page-note">
                      <span className="nc-page-title">{nb.name}</span>
                      <svg className="nc-doodle" viewBox="0 0 120 8" aria-hidden="true"><path d="M2 5 C 20 1, 40 8, 60 4 S 100 2, 118 5" fill="none" stroke="#e96f34" strokeWidth="2.2" strokeLinecap="round" /></svg>
                      <small>{questionsLabel(nb.questionCount)} salvas</small>
                      {nb.accuracy != null && <small className="nc-page-acc">{nb.accuracy}% de acertos</small>}
                    </span>
                    <span className="nc-gutter" /><span className="nc-cast" /><span className="nc-curl" />
                  </span>
                  <span className="nc-ribbon" />
                  <span
                    className="nc-cover"
                    ref={(el) => { coverRefs.current[i] = el; }}
                  >
                    <span className="nc-face nc-front">
                      <span className="nc-stitch" /><span className="nc-band" />
                      <span className="nc-brand"><i />ToDaHORA · Caderno</span>
                      <span className="nc-subject">{nb.name}</span>
                      <span className="nc-meta">{meta}</span>
                    </span>
                    <span className="nc-face nc-back" data-owner="Este caderno é seu" />
                  </span>
                  <span className="nc-dim" />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="nc-foot">
        <div className="nc-info" aria-live="polite">
          <strong>{current.name}</strong>
          <span>{current.accuracy == null ? questionsLabel(current.questionCount) : `${questionsLabel(current.questionCount)} · ${current.accuracy}% de acertos`}</span>
        </div>

        {N <= 12 ? (
          <div className="nc-dots">
            {notebooks.map((nb, i) => (
              <button key={nb.id} type="button" className="nc-dot" aria-label={`Ir para o caderno ${nb.name}`} aria-current={i === active ? 'true' : 'false'} onClick={() => go(i)} />
            ))}
          </div>
        ) : (
          <p className="nc-count">{active + 1} de {N}</p>
        )}

        <div className="nc-controls">
          <div className="nc-actions">
            <button type="button" className="nc-btn" aria-label="Caderno anterior" disabled={active === 0} onClick={() => go(target.current - 1)}>←</button>
            <button type="button" className="nc-btn nc-primary" onClick={() => enter(clamp(Math.round(pos.current), 0, N - 1))}>Abrir caderno</button>
            <button type="button" className="nc-btn" aria-label="Próximo caderno" disabled={active === N - 1} onClick={() => go(target.current + 1)}>→</button>
          </div>

          {(onEdit || onMove || onDelete) && (
            <div className="nc-tools" role="group" aria-label={`Ações do caderno ${current.name}`}>
              {onEdit && (
                <button type="button" className="nc-tool" title="Editar título e cor da capa" aria-label="Editar caderno" onClick={() => onEdit(current.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
                  <span className="nc-tool-label">Editar</span>
                </button>
              )}
              {onMove && (
                <button type="button" className="nc-tool" title="Mover as questões deste caderno" aria-label="Mover questões do caderno" onClick={() => onMove(current.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  <span className="nc-tool-label">Mover questões</span>
                </button>
              )}
              {onDelete && (
                <button type="button" className="nc-tool nc-danger" title="Apagar caderno" aria-label="Apagar caderno" onClick={() => onDelete(current.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  <span className="nc-tool-label">Apagar</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default NotebookCarousel;
