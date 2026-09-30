import React from 'react';

interface CustomColorFieldProps {
  label: string;
  color: string;
  onChange: (color: string) => void;
  dark?: boolean;
}

const CustomColorField: React.FC<CustomColorFieldProps> = ({ label, color, onChange, dark = false }) => (
  <label className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${dark ? 'border-white/10 bg-white/5 text-white' : 'border-[#eadfce] bg-[#fffdf9] text-[#473c33]'}`}>
    <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${dark ? 'text-white/65' : 'text-[#725442]'}`}>{label}</span>
    <span className="flex min-w-0 items-center gap-2">
      <input
        type="color"
        value={/^#[\da-f]{6}$/i.test(color) ? color : '#f97316'}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-9 w-11 cursor-pointer rounded-lg border-0 bg-transparent p-0"
      />
      <span className={`font-mono text-xs uppercase ${dark ? 'text-white/70' : 'text-[#8c7b68]'}`}>{color}</span>
    </span>
  </label>
);

export default CustomColorField;
