import React, { useMemo } from 'react';
import { QuizFolder, QuizAttempt, SmartRevisionSystem, UserStats, FISH_RANKS, getFishRank } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Trophy, Target, TrendingUp, AlertCircle, CheckCircle2, XCircle, BarChart3, ChevronLeft, Zap, Brain, Plus, Minus, Settings2, Filter } from './icons';
import { motion } from 'motion/react';

interface PerformanceViewProps {
  attempts: QuizAttempt[];
  folders: QuizFolder[];
  smartSystem: SmartRevisionSystem;
  stats: UserStats;
  onBack: () => void;
}

const PerformanceView: React.FC<PerformanceViewProps> = ({ attempts, folders, smartSystem, stats, onBack }) => {
  // 1. Process overall statistics
  const overallStats = useMemo(() => {
    const totalQuestions = attempts.reduce((acc, curr) => acc + curr.total, 0);
    const totalCorrect = attempts.reduce((acc, curr) => acc + curr.score, 0);
    const totalErrors = totalQuestions - totalCorrect;
    const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

    // Unique folders with attempts
    const uniqueFolders = new Set(attempts.map((a) => a.folderId)).size;

    return {
      totalQuestions,
      totalCorrect,
      totalErrors,
      uniqueFolders,
      accuracy: totalQuestions > 0 ? accuracy.toFixed(1) : '—',
      totalAttempts: attempts.length,
    };
  }, [attempts]);

  // 2. Performance by Folder (Categories)
  const categoryStats = useMemo(() => {
    const statsMap: Record<string, { total: number; score: number; name: string }> = {};

    attempts.forEach((attempt) => {
      const folder = folders.find((f) => f.id === attempt.folderId);
      const categoryName = folder ? folder.name : 'Geral';

      if (!statsMap[attempt.folderId]) {
        statsMap[attempt.folderId] = { total: 0, score: 0, name: categoryName };
      }

      statsMap[attempt.folderId].total += attempt.total;
      statsMap[attempt.folderId].score += attempt.score;
    });

    const data = Object.values(statsMap)
      .map((item) => ({
        name: item.name,
        accuracy: parseFloat(((item.score / item.total) * 100).toFixed(1)),
        correct: item.score,
        wrong: item.total - item.score,
        total: item.total,
      }))
      .sort((a, b) => b.accuracy - a.accuracy);

    return data;
  }, [attempts, folders]);

  // Radar chart data (max 8 subjects for readability)
  const radarData = useMemo(() => {
    return categoryStats.slice(0, 10).map((item) => ({
      subject: item.name.length > 8 ? item.name.substring(0, 8) + '...' : item.name,
      fullSubject: item.name,
      value: item.accuracy,
    }));
  }, [categoryStats]);

  const pieData = [
    { name: 'Acertos', value: overallStats.totalCorrect, color: '#10B981' },
    { name: 'Erros', value: overallStats.totalErrors, color: '#EF4444' },
  ];

  // 3. Performance Timeline
  const timelineData = useMemo(() => {
    const sortedAttempts = [...attempts].sort((a, b) => a.date - b.date);

    // Group by date to show daily progress
    const dailyMap: Record<string, { total: number; score: number; date: string }> = {};

    sortedAttempts.forEach((attempt) => {
      const dateKey = new Date(attempt.date).toLocaleDateString();
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { total: 0, score: 0, date: dateKey };
      }
      dailyMap[dateKey].total += attempt.total;
      dailyMap[dateKey].score += attempt.score;
    });

    return Object.values(dailyMap).map((day) => ({
      date: day.date,
      accuracy: parseFloat(((day.score / day.total) * 100).toFixed(1)),
    }));
  }, [attempts]);

  // 4. Strengths & Weaknesses
  const strengths = categoryStats.filter((c) => c.accuracy >= 80).slice(0, 3);
  const weaknesses = [...categoryStats]
    .reverse()
    .filter((c) => c.accuracy < 60)
    .slice(0, 3);

  // 5. Error Vault Insights
  const vaultStats = useMemo(() => {
    const totalErrors = smartSystem.vault.length;
    const resolvedErrors = smartSystem.vault.filter((v) => v.resolved).length;
    const pendingErrors = totalErrors - resolvedErrors;
    const persistentErrors = smartSystem.vault.filter((v) => v.isStuck && !v.resolved).length;

    return {
      total: totalErrors,
      resolved: resolvedErrors,
      pending: pendingErrors,
      persistent: persistentErrors,
      accuracy: totalErrors > 0 ? ((resolvedErrors / totalErrors) * 100).toFixed(0) : '0',
    };
  }, [smartSystem.vault]);

  const COLORS = ['#3B82F6', '#10B981', '#f59e0b', '#EF4444', '#8B5CF6'];

  const rank = getFishRank(stats.totalDaysStudied);
  const hasPerformanceData = overallStats.totalQuestions > 0;

  return (
    <div className="performance-view min-h-full overflow-x-hidden bg-[#f7f3ed] pb-24 font-sans text-[#473c33]">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#a79c8e]">Acompanhamento de estudos</p>
            <h1 className="mt-1 text-2xl md:text-3xl font-black tracking-tight text-[#473c33]">Desempenho</h1>
            <p className="mt-1 text-sm font-medium text-[#8f8375]">Veja sua evolução e escolha onde concentrar o próximo treino.</p>
          </div>
          <button onClick={onBack} className="flex items-center gap-2 text-[#725442] hover:text-[#473c33] transition-colors font-black uppercase text-[10px] tracking-[0.16em] bg-white px-4 py-3 rounded-2xl border border-[#e9e0d4] shadow-[0_6px_18px_rgba(71,60,51,0.06)]">
            <ChevronLeft className="w-5 h-5" />
            Voltar ao Hub
          </button>
        </div>

        {/* Section 1: Overall Performance */}
        <div className="bg-white rounded-[28px] shadow-[0_14px_34px_rgba(71,60,51,0.08)] border border-[#e9e0d4] overflow-hidden mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 md:px-7 py-5 border-b border-[#eee6d6]">
            <div>
              <h2 className="text-lg font-black text-[#473c33] uppercase tracking-tight">Desempenho geral</h2>
              <p className="mt-1 text-xs font-medium text-[#a79c8e]">Um resumo do seu histórico de respostas.</p>
            </div>
            <span className="rounded-full bg-[#fff6e8] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#d87b32]">
              {overallStats.totalAttempts} {overallStats.totalAttempts === 1 ? 'treino' : 'treinos'}
            </span>
          </div>

          <div className="p-5 md:p-7">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-[#eee6d6] bg-[#fdfbf7] p-4">
                <p className="text-[10px] font-black text-[#a79c8e] uppercase tracking-widest">Questões resolvidas</p>
                <h3 className="mt-3 text-3xl font-black text-[#473c33] tracking-tight">{overallStats.totalQuestions}</h3>
              </div>
              <div className="rounded-2xl border border-[#e4edd7] bg-[#f7fbf1] p-4">
                <p className="text-[10px] font-black text-[#8ea865] uppercase tracking-widest">Acertos</p>
                <h3 className="mt-3 text-3xl font-black text-[#94b866] tracking-tight">{overallStats.totalCorrect}</h3>
              </div>
              <div className="rounded-2xl border border-[#eee6d6] bg-[#fdfbf7] p-4">
                <p className="text-[10px] font-black text-[#a79c8e] uppercase tracking-widest">Pastas com treino</p>
                <h3 className="mt-3 text-3xl font-black text-[#473c33] tracking-tight">{overallStats.uniqueFolders}</h3>
              </div>
              <div className="rounded-2xl border border-[#f4dede] bg-[#fff8f8] p-4">
                <p className="text-[10px] font-black text-[#d97979] uppercase tracking-widest">Erros</p>
                <h3 className="mt-3 text-3xl font-black text-[#e45d5d] tracking-tight">{overallStats.totalErrors}</h3>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Main Donut Chart */}
              <div className="rounded-2xl border border-[#eee6d6] bg-[#fdfbf7] p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-[#473c33]">Precisão geral</h3>
                    <p className="text-xs text-[#a79c8e] mt-1">Relação entre acertos e erros.</p>
                  </div>
                  <Target className="w-5 h-5 text-[#f5b84b]" />
                </div>
                <div className="relative h-52 flex items-center justify-center">
                  {hasPerformanceData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={62} outerRadius={88} paddingAngle={0} dataKey="value" stroke="none">
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-40 w-40 rounded-full border-[18px] border-[#eee6d6]" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center text-center">
                    <div>
                      <span className="block text-3xl font-black text-[#473c33]">{overallStats.accuracy}{hasPerformanceData ? '%' : ''}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#a79c8e]">{hasPerformanceData ? 'aproveitamento' : 'sem treinos ainda'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Radar Chart */}
              <div className="rounded-2xl border border-[#eee6d6] bg-[#fdfbf7] p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-[#473c33]">Mapa por matéria</h3>
                    <p className="text-xs text-[#a79c8e] mt-1">Compare seu desempenho entre os temas.</p>
                  </div>
                  <BarChart3 className="w-5 h-5 text-[#f5b84b]" />
                </div>
                <div className="h-52">
                  {radarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid stroke="#e9e0d4" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700, fill: '#8f8375' }} />
                        <Radar name="Desempenho" dataKey="value" stroke="#e5a83e" fill="#e5a83e" fillOpacity={0.22} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e9e0d4] text-center">
                      <BarChart3 className="w-7 h-7 text-[#c8bbaa] mb-2" />
                      <p className="text-xs font-bold text-[#8f8375]">O mapa será preenchido após seu primeiro treino.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Performance by Subject */}
        <div className="bg-white rounded-[28px] shadow-[0_14px_34px_rgba(71,60,51,0.07)] border border-[#e9e0d4] overflow-hidden">
          <div className="px-5 md:px-7 py-5 border-b border-[#eee6d6]">
            <h2 className="text-lg font-black text-[#473c33] uppercase tracking-tight">Desempenho por matéria e assunto</h2>
            <p className="mt-1 text-xs font-medium text-[#a79c8e]">Organize os resultados para encontrar seus próximos focos.</p>
          </div>

          {/* Table Header / Toolbar */}
          <div className="px-5 md:px-7 py-4 border-b border-[#eee6d6] bg-[#fdfbf7] flex flex-wrap items-center justify-between gap-4 text-[10px] font-black text-[#8f8375] uppercase tracking-wider">
            <div className="flex flex-wrap items-center gap-4 md:gap-6">
              <span className="text-[#473c33]">Ordenar por</span>
              <label className="flex items-center gap-2 cursor-pointer text-[#d88b2f]">
                <input type="radio" name="order" className="w-4 h-4 accent-[#e5a83e]" defaultChecked />
                Índice
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-[#fec868] transition-colors">
                <input type="radio" name="order" className="w-4 h-4 accent-[#e5a83e]" />
                Pontos Fortes
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-[#fec868] transition-colors">
                <input type="radio" name="order" className="w-4 h-4 accent-[#e5a83e]" />
                Pontos Fracos
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-4 md:gap-6">
              <span className="text-[#473c33]">Exibir</span>
              <label className="flex items-center gap-2 cursor-pointer text-[#d88b2f]">
                <input type="checkbox" className="w-4 h-4 accent-[#e5a83e]" defaultChecked />
                Gráfico
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[#d88b2f]">
                <input type="checkbox" className="w-4 h-4 accent-[#e5a83e]" defaultChecked />
                Texto
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[#d88b2f]">
                <input type="checkbox" className="w-4 h-4 accent-[#e5a83e]" defaultChecked />
                Peso
              </label>
            </div>
          </div>

          {/* Table Controls */}
          <div className="px-5 md:px-7 py-3 bg-white flex items-center justify-between border-b border-[#eee6d6]">
            <div className="flex items-center gap-3">
              <input type="checkbox" className="w-4 h-4 border-[#d8cec0] rounded accent-[#e5a83e]" />
              <span className="text-[10px] font-black text-[#8f8375] uppercase tracking-wider">Selecionar todos</span>
            </div>
            <div className="hidden md:flex items-center gap-12 text-[10px] font-black text-[#8f8375] uppercase tracking-wider mr-4">
              <span>Questões Resolvidas</span>
              <span className="w-40 text-center">Desempenho</span>
              <span>Peso</span>
            </div>
          </div>

          {/* Subject List */}
          <div className="divide-y divide-[#f1ebe3] overflow-x-auto">
            {categoryStats.length === 0 ? (
              <div className="px-6 py-12 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#fff6e8] text-[#e5a83e] flex items-center justify-center mb-3">
                  <Target className="w-6 h-6" />
                </div>
                <p className="text-sm font-black text-[#473c33]">Ainda não há matérias com desempenho registrado.</p>
                <p className="mt-1 max-w-md text-xs font-medium text-[#a79c8e]">Complete um treino para começar a acompanhar seus acertos por tema.</p>
              </div>
            ) : categoryStats.map((item, index) => (
              <div key={index} className="min-w-[700px] px-5 md:px-7 py-4 flex items-center hover:bg-[#fdfbf7] transition-colors group">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <input type="checkbox" className="w-4 h-4 border-[#d8cec0] rounded accent-[#e5a83e]" />
                  <button className="flex items-center gap-3 text-left">
                    <div className="w-6 h-6 rounded-full border border-[#d8cec0] flex items-center justify-center text-[#a79c8e] group-hover:bg-[#fff6e8] group-hover:text-[#d88b2f] group-hover:border-[#ffe6b9] transition-all">
                      <Plus className="w-3 h-3" />
                    </div>
                    <span className="text-sm font-black text-[#473c33] uppercase tracking-tight truncate">{item.name}</span>
                  </button>
                </div>

                <div className="flex items-center gap-12 ml-4">
                  <span className="text-sm font-black text-[#473c33] w-24 text-right pr-4">{item.total}</span>

                  {/* Custom Progress Bar */}
                  <div className="w-40 h-6 bg-[#f6e5e5] rounded-lg flex overflow-hidden relative group/bar">
                    <div className="bg-[#a9c878] h-full transition-all duration-1000" style={{ width: `${item.accuracy}%` }} />
                    <div className="bg-[#e98989] h-full transition-all duration-1000" style={{ width: `${100 - item.accuracy}%` }} />
                    {/* Floating Labels Effect */}
                    <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-black pointer-events-none">
                      <span className={item.accuracy > 20 ? 'text-white' : 'text-transparent'}>{item.accuracy}%</span>
                      <span className={item.accuracy < 80 ? 'text-white' : 'text-transparent'}>{100 - Math.round(item.accuracy)}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 min-w-[120px] text-[11px] font-black">
                    <span className="text-[#8eaf58]">
                      {item.accuracy}% <span className="text-[#a79c8e] font-bold">({item.correct})</span>
                    </span>
                    <span className="text-[#df7373]">
                      {Math.round(100 - item.accuracy)}% <span className="text-[#a79c8e] font-bold">({item.wrong})</span>
                    </span>
                  </div>

                  <span className="text-sm font-black text-[#473c33] w-8 text-center">1</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Extra Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-5 md:p-6 rounded-[28px] border border-[#e9e0d4] shadow-[0_12px_28px_rgba(71,60,51,0.06)]">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-[#e5a83e]" />
                <h3 className="font-black text-[#473c33] uppercase tracking-tight">Curva de evolução</h3>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#a79c8e]">Por dia</span>
            </div>
            <div className="h-52">
              {timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee6d6" />
                    <XAxis dataKey="date" hide />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip />
                    <Line type="monotone" dataKey="accuracy" stroke="#e5a83e" strokeWidth={3} dot={{ fill: '#e5a83e', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#e9e0d4] text-center">
                  <TrendingUp className="w-7 h-7 text-[#c8bbaa] mb-2" />
                  <p className="text-xs font-bold text-[#8f8375]">Sua curva aparecerá depois das primeiras respostas.</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#473c33] p-5 md:p-6 rounded-[28px] shadow-[0_16px_32px_rgba(71,60,51,0.16)] text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#fecc73]/10 blur-3xl rounded-full"></div>
            <div className="flex items-center gap-3 mb-5 text-[#fed386]">
              <Brain className="w-5 h-5" />
              <h3 className="font-black uppercase tracking-tight">Ponto de alerta IA</h3>
            </div>
            <p className="text-sm text-[#e7ddd1] font-medium leading-relaxed mb-6">{weaknesses.length > 0 ? `Seu desempenho em "${weaknesses[0].name}" precisa de atenção imediata. Você está errando ${Math.round(100 - weaknesses[0].accuracy)}% das questões.` : 'Excelente consistência! Mantenha essa rotina para consolidar o conhecimento nos temas de maior peso.'}</p>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#fdad74]/20 text-[#fdb887] flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider">Meta sugerida</span>
              </div>
              <span className="text-right text-xs font-black text-[#fed386]">Resolver 20 questões de {weaknesses[0]?.name || 'Geral'}</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceView;
