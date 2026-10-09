import { TopicSource, fetchTopicSource, normalize, tokens, wikiGet } from './topicSource';

const FETCH_TIMEOUT_MS = 7000;

// ---------------------------------------------------------------- Wikilivros
// Didactic Portuguese textbooks. Search is by content, so the page is only
// trusted when it actually talks about the topic (phrase repeated).
const WIKIBOOKS_API = 'https://pt.wikibooks.org/w/api.php';

export const fetchWikibooksSource = async (subject: string, topic: string): Promise<TopicSource | null> => {
  const topicNorm = normalize(topic).trim();
  if (topicNorm.length < 3) return null;
  const search = await wikiGet({ action: 'query', list: 'search', srsearch: `${topic} ${subject}`, srlimit: '3' }, WIKIBOOKS_API);
  const hits: { title: string }[] = search?.query?.search ?? [];
  for (const hit of hits) {
    const page = await wikiGet(
      { action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'plain', redirects: '1', titles: hit.title },
      WIKIBOOKS_API,
    );
    const first: any = Object.values(page?.query?.pages ?? {})[0];
    const text: string = (first?.extract ?? '').trim();
    if (text.length < 600) continue;
    // Huge pages (glossaries, whole books) match anything; a useful page is
    // short and names the topic in its title or opening paragraph.
    if (text.length > 40000) continue;
    const normText = normalize(text);
    const occurrences = normText.split(topicNorm).length - 1;
    const upfront = normalize(`${hit.title} ${text.slice(0, 800)}`).includes(topicNorm);
    if (occurrences >= 3 && upfront) {
      const title: string = first.title ?? hit.title;
      return { kind: 'wikilivros', title, url: `https://pt.wikibooks.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`, text };
    }
  }
  return null;
};

// --------------------------------------------------------------- Vade Mecum
interface LawFile {
  id: string;
  label: string;
  url: string;
  appliesTo: RegExp;
}
interface LawArticle {
  numero: string;
  titulo?: string | null;
  capitulo?: string | null;
  texto: string;
}

const LAWS: LawFile[] = [
  { id: 'codigo-penal', label: 'Código Penal', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm', appliesTo: /penal|crime|criminal/ },
  { id: 'constituicao-federal', label: 'Constituição Federal de 1988', url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm', appliesTo: /constituc|administrativ|direitos|garantias|fundamentais/ },
  // Federal laws most common in editais, built from the official compiled text by scripts/build-vademecum.mjs.
  { id: 'codigo-processo-penal', label: 'Código de Processo Penal', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm', appliesTo: /processo penal|processual penal|inquerito|flagrante|prisao|acao penal|denuncia|queixa|cpp|habeas|fianca|jurisdicao penal|provas? (no|do) processo/ },
  { id: 'lei-14133', label: 'Lei nº 14.133/2021 (Licitações e Contratos)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm', appliesTo: /licita|contrato.{0,15}administrativ|contratacao publica|14\.?133|pregao|dispensa|inexigib|dialogo competitivo|leilao|concorrencia/ },
  { id: 'lei-8112', label: 'Lei nº 8.112/1990 (Servidores Públicos Federais)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm', appliesTo: /servidor|8\.?112|estatuto|cargo public|provimento|vacancia|estagio probatorio|estabilidade|licenca|remocao|redistribuic|regime disciplinar|processo disciplinar|sindicancia|penalidade/ },
  { id: 'lei-9784', label: 'Lei nº 9.784/1999 (Processo Administrativo)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9784.htm', appliesTo: /processo administrativo|9\.?784|recurso administrativo|anulac|revogac|convalidac|motivac|delegac|avocac|impedimento|suspeic|decadencia administrativ/ },
  { id: 'lei-8429', label: 'Lei nº 8.429/1992 (Improbidade Administrativa)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm', appliesTo: /improbidade|8\.?429|enriquecimento ilicito|dano ao erario/ },
  { id: 'lei-12527', label: 'Lei nº 12.527/2011 (Acesso à Informação)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm', appliesTo: /acesso a informac|12\.?527|\blai\b|transparencia|sigilo|informac(ao|oes) (sigilosa|classificada|pessoa)/ },
  { id: 'lc-101', label: 'Lei Complementar nº 101/2000 (Responsabilidade Fiscal)', url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm', appliesTo: /responsabilidade fiscal|\blrf\b|lc 101|101\/2000|despesa (total )?com pessoal|receita corrente liquida|renuncia de receita|divida consolidada|gestao fiscal/ },
  { id: 'lei-11343', label: 'Lei nº 11.343/2006 (Lei de Drogas)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11343.htm', appliesTo: /droga|entorpecente|trafico|11\.?343|sisnad|usuario de droga/ },
];
const LEGAL_RE = /direito|penal|constituc|legisla|\blei\b|\blrf\b|\blai\b|c[oó]digo|licita|servidor|improbidade|processo administrativo|responsabilidade fiscal|acesso a informac|droga/;
const STOPWORDS = new Set(['dos', 'das', 'del', 'que', 'com', 'por', 'para', 'uma', 'nos', 'nas']);

const lawCache = new Map<string, Promise<LawArticle[]>>();
const loadLaw = (id: string): Promise<LawArticle[]> => {
  if (!lawCache.has(id)) {
    lawCache.set(
      id,
      fetch(`/vademecum/${id}.json`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then((res) => {
        if (!res.ok) throw new Error(`Lei ${id} indisponível`);
        return res.json();
      }),
    );
  }
  return lawCache.get(id)!;
};

const rubricaOf = (article: LawArticle): string => {
  const at = article.texto.search(/\bArt\.\s*\d/);
  return at > 0 ? article.texto.slice(0, at) : '';
};

// Scores how well an article answers the topic. The rubrica (the article's
// heading, e.g. "Roubo.") counts most, then chapter titles, then the caput.
// Laws write verbs where topics use nouns ("anular"/"revogá-los" for "anulação e revogação"), so tokens are
// compared by their stem.
const stemOf = (token: string): string => (token.length > 6 ? token.slice(0, token.length - 3) : token);
export const scoreArticle = (article: LawArticle, topicTokens: string[]): number => {
  const stems = topicTokens.map(stemOf);
  const rubrica = normalize(rubricaOf(article));
  const heading = normalize(`${article.titulo ?? ''} ${article.capitulo ?? ''} ${(article as { secao?: string | null }).secao ?? ''}`);
  const caput = normalize(article.texto.slice(0, 500));
  const inRubrica = stems.filter((t) => rubrica.includes(t)).length;
  const inHeading = stems.filter((t) => heading.includes(t)).length;
  const inCaput = stems.filter((t) => caput.includes(t)).length;
  if (inRubrica === stems.length) return 100 + inHeading;
  if (inCaput === stems.length) return 40 + inHeading;
  // The chapter names the topic ("Da Prisão em Flagrante") and the article itself mentions part of it (art. 302).
  if (inHeading === stems.length && inCaput > 0) return 60 + inCaput;
  return 0;
};


// ---- Official text helpers (Vade Mecum) --------------------------------
// Dispositivo markers inside a flattened article: "Art. 157 -", "§ 2º-A",
// "Parágrafo único", incisos ("VII -", "VI  se", "I  (revogado)") and alíneas ("a)").
// A "§" starts a paragraph unless it is a cross-reference: preceded by "do/da/no/ao/o/a/de/em/e/ou", by a comma
// ("art. 129, § 3º") or by "art.". Rubricas such as "Homicídio qualificado § 2º" are real paragraph starts.
const NOT_XREF = '(?<!\\b(?:do|da|dos|das|no|na|nos|nas|ao|aos|pelo|pela|o|a|os|as|de|em|e|ou|art\\.?|artigos?)\\s+)(?<!,\\s*)';
const MARKER_RE = new RegExp(
  `(?:^|(?<=[\\s;:.)]))(Art\\.\\s*\\d+[ºo°]?(?:-[A-Z])?|[IVXLC]{1,6}(?=\\s*[-–—(]|\\s{2,}|\\s+se\\b)|[a-z]\\)(?=\\s))|${NOT_XREF}(?:^|(?<=\\s))(§\\s*\\d+[ºo°]?(?:-[A-Z])?|Parágrafo único)`,
  'g',
);
const PARAGRAPH_START_RE = new RegExp(`${NOT_XREF}(?:^|(?<=\\s))(§\\s*\\d+[ºo°]?(?:-[A-Z])?|Parágrafo único)`, 'g');

const stripRubrica = (texto: string): string => texto.replace(/[\u0096\u0097]/g, '–').replace(/^.*?(?=\bArt\.\s*\d)/, '').trim();

// Splits the article into caput + each paragraph (incisos stay inside their
// paragraph, one per line) so the box shows the complete official wording.
export const lawDispositivos = (texto: string, lawLabel: string, numero: string): { label: string; text: string }[] => {
  const body = stripRubrica(texto);
  const starts = Array.from(body.matchAll(PARAGRAPH_START_RE)).map((m) => m.index as number);
  const cuts = [0, ...starts.filter((i) => i > 0), body.length];
  const items: { label: string; text: string }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const chunk = body.slice(cuts[i], cuts[i + 1]).trim();
    if (!chunk) continue;
    const label = i === 0 ? `${lawLabel}, Art. ${numero} (caput)` : `${lawLabel}, Art. ${numero}, ${chunk.match(/^(§\s*\d+[ºo°]?(?:-[A-Z])?|Parágrafo único)/)?.[1].replace(/\s+/g, ' ') ?? ''}`;
    const text = chunk
      .replace(/^(Art\.\s*\d+[ºo°]?(?:-[A-Z])?|§\s*\d+[ºo°]?(?:-[A-Z])?)\s*[-–.]?\s*/, '')
      .replace(/\s+(?=[IVXLC]{1,6}(?:\s*[-–—(]|\s{2,}|\s+se\b)|[a-z]\)\s)/g, '\n')
      .replace(/ {2,}/g, ' ')
      .trim();
    items.push({ label, text });
  }
  return items;
};

// Deterministic list of the laws that changed this article, read straight from
// the "(Incluído pela Lei nº X, de AAAA)" notes — never written by the AI.
export const lawChangesOf = (texto: string, numero: string): { label: string; text: string }[] => {
  const body = stripRubrica(texto);
  const markers = Array.from(body.matchAll(MARKER_RE)).map((m) => ({ at: m.index as number, token: (m[1] ?? m[2]) as string }));
  const where = (pos: number): string => {
    let par = '', inc = '', ali = '';
    for (const mk of markers) {
      if (mk.at >= pos) break;
      const t = mk.token.replace(/\s+/g, ' ');
      if (/^Art\./.test(t)) { par = ''; inc = ''; ali = ''; }
      else if (/^§|^Parágrafo/.test(t)) { par = t; inc = ''; ali = ''; }
      else if (/^[a-z]\)$/.test(t)) ali = t.replace(')', '');
      else { inc = t; ali = ''; }
    }
    return `${par || 'caput'}${inc ? `, inciso ${inc}` : ''}${ali ? `, alínea ${ali}` : ''}`;
  };
  const NOTE_RE = /\((Redação dada|Incluíd[oa]|Revogad[oa])[^)]*?Lei(?: Complementar)?\s*n[ºo°]\s*([\d.]+),\s*de\s*(\d{4})[^)]*\)/g;
  const groups = new Map<string, { year: number; number: string; verbs: Map<string, string[]> }>();
  for (const m of body.matchAll(NOTE_RE)) {
    const verb = /^Redação/.test(m[1]) ? 'deu nova redação a' : /^Incluíd/.test(m[1]) ? 'incluiu' : 'revogou';
    const key = `${m[2]}/${m[3]}`;
    const g = groups.get(key) ?? { year: Number(m[3]), number: m[2], verbs: new Map() };
    const list = g.verbs.get(verb) ?? [];
    const spot = where(m.index as number);
    if (!list.includes(spot)) list.push(spot);
    g.verbs.set(verb, list);
    groups.set(key, g);
  }
  return Array.from(groups.values())
    .sort((a, b) => a.year - b.year || a.number.localeCompare(b.number))
    .map((g) => ({
      label: String(g.year),
      text: `Lei nº ${g.number}, de ${g.year}: ${Array.from(g.verbs.entries()).map(([verb, spots]) => `${verb} ${spots.filter((spot) => !spots.some((other) => spot.startsWith(`${other}, alínea`))).join('; ')}`).join(' e ')} (Art. ${numero}).`,
    }));
};

export const fetchLegalSource = async (subject: string, topic: string): Promise<TopicSource | null> => {
  const subjectNorm = normalize(subject);
  const topicNorm = normalize(topic);
  const explicit = topicNorm.match(/\bart(?:igo)?\.?\s*(\d+)/);
  if (!LEGAL_RE.test(subjectNorm) && !explicit) return null;

  const wanted = LAWS.filter((law) => law.appliesTo.test(subjectNorm));
  const laws = wanted.length > 0 ? wanted : LAWS;
  const topicTokens = tokens(topic).filter((t) => !STOPWORDS.has(t) && !/^\d+$/.test(t) && t !== 'art' && t !== 'artigo');

  const picked: { law: LawFile; article: LawArticle; score: number }[] = [];
  for (const law of laws) {
    const articles = await loadLaw(law.id);
    if (explicit) {
      const num = explicit[1];
      articles.filter((a) => a.numero === num || a.numero.startsWith(`${num}-`)).forEach((article) => picked.push({ law, article, score: 200 }));
      continue;
    }
    if (topicTokens.length === 0) continue;
    articles.forEach((article) => {
      const score = scoreArticle(article, topicTokens);
      if (score > 0) picked.push({ law, article, score });
    });
  }
  if (picked.length === 0) return null;

  const strong = picked.filter((p) => p.score >= 100);
  const best = (strong.length > 0 ? strong : picked).sort((a, b) => b.score - a.score).slice(0, 4);
  const lawLabel = Array.from(new Set(best.map((b) => b.law.label))).join(' e ');
  const nums = best.map((b) => b.article.numero);
  return {
    kind: 'lei',
    title: `${lawLabel}, art. ${nums.join(', ')}`,
    url: best[0].law.url,
    articles: nums,
    lawItems: best.slice(0, 2).flatMap((b) => lawDispositivos(b.article.texto, b.law.label, b.article.numero)),
    lawChanges: best.slice(0, 2).flatMap((b) => lawChangesOf(b.article.texto, b.article.numero)),
    // Full official wording (never cut mid-article): the lesson must not fill gaps from memory.
    text: best.map((b) => `${b.law.label}, Art. ${b.article.numero}: ${stripRubrica(b.article.texto).replace(/\s+/g, ' ')}`).join('\n\n'),
  };
};

// ----------------------------------------------------------------- Wikidata
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const SPARQL = 'https://query.wikidata.org/sparql';

const yearOf = (claim: any): number | null => {
  const value = claim?.mainsnak?.datavalue?.value;
  if (!value?.time || (value.precision ?? 0) < 9) return null;
  const y = parseInt(value.time.slice(0, 5), 10);
  return Number.isFinite(y) ? y : null;
};
const firstYear = (claims: any, prop: string): number | null => (claims?.[prop] ?? []).map(yearOf).find((y: number | null) => y !== null) ?? null;
const labelOf = (entity: any): string => entity?.labels?.pt?.value ?? entity?.labels?.en?.value ?? '';

export const fetchWikidataFacts = async (_subject: string, topic: string): Promise<TopicSource | null> => {
  const topicNorm = normalize(topic).trim();
  const search = await wikiGet({ action: 'wbsearchentities', search: topic, language: 'pt', uselang: 'pt', type: 'item', limit: '5' }, WIKIDATA_API);
  const candidate = (search?.search ?? []).find((r: any) => {
    const desc = normalize(r.description ?? '');
    return normalize(r.label ?? '') === topicNorm && !/desambigua|disambiguation|adapta|adaptation/.test(desc);
  });
  if (!candidate) return null;

  const fetchEntities = async (ids: string[]) =>
    (await wikiGet({ action: 'wbgetentities', ids: ids.join('|'), props: 'claims|labels|descriptions', languages: 'pt|en' }, WIKIDATA_API))?.entities ?? {};

  const entities = await fetchEntities([candidate.id]);
  const entity = entities[candidate.id];
  if (!entity) return null;
  const claims = entity.claims ?? {};
  const name = labelOf(entity) || candidate.label;
  const lines: string[] = [];
  const description = entity.descriptions?.pt?.value ?? entity.descriptions?.en?.value;
  if (description) lines.push(`${name}: ${description}.`);

  const published = firstYear(claims, 'P577');
  const inception = firstYear(claims, 'P571');
  const born = firstYear(claims, 'P569');
  const died = firstYear(claims, 'P570');
  const started = firstYear(claims, 'P580');
  const ended = firstYear(claims, 'P582');
  const happened = firstYear(claims, 'P585');
  if (published) lines.push(`${name} foi publicado em ${published}.`);
  if (inception) lines.push(`${name} foi criado em ${inception}.`);
  if (born) lines.push(`${name} nasceu em ${born}.`);
  if (died) lines.push(`${name} morreu em ${died}.`);
  if (started) lines.push(`${name} começou em ${started}.`);
  if (ended) lines.push(`${name} terminou em ${ended}.`);
  if (happened) lines.push(`${name} ocorreu em ${happened}.`);

  // Author facts, plus every dated work by that author or by this person.
  const authorIds: string[] = (claims.P50 ?? []).map((c: any) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean).slice(0, 1);
  const personId = born ? candidate.id : authorIds[0];
  if (authorIds.length > 0) {
    const authors = await fetchEntities(authorIds);
    const author = authors[authorIds[0]];
    if (author) {
      const aName = labelOf(author);
      const aBorn = firstYear(author.claims, 'P569');
      const aDied = firstYear(author.claims, 'P570');
      if (aName) lines.push(`Autor: ${aName}.`);
      if (aName && aBorn) lines.push(`${aName} nasceu em ${aBorn}.`);
      if (aName && aDied) lines.push(`${aName} morreu em ${aDied}.`);
    }
  }
  if (personId) {
    try {
      // Most notable dated works first (by number of Wikipedia editions), then shown in chronological order.
      const query = `SELECT ?wLabel (YEAR(?d) AS ?y) ?links WHERE { ?w wdt:P50 wd:${personId}; wdt:P577 ?d; wikibase:sitelinks ?links. SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en". } } ORDER BY DESC(?links) LIMIT 8`;
      const res = await fetch(`${SPARQL}?${new URLSearchParams({ format: 'json', query }).toString()}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.ok) {
        const rows: any[] = (await res.json())?.results?.bindings ?? [];
        const works = rows
          .map((r) => ({ title: String(r.wLabel?.value ?? ''), year: Number(r.y?.value) }))
          .filter((w) => w.title && !/^Q\d+$/.test(w.title) && !w.title.startsWith('[') && Number.isFinite(w.year))
          .sort((a, b) => a.year - b.year)
          .map((w) => `${w.title} (${w.year})`);
        if (works.length > 0) lines.push(`Obras com ano de publicação: ${works.join('; ')}.`);
      }
    } catch {
      // works list is optional
    }
  }

  if (lines.length < 2) return null;
  return { kind: 'wikidata', title: name, url: `https://www.wikidata.org/wiki/${candidate.id}`, text: lines.join('\n') };
};


// ------------------------------------------------- Sources for question banks
const TERM_STOP = new Set(['uso', 'regras', 'regra', 'conceito', 'conceitos', 'principais', 'tipos', 'noções', 'nocoes', 'geral', 'sobre', 'segundo', 'conforme',
  // Law names and acronyms say which law, not what the article is about.
  'lei', 'leis', 'lrf', 'lai', 'cpp', 'codigo', 'complementar']);
const splitTopicTerms = (topic: string): string[] =>
  topic
    .replace(/\bart(?:igos?|s?\.)?\.?\s*\d+[^\s,;)]*/gi, ' ')
    .split(/[,;()]|\s+e\s+|\s+ou\s+|\s[-–]\s/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 4);

// Retrieves the official articles a question set should rest on: explicit "art. N" in the topic plus
// every article whose heading (rubrica) matches one of the topic's terms (e.g. "furto", "roubo").
const PENAL_ALIASES: Record<string, string> = {
  'dolo eventual': '18', 'dolo direto': '18', 'culpa consciente': '18', 'culpa inconsciente': '18', 'crime doloso': '18', 'crime culposo': '18',
  'erro de tipo': '20', 'erro de proibicao': '21', 'tentativa': '14', 'desistencia voluntaria': '15', 'arrependimento eficaz': '15',
  'arrependimento posterior': '16', 'crime impossivel': '17', 'estado de necessidade': '24', 'legitima defesa': '25',
  'coacao moral': '22', 'obediencia hierarquica': '22', 'inimputabilidade': '26', 'embriaguez': '28', 'concurso de pessoas': '29',
  'concurso material': '69', 'concurso formal': '70', 'crime continuado': '71', 'reincidencia': '63', 'relacao de causalidade': '13',
};

export const fetchLegalSourceForQuestions = async (subject: string, topic: string): Promise<TopicSource | null> => {
  const subjectNorm = normalize(subject);
  const topicNorm = normalize(topic);
  const explicit = Array.from(topicNorm.matchAll(/\bart(?:igos?|s?\.)?\.?\s*(\d+)/g)).map((m) => m[1]);
  if (!LEGAL_RE.test(subjectNorm) && !LEGAL_RE.test(topicNorm) && explicit.length === 0) return null;

  const wanted = LAWS.filter((law) => law.appliesTo.test(`${subjectNorm} ${topicNorm}`));
  const laws = wanted.length > 0 ? wanted : LAWS;
  // Doctrinal names the Código Penal never writes ("erro de proibição" is art. 21, "dolo eventual" is art. 18).
  for (const [alias, num] of Object.entries(PENAL_ALIASES)) {
    if (topicNorm.includes(alias) && !explicit.includes(num)) explicit.push(num);
  }
  const termTokens = splitTopicTerms(topic)
    .map((term) => tokens(term).filter((t) => !STOPWORDS.has(t) && !TERM_STOP.has(t) && !/^\d+$/.test(t)))
    .filter((list) => list.length > 0);

  const picked = new Map<string, { law: LawFile; article: LawArticle; score: number }>();
  for (const law of laws) {
    const articles = await loadLaw(law.id);
    for (const article of articles) {
      let score = 0;
      if (explicit.some((num) => article.numero === num || article.numero.startsWith(`${num}-`))) score = 200;
      else score = Math.max(0, ...termTokens.map((list) => scoreArticle(article, list)).filter((value) => value >= 100));
      if (score > 0) picked.set(`${law.id}:${article.numero}`, { law, article, score });
    }
  }
  // Concept topics ("dolo", "culpa") live in the caput of an article without a matching rubrica (art. 18 says
  // "doloso"): when the strict pass finds little, accept caput-level matches too.
  if (picked.size < 2) {
    for (const law of laws) {
      const articles = await loadLaw(law.id);
      for (const article of articles) {
        const key = `${law.id}:${article.numero}`;
        if (picked.has(key)) continue;
        const loose = Math.max(0, ...termTokens.map((list) => scoreArticle(article, list)).filter((value) => value >= 40 && value < 100));
        if (loose > 0 && picked.size < 6) picked.set(key, { law, article, score: loose });
      }
    }
  }
  if (picked.size === 0) return null;

  const best = Array.from(picked.values()).sort((a, b) => b.score - a.score).slice(0, 6);
  const perArticle = best.length === 1 ? 5000 : 2200;
  const chosen = best.map((b) => ({ label: b.law.label, numero: b.article.numero, text: stripRubrica(b.article.texto).replace(/\s+/g, ' ').slice(0, perArticle) }));
  return {
    kind: 'lei',
    title: `${Array.from(new Set(chosen.map((c) => c.label))).join(' e ')}, art. ${chosen.map((c) => c.numero).join(', ')}`,
    url: best[0].law.url,
    articles: chosen.map((c) => c.numero),
    laws: chosen,
    text: chosen.map((c) => `${c.label}, Art. ${c.numero}: ${c.text}`).join('\n\n'),
  };
};

// Encyclopedic sources for factual (non-law) topics: one article per main term of the topic. The search uses the
// term alone (adding the school subject buries short titles such as "Crase") and accepts close titles
// ("Biomas do Brasil" for "biomas brasileiros") by comparing word stems.
const stem = (word: string): string => word.slice(0, 5);
const scoreTitleByTerm = (title: string, termTokens: string[]): number => {
  const titleStems = tokens(title).map(stem);
  const matched = termTokens.filter((t) => titleStems.includes(stem(t))).length;
  if (matched === 0 || matched / termTokens.length < 0.5) return 0;
  return 100 * (matched / termTokens.length) - (titleStems.length - matched) * 5;
};

const fetchArticleForTerm = async (term: string): Promise<TopicSource | null> => {
  const termTokens = tokens(term).filter((t) => !STOPWORDS.has(t) && !TERM_STOP.has(t));
  if (termTokens.length === 0) return null;
  const search = await wikiGet({ action: 'query', list: 'search', srsearch: term, srlimit: '6' });
  const hits: { title: string }[] = search?.query?.search ?? [];
  const best = hits
    .map((hit, index) => ({ title: hit.title, score: scoreTitleByTerm(hit.title, termTokens), index }))
    .filter((candidate) => candidate.score >= 45)
    .sort((x, y) => y.score - x.score || x.index - y.index)[0];
  if (!best) return null;
  const page = await wikiGet({ action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'plain', redirects: '1', titles: best.title });
  const first: any = Object.values(page?.query?.pages ?? {})[0];
  const text: string = (first?.extract ?? '').trim();
  if (text.length < 800 || /pode referir-se a|desambigua/i.test(text.slice(0, 400))) return null;
  const title: string = first.title ?? best.title;
  return { kind: 'wikipedia', title, url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`, text: text.slice(0, 3500) };
};

export const fetchFactSourcesForQuestions = async (_subject: string, topic: string): Promise<TopicSource[]> => {
  const terms = splitTopicTerms(topic)
    .map((term) => tokens(term).filter((t) => !STOPWORDS.has(t) && !TERM_STOP.has(t)).join(' '))
    .filter((term) => term.length >= 4);
  const unique = Array.from(new Set(terms)).slice(0, 3);
  const found = await Promise.all(unique.map((term) => fetchArticleForTerm(term).catch(() => null)));
  const seen = new Set<string>();
  return found.filter((src): src is TopicSource => !!src && !seen.has(src.url) && !!seen.add(src.url));
};

// ---------------------------------------------------------------- Aggregate
export const gatherSources = async (subject: string, topic: string): Promise<TopicSource[]> => {
  const attempt = (fn: () => Promise<TopicSource | null>) => fn().catch(() => null);
  const [law, facts, wiki, books] = await Promise.all([
    attempt(() => fetchLegalSource(subject, topic)),
    attempt(() => fetchWikidataFacts(subject, topic)),
    attempt(() => fetchTopicSource(subject, topic)),
    attempt(() => fetchWikibooksSource(subject, topic)),
  ]);
  return [law, facts, wiki, books].filter((s): s is TopicSource => s !== null);
};

const LABEL: Record<TopicSource['kind'], string> = {
  lei: 'TEXTO DA LEI (Vade Mecum oficial do app, Planalto)',
  wikidata: 'FATOS VERIFICADOS (Wikidata)',
  wikipedia: 'ARTIGO (Wikipédia em português)',
  wikilivros: 'MATERIAL DIDÁTICO (Wikilivros em português)',
};
const LIMIT: Record<TopicSource['kind'], number> = { lei: 9000, wikidata: 1800, wikipedia: 6000, wikilivros: 4000 };

export const sourcesPromptBlock = (sources: TopicSource[], scale = 1): string => {
  if (sources.length === 0) return '';
  const blocks = sources.map((s) => `### ${LABEL[s.kind]}: ${s.title}\n${s.text.slice(0, Math.round(LIMIT[s.kind] * scale))}`);
  return `
      FONTES DE APOIO (use como BASE FACTUAL):
      ${blocks.join('\n\n      ')}
      REGRAS DAS FONTES: o pedido do aluno (matéria e assunto) sempre prevalece; ignore partes das fontes que tratem de outro significado ou escopo. Datas, nomes, obras, números e artigos de lei devem vir DESTAS fontes; se um dado não estiver nelas, não o inclua. Em "FATOS VERIFICADOS" e em "TEXTO DA LEI" os dados são oficiais: prefira-os a qualquer outra informação. Cite artigos de lei APENAS dos que aparecem no "TEXTO DA LEI". Ao mencionar uma lei alteradora, copie número e ano exatamente como estão em "(Incluído pela Lei nº …, de …)" e atribua a ela apenas o dispositivo ao lado do qual a nota aparece; em dúvida, não cite a lei alteradora (o app já exibe a lista oficial de alterações). Não cite tribunais, súmulas, jurisprudência, números de leis alteradoras nem classificações (como "crime hediondo") que não estejam escritos nas fontes. Não faça afirmações absolutas como "o mais grave" ou "o mais violento". Explique com suas próprias palavras; nunca copie frases literalmente, exceto trechos curtos de lei entre aspas.
`;
};
