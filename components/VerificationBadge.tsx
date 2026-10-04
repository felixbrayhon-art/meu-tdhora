import React from 'react';
import { CheckCircle2, AlertTriangle, Info } from './icons';
import { QuestionVerification } from '../types';

const STYLES = {
  verified: {
    label: 'Conferida no texto oficial',
    Icon: CheckCircle2,
    box: 'bg-[#446b4e]/10 border-[#446b4e]/30 text-[#2f4f38] dark:bg-[#8fbf7a]/10 dark:border-[#8fbf7a]/30 dark:text-[#b9dda8]',
  },
  consistent: {
    label: 'Conferida por 2 análises de IA',
    Icon: Info,
    box: 'bg-[#d8a53a]/10 border-[#d8a53a]/35 text-[#6e4a0e] dark:bg-[#fecc73]/10 dark:border-[#fecc73]/30 dark:text-[#fedf9f]',
  },
  unverified: {
    label: 'Não conferida: confirme no seu material',
    Icon: AlertTriangle,
    box: 'bg-[#a94432]/10 border-[#a94432]/30 text-[#7d2f21] dark:bg-[#e58a76]/10 dark:border-[#e58a76]/30 dark:text-[#f2b3a6]',
  },
} as const;

// Shows how an AI-generated question was checked, so the student knows how far to trust the answer key.
const VerificationBadge: React.FC<{ verification?: QuestionVerification }> = ({ verification }) => {
  if (!verification) return null;
  const { label, Icon, box } = STYLES[verification.status];
  const detail = verification.status === 'verified' ? verification.source : verification.note;
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-xs font-bold leading-relaxed ${box}`} role="note">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-black uppercase tracking-wide">{label}</p>
        {detail && <p className="mt-0.5 font-medium opacity-90">{detail}</p>}
      </div>
    </div>
  );
};

export default VerificationBadge;
