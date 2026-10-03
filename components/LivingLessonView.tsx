import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from './icons';
import { IllustratedLesson, IllustratedLessonBox, IllustratedLessonPage, StudyProfile, ExplanationStyle } from '../types';
import { generateLivingLesson } from '../services/geminiService';
import BookLoader from './BookLoader';

const SOURCE_LABEL: Record<NonNullable<IllustratedLesson['sources']>[number]['kind'], string> = {
  lei: 'Vade Mecum',
  wikidata: 'Wikidata',
  wikipedia: 'Wikipédia',
  wikilivros: 'Wikilivros',
};

const INK = 'text-[#473c33] dark:text-[#f2efd2]';
const MUTED = 'text-[#725442] dark:text-[#c8c5a9]';
const PAPER = 'bg-[#fdfbf7] dark:bg-[#24251f]';
const CARD = 'bg-white dark:bg-[#2d2e27]';
const RULE = 'border-[#e8dcc8] dark:border-white/10';

const BoxTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-t-2xl bg-[#e96f34] px-4 py-2 text-center font-logo text-lg tracking-wide text-white">{children}</div>
);

// "(Redação dada pela Lei nº …)" / "(Incluído pela Lei nº …)" become quiet tags so the
// official wording stays easy to read.
const LAW_NOTE_RE = /(\((?:Redação dada|Incluíd[oa]|Revogad[oa])[^)]*\))/g;
const LAW_NOTE_START = /^\((?:Redação dada|Incluíd[oa]|Revogad[oa])/;
const LawText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(LAW_NOTE_RE).map((part, i) =>
      LAW_NOTE_START.test(part) ? (
        <span key={i} className={`mx-0.5 inline-block rounded-md bg-black/5 px-1.5 py-0.5 text-xs leading-tight dark:bg-white/10 ${MUTED}`}>{part.slice(1, -1)}</span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    )}
  </>
);

// The caput stays open; the paragraphs fold away so long articles do not push the lesson down.
const LawBox: React.FC<{ box: IllustratedLessonBox }> = ({ box }) => {
  const [open, setOpen] = useState(false);
  const [first, ...rest] = box.items;
  const shown = open ? box.items : [first];
  return (
    <section className={`overflow-hidden rounded-2xl border ${RULE} ${CARD}`}>
      <BoxTitle>{box.title}</BoxTitle>
      <div className="space-y-4 p-4">
        {shown.map((item, i) => (
          <figure key={i} className="border-l-4 border-[#e96f34] pl-3">
            <figcaption className="mb-1 text-xs font-black uppercase tracking-wide text-[#e96f34]">{item.label}</figcaption>
            <p className={`whitespace-pre-line text-sm leading-relaxed ${INK}`}><LawText text={item.text} /></p>
          </figure>
        ))}
        {rest.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={`flex min-h-[48px] w-full items-center justify-between rounded-xl border px-4 text-xs font-black uppercase tracking-wide text-[#e96f34] ${RULE}`}
          >
            {open ? 'Recolher parágrafos' : `Ver parágrafos (${rest.length})`}
            <ChevronRight className={`h-4 w-4 transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
          </button>
        )}
      </div>
    </section>
  );
};

const Box: React.FC<{ box: IllustratedLessonBox }> = ({ box }) => {
  if (box.kind === 'table') {
    return (
      <section className={`overflow-hidden rounded-2xl border ${RULE} ${CARD}`}>
        <BoxTitle>{box.title}</BoxTitle>
        <div className="divide-y divide-[#efe6d6] dark:divide-white/10">
          {box.items.map((item, i) => (
            <div key={i} className="grid grid-cols-[7.5rem_1fr] items-center gap-4 px-4 py-3">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff0e5] text-sm font-black text-[#e96f34] dark:bg-[#35362e]">{i + 1}</span>
                <span className="text-xs font-black uppercase leading-tight tracking-wide text-[#e96f34]">{item.label}</span>
              </div>
              <p className={`text-sm leading-relaxed ${INK}`}>{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (box.kind === 'law') return <LawBox box={box} />;

  if (box.kind === 'steps') {
    return (
      <section className={`overflow-hidden rounded-2xl border ${RULE} ${CARD}`}>
        <BoxTitle>{box.title}</BoxTitle>
        <ol className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2">
          {box.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e96f34] text-xs font-black text-white">{i + 1}</span>
              <p className={`text-sm leading-snug ${INK}`}>
                <b className="text-[#e96f34]">{item.label}.</b> {item.text}
              </p>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section className={`overflow-hidden rounded-2xl border ${RULE} ${CARD}`}>
      <BoxTitle>{box.title}</BoxTitle>
      <ol className="relative grid grid-cols-2 gap-y-6 p-5 sm:grid-cols-5">
        <span aria-hidden="true" className="absolute left-5 right-5 top-[2.1rem] hidden h-0.5 bg-[#e96f34]/40 sm:block" />
        {box.items.map((item, i) => (
          <li key={i} className="relative flex flex-col items-center text-center">
            <span className="relative z-10 rounded-full border-2 border-[#e96f34] bg-[#fdfbf7] px-3 py-1 font-logo text-sm text-[#e96f34] dark:bg-[#24251f]">{item.label}</span>
            <p className={`mt-2 px-1 text-xs leading-snug ${INK}`}>{item.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
};

const QuoteMark: React.FC<{ flip?: boolean }> = ({ flip }) => (
  <svg aria-hidden="true" viewBox="0 0 48 40" className={`h-9 w-11 text-[#e96f34]/45 ${flip ? 'rotate-180' : ''}`} fill="currentColor">
    <path d="M0 40V22C0 9 7 2 20 0v8c-6 1-9 5-9 10h9v22H0Zm26 0V22C26 9 33 2 46 0v8c-6 1-9 5-9 10h9v22H26Z" />
  </svg>
);

interface LessonBookProps {
  lesson: IllustratedLesson;
  onBack: () => void;
}

const PageContent: React.FC<{ page: IllustratedLessonPage; lesson: IllustratedLesson; first: boolean }> = ({ page, lesson, first }) => {
  const initials = page.profile?.name
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  const topBoxes = page.quote ? page.boxes.slice(0, 1) : [];
  const restBoxes = page.quote ? page.boxes.slice(1) : page.boxes;

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e96f34]">{lesson.subject}</p>
        <h1 className={`font-logo leading-tight ${INK} ${first ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'}`}>{lesson.topic}</h1>
        {page.lead && <p className={`mt-3 max-w-3xl text-base font-semibold leading-relaxed ${INK}`}>{page.lead}</p>}
      </header>

      {page.quote && (
        <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
          <blockquote className="flex flex-col items-center justify-center gap-3 px-2 text-center">
            <QuoteMark />
            <p className={`font-logo text-2xl leading-snug ${INK}`}>{page.quote.text}</p>
            <footer className="text-sm font-black italic text-[#e96f34]">{page.quote.author}</footer>
            <QuoteMark flip />
          </blockquote>
          <div className="space-y-6">{topBoxes.map((b, i) => <Box key={i} box={b} />)}</div>
        </div>
      )}

      <div className={`${page.quote ? 'mt-8' : ''} grid gap-8 ${page.profile ? 'lg:grid-cols-[1fr_16rem]' : ''}`}>
        <div>
          {page.sections.length > 0 && (
            <div className="columns-1 gap-8 md:columns-2">
              {page.sections.map((section, i) => (
                <div key={i} className="mb-5 break-inside-avoid-column">
                  <h2 className="mb-2 font-logo text-xl text-[#e96f34]">{section.heading}</h2>
                  {section.paragraphs.map((p, j) => (
                    <p key={j} className={`mb-3 text-left hyphens-auto text-sm leading-relaxed ${INK}`}>{p}</p>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 space-y-6">{restBoxes.map((b, i) => <Box key={i} box={b} />)}</div>
        </div>

        {page.profile && (
          <aside className={`h-fit rounded-2xl border ${RULE} ${CARD} p-4`}>
            <div className="mx-auto mb-3 flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e96f34] to-[#f3a06c] font-logo text-4xl text-white" aria-hidden="true">{initials}</div>
            <h3 className="rounded-md bg-[#fff0e5] px-2 py-1 text-center font-logo text-lg text-[#e96f34] dark:bg-[#35362e]">{page.profile.name}</h3>
            <p className={`mt-1 text-center text-xs font-black uppercase tracking-wide ${MUTED}`}>{page.profile.role}</p>
            <p className={`mt-3 text-left hyphens-auto text-xs leading-relaxed ${INK}`}>{page.profile.bio}</p>
            {page.profile.works.length > 0 && (
              <>
                <h4 className="mt-4 border-b border-[#e96f34]/40 pb-1 text-xs font-black uppercase tracking-widest text-[#e96f34]">Outras obras</h4>
                <ul className="mt-2 space-y-1">
                  {page.profile.works.map((w) => (
                    <li key={w.year + w.title} className={`text-xs leading-snug ${INK}`}>
                      <b>{w.year}</b> <span className={MUTED}>{w.title}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        )}
      </div>
    </>
  );
};

const LessonBook: React.FC<LessonBookProps> = ({ lesson, onBack }) => {
  const [pageIndex, setPageIndex] = useState(0);
  const articleRef = useRef<HTMLElement>(null);
  const total = lesson.pages.length;
  const isLast = pageIndex === total - 1;

  const goTo = (next: number) => setPageIndex(Math.min(total - 1, Math.max(0, next)));

  useEffect(() => {
    if (pageIndex > 0) articleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pageIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'ArrowRight') setPageIndex((i) => Math.min(total - 1, i + 1));
      if (e.key === 'ArrowLeft') setPageIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  return (
    <article ref={articleRef} lang="pt-BR" className={`mx-auto w-full max-w-5xl rounded-[28px] p-5 sm:p-8 ${PAPER}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <button type="button" onClick={onBack} aria-label="Voltar" className={`flex h-11 w-11 items-center justify-center rounded-full border ${RULE} ${CARD} ${INK} transition-transform hover:scale-105 active:scale-95`}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-1 items-baseline justify-between gap-4">
          <span className="font-logo text-xs uppercase tracking-[0.2em] text-[#e96f34]">Aula Viva</span>
          <span className={`text-right text-xs font-black uppercase tracking-[0.18em] ${MUTED}`}>
            {lesson.section} <span className="mx-1 text-[#e96f34]">|</span> <span className="font-logo text-sm text-[#e96f34]">{pageIndex + 1}</span>
          </span>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="mb-4 h-3 opacity-60"
        style={{ backgroundImage: 'url("/sul-americano-triangulos.svg")', backgroundRepeat: 'repeat-x', backgroundSize: 'auto 100%' }}
      />

      {pageIndex === 0 && (
        <p className={`mb-6 text-xs leading-relaxed ${MUTED}`}>
          <b className={INK}>Veja também:</b> {lesson.seeAlso.join(' · ')}
        </p>
      )}

      <PageContent page={lesson.pages[pageIndex]} lesson={lesson} first={pageIndex === 0} />

      {isLast && (
        <p className={`mt-8 rounded-2xl border ${RULE} ${CARD} p-3 text-xs leading-relaxed ${MUTED}`}>
          {lesson.sources && lesson.sources.length > 0 ? (
            <>
              <b className={INK}>Fontes de apoio:</b>{' '}
              {lesson.sources.map((src, i) => (
                <React.Fragment key={src.url}>
                  {i > 0 && ' · '}
                  <a href={src.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[#e96f34] underline">
                    {SOURCE_LABEL[src.kind]}: {src.title}
                  </a>
                </React.Fragment>
              ))}
              . Datas, nomes e artigos de lei foram conferidos nessas fontes; o texto foi reescrito pela IA. Para prova oficial, confirme também no seu material.
            </>
          ) : (
            <>
              <b className={INK}>Atenção:</b> não encontrei uma fonte externa para este assunto, então o conteúdo veio só da IA. Confira datas, nomes e números no seu material antes de decorar.
            </>
          )}
        </p>
      )}

      <nav aria-label="Páginas da aula" className={`sticky bottom-0 z-20 -mx-5 -mb-5 mt-10 flex items-center justify-between gap-3 rounded-b-[28px] border-t px-5 py-3 sm:-mx-8 sm:-mb-8 sm:px-8 ${RULE} ${PAPER}`}>
        <button
          type="button"
          onClick={() => goTo(pageIndex - 1)}
          disabled={pageIndex === 0}
          className={`flex min-h-[48px] items-center gap-2 rounded-full border px-4 text-xs font-black uppercase tracking-wide ${RULE} ${CARD} ${INK} transition-all enabled:hover:border-[#e96f34] disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <div className="flex flex-col items-center gap-1" aria-hidden="true">
          <div className="flex items-center gap-2">
            {lesson.pages.map((_, i) => (
              <span key={i} className={`h-2 rounded-full transition-all ${i === pageIndex ? 'w-6 bg-[#e96f34]' : 'w-2 bg-[#e96f34]/30'}`} />
            ))}
          </div>
          <span className={`text-xs font-black tabular-nums ${MUTED}`}>{pageIndex + 1} / {total}</span>
        </div>
        {isLast ? (
          <button type="button" onClick={onBack} className="flex min-h-[48px] items-center gap-2 rounded-full bg-[#bf4f1b] px-5 text-xs font-black uppercase tracking-wide text-white transition-transform hover:scale-105 active:scale-95">
            Concluir aula
          </button>
        ) : (
          <button type="button" onClick={() => goTo(pageIndex + 1)} className="flex min-h-[48px] items-center gap-2 rounded-full bg-[#bf4f1b] px-5 text-xs font-black uppercase tracking-wide text-white transition-transform hover:scale-105 active:scale-95">
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </nav>
      <p className="sr-only" aria-live="polite">Página {pageIndex + 1} de {total}</p>
    </article>
  );
};

interface LivingLessonViewProps {
  subject: string;
  topic: string;
  profile?: StudyProfile;
  explanationStyle?: ExplanationStyle;
  onBack: () => void;
}

// One generation per request: React dev mode runs effects twice, and without
// this the (slow, local) model would be asked for the same lesson twice.
const inFlight = new Map<string, Promise<IllustratedLesson>>();
const requestLesson = (key: string, start: () => Promise<IllustratedLesson>): Promise<IllustratedLesson> => {
  let promise = inFlight.get(key);
  if (!promise) {
    promise = start().finally(() => {
      setTimeout(() => inFlight.delete(key), 0);
    });
    inFlight.set(key, promise);
  }
  return promise;
};

const RATE_LIMIT_RE = /\b429\b|rate[ _-]?limit|quota|limite de/i;
const RATE_LIMIT_WAIT_MS = 20000;
const MAX_AUTO_RETRIES = 3;

const LivingLessonView: React.FC<LivingLessonViewProps> = ({ subject, topic, profile = 'VESTIBULAR', explanationStyle, onBack }) => {
  const [lesson, setLesson] = useState<IllustratedLesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [waitingLimit, setWaitingLimit] = useState(false);
  const [slow, setSlow] = useState(false);
  const autoRetries = useRef(0);
  const missingRequest = !subject.trim() || !topic.trim();

  useEffect(() => {
    if (missingRequest) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), 25000);
    setLesson(null);
    setError(null);
    requestLesson(`${subject}|${topic}|${profile}|${explanationStyle ?? ''}|${attempt}`, () => generateLivingLesson(subject, topic, profile, explanationStyle))
      .then((data: IllustratedLesson) => {
        if (cancelled) return;
        autoRetries.current = 0;
        setWaitingLimit(false);
        setLesson(data);
      })
      .catch((e: any) => {
        if (cancelled) return;
        const message = e?.message || 'Não foi possível gerar a aula agora.';
        if (RATE_LIMIT_RE.test(message) && autoRetries.current < MAX_AUTO_RETRIES) {
          autoRetries.current += 1;
          setWaitingLimit(true);
          timer = setTimeout(() => setAttempt((n) => n + 1), RATE_LIMIT_WAIT_MS);
          return;
        }
        setWaitingLimit(false);
        setError(message);
      });
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      if (timer) clearTimeout(timer);
    };
  }, [subject, topic, profile, explanationStyle, attempt, missingRequest]);

  if (missingRequest) {
    return (
      <div className={`mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-[28px] p-8 text-center ${PAPER}`}>
        <h2 className={`font-logo text-2xl ${INK}`}>Escolha a matéria e o assunto</h2>
        <p className={`text-sm leading-relaxed ${MUTED}`}>Abra a Aula Viva pelo painel, informando matéria e assunto, para montarmos a aula.</p>
        <button type="button" onClick={onBack} className="rounded-full bg-[#bf4f1b] px-5 py-2 text-xs font-black uppercase tracking-wide text-white">Voltar ao painel</button>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className={`mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-[28px] p-8 text-center ${PAPER}`}>
        <h2 className={`font-logo text-2xl ${INK}`}>Não deu para montar a aula</h2>
        <p className={`text-sm leading-relaxed ${MUTED}`}>{error}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onBack} className={`rounded-full border px-5 py-2 text-xs font-black uppercase tracking-wide ${RULE} ${CARD} ${INK}`}>Voltar</button>
          <button type="button" onClick={() => { autoRetries.current = 0; setAttempt((n) => n + 1); }} className="flex items-center gap-2 rounded-full bg-[#bf4f1b] px-5 py-2 text-xs font-black uppercase tracking-wide text-white">
            <RotateCcw className="h-4 w-4" /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div role="status" className="flex min-h-[55vh] flex-col items-center justify-center gap-10 text-center">
        <BookLoader className="scale-[2.4] sm:scale-[3]" />
        <div className="mt-6">
          <p className={`font-logo text-xl ${INK}`}>Montando sua Aula Viva sobre {topic}...</p>
          <p className={`mt-1 text-xs font-bold uppercase tracking-widest ${MUTED}`}>
            {waitingLimit ? 'O provedor gratuito atingiu o limite. Tentando de novo em instantes...' : slow ? 'Ainda montando. A IA local pode levar alguns minutos, pode deixar aberto.' : 'Quadros, linha do tempo e revisão em 3 páginas'}
          </p>
        </div>
      </div>
    );
  }

  return <LessonBook lesson={lesson} onBack={onBack} />;
};

export default LivingLessonView;
