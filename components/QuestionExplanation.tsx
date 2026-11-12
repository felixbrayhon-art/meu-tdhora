import React from 'react';
import MarkdownContent from './MarkdownContent';

interface QuestionExplanationProps {
  explanation?: string;
  options: string[];
  correctAnswer: number;
  fontSizeMultiplier?: number;
}

// Only split the explicit format requested from the model. Existing comments may
// contain arbitrary Markdown or HTML, so they remain intact as one commentary.
const splitSteps = (text: string): string[] | null => {
  const normalized = text.replace(/\\n/g, '\n');
  const marker = /\*\*(Regra|Resposta correta|Alternativas incorretas):\*\*/g;
  const matches = [...normalized.matchAll(marker)];
  if (matches.length !== 3 || matches.map((m) => m[1]).join('|') !== 'Regra|Resposta correta|Alternativas incorretas' || normalized.slice(0, matches[0].index).trim()) return null;
  const parts = matches.map((match, i) => normalized.slice(match.index! + match[0].length, matches[i + 1]?.index ?? normalized.length).trim());
  return parts.every(Boolean) ? parts : null;
};

const QuestionExplanation: React.FC<QuestionExplanationProps> = ({ explanation, options, correctAnswer, fontSizeMultiplier = 1 }) => {
  const answer = Number.isInteger(correctAnswer) && correctAnswer >= 0 ? options[correctAnswer]?.trim() : '';
  const steps = explanation?.trim() ? splitSteps(explanation) : null;
  const sections = steps
    ? ['Comece pela regra', 'Por que a resposta está correta?', 'Onde estão os erros?'].map((title, i) => ({ title, content: steps[i] }))
    : explanation?.trim() ? [{ title: 'Comentário da questão', content: explanation }] : [];

  return (
    <div className="space-y-4">
      {answer && <div className="rounded-2xl border border-[#abc270]/50 bg-[#f1f6e8] px-5 py-4 text-[#46523a]">
        <p className="text-xs font-bold uppercase tracking-wider text-[#596b2a]">Resposta correta: {String.fromCharCode(65 + correctAnswer)}</p>
        <p className="mt-2 text-sm font-bold leading-relaxed">{answer}</p>
      </div>}
      {sections.length ? <div className="space-y-3">{sections.map((section, index) => (
        <section key={section.title} className="flex items-start gap-4 rounded-2xl border border-[#eee8dd] bg-white px-5 py-5 text-slate-700">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff2d6] text-sm font-bold text-[#8a5a10]">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <h5 className="mb-3 text-sm font-bold text-[#473c33]">{section.title}</h5>
            <MarkdownContent content={section.content} fontSizeMultiplier={fontSizeMultiplier} />
          </div>
        </section>
      ))}</div> : <p className="text-sm text-slate-600">Esta questão ainda não tem uma explicação disponível.</p>}
    </div>
  );
};

export default QuestionExplanation;
