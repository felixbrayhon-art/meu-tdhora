import React from 'react';

// Lightens a #rrggbb hex color toward white by `amount` (0-1) — used to derive
// the front flap's gradient end and tab accents from a single folder color.
const lighten = (hex: string, amount: number): string => {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * amount));
  const g = Math.min(255, Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * amount));
  const b = Math.min(255, Math.round((n & 255) + (255 - (n & 255)) * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

interface Folder3DProps {
  /** Folder accent color as a #rrggbb hex — every shade below derives from this one value. */
  color: string;
}

// A 3D folder that fans its "papers" open on hover — adapted from a Uiverse.io
// snippet (fixed amber/zinc palette); recolored here to take any folder's own
// accent color instead, one hex in, every shade out. The original used
// Tailwind's after:/before: pseudo-elements for the little corner tabs, but
// those can't take a per-instance inline color — swapped for real child
// <span>s so each folder card can carry its own color independently.
const Folder3D: React.FC<Folder3DProps> = ({ color }) => {
  const light = lighten(color, 0.35);

  return (
    <div className="file relative w-full aspect-[3/2] cursor-pointer origin-bottom [perspective:1500px]">
      <div
        className="work-5 w-full h-full origin-top rounded-2xl rounded-tl-none group-hover:shadow-[0_20px_40px_rgba(0,0,0,.2)] transition-all ease duration-300 relative"
        style={{ backgroundColor: color }}
      >
        <span className="absolute bottom-[99%] left-0 w-1/3 h-4 rounded-t-2xl" style={{ backgroundColor: color }} />
        <span
          className="absolute -top-[15px] left-[31%] w-4 h-4 [clip-path:polygon(0_35%,0%_100%,50%_100%)]"
          style={{ backgroundColor: color }}
        />
      </div>
      <div className="work-4 absolute inset-1 bg-zinc-400 rounded-2xl transition-all ease duration-300 origin-bottom select-none group-hover:[transform:rotateX(-20deg)]" />
      <div className="work-3 absolute inset-1 bg-zinc-300 rounded-2xl transition-all ease duration-300 origin-bottom group-hover:[transform:rotateX(-30deg)]" />
      <div className="work-2 absolute inset-1 bg-zinc-200 rounded-2xl transition-all ease duration-300 origin-bottom group-hover:[transform:rotateX(-38deg)]" />
      <div
        className="work-1 absolute bottom-0 w-full h-[78%] rounded-2xl rounded-tr-none transition-all ease duration-300 origin-bottom flex items-end group-hover:[transform:rotateX(-46deg)_translateY(1px)]"
        style={{ background: `linear-gradient(to top, ${color}, ${light})` }}
      >
        <span className="absolute bottom-[99%] right-0 w-[57%] h-[10%] rounded-t-2xl" style={{ backgroundColor: light }} />
        <span
          className="absolute -top-[10px] right-[55.5%] w-3 h-3 [clip-path:polygon(100%_14%,50%_100%,100%_100%)]"
          style={{ backgroundColor: light }}
        />
      </div>
    </div>
  );
};

export default Folder3D;
