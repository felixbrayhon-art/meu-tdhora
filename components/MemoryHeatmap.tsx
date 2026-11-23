import React from 'react';
import { motion } from 'motion/react';
import { EditalSubject, StudyProfile } from '../types';
import { diasParaRevisao, faixaDaNota, notaDaMateria, notaHoje, NotaTopico } from '../services/notaTopico';

// Quanto o aluno domina cada matéria do edital, e o que está vencido dentro dela.
//
// Antes mostrava o campo `heat`, que era movido por números chutados (+10 ao revisar, +1 a cada 2 minutos
// de estudo) e nunca caía sozinho — dava para "esquentar" uma matéria só ficando sentado nela. Agora a
// barra é a média das notas dos tópicos (services/notaTopico.ts), que vêm de resultado de atividade e caem
// a cada dia sem estudar.

interface MemoryHeatmapProps {
  subjects: EditalSubject[];
  notas: NotaTopico[];
  studyProfile?: StudyProfile;
}

const MemoryHeatmap: React.FC<MemoryHeatmapProps> = ({ subjects, notas, studyProfile = 'VESTIBULAR' }) => {
  const agora = Date.now();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {subjects.map((subject) => {
        const nota = notaDaMateria(notas, subject.name, agora);
        const dela = notas.filter((t) => t.materia === subject.name);
        const vencidos = dela.filter((t) => diasParaRevisao(t, agora) <= 0);
        // O pior tópico é mais útil que a média: é por onde o aluno deve começar.
        const pior = dela.length ? dela.reduce((a, b) => (notaHoje(a, agora) <= notaHoje(b, agora) ? a : b)) : null;
        const faixa = nota === null ? null : faixaDaNota(nota);

        return (
          <div key={subject.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group dark:bg-[#272019] dark:border-white/[0.06]">
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="min-w-0">
                <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-[0.2em] mb-1">{studyProfile === 'FACULDADE' ? 'Disciplina da Grade' : 'Disciplina do Edital'}</h4>
                <h3 className="font-black text-xl text-[#473c33] dark:text-[#f2efd2] leading-tight uppercase tracking-tighter">{subject.name}</h3>
              </div>
              {faixa && (
                <span className="shrink-0 rounded-xl px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white" style={{ backgroundColor: faixa.cor }}>
                  {faixa.rotulo}
                </span>
              )}
            </div>

            {nota === null ? (
              <p className="relative z-10 text-[11px] font-bold leading-relaxed text-gray-400">
                Sem nota ainda. Ela aparece depois da primeira atividade desta matéria — questões, flashcards ou revisão.
              </p>
            ) : (
              <>
                <div className="space-y-2 relative z-10">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                    <span className="text-[#8f8375]">Nota da matéria</span>
                    <span className="text-[#473c33] dark:text-[#f2efd2]">{nota}/100</span>
                  </div>
                  <div className="h-4 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden p-1 border border-gray-200/50 dark:border-white/10">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${nota}%` }} className="h-full rounded-full" style={{ backgroundColor: faixa?.cor }} />
                  </div>
                </div>

                <p className="mt-4 text-[9px] font-bold text-gray-400 uppercase tracking-widest relative z-10">
                  {vencidos.length > 0
                    ? `${vencidos.length} ${vencidos.length === 1 ? 'assunto vencido' : 'assuntos vencidos'}`
                    : `${dela.length} ${dela.length === 1 ? 'assunto em dia' : 'assuntos em dia'}`}
                  {pior && ` · mais frágil: ${pior.assunto}`}
                </p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MemoryHeatmap;
