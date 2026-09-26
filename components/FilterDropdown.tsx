import React, { useState } from 'react';
import { ChevronDown, Check, Search } from './icons';
import { BankFacetOption } from '../services/questionBankService';

interface FilterDropdownProps {
  label: string;
  placeholder: string;
  value: string;
  options: BankFacetOption[];
  onChange: (value: string) => void;
  loading?: boolean;
  disabled?: boolean;
  loadingLabel?: string;
}

// Single-select dropdown styled after the app's own filter chips (blue/slate
// palette, rounded-3xl cards) with a searchable option list — used for the
// banca/órgão/cargo/ano cascade in TDHQuestoes.tsx. Selection stays
// single-choice (picking a banca narrows the next level down), only the
// visual pattern (pill + chevron + searchable panel) is borrowed.
const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  placeholder,
  value,
  options,
  onChange,
  loading = false,
  disabled = false,
  loadingLabel = 'Carregando...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find(o => o.value === value);
  const isDisabled = disabled || loading || options.length === 0;
  const filtered = search
    ? options.filter(o => o.value.toLowerCase().includes(search.toLowerCase()))
    : options;

  const close = () => {
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="space-y-2 text-left relative">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{label}</label>

      <button
        type="button"
        onClick={() => !isDisabled && setIsOpen(o => !o)}
        disabled={isDisabled}
        className={`w-full flex items-center justify-between gap-3 bg-slate-50 border-2 rounded-3xl px-6 py-5 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isOpen ? 'border-[#fec868]' : 'border-slate-100'}`}
      >
        {selected ? (
          <span className="inline-flex items-center gap-2 bg-[#fec868] text-white text-sm font-bold px-4 py-1.5 rounded-full truncate max-w-[85%]">
            <span className="truncate">{selected.value}</span>
            <span className="text-white/70 font-black text-[11px] flex-shrink-0">{selected.count}</span>
          </span>
        ) : (
          <span className="text-slate-400 font-bold text-base truncate">
            {loading ? loadingLabel : options.length === 0 ? 'Nada disponível' : placeholder}
          </span>
        )}
        <ChevronDown className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180 text-[#fec868]' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={close} />
          <div className="absolute left-0 right-0 top-full mt-2 z-30 bg-white border-2 border-slate-100 rounded-3xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {options.length > 6 && (
              <div className="p-3 border-b border-slate-100">
                <div className="flex items-center gap-2 bg-slate-50 rounded-2xl px-4 py-2.5">
                  <Search className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300 w-full"
                  />
                </div>
              </div>
            )}
            <div className="max-h-64 overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <p className="text-center text-xs font-bold text-slate-300 py-6">Nenhum resultado.</p>
              ) : (
                filtered.map(o => {
                  const isSelected = o.value === value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => { onChange(o.value); close(); }}
                      className={`w-full flex items-center justify-between gap-3 px-5 py-3 text-left transition-colors ${isSelected ? 'bg-[#fec868]/10 text-[#fec868]' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span className="font-bold text-sm truncate">{o.value}</span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] font-black text-slate-300">{o.count}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#fec868]" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FilterDropdown;
