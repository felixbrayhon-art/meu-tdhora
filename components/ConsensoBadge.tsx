import React from 'react';
import { CheckCircle2, Info, AlertTriangle } from './icons';
import { ConsensoFontes } from '../types';

const STYLES = {
  ALTO: {
    label: 'Alta concordância entre as fontes',
    Icon: CheckCircle2,
    box: 'bg-[#446b4e]/10 border-[#446b4e]/30 text-[#2f4f38] dark:bg-[#8fbf7a]/10 dark:border-[#8fbf7a]/30 dark:text-[#b9dda8]',
  },
  MEDIO: {
    label: 'Concordância moderada entre as fontes',
    Icon: Info,
    box: 'bg-[#d8a53a]/10 border-[#d8a53a]/35 text-[#6e4a0e] dark:bg-[#fecc73]/10 dark:border-[#fecc73]/30 dark:text-[#fedf9f]',
  },
  BAIXO: {
    label: 'Poucas fontes concordam: confirme na lei',
    Icon: AlertTriangle,
    box: 'bg-[#a94432]/10 border-[#a94432]/30 text-[#7d2f21] dark:bg-[#e58a76]/10 dark:border-[#e58a76]/30 dark:text-[#f2b3a6]',
  },
} as const;

// Shows how well independent study sources agreed on this topic when the AI wrote it. It measures consistency between
// sources, not proof: the official text still prevails, which the tooltip says. Nothing about the sources themselves is shown.
const ConsensoBadge: React.FC<{ consenso?: ConsensoFontes; className?: string }> = ({ consenso, className = 'mb-4' }) => {
  if (!consenso) return null;
  const { label, Icon, box } = STYLES[consenso.nivel];
  const fontes = `${consenso.fontes} fonte${consenso.fontes === 1 ? '' : 's'} independente${consenso.fontes === 1 ? '' : 's'}`;
  const divergencia = consenso.divergencias > 0 ? ` · ${consenso.divergencias} ponto${consenso.divergencias === 1 ? '' : 's'} com divergência` : '';
  return (
    <div
      className={`${className} inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold leading-tight ${box}`}
      role="note"
      title="Mede o quanto fontes independentes concordam sobre o tema. Concordância não é prova: o texto oficial da lei prevalece."
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="font-black uppercase tracking-wide">{label}</span>
      <span className="font-medium opacity-90">{fontes} · {Math.round(consenso.confianca * 100)}%{divergencia}</span>
    </div>
  );
};

export default ConsensoBadge;
