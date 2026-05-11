
import React, { useMemo } from 'react';
import { 
  QuizFolder, 
  QuizAttempt, 
  SmartRevisionSystem, 
  UserStats,
  FISH_RANKS,
  getFishRank
} from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Cell,
  PieChart,
  Pie,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  BarChart3,
  ChevronLeft,
  Zap,
  Brain,
  History,
  Plus,
  Minus,
  Settings2,
  Filter
} from 'lucide-react';
import { motion } from 'motion/react';

interface PerformanceViewProps {
  attempts: QuizAttempt[];
  folders: QuizFolder[];
  smartSystem: SmartRevisionSystem;
  stats: UserStats;
  onBack: () => void;
}

const PerformanceView: React.FC<PerformanceViewProps> = ({ 
  attempts, 
  folders, 
  smartSystem, 
  stats,
  onBack 
}) => {
  // 1. Process overall statistics
  const overallStats = useMemo(() => {
    const totalQuestions = attempts.reduce((acc, curr) => acc + curr.total, 0);
    const totalCorrect = attempts.reduce((acc, curr) => acc + curr.score, 0);
    const totalErrors = totalQuestions - totalCorrect;
    const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    
    // Unique folders with attempts
    const uniqueFolders = new Set(attempts.map(a => a.folderId)).size;

    return {
      totalQuestions,
      totalCorrect,
      totalErrors,
      uniqueFolders,
      accuracy: accuracy.toFixed(2),
      totalAttempts: attempts.length
    };
  }, [attempts]);

  // 2. Performance by Folder (Categories)
  const categoryStats = useMemo(() => {
    const statsMap: Record<string, { total: number, score: number, name: string }> = {};
    
    attempts.forEach(attempt => {
      const folder = folders.find(f => f.id === attempt.folderId);
      const categoryName = folder ? folder.name : 'Geral';
      
      if (!statsMap[attempt.folderId]) {
        statsMap[attempt.folderId] = { total: 0, score: 0, name: categoryName };
      }
      
      statsMap[attempt.folderId].total += attempt.total;
      statsMap[attempt.folderId].score += attempt.score;
    });
    
    const data = Object.values(statsMap).map(item => ({
      name: item.name,
      accuracy: parseFloat(((item.score / item.total) * 100).toFixed(1)),
      correct: item.score,
      wrong: item.total - item.score,
      total: item.total
    })).sort((a, b) => b.accuracy - a.accuracy);

    return data;
  }, [attempts, folders]);

  // Radar chart data (max 8 subjects for readability)
  const radarData = useMemo(() => {
    return categoryStats.slice(0, 10).map(item => ({
      subject: item.name.length > 8 ? item.name.substring(0, 8) + '...' : item.name,
      fullSubject: item.name,
      value: item.accuracy
    }));
  }, [categoryStats]);

  const pieData = [
    { name: 'Acertos', value: overallStats.totalCorrect, color: '#10B981' },
    { name: 'Erros', value: overallStats.totalErrors, color: '#EF4444' }
  ];

  // 3. Performance Timeline
  const timelineData = useMemo(() => {
    const sortedAttempts = [...attempts].sort((a, b) => a.date - b.date);
    
    // Group by date to show daily progress
    const dailyMap: Record<string, { total: number, score: number, date: string }> = {};
    
    sortedAttempts.forEach(attempt => {
      const dateKey = new Date(attempt.date).toLocaleDateString();
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { total: 0, score: 0, date: dateKey };
      }
      dailyMap[dateKey].total += attempt.total;
      dailyMap[dateKey].score += attempt.score;
    });
    
    return Object.values(dailyMap).map(day => ({
      date: day.date,
      accuracy: parseFloat(((day.score / day.total) * 100).toFixed(1))
    }));
  }, [attempts]);

  // 4. Strengths & Weaknesses
  const strengths = categoryStats.filter(c => c.accuracy >= 80).slice(0, 3);
  const weaknesses = [...categoryStats].reverse().filter(c => c.accuracy < 60).slice(0, 3);

  // 5. Error Vault Insights
  const vaultStats = useMemo(() => {
    const totalErrors = smartSystem.vault.length;
    const resolvedErrors = smartSystem.vault.filter(v => v.resolved).length;
    const pendingErrors = totalErrors - resolvedErrors;
    const persistentErrors = smartSystem.vault.filter(v => v.isStuck && !v.resolved).length;
    
    return {
      total: totalErrors,
      resolved: resolvedErrors,
      pending: pendingErrors,
      persistent: persistentErrors,
      accuracy: totalErrors > 0 ? ((resolvedErrors / totalErrors) * 100).toFixed(0) : '0'
    };
  }, [smartSystem.vault]);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const rank = getFishRank(stats.totalDaysStudied);

  return (
    <div className="min-h-screen bg-gray-100 pb-20 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-500 hover:text-[#0A0F1E] transition-colors font-bold uppercase text-xs tracking-widest bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
            Voltar ao Hub
          </button>
        </div>

        {/* Section 1: Overall Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-black text-gray-700 uppercase italic">Desempenho Geral</h2>
          </div>
          
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Stats list */}
            <div className="lg:col-span-3 grid grid-cols-2 gap-y-12">
              <div className="text-center">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-tight mb-2">Questões resolvidas</p>
                <h3 className="text-4xl font-black text-gray-800 tracking-tight">{overallStats.totalQuestions}</h3>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-tight mb-2">Acertos</p>
                <h3 className="text-4xl font-black text-green-500 tracking-tight">{overallStats.totalCorrect}</h3>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-tight mb-2">Total de matérias</p>
                <h3 className="text-4xl font-black text-gray-800 tracking-tight">{overallStats.uniqueFolders}</h3>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-tight mb-2">Erros</p>
                <h3 className="text-4xl font-black text-red-500 tracking-tight">{overallStats.totalErrors}</h3>
              </div>
            </div>

            {/* Main Donut Chart */}
            <div className="lg:col-span-4 flex flex-col items-center justify-center relative h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={0}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <span className="text-4xl font-black text-gray-800">{overallStats.accuracy}%</span>
              </div>
            </div>

            {/* Radar Chart */}
            <div className="lg:col-span-5 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
                  <Radar
                    name="Desempenho"
                    dataKey="value"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Section 2: Performance by Subject */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-black text-gray-700 uppercase italic">Desempenho por Matéria e Assunto</h2>
          </div>

          {/* Table Header / Toolbar */}
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-gray-500 uppercase tracking-tight">
            <div className="flex items-center gap-6">
              <span>Ordem de Exibição:</span>
              <label className="flex items-center gap-2 cursor-pointer text-blue-600">
                <input type="radio" name="order" className="w-4 h-4" defaultChecked />
                Índice
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors">
                <input type="radio" name="order" className="w-4 h-4" />
                Pontos Fortes
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors">
                <input type="radio" name="order" className="w-4 h-4" />
                Pontos Fracos
              </label>
            </div>

            <div className="flex items-center gap-6">
              <span>Exibir:</span>
              <label className="flex items-center gap-2 cursor-pointer text-blue-600">
                <input type="checkbox" className="w-4 h-4" defaultChecked />
                Gráfico
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-blue-600">
                <input type="checkbox" className="w-4 h-4" defaultChecked />
                Texto
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-blue-600">
                <input type="checkbox" className="w-4 h-4" defaultChecked />
                Peso
              </label>
            </div>
          </div>

          {/* Table Controls */}
          <div className="px-6 py-3 bg-gray-50/50 flex items-center justify-between border-b border-gray-100">
             <div className="flex items-center gap-3">
               <input type="checkbox" className="w-4 h-4 border-gray-300 rounded" />
               <span className="text-[11px] font-bold text-gray-500 uppercase">Selecionar Todos</span>
             </div>
             <div className="flex items-center gap-12 text-[11px] font-bold text-gray-500 uppercase mr-4">
               <span>Questões Resolvidas</span>
               <span className="w-40 text-center">Desempenho</span>
               <span>Peso</span>
             </div>
          </div>

          {/* Subject List */}
          <div className="divide-y divide-gray-100">
            {categoryStats.map((item, index) => (
              <div key={index} className="px-6 py-4 flex items-center hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <input type="checkbox" className="w-4 h-4 border-gray-300 rounded" />
                  <button className="flex items-center gap-3 text-left">
                    <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-all">
                      <Plus className="w-3 h-3" />
                    </div>
                    <span className="text-sm font-black text-gray-700 uppercase tracking-tight truncate">{item.name}</span>
                  </button>
                </div>

                <div className="flex items-center gap-12 ml-4">
                  <span className="text-sm font-black text-gray-700 w-24 text-right pr-4">{item.total}</span>
                  
                  {/* Custom Progress Bar */}
                  <div className="w-40 h-6 bg-gray-100 rounded-sm flex overflow-hidden relative group/bar">
                    <div 
                      className="bg-green-500 h-full transition-all duration-1000"
                      style={{ width: `${item.accuracy}%` }}
                    />
                    <div 
                      className="bg-red-500 h-full transition-all duration-1000"
                      style={{ width: `${100 - item.accuracy}%` }}
                    />
                    {/* Floating Labels Effect */}
                    <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-black pointer-events-none">
                       <span className={item.accuracy > 20 ? 'text-white' : 'text-transparent'}>{item.accuracy}%</span>
                       <span className={item.accuracy < 80 ? 'text-white' : 'text-transparent'}>{100 - Math.round(item.accuracy)}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 min-w-[120px] text-[11px] font-black">
                     <span className="text-green-600">{item.accuracy}% <span className="text-gray-400 font-bold">({item.correct})</span></span>
                     <span className="text-red-500">{Math.round(100 - item.accuracy)}% <span className="text-gray-400 font-bold">({item.wrong})</span></span>
                  </div>

                  <span className="text-sm font-black text-gray-700 w-8 text-center">1</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Extra Insights (Keep some the original but style like Tec) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm"
            >
               <div className="flex items-center gap-3 mb-6">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h3 className="font-black text-gray-800 uppercase italic">Curva de Evolução</h3>
               </div>
               <div className="h-60">
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={timelineData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                     <XAxis dataKey="date" hide />
                     <YAxis domain={[0, 100]} hide />
                     <Tooltip />
                     <Line type="monotone" dataKey="accuracy" stroke="#3B82F6" strokeWidth={3} dot={false} />
                   </LineChart>
                 </ResponsiveContainer>
               </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.1 }}
               className="bg-[#0A0F1E] p-6 rounded-xl shadow-xl text-white relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full"></div>
               <div className="flex items-center gap-3 mb-6 text-blue-400">
                  <Brain className="w-5 h-5" />
                  <h3 className="font-black uppercase italic">Ponto de Alerta IA</h3>
               </div>
               <p className="text-sm text-gray-300 font-medium leading-relaxed mb-6 italic">
                 {weaknesses.length > 0 
                   ? `Seu desempenho em "${weaknesses[0].name}" precisa de atenção imediata. Você está errando ${Math.round(100 - weaknesses[0].accuracy)}% das questões.`
                   : "Excelente consistência! Mantenha essa rotina para consolidar o conhecimento nos temas de maior peso."
                 }
               </p>
               <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                        <Zap className="w-4 h-4" />
                     </div>
                     <span className="text-xs font-bold uppercase">Meta Sugerida</span>
                  </div>
                  <span className="text-xs font-black text-blue-400">Resolver 20 questões de {weaknesses[0]?.name || 'Geral'}</span>
               </div>
            </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceView;
