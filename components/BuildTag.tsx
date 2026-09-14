import React from 'react';

const formatStamp = (iso: string) => {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  } catch {
    return iso;
  }
};

const BuildTag: React.FC = () => (
  <div className="fixed bottom-1 left-1 z-[9999] px-2 py-0.5 rounded-md bg-black/40 text-white/70 text-[9px] font-mono tracking-tight pointer-events-none select-none">
    build {formatStamp(__BUILD_STAMP__)}
  </div>
);

export default BuildTag;
