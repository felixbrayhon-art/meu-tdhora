import { IllustratedLesson, IllustratedLessonBox, IllustratedLessonPage } from '../types';

export type SourceKind = 'wikipedia' | 'wikilivros' | 'lei' | 'wikidata';

export interface TopicSource {
  kind: SourceKind;
  title: string;
  url: string;
  text: string;
  // Official article numbers included from a law source (e.g. "157", "157-A").
  articles?: string[];
  // Verbatim official text per article, shown in its own box (never AI-written).
  lawItems?: { label: string; text: string }[];
  // Official amendments (law number + year per dispositivo) read from the law text.
  lawChanges?: { label: string; text: string }[];
}

const WIKI_API = 'https://pt.wikipedia.org/w/api.php';
const FETCH_TIMEOUT_MS = 7000;

export const normalize = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const tokens = (value: string): string[] =>
  normalize(value).split(/[^a-z0-9]+/).filter((t) => t.length > 2);

export const wikiGet = async (params: Record<string, string>, api: string = WIKI_API): Promise<any> => {
  const url = `${api}?${new URLSearchParams({ format: 'json', origin: '*', ...params }).toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
  return res.json();
};

// Picks the article whose TITLE is the topic itself (or the topic plus a
// qualifier such as "Função (matemática)"). Looser matches are rejected on
// purpose: a wrong article drags the whole lesson off the requested subject.
export const scoreCandidate = (title: string, topic: string, subject: string): number => {
  const topicNorm = normalize(topic).trim();
  const titleNorm = normalize(title).trim();
  const topicTokens = tokens(topic);
  const titleTokens = tokens(title);
  if (topicTokens.length === 0 || !topicTokens.every((t) => titleTokens.includes(t))) return 0;
  if (titleNorm === topicNorm) return 100;
  const qualified = titleNorm.startsWith(`${topicNorm} (`);
  if (qualified) {
    const qualifier = titleNorm.slice(topicNorm.length);
    return tokens(subject).some((t) => qualifier.includes(t)) ? 95 : 80;
  }
  // Title contains every topic word but adds others (e.g. "Força física"
  // for "Força"): only trust it when nothing extra changes the meaning.
  return titleTokens.length <= topicTokens.length + 1 ? 50 : 0;
};

// Finds a Portuguese Wikipedia article for the topic so the lesson can be
// written from real text instead of the model's memory. Returns null when
// nothing clearly matches (the caller then falls back to model-only rules).
export const fetchTopicSource = async (subject: string, topic: string): Promise<TopicSource | null> => {
  try {
    const search = await wikiGet({ action: 'query', list: 'search', srsearch: `${topic} ${subject}`, srlimit: '8' });
    const hits: { title: string }[] = search?.query?.search ?? [];
    const ranked = hits
      .map((hit, index) => ({ title: hit.title, score: scoreCandidate(hit.title, topic, subject), index }))
      .filter((c) => c.score >= 80)
      .sort((x, y) => y.score - x.score || x.index - y.index);
    if (ranked.length === 0) return null;
    const match = ranked[0];

    const page = await wikiGet({
      action: 'query',
      prop: 'extracts',
      explaintext: '1',
      exsectionformat: 'plain',
      redirects: '1',
      titles: match.title,
    });
    const pages = page?.query?.pages ?? {};
    const first: any = Object.values(pages)[0];
    const text: string = (first?.extract ?? '').trim();
    if (text.length < 800) return null;
    if (/pode referir-se a|desambigua/i.test(text.slice(0, 400))) return null;

    // The article must also belong to the requested subject area.
    const subjectTokens = tokens(subject);
    const textNorm = normalize(text);
    if (subjectTokens.length > 0 && !subjectTokens.some((t) => textNorm.includes(t)) && match.score < 95) return null;

    const title: string = first.title ?? match.title;
    return {
      kind: 'wikipedia',
      title,
      url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      text,
    };
  } catch {
    return null;
  }
};

const YEAR_RE = /\b(1[0-9]{3}|20[0-4][0-9])\b/g;
const WINDOW = 220;

const yearsIn = (value: string): string[] => value.match(YEAR_RE) ?? [];

// A year is only trusted when it appears in the source close to the words it
// is attached to (e.g. a work's title or the event), not just anywhere in it.
// This catches the common slip of pairing a real year with the wrong item.
const pairSupported = (normSource: string, year: string, phrase: string, minTokenLen: number, minHits: number): boolean => {
  const words = Array.from(new Set(tokens(phrase.replace(YEAR_RE, ' ')).filter((w) => w.length >= minTokenLen)));
  if (words.length === 0) return normSource.includes(year);
  const need = Math.min(minHits, words.length);
  let from = 0;
  while (true) {
    const at = normSource.indexOf(year, from);
    if (at === -1) return false;
    const around = normSource.slice(Math.max(0, at - WINDOW), at + WINDOW);
    if (words.filter((w) => around.includes(w)).length >= need) return true;
    from = at + year.length;
  }
};

// Splits into sentences without breaking after abbreviations such as "Art."
// or "nº", which would separate a citation from its number.
const ABBREVIATION = /\b(arts?|inc|al|par|cf|dr|sr|sra|ex|vol|pp|nº|n)\.\s+/gi;
export const splitSentences = (text: string): string[] =>
  text
    .replace(ABBREVIATION, (match) => match.replace(/\s+$/, '\uE000'))
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\uE000/g, ' '));

// Deterministic fact guard: with real sources in hand, any year the model
// wrote that the sources do not tie to the same item is treated as invented
// and removed (items from boxes/works, sentences from paragraphs). Citations
// of law articles must also be among the articles actually retrieved.
export const applySourceGuard = (lesson: IllustratedLesson, sources: TopicSource[]): IllustratedLesson => {
  if (sources.length === 0) return lesson;
  const norm = normalize(sources.map((src) => src.text).join('\n'));
  const lawArticles = new Set(sources.flatMap((src) => src.articles ?? []).map((n) => n.toUpperCase()));

  const badYear = (text: string, minTokenLen = 5, minHits = 2): boolean =>
    yearsIn(text).some((y) => !pairSupported(norm, y, text, minTokenLen, minHits));

  // Courts, súmulas, "hediondo" and law numbers are classic invention
  // targets: they survive only if the sources themselves contain them.
  const PROTECTED = /\b(hediondos?|s[úu]mulas?(?:\s+vinculantes?)?(?:\s+n?[ºo°]?\s*\d+)?|STF|STJ|Supremo|Superior Tribunal|jurisprud[êe]ncia|ac[óo]rd[ãa]os?)\b/gi;
  // With an official law text, protected terms must appear in the LAW itself
  // (a general article may mention "hediondo" about a different crime).
  const lawText = normalize(sources.filter((src) => src.kind === 'lei').map((src) => src.text).join('\n'));
  const termPool = lawText || norm;
  // Numbers the law itself uses as penalty lengths: "6 (seis)", "10 (dez) anos", "2 anos"...
  const penaltyNumbers = new Set<string>([
    ...Array.from(lawText.matchAll(/(\d+)\s*\([a-z\s-]+\)/g)).map((m) => m[1]),
    ...Array.from(lawText.matchAll(/(\d+)\s*(?:anos?|meses)\b/g)).map((m) => m[1]),
  ]);
  const lawPairs = new Set<string>(
    Array.from(sources.filter((src) => src.kind === 'lei').map((src) => src.text).join('\n').matchAll(/Lei(?:\s+Complementar)?\s*n[ºo°]\s*([\d.]+),\s*de\s*(\d{4})/g)).map((m) => `${m[1].replace(/\./g, '')}/${m[2]}`),
  );
  const SUPERLATIVE = /\b(crime|delito)\s+mais\s+\w+|\b(o|a)\s+mais\s+(grave|violent[oa]|perigos[oa]|importante)\b/i;
  const badTerms = (text: string): boolean => {
    if (SUPERLATIVE.test(text)) return true;
    const terms = Array.from(text.matchAll(PROTECTED)).map((m) => normalize(m[0]).replace(/\s+/g, ' ').trim());
    if (terms.some((term) => !termPool.includes(term))) return true;
    // Law numbers: with an official text, "Lei nº N, de AAAA" must be a pair that the
    // Vade Mecum itself prints; otherwise N must at least appear in the sources.
    const laws = Array.from(text.matchAll(/\blei(?:\s+complementar)?\s*n?[ºo°]?\s*([\d.]{3,})(?:\s*(?:,|\/)?\s*(?:de\s*)?(\d{4}))?/gi)).map((m) => ({ digits: m[1].replace(/\./g, ''), year: m[2] }));
    if (laws.some(({ digits, year }) => (lawPairs.size > 0 && year ? !lawPairs.has(`${digits}/${year}`) : !norm.replace(/\./g, '').includes(digits)))) return true;
    if (lawText) {
      // Penalty lengths ("12 anos") must be numbers that the law text itself contains.
      const spans = Array.from(text.matchAll(/(\d+)\s*(?:\([^)]*\)\s*)?(?:anos?|meses)\b/gi)).map((m) => m[1]);
      if (spans.some((n) => !penaltyNumbers.has(n))) return true;
    }
    return false;
  };

  const badArticle = (text: string): boolean => {
    if (lawArticles.size === 0) return false;
    const cited = Array.from(text.matchAll(/\bart(?:igos?|s?\.)\s*(\d+)\s*[ºo°]?(-[A-Za-z])?/gi));
    return cited.some((m) => !lawArticles.has(`${m[1]}${(m[2] ?? '').toUpperCase()}`));
  };

  const bad = (text: string, minTokenLen = 5, minHits = 2): boolean => badYear(text, minTokenLen, minHits) || badArticle(text) || badTerms(text);

  const guardBox = (box: IllustratedLessonBox): IllustratedLessonBox | null => {
    const items = box.items.filter((it) => {
      const years = yearsIn(it.label);
      if (box.kind === 'timeline' && years.length > 0) {
        return years.every((y) => pairSupported(norm, y, it.text, 5, 2)) && !badArticle(it.text) && !badTerms(it.text);
      }
      return !bad(`${it.label} ${it.text}`);
    });
    const min = box.kind === 'timeline' ? 3 : 2;
    return items.length >= min ? { ...box, items } : null;
  };

  const guardSentences = (value: string): string =>
    splitSentences(value)
      .filter((sentence) => !bad(sentence))
      .join(' ')
      .trim();

  const guardPage = (page: IllustratedLessonPage): IllustratedLessonPage => {
    const sections = page.sections
      .map((section) => ({ ...section, paragraphs: section.paragraphs.map(guardSentences).filter(Boolean) }))
      .filter((section) => section.paragraphs.length > 0);

    const profile = page.profile
      ? { ...page.profile, works: page.profile.works.filter((w) => pairSupported(norm, w.year, w.title, 3, 1)) }
      : undefined;

    return {
      ...page,
      lead: page.lead ? guardSentences(page.lead) || undefined : undefined,
      quote: page.quote && !bad(page.quote.text) ? page.quote : undefined,
      boxes: page.boxes.map(guardBox).filter((b): b is IllustratedLessonBox => b !== null),
      sections,
      profile,
    };
  };

  const lawItems = sources.flatMap((src) => src.lawItems ?? []);
  const lawChanges = sources.flatMap((src) => src.lawChanges ?? []);
  const guardedPages = lesson.pages.map(guardPage);
  if (lawItems.length > 0 && guardedPages.length > 0) {
    guardedPages[0] = {
      ...guardedPages[0],
      boxes: [...guardedPages[0].boxes, { kind: 'law', title: 'Texto da lei (Vade Mecum)', items: lawItems }],
    };
  }
  // The amendment list is built from the "(Incluído pela Lei nº …)" notes of the
  // Vade Mecum, so law numbers and years are official and never AI-written.
  if (lawChanges.length > 0 && guardedPages.length > 0) {
    const at = Math.min(1, guardedPages.length - 1);
    guardedPages[at] = {
      ...guardedPages[at],
      boxes: [...guardedPages[at].boxes, { kind: 'timeline', title: 'Alterações da lei (Vade Mecum)', items: lawChanges }],
    };
  }

  return {
    ...lesson,
    pages: guardedPages,
    sources: sources.map(({ kind, title, url }) => ({ kind, title, url })),
  };
};
