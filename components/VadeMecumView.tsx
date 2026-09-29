import React, { useEffect, useMemo, useState } from 'react';
import { Scale, Search, ChevronDown } from './icons';
import { VadeMecumArticle, VADE_MECUM_LAWS } from '../types';
import { getVadeMecumArticles, searchVadeMecumArticles } from '../services/vademecumService';
import LoadingFish from './LoadingFish';

interface VadeMecumViewProps {
  onBack: () => void;
}

const VadeMecumView: React.FC<VadeMecumViewProps> = ({ onBack }) => {
  const [lawId, setLawId] = useState(VADE_MECUM_LAWS[0].id);
  const [articles, setArticles] = useState<VadeMecumArticle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openArticle, setOpenArticle] = useState<string | null>(null);

  useEffect(() => {
    setArticles(null);
    setError(null);
    setOpenArticle(null);
    setQuery('');
    getVadeMecumArticles(lawId)
      .then(setArticles)
      .catch(() => setError('Não foi possível carregar essa legislação agora.'));
  }, [lawId]);

  const filtered = useMemo(() => {
    if (!articles) return [];
    return searchVadeMecumArticles(articles, query);
  }, [articles, query]);

  return (
    <div className="flex-1 w-full flex flex-col bg-[#FDFBF7] h-full" style={{ overflowY: 'auto' }}>
      <div className="bg-white px-8 py-8 md:py-10 shadow-sm border-b border-gray-100 flex-shrink-0 flex items-center justify-between sticky top-0 z-30">
        <div>
          <h2 className="font-logo text-3xl text-gray-900 flex items-center gap-3">
            <Scale className="w-8 h-8 text-[#fdad74]" />
            Vade Mecum
          </h2>
          <select
            value={lawId}
            onChange={(e) => setLawId(e.target.value)}
            className="mt-1 text-gray-500 font-medium tracking-wide uppercase text-sm bg-transparent border-none focus:outline-none cursor-pointer hover:text-gray-700"
          >
            {VADE_MECUM_LAWS.map((law) => (
              <option key={law.id} value={law.id}>{law.name}</option>
            ))}
          </select>
        </div>

        <button onClick={onBack} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors uppercase tracking-widest text-sm">
          Voltar
        </button>
      </div>

      <div className="p-6 md:p-10 w-full max-w-4xl mx-auto space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por número do artigo ou palavra-chave..." className="w-full bg-white border-2 border-gray-200 rounded-2xl pl-12 pr-4 py-4 text-base font-medium focus:outline-none focus:border-[#fdb887] transition-colors" />
        </div>

        {error && <div className="bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-6 text-center font-bold">{error}</div>}

        {!error && !articles && <LoadingFish message="Carregando a legislação..." />}

        {articles && (
          <>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
              {filtered.length} de {articles.length} artigos
            </p>

            <div className="space-y-4">
              {filtered.map((article) => {
                const isOpen = openArticle === article.numero;
                const context = [article.titulo, article.capitulo, article.secao, article.subsecao].filter(Boolean).join(' · ');

                if (isOpen) {
                  return (
                    <div key={article.numero} className="bg-[#473c33] rounded-[40px] md:rounded-[60px] p-8 md:p-16 border border-white/10 relative overflow-hidden backdrop-blur-2xl shadow-2xl">
                      <div className="absolute top-0 left-0 w-3 h-full bg-[#fdad74] opacity-60"></div>
                      <button onClick={() => setOpenArticle(null)} className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors">
                        <ChevronDown className="w-7 h-7 rotate-180" />
                      </button>
                      <div className="flex items-center gap-6 mb-10">
                        <div className="w-16 h-16 bg-[#fdad74] text-white rounded-[25px] flex items-center justify-center shadow-lg shadow-[#ac4800]/40 flex-shrink-0">
                          <Scale className="w-8 h-8" />
                        </div>
                        <div className="min-w-0">
                          {context && <h4 className="text-[#fdad74] font-black uppercase text-[10px] tracking-[0.4em] mb-2 truncate">{context}</h4>}
                          <h3 className="text-4xl md:text-5xl font-black tracking-tighter uppercase text-white leading-none">Art. {article.numero}</h3>
                        </div>
                      </div>

                      <div className="text-slate-100 text-xl md:text-2xl leading-[1.6] font-medium whitespace-pre-wrap">{article.texto}</div>
                    </div>
                  );
                }

                return (
                  <button key={article.numero} onClick={() => setOpenArticle(article.numero)} className="w-full bg-white rounded-2xl border-2 border-gray-100 flex items-center justify-between gap-4 p-5 text-left hover:shadow-lg hover:border-[#fed6ba] transition-all">
                    <div className="min-w-0">
                      <p className="font-black text-gray-900">Art. {article.numero}</p>
                      {context && <p className="text-xs text-gray-400 font-bold uppercase tracking-wide truncate">{context}</p>}
                    </div>
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </button>
                );
              })}
            </div>

            {filtered.length === 0 && <p className="text-center text-gray-400 font-bold py-12">Nenhum artigo encontrado.</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default VadeMecumView;
