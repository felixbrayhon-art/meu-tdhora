
import React from 'react';
import { motion } from 'motion/react';
import { EditalSubject } from '../types';

interface MemoryHeatmapProps {
  subjects: EditalSubject[];
}

const MemoryHeatmap: React.FC<MemoryHeatmapProps> = ({ subjects }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {subjects.map((subject) => (
        <div key={subject.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-[0.2em] mb-1 italic">Disciplina do Edital</h4>
              <h3 className="font-black text-xl text-[#0F172A] leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tighter">{subject.name}</h3>
            </div>
            <div className={`p-2 rounded-xl flex items-center justify-center ${subject.heat > 50 ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
          </div>

          <div className="space-y-2 relative z-10">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
               <span className={subject.heat > 50 ? 'text-orange-500' : 'text-blue-500'}>Calor da Memória</span>
               <span className="text-gray-400">{subject.heat}%</span>
            </div>
            <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden p-1 border border-gray-200/50">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${subject.heat}%` }}
                 className={`h-full rounded-full ${subject.heat > 80 ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]' : subject.heat > 40 ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-gray-300'}`}
               />
            </div>
          </div>

          <p className="mt-4 text-[9px] font-bold text-gray-400 uppercase tracking-widest relative z-10 italic">
             {subject.heat > 80 ? 'Mergulhando fundo - Retenção Máxima' : subject.heat > 40 ? 'Águas estáveis - Revisão programada' : 'Esfriando - Requer validação urgente'}
          </p>

          {/* Background decoration */}
          <div className={`absolute -bottom-12 -right-12 w-32 h-32 blur-3xl rounded-full opacity-10 transition-all group-hover:opacity-20 ${subject.heat > 50 ? 'bg-orange-500' : 'bg-blue-500'}`} />
        </div>
      ))}
    </div>
  );
};

export default MemoryHeatmap;
