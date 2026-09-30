import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Scale, Search, ChevronDown } from './icons';
import { VadeMecumArticle, VADE_MECUM_LAWS } from '../types';
import { getVadeMecumArticles, searchVadeMecumArticles } from '../services/vademecumService';
import LoadingFish from './LoadingFish';

interface VadeMecumViewProps {
  onBack: () => void;
}

const VadeMecumView: React.FC<VadeMecumViewProps> = ({ onBack }) => {
  const bookTextSizes = [15, 17, 19, 21] as const;
  const [lawId, setLawId] = useState(VADE_MECUM_LAWS[0].id);
  const [articles, setArticles] = useState<VadeMecumArticle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openArticle, setOpenArticle] = useState<string | null>(null);
  const [readingMode, setReadingMode] = useState<'list' | 'book'>(() => {
    if (typeof window === 'undefined') return 'list';
    try {
      return window.localStorage.getItem('vadeMecumReadingMode') === 'book' ? 'book' : 'list';
    } catch {
      return 'list';
    }
  });
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [pageTurn, setPageTurn] = useState<'next' | 'previous' | null>(null);
  const pageTurnTimer = useRef<number | null>(null);
  const pageTurnLocked = useRef(false);
  const [bookTextSizeIndex, setBookTextSizeIndex] = useState(() => {
    if (typeof window === 'undefined') return 1;
    try {
      const savedSize = Number(window.localStorage.getItem('vadeMecumBookTextSize'));
      return Number.isInteger(savedSize) && savedSize >= 0 && savedSize < bookTextSizes.length ? savedSize : 1;
    } catch {
      return 1;
    }
  });

  const cancelPageTurn = () => {
    if (pageTurnTimer.current !== null) {
      window.clearTimeout(pageTurnTimer.current);
      pageTurnTimer.current = null;
    }
    pageTurnLocked.current = false;
    setPageTurn(null);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem('vadeMecumReadingMode', readingMode);
    } catch {
      // Keep the reader usable if this browser blocks local storage.
    }
  }, [readingMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem('vadeMecumBookTextSize', String(bookTextSizeIndex));
    } catch {
      // Keep the reader usable if this browser blocks local storage.
    }
  }, [bookTextSizeIndex]);

  useEffect(() => {
    setArticles(null);
    setError(null);
    setOpenArticle(null);
    setQuery('');
    setSpreadIndex(0);
    cancelPageTurn();
    getVadeMecumArticles(lawId)
      .then(setArticles)
      .catch(() => setError('Não foi possível carregar essa legislação agora.'));
  }, [lawId]);

  useEffect(() => {
    setSpreadIndex(0);
  }, [query]);

  useEffect(() => () => {
    if (pageTurnTimer.current !== null) window.clearTimeout(pageTurnTimer.current);
  }, []);

  const filtered = useMemo(() => {
    if (!articles) return [];
    return searchVadeMecumArticles(articles, query);
  }, [articles, query]);

  const currentLaw = VADE_MECUM_LAWS.find((law) => law.id === lawId) ?? VADE_MECUM_LAWS[0];
  const spreadCount = Math.ceil(filtered.length / 2);
  const currentSpread = filtered.slice(spreadIndex * 2, spreadIndex * 2 + 2);
  const previousSpread = filtered.slice(Math.max(0, spreadIndex - 1) * 2, Math.max(0, spreadIndex - 1) * 2 + 2);
  const nextSpread = filtered.slice((spreadIndex + 1) * 2, (spreadIndex + 1) * 2 + 2);

  const completePageTurn = (direction: 'next' | 'previous') => {
    if (!pageTurnLocked.current) return;
    if (pageTurnTimer.current !== null) window.clearTimeout(pageTurnTimer.current);
    setSpreadIndex((page) => page + (direction === 'next' ? 1 : -1));
    setPageTurn(null);
    pageTurnLocked.current = false;
    pageTurnTimer.current = null;
  };

  const moveSpread = (direction: 'next' | 'previous') => {
    const isOutOfBounds = direction === 'next' ? spreadIndex >= spreadCount - 1 : spreadIndex === 0;
    if (isOutOfBounds || pageTurnLocked.current) return;

    const canAnimate = window.matchMedia('(min-width: 768px)').matches
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (canAnimate) {
      pageTurnLocked.current = true;
      setPageTurn(direction);
      pageTurnTimer.current = window.setTimeout(() => {
        completePageTurn(direction);
      }, 1000);
    } else {
      setSpreadIndex((page) => page + (direction === 'next' ? 1 : -1));
    }
  };

  const renderBookPage = (article: VadeMecumArticle | undefined, pageNumber: number) => {
    if (!article) {
      return <div key={`blank-${pageNumber}`} className="vade-book-page hidden md:flex flex-col justify-between border-l border-[#dfd2bc]/70 bg-[#fffaf0] px-8 py-9 dark:border-[#4a493d] dark:bg-[#292a23]" aria-hidden="true" />;
    }

    const context = [article.titulo, article.capitulo, article.secao, article.subsecao].filter(Boolean).join(' · ');
    const paragraphs = article.texto.split(/\n+/).map((part) => part.trim()).filter(Boolean);

    return (
      <article key={article.numero} className="vade-book-page relative flex flex-col overflow-clip bg-[#fffaf0] px-6 py-7 text-[#473c33] sm:px-9 sm:py-9 md:px-10 dark:bg-[#292a23] dark:text-[#eee9d0]">
        <div className="mb-7 flex items-center justify-between gap-4 border-b border-[#d8c7a9]/70 pb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9c8666] dark:border-[#4a493d] dark:text-[#b5ad8c]">
          <span className="truncate">{currentLaw.shortName}</span>
          <span className="shrink-0">{pageNumber}</span>
        </div>
        {context && <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#bb5c2b] dark:text-[#f28a4c]">{context}</p>}
        <h3 className="mb-5 font-serif text-2xl font-bold leading-tight sm:text-3xl">Art. {article.numero}</h3>
        <div className="vade-book-page-content min-h-0 flex-1 overflow-y-auto pr-2 font-serif leading-[1.75]" style={{ fontSize: `${bookTextSizes[bookTextSizeIndex]}px` }}>
          <div className="space-y-4">
          {paragraphs.map((paragraph, index) => (
            <p key={`${article.numero}-${index}`} className={index === 0 ? 'first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:text-[3em] first-letter:font-bold first-letter:leading-[0.8] first-letter:text-[#d86632] dark:first-letter:text-[#f28a4c]' : 'indent-6'}>
              {paragraph}
            </p>
          ))}
          </div>
        </div>
        <div className="mt-auto pt-8 text-center font-serif text-xs italic text-[#a39279] dark:text-[#a8a188]">{pageNumber}</div>
      </article>
    );
  };

  return (
    <div className="flex-1 w-full flex flex-col bg-[#FDFBF7] text-[#473c33] h-full dark:bg-[#1c1712] dark:text-[#f4ebdd]" style={{ overflowY: 'auto' }}>
      <div className="bg-white px-8 py-8 md:py-10 shadow-sm border-b border-gray-100 flex-shrink-0 flex items-center justify-between sticky top-0 z-30 dark:bg-[#272019] dark:border-white/[0.08]">
        <div>
          <h2 className="font-logo text-3xl text-gray-900 flex items-center gap-3 dark:text-[#f4ebdd]">
            <Scale className="w-8 h-8 text-[#fdad74]" />
            Vade Mecum
          </h2>
          <select
            value={lawId}
            onChange={(e) => { cancelPageTurn(); setLawId(e.target.value); }}
            className="mt-1 text-gray-500 font-medium tracking-wide uppercase text-sm bg-transparent border-none focus:outline-none cursor-pointer hover:text-gray-700 dark:text-[#c2baa0] dark:hover:text-white"
          >
            {VADE_MECUM_LAWS.map((law) => (
              <option key={law.id} value={law.id}>{law.name}</option>
            ))}
          </select>
        </div>

        <button onClick={onBack} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors uppercase tracking-widest text-sm dark:bg-[#3a2f22] dark:text-[#f4ebdd] dark:hover:bg-[#493a29]">
          Voltar
        </button>
      </div>

      <div className="p-6 md:p-10 w-full max-w-6xl mx-auto space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input value={query} onChange={(e) => { cancelPageTurn(); setQuery(e.target.value); }} placeholder="Buscar por número do artigo ou palavra-chave..." className="w-full bg-white border-2 border-gray-200 rounded-2xl pl-12 pr-4 py-4 text-base font-medium focus:outline-none focus:border-[#fdb887] transition-colors dark:bg-[#292a23] dark:border-white/10 dark:text-[#f4ebdd] dark:placeholder:text-[#aaa58e]" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#eadfce] bg-white p-3 dark:border-[#454438] dark:bg-[#292a23]">
          <div>
            <p className="px-2 text-xs font-black uppercase tracking-[0.16em] text-[#8e8170] dark:text-[#c2baa0]">Formato de leitura</p>
            <p className="px-2 pt-1 text-sm text-[#9b9183] dark:text-[#aaa58e]">A escolha fica salva neste dispositivo.</p>
          </div>
          <div className="flex rounded-xl bg-[#f6f1e8] p-1 dark:bg-[#20211c]" role="group" aria-label="Formato de leitura do Vade Mecum">
            <button type="button" aria-pressed={readingMode === 'list'} onClick={() => { cancelPageTurn(); setReadingMode('list'); }} className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${readingMode === 'list' ? 'bg-[#473c33] text-white shadow-sm dark:bg-[#e86c32] dark:text-white' : 'text-[#766b5c] hover:bg-white dark:text-[#c2baa0] dark:hover:bg-white/5'}`}>
              Lista
            </button>
            <button type="button" aria-pressed={readingMode === 'book'} onClick={() => setReadingMode('book')} className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${readingMode === 'book' ? 'bg-[#473c33] text-white shadow-sm dark:bg-[#e86c32] dark:text-white' : 'text-[#766b5c] hover:bg-white dark:text-[#c2baa0] dark:hover:bg-white/5'}`}>
              Livro aberto
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-6 text-center font-bold">{error}</div>}

        {!error && !articles && <LoadingFish message="Carregando a legislação..." />}

        {articles && (
          <>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs dark:text-[#aaa58e]">
              {filtered.length} de {articles.length} artigos
            </p>

            {filtered.length === 0 ? (
              <p className="text-center text-gray-400 font-bold py-12 dark:text-[#aaa58e]">Nenhum artigo encontrado.</p>
            ) : readingMode === 'book' ? (
              <section aria-label="Leitura em formato de livro" className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <p className="text-sm font-bold text-[#786b5a] dark:text-[#c2baa0]">Páginas {spreadIndex * 2 + 1}–{Math.min(spreadIndex * 2 + currentSpread.length, filtered.length)} de {filtered.length}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 rounded-xl border border-[#d9cbb6] bg-white p-1 dark:border-[#4a493d] dark:bg-[#292a23]" role="group" aria-label="Tamanho do texto do livro">
                      <span className="px-2 text-xs font-bold text-[#786b5a] dark:text-[#c2baa0]">Texto</span>
                      <button type="button" onClick={() => setBookTextSizeIndex((size) => Math.max(0, size - 1))} disabled={bookTextSizeIndex === 0} aria-label="Diminuir tamanho do texto" className="h-8 w-8 rounded-lg font-serif text-sm font-bold text-[#6f6252] transition hover:bg-[#f8f1e5] disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#d3cbae] dark:hover:bg-white/5">A−</button>
                      <span className="min-w-10 text-center text-xs font-bold tabular-nums text-[#786b5a] dark:text-[#c2baa0]" aria-live="polite">{bookTextSizes[bookTextSizeIndex]}px</span>
                      <button type="button" onClick={() => setBookTextSizeIndex((size) => Math.min(bookTextSizes.length - 1, size + 1))} disabled={bookTextSizeIndex === bookTextSizes.length - 1} aria-label="Aumentar tamanho do texto" className="h-8 w-8 rounded-lg font-serif text-lg font-bold text-[#6f6252] transition hover:bg-[#f8f1e5] disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#d3cbae] dark:hover:bg-white/5">A+</button>
                    </div>
                    <button type="button" onClick={() => moveSpread('previous')} disabled={spreadIndex === 0 || pageTurn !== null} className="rounded-xl border border-[#d9cbb6] bg-white px-4 py-2 text-sm font-bold text-[#6f6252] transition hover:bg-[#f8f1e5] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#4a493d] dark:bg-[#292a23] dark:text-[#d3cbae] dark:hover:bg-white/5">
                      Anterior
                    </button>
                    <button type="button" onClick={() => moveSpread('next')} disabled={spreadIndex >= spreadCount - 1 || pageTurn !== null} className="rounded-xl bg-[#e86c32] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#cf5725] disabled:cursor-not-allowed disabled:opacity-40">
                      Próximas páginas
                    </button>
                  </div>
                </div>
                <div className="overflow-clip rounded-[24px] border-[9px] border-[#473c33] bg-[#f4ead8] p-1 shadow-[0_18px_40px_rgba(71,60,51,.18)] dark:border-[#171812] dark:bg-[#25261f] sm:rounded-[30px] sm:border-[12px]">
                  <div className="vade-book-spread relative grid overflow-clip rounded-[15px] border border-[#ddcfb9] md:grid-cols-2 dark:border-[#414136]">
                    <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 hidden w-5 -translate-x-1/2 bg-gradient-to-r from-[#4f4438]/15 via-[#fffaf0]/45 to-[#4f4438]/15 md:block dark:from-black/25 dark:via-[#292a23]/50 dark:to-black/25" />
                    {renderBookPage(pageTurn === 'previous' ? previousSpread[0] : currentSpread[0], pageTurn === 'previous' ? (spreadIndex - 1) * 2 + 1 : spreadIndex * 2 + 1)}
                    {renderBookPage(pageTurn === 'next' ? nextSpread[1] : currentSpread[1], pageTurn === 'next' ? (spreadIndex + 1) * 2 + 2 : spreadIndex * 2 + 2)}

                    {pageTurn && (
                      <div
                        className={`vade-page-turn vade-page-turn-${pageTurn}`}
                        onAnimationEnd={(event) => {
                          if (event.target === event.currentTarget) completePageTurn(pageTurn);
                        }}
                        aria-hidden="true"
                      >
                        <div className="vade-page-turn-face vade-page-turn-front">
                          {renderBookPage(pageTurn === 'next' ? currentSpread[1] : currentSpread[0], pageTurn === 'next' ? spreadIndex * 2 + 2 : spreadIndex * 2 + 1)}
                        </div>
                        <div className="vade-page-turn-face vade-page-turn-back">
                          {renderBookPage(pageTurn === 'next' ? nextSpread[0] : previousSpread[1], pageTurn === 'next' ? (spreadIndex + 1) * 2 + 1 : spreadIndex * 2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ) : (
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
                  <button key={article.numero} onClick={() => setOpenArticle(article.numero)} className="w-full bg-white rounded-2xl border-2 border-gray-100 flex items-center justify-between gap-4 p-5 text-left hover:shadow-lg hover:border-[#fed6ba] transition-all dark:bg-[#292a23] dark:border-white/[0.08] dark:hover:border-[#e96f34]/50">
                    <div className="min-w-0">
                      <p className="font-black text-gray-900 dark:text-[#f4ebdd]">Art. {article.numero}</p>
                      {context && <p className="text-xs text-gray-400 font-bold uppercase tracking-wide truncate dark:text-[#aaa58e]">{context}</p>}
                    </div>
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VadeMecumView;
