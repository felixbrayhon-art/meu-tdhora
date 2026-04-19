
import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';
import { Brain, Zap, Info, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

const data = [
  { time: 'Início', retention: 100, withoutReview: 100 },
  { time: '20 min', retention: 100, withoutReview: 58 },
  { time: '1h', retention: 100, withoutReview: 44 },
  { time: '9h', retention: 100, withoutReview: 36 },
  { time: '1 dia', retention: 100, withoutReview: 33 },
  { time: '2 dias', retention: 90, withoutReview: 28 },
  { time: '7 dias', retention: 85, withoutReview: 21 },
  { time: '15 dias', retention: 80, withoutReview: 15 },
  { time: '31 dias', retention: 75, withoutReview: 10 },
];

const ForgettingCurve: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-2xl border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Brain size={120} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-600 p-2 rounded-xl text-white">
              <Zap size={20} />
            </div>
            <h3 className="text-xl font-black italic tracking-tighter uppercase">Curva de Ebbinghaus</h3>
          </div>

          <p className="text-gray-500 font-medium max-w-2xl mb-12 leading-relaxed">
            Sem revisões estratégicas, seu cérebro descarta até <span className="text-red-500 font-black">70%</span> do que você aprendeu em apenas 24 horas. Nossa IA combate essa curva aplicando revisões exatamente nos pontos de queda.
          </p>

          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorWithReview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94A3B8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94A3B8' }}
                  domain={[0, 100]}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="retention" 
                  name="Com TDAH ORA (SRS)" 
                  stroke="#3B82F6" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorWithReview)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="withoutReview" 
                  name="Sem Revisão" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="none" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
               <div className="flex items-center gap-2 mb-3 text-red-600">
                 <ShieldAlert size={18} />
                 <span className="text-[10px] font-black uppercase tracking-widest">O Perigo</span>
               </div>
               <p className="text-sm font-bold text-red-900/60 leading-relaxed">
                 A queda inicial é a mais drástica. Se não revisar em 24h, você terá que re-estudar quase tudo do zero.
               </p>
            </div>

            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
               <div className="flex items-center gap-2 mb-3 text-blue-600">
                 <Zap size={18} />
                 <span className="text-[10px] font-black uppercase tracking-widest">A Defesa</span>
               </div>
               <p className="text-sm font-bold text-blue-900/60 leading-relaxed">
                 Cada "pico" de revisão reconecta os neurônios, tornando a curva de esquecimento cada vez mais suave.
               </p>
            </div>

            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
               <div className="flex items-center gap-2 mb-3 text-gray-600">
                 <Info size={18} />
                 <span className="text-[10px] font-black uppercase tracking-widest">A Meta</span>
               </div>
               <p className="text-sm font-bold text-gray-900/60 leading-relaxed">
                 O objetivo do nosso ciclo 0-1-3-7-15 é mover a informação da Memória de Curto Prazo para a de Longo Prazo.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgettingCurve;
