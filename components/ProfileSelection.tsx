import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from './icons';
import { StudyProfile } from '../types';

interface ProfileSelectionProps {
  initialName?: string;
  onNext: (name: string, profile: StudyProfile) => void;
  onBack?: () => void;
}

// Natural pixel size of onboarding-hero.webp — used to replicate object-fit:
// cover's crop/scale math in JS, so the invisible hotspots stay locked onto
// the "vestibular / concurso / faculdade" buttons already painted into the
// artwork even when the viewport's aspect ratio doesn't match the image's
// (2:1) and the browser crops top/bottom or left/right to fill the screen.
const IMG_W = 2000;
const IMG_H = 1000;

const HOTSPOTS: Array<{ id: StudyProfile; title: string; xf: number; yf: number; wf: number; hf: number }> = [
  { id: 'VESTIBULAR', title: 'Vestibular', xf: 0.227, yf: 0.435, wf: 0.15, hf: 0.17 },
  { id: 'CONCURSO', title: 'Concursos', xf: 0.402, yf: 0.455, wf: 0.145, hf: 0.17 },
  { id: 'FACULDADE', title: 'Faculdade', xf: 0.57, yf: 0.435, wf: 0.15, hf: 0.17 },
];

type Rect = { left: number; top: number; width: number; height: number };

const ProfileSelection: React.FC<ProfileSelectionProps> = ({ initialName, onNext, onBack }) => {
  const [name, setName] = useState(initialName ?? '');
  const [nameError, setNameError] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<StudyProfile | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<Partial<Record<StudyProfile, Rect>>>({});

  useEffect(() => {
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (!cw || !ch) return;
      const scale = Math.max(cw / IMG_W, ch / IMG_H);
      const dispW = IMG_W * scale;
      const dispH = IMG_H * scale;
      const offsetX = (cw - dispW) / 2;
      const offsetY = (ch - dispH) / 2;
      const next: Partial<Record<StudyProfile, Rect>> = {};
      HOTSPOTS.forEach((h) => {
        next[h.id] = {
          left: offsetX + h.xf * dispW,
          top: offsetY + h.yf * dispH,
          width: h.wf * dispW,
          height: h.hf * dispH,
        };
      });
      setRects(next);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  useEffect(() => {
    if (pendingProfile) {
      // Give the overlay a beat to mount before focusing, so the browser
      // doesn't fight the fade-in for scroll/focus position.
      const t = setTimeout(() => nameInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [pendingProfile]);

  const handlePick = (profile: StudyProfile) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setPendingProfile(profile);
      return;
    }
    onNext(trimmed, profile);
  };

  const confirmName = () => {
    const trimmed = name.trim();
    if (!trimmed || !pendingProfile) {
      setNameError(true);
      return;
    }
    onNext(trimmed, pendingProfile);
  };

  return (
    <div id="profile-selection-screen" className="fixed inset-0 z-[110] overflow-hidden animate-in fade-in duration-700" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Full-screen artwork — the only functional UI on top of it is the
          three invisible hotspots aligned to its own painted buttons. */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full">
        <img src="/onboarding-hero.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />

        {HOTSPOTS.map((h) => {
          const rect = rects[h.id];
          if (!rect) return null;
          return (
            <button
              key={h.id}
              onClick={() => handlePick(h.id)}
              aria-label={h.title}
              className="group absolute rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-white/70 transition-transform hover:scale-[1.03] active:scale-95"
              style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
            >
              <span className="absolute inset-0 rounded-2xl bg-white/0 group-hover:bg-white/15 transition-colors" />
            </button>
          );
        })}
      </div>

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 md:px-10 pt-5 md:pt-7">
        {onBack ? (
          <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 rounded-2xl text-white/80 hover:text-white hover:bg-white/10 transition-all">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[11px] font-medium uppercase tracking-[0.06em]">Voltar</span>
          </button>
        ) : <span />}
        <div className="flex items-center gap-2 bg-black/30 rounded-full px-4 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white">Passo 1 de 2</span>
        </div>
      </header>

      {/* Name capture is a secondary micro-step: it only appears once the
          user has already tapped a profile chip, so the base screen stays
          just the artwork with its functional hotspots. */}
      {pendingProfile && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 px-5 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[28px] bg-[#FBF7F0] p-6 md:p-8 text-center shadow-2xl">
            <h1 className="font-logo font-medium text-xl md:text-2xl text-[#473c33] leading-[1.1]">Como podemos te chamar?</h1>
            <input
              ref={nameInputRef}
              value={name}
              onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmName(); }}
              placeholder="Digite seu apelido..."
              className="w-full mt-4 bg-white border-2 rounded-2xl px-5 py-3.5 text-base font-semibold text-center text-[#473c33] placeholder:text-[#725442]/40 focus:outline-none transition-all"
              style={{ borderColor: nameError ? '#A94432' : '#E8DDCC' }}
            />
            {nameError && (
              <p className="text-[11px] font-semibold mt-2" style={{ color: '#A94432' }}>Digite seu apelido antes de continuar</p>
            )}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setPendingProfile(null)}
                className="flex-1 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest text-[#725442] bg-[#E8DDCC]"
              >
                Voltar
              </button>
              <button
                onClick={confirmName}
                className="flex-1 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest text-white bg-[#ec6300]"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSelection;
