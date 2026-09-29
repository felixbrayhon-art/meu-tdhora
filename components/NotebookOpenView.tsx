import React from 'react';
import { ArrowLeft, Plus, Palette, Folder, Trash2 } from './icons';

interface NotebookOpenViewProps {
  title: string;
  pageIndex: number;
  totalPages: number;
  onBack: () => void;
  accent?: string;
}

// The 3D "open book" illusion is pure CSS: two pages rotated in opposite
// directions around the edge that meets the spine (transform-origin is what
// makes them hinge there instead of spinning around their own center), plus
// a thin gradient strip between them for the spine shadow and one
// drop-shadow on the wrapping div for the whole book "floating" on the page.
const NotebookOpenView: React.FC<NotebookOpenViewProps> = ({ title, pageIndex, totalPages, onBack, accent = '#d9772b' }) => {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(120% 100% at 50% 0%, #2a2018 0%, #1c1712 60%, #140f0a 100%)' }}
    >
      {/* faint geometric texture, matches the app's own background pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-50 pointer-events-none" aria-hidden="true">
        <defs>
          <pattern id="notebookGrid" width="64" height="64" patternUnits="userSpaceOnUse">
            <rect x="8" y="8" width="48" height="48" rx="10" fill="none" stroke="#f4ebdd" strokeWidth="1" strokeOpacity="0.04" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#notebookGrid)" />
      </svg>

      {/* top bar */}
      <div className="absolute top-8 left-8 right-8 flex items-center justify-between z-10">
        <button onClick={onBack} className="flex items-center gap-2.5 bg-white/[0.06] hover:bg-white/10 border-none rounded-2xl px-4 py-2.5 text-[#c8bbaa] transition-colors">
          <ArrowLeft className="w-[18px] h-[18px]" />
          <span className="text-xs font-black tracking-[0.14em] uppercase">Voltar</span>
        </button>
        <div className="text-center">
          <p className="m-0 text-[10px] font-black tracking-[0.35em] uppercase" style={{ color: accent }}>Anotações</p>
          <h1 className="mt-1 font-logo text-2xl text-[#f4ebdd]">{title}</h1>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center text-[#c8bbaa] text-[11px] font-black">
          {pageIndex}/{totalPages}
        </div>
      </div>

      {/* the open notebook */}
      <div style={{ perspective: 2400 }} className="mt-6">
        <div className="flex" style={{ filter: 'drop-shadow(0 40px 70px rgba(0,0,0,0.55))' }}>
          {/* left page — starts flat (closed) and swings open on mount, see .animate-book-open-left in index.css */}
          <div
            className="w-[380px] h-[520px] p-10 box-border relative rounded-l-[18px] rounded-r animate-book-open-left"
            style={{
              background: 'linear-gradient(100deg, #efe6d6 0%, #fbf7f0 18%)',
              transformOrigin: 'right center',
              boxShadow: 'inset -18px 0 30px -20px rgba(71,60,51,0.35)',
            }}
          >
            <p className="m-0 mb-5 font-logo text-[15px] text-[#473c33]">Mapa — regra geral</p>

            {/* original mind-map sketch, not copied artwork */}
            <svg width="312" height="360" viewBox="0 0 312 360" style={{ overflow: 'visible' }}>
              <line x1="156" y1="70" x2="70" y2="150" stroke="#a79c8e" strokeWidth="2" strokeDasharray="4 4" />
              <line x1="156" y1="70" x2="245" y2="150" stroke="#a79c8e" strokeWidth="2" strokeDasharray="4 4" />
              <line x1="156" y1="70" x2="156" y2="200" stroke="#a79c8e" strokeWidth="2" strokeDasharray="4 4" />
              <line x1="70" y1="150" x2="70" y2="260" stroke="#a79c8e" strokeWidth="2" strokeDasharray="4 4" />
              <line x1="245" y1="150" x2="245" y2="260" stroke="#a79c8e" strokeWidth="2" strokeDasharray="4 4" />

              <circle cx="156" cy="70" r="46" fill={accent} />
              <text x="156" y="66" textAnchor="middle" fill="#fdfbf7" fontFamily="Righteous" fontSize="14">crase</text>
              <text x="156" y="82" textAnchor="middle" fill="#fdfbf7" fontFamily="Manrope" fontSize="10">a + a = à</text>

              <circle cx="70" cy="150" r="38" fill="#fbf7f0" stroke="#473c33" strokeWidth="2" />
              <text x="70" y="146" textAnchor="middle" fill="#473c33" fontFamily="Manrope" fontWeight={800} fontSize="11">regência</text>
              <text x="70" y="160" textAnchor="middle" fill="#725442" fontFamily="Manrope" fontSize="9">exige "a"</text>

              <circle cx="245" cy="150" r="38" fill="#fbf7f0" stroke="#473c33" strokeWidth="2" />
              <text x="245" y="146" textAnchor="middle" fill="#473c33" fontFamily="Manrope" fontWeight={800} fontSize="11">artigo</text>
              <text x="245" y="160" textAnchor="middle" fill="#725442" fontFamily="Manrope" fontSize="9">"a" fem.</text>

              <circle cx="156" cy="220" r="38" fill="#fbf7f0" stroke="#473c33" strokeWidth="2" />
              <text x="156" y="216" textAnchor="middle" fill="#473c33" fontFamily="Manrope" fontWeight={800} fontSize="11">teste</text>
              <text x="156" y="230" textAnchor="middle" fill="#725442" fontFamily="Manrope" fontSize="9">troque p/ masc.</text>

              <circle cx="70" cy="270" r="30" fill="none" stroke="#8a9a7b" strokeWidth="2" />
              <text x="70" y="266" textAnchor="middle" fill="#446b4e" fontFamily="Manrope" fontWeight={800} fontSize="9">vou à</text>
              <text x="70" y="278" textAnchor="middle" fill="#446b4e" fontFamily="Manrope" fontSize="9">praia</text>

              <circle cx="245" cy="270" r="30" fill="none" stroke="#c96c4a" strokeWidth="2" />
              <text x="245" y="266" textAnchor="middle" fill="#c96c4a" fontFamily="Manrope" fontWeight={800} fontSize="9">vou a</text>
              <text x="245" y="278" textAnchor="middle" fill="#c96c4a" fontFamily="Manrope" fontSize="9">pé</text>
            </svg>

            <div className="absolute bottom-7 left-[34px] right-[34px] h-[26px] rounded-md -rotate-1" style={{ background: `${accent}1f` }} />
          </div>

          {/* spine shadow */}
          <div className="w-4 h-[520px] z-[2]" style={{ background: 'linear-gradient(90deg, rgba(20,15,10,0.5), rgba(20,15,10,0.15), rgba(20,15,10,0.5))' }} />

          {/* right page — see .animate-book-open-right in index.css */}
          <div
            className="w-[380px] h-[520px] p-10 box-border rounded-r-[18px] rounded-l animate-book-open-right"
            style={{
              background: 'linear-gradient(260deg, #efe6d6 0%, #fbf7f0 18%)',
              transformOrigin: 'left center',
              boxShadow: 'inset 18px 0 30px -20px rgba(71,60,51,0.35)',
              fontFamily: "'Kalam', cursive",
            }}
          >
            <p className="m-0 mb-4 font-sans font-black text-[11px] tracking-[0.14em] uppercase" style={{ color: accent }}>Bizu rápido</p>

            <p className="m-0 mb-3.5 pb-3 border-b border-[#473c33]/10 text-xl text-[#473c33] leading-relaxed">
              Só existe crase antes de palavra <span className="text-[#c96c4a] font-bold">feminina</span>.
            </p>
            <p className="m-0 mb-3.5 pb-3 border-b border-[#473c33]/10 text-xl text-[#473c33] leading-relaxed">
              Troca "a" por "ao" — deu certo? <span className="text-[#446b4e] font-bold">Tem crase.</span>
            </p>
            <p className="m-0 mb-3.5 pb-3 border-b border-[#473c33]/10 text-xl text-[#473c33] leading-relaxed">
              "Vou à escola" → "vou ao colégio" ✓
            </p>
            <p className="mt-7 text-xl text-[#473c33] leading-relaxed">
              Antes de verbo, <span className="text-[#c96c4a] font-bold">nunca</span> tem crase.
            </p>

            <div className="mt-10 flex items-center gap-2.5">
              <svg width="20" height="20" viewBox="0 0 256 256"><path d="M232 96L120 208l-64-64" fill="none" stroke="#8a9a7b" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="font-sans text-xs font-bold text-[#8a9a7b]">revisado 2x</span>
            </div>
          </div>
        </div>
      </div>

      {/* page dots */}
      <div className="flex gap-2 mt-7">
        {Array.from({ length: totalPages }).map((_, i) => (
          <div
            key={i}
            className="h-2 rounded-full transition-all"
            style={{ width: i === pageIndex - 1 ? 22 : 8, background: i === pageIndex - 1 ? accent : 'rgba(244,235,221,0.25)' }}
          />
        ))}
      </div>

      {/* bottom icon toolbar */}
      <div className="flex gap-2.5 mt-6 bg-white/5 border border-white/[0.08] p-2.5 rounded-[20px]">
        <button aria-label="Cores" className="w-11 h-11 rounded-2xl flex items-center justify-center hover:bg-white/5 transition-colors">
          <Palette className="w-5 h-5 text-[#c8bbaa]" />
        </button>
        <button aria-label="Mover para pasta" className="w-11 h-11 rounded-2xl flex items-center justify-center hover:bg-white/5 transition-colors">
          <Folder className="w-5 h-5 text-[#c8bbaa]" />
        </button>
        <button aria-label="Excluir" className="w-11 h-11 rounded-2xl flex items-center justify-center hover:bg-white/5 transition-colors">
          <Trash2 className="w-5 h-5 text-[#c8bbaa]" />
        </button>
        <button aria-label="Nova anotação" className="w-11 h-11 rounded-2xl flex items-center justify-center transition-colors" style={{ background: accent }}>
          <Plus className="w-5 h-5 text-[#fdfbf7]" />
        </button>
      </div>
    </div>
  );
};

export default NotebookOpenView;
