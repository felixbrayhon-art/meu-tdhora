import { QuestionVerification } from '../types';
import { TopicSource, normalize, tokens, splitSentences } from './topicSource';
import { fetchFactSourcesForQuestions, fetchLegalSourceForQuestions, lawDispositivos } from './lessonSources';

// Quality layer for AI-generated multiple-choice questions.
//
//   1. Ground: retrieve the official text (Vade Mecum) or an encyclopedic article for the topic.
//   2. Audit (deterministic): structure, citations (article, paragraph, inciso, law number), penalties and
//      unsupported jurisprudence are checked against the retrieved text.
//   3. Verify (independent pass): a judge that does NOT see the answer key answers each question and must quote
//      the source literally. A question is kept only when it agrees with the key.
//   4. Repair: unsupported sentences are removed from the explanation, a verbatim "Base legal" line is appended,
//      and rejected questions are replaced by new ones (up to a few rounds).

export interface RawQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  memoryHint?: string;
}

export type FinalQuestion = RawQuestion & { verification: QuestionVerification };

export type JudgeFn = (prompt: string, schema: any, name: string) => Promise<any>;

export interface QualityReport {
  sources: string[];
  rounds: number;
  generated: number;
  rejectedStructure: number;
  rejectedCitations: number;
  rejectedByJudge: number;
  explanationsFixed: number;
  verified: number;
  consistent: number;
  unverified: number;
  judgeAvailable: boolean;
  /** A few rejection reasons, for the audit log. */
  reasons: string[];
}

// ---------------------------------------------------------------- helpers
const squash = (value: string): string => normalize(value).replace(/[^a-z0-9]+/g, '');

// Finds `quote` in `source` ignoring case, accents and punctuation, and returns the source's own wording.
const clip = (text: string, max = 320): string => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 200))}…`;
};

export const findInSource = (source: string, quote: string): string | null => {
  const needle = squash(quote);
  if (needle.length < 20) return null;
  const chars: string[] = [];
  const index: number[] = [];
  for (let i = 0; i < source.length; i++) {
    const folded = normalize(source[i]).replace(/[^a-z0-9]/g, '');
    if (folded) { chars.push(folded); index.push(i); }
  }
  const hay = chars.join('');
  const at = hay.indexOf(needle);
  if (at === -1) return null;
  return source.slice(index[at], index[at + needle.length - 1] + 1).trim();
};

// Same words with different accents ARE different options (crase: "à escola" vs "a escola").
const optionKey = (value: string): string => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

const stripLetter = (option: string): string => {
  let value = String(option ?? '').trim();
  for (let i = 0; i < 3; i++) value = value.replace(/^\(?[A-Ea-e]\)?\s*[).:–-]\s*/, '').trim();
  return value;
};

const splitSubjectTopic = (topic: string): [string, string] => {
  const match = topic.match(/^(.{3,60}?)\s*(?::|\s-\s|–)\s*(.+)$/);
  return match ? [match[1].trim(), match[2].trim()] : [topic.trim(), topic.trim()];
};

// ---------------------------------------------------------------- grounding
export const gatherQuestionSources = async (topic: string): Promise<TopicSource[]> => {
  const [subject, rest] = splitSubjectTopic(topic);
  const law = await fetchLegalSourceForQuestions(subject, rest).catch(() => null);
  if (law) return [law];
  return fetchFactSourcesForQuestions(subject, rest).catch(() => []);
};

export const questionSourcesBlock = (sources: TopicSource[]): string => {
  if (sources.length === 0) return '';
  const blocks = sources.map((src) => {
    const label = src.kind === 'lei' ? 'TEXTO DA LEI (Vade Mecum oficial)' : 'ARTIGO DE REFERÊNCIA (Wikipédia)';
    return `### ${label}: ${src.title}\n${src.text.slice(0, 6500)}`;
  });
  return `
      FONTES DE APOIO (BASE FACTUAL OBRIGATÓRIA):
      ${blocks.join('\n\n      ')}
`;
};

export const questionGenerationRules = (sources: TopicSource[], avoid: string[], notes = ''): string => {
  const hasLaw = sources.some((src) => src.kind === 'lei');
  const grounded = sources.length > 0;
  return `${questionSourcesBlock(sources)}${notes}
      REGRAS DE CONFIABILIDADE (obrigatórias):
      - Cada questão deve ter UMA única alternativa correta; as demais devem ser incorretas de forma indiscutível. Nada de "todas as anteriores" nem "nenhuma das anteriores".
      - O texto das alternativas NÃO leva letra ("A)", "B)"): escreva só o conteúdo.
      ${grounded ? '- Baseie enunciado, gabarito e explicação SOMENTE nas fontes acima. Se um ponto não está nas fontes, não o cobre.' : '- Cobre apenas fatos consolidados e incontroversos; se não tiver certeza de um dado, escolha outro ponto.'}
      ${hasLaw ? '- Direito: cite artigo, parágrafo e inciso exatamente como aparecem no texto da lei acima; copie penas e prazos de lá. Não cite números de outras leis, súmulas, jurisprudência nem classificações (como "crime hediondo") que não estejam no texto.' : '- Não invente números de leis, artigos, súmulas ou jurisprudência. Se citar, só o que for notoriamente correto.'}
      - O enunciado deve pedir exatamente o que as alternativas respondem (se elas trazem faixas de pena, pergunte "qual a pena prevista", não "a pena mínima").
      - A explicação deve dizer por que a alternativa correta está certa e por que as demais estão erradas, sem afirmar nada que as fontes não sustentem.
      - Não use aspas para inventar citações. Datas, nomes e números devem ser reais.${avoid.length ? `\n      - NÃO repita nem reformule estas questões já geradas: ${avoid.map((a) => `"${a.slice(0, 80)}"`).join(' | ')}` : ''}`;
};


// ---------------------------------------------------------------- doctrine checklist
// The pairs below are the ones generators most often swap ("gavetas conceituais"). Giving the correct definitions to the
// generator, the judge and the reviewer is a guard rail, not a source: statements about the statute still need the quote.
const PENAL_TOPIC = /\b(penal|crime|crimes|dolo|culpa|tipicidade|ilicitude|culpabilidade|conduta|tentativa|pena|erro de tipo|erro de proibi)/i;

export const doctrineNotes = (topic: string): string =>
  PENAL_TOPIC.test(normalize(topic))
    ? `
      NOTAS DE DOUTRINA (Direito Penal, Teoria Finalista da Ação; use como conferência, não invente além disto):
      - Dolo direto: o agente QUER o resultado (art. 18, I, 1ª parte). Dolo eventual: prevê o resultado e ASSUME O RISCO de produzi-lo (art. 18, I, 2ª parte); não é "vontade de causar o resultado".
      - Culpa consciente: prevê o resultado, mas acredita sinceramente que não ocorrerá ou que poderá evitá-lo. Culpa inconsciente: não prevê o resultado que era previsível (art. 18, II). Dolo eventual e culpa consciente diferem porque no primeiro o agente aceita o risco.
      - Erro de tipo (art. 20): falsa percepção sobre elemento do tipo; EXCLUI O DOLO (se inevitável, exclui também a culpa; se evitável, pune-se a culpa quando prevista em lei). Não exclui culpabilidade.
      - Erro de proibição (art. 21): erro sobre a ilicitude do fato; afeta a CULPABILIDADE (potencial consciência da ilicitude): escusável isenta de pena; inescusável diminui a pena de 1/6 a 1/3.
      - Na Teoria Finalista, dolo e culpa integram o TIPO (conduta e tipicidade). Culpabilidade: imputabilidade, potencial consciência da ilicitude e exigibilidade de conduta diversa.
      - Não confunda "elemento subjetivo do tipo" (dolo/culpa) com "elementos da culpabilidade".
      - Desistência voluntária e arrependimento eficaz (art. 15) afastam a tentativa; arrependimento posterior (art. 16) é causa de diminuição de pena; tentativa (art. 14, II) é crime que não se consuma por circunstâncias alheias à vontade do agente.`
    : '';


// Targeted rules for the concept swaps AIs make most often in Direito Penal. A general reviewer model misses some of
// them (it can read "o erro de tipo exclui a culpabilidade" and agree), so these are checked deterministically.
const CONCEPT_SWAPS: { when: RegExp; and: RegExp; unless?: RegExp; message: string }[] = [
  { when: /erro de tipo/, and: /(exclui|afasta|isenta)\b.{0,40}(culpabilidade|pena\b)|potencial consciencia|\bart\.? ?21\b/, unless: /nao (exclui|afasta|isenta|atinge|afeta)|diferen|ao contrario|\be nao\b/, message: 'erro de tipo (art. 20) exclui o DOLO; culpabilidade e art. 21 tratam do erro de proibição' },
  { when: /erro de proibicao/, and: /exclui.{0,20}\bdolo|elemento (constitutivo )?do tipo|\bart\.? ?20\b/, unless: /nao (exclui|afasta|atinge|afeta)|diferen|ao contrario|\be nao\b|em vez de/, message: 'erro de proibição (art. 21) atinge a culpabilidade, não o dolo' },
  { when: /dolo eventual/, and: /\b(vontade|quer|desej)\w*/, unless: /risco|assum|aceit|consent|nao quer|nao deseja|em vez de|diferen/, message: 'dolo eventual é assumir o risco de produzir o resultado, não a vontade de causá-lo' },
  { when: /dolo direto/, and: /assum\w* o risco/, unless: /eventual|nao|diferen|contrari/, message: 'assumir o risco caracteriza o dolo eventual, não o direto' },
  { when: /culpa consciente/, and: /(assume|aceita|consente)\w*.{0,25}(risco|resultado)/, unless: /nao (assume|aceita|consente)|em vez de|diferen|contrari|ao contrario/, message: 'na culpa consciente o agente NÃO aceita o resultado' },
  { when: /culpa inconsciente/, and: /\bpreve\b|previu|prevendo/, unless: /nao (preve|previu)|sem prever|diferen|contrari|ao contrario/, message: 'na culpa inconsciente o agente não prevê o resultado' },
];

const conceptSwap = (sentence: string): string | null => {
  const text = normalize(sentence);
  for (const rule of CONCEPT_SWAPS) {
    if (rule.when.test(text) && rule.and.test(text) && !(rule.unless && rule.unless.test(text))) return rule.message;
  }
  return null;
};

// ---------------------------------------------------------------- deterministic audit
const ROMAN = 'IVXLC';

interface ArticleIndex {
  label: string;
  numero: string;
  paragraphs: Map<string, string>; // "§ 2º" | "caput" -> text with one inciso per line
}

const buildArticleIndex = (source: TopicSource): ArticleIndex[] =>
  (source.laws ?? []).map((law) => {
    const paragraphs = new Map<string, string>();
    for (const item of lawDispositivos(law.text, law.label, law.numero)) {
      // The Planalto text mixes "§ 2º", "§ 2°" and "§ 2o": all mean the same paragraph.
      const para = item.label.includes('(caput)') ? 'caput' : (item.label.split(', ').pop() ?? '').replace(/\s+/g, ' ').replace(/(\d)[°o]/g, '$1º');
      paragraphs.set(para, [paragraphs.get(para), item.text].filter(Boolean).join('\n'));
    }
    // Truncated text: if the article is long we cannot disprove paragraphs past the cut.
    return { label: law.label, numero: law.numero.toUpperCase(), paragraphs };
  });

const CITATION_RE = new RegExp(
  `\\bart(?:igos?|s?\\.)\\.?\\s*(\\d+)\\s*[ºo°]?(-[A-Za-z])?` +
    `(?:\\s*,?\\s*(?:§|par[áa]grafo)\\s*(\\d+|[úu]nico)\\s*[ºo°]?(-[A-Za-z])?)?` +
    `(?:\\s*,?\\s*(?:inciso\\s+)?([${ROMAN}]{1,6})\\b)?`,
  'gi',
);

interface Citation { raw: string; art: string; par: string | null; inc: string | null }

const extractCitations = (text: string): Citation[] =>
  Array.from(text.matchAll(CITATION_RE)).map((m) => ({
    raw: m[0],
    art: `${m[1]}${(m[2] ?? '').toUpperCase()}`,
    par: m[3] ? `§ ${m[3].replace(/[úu]nico/i, 'único')}${m[3].match(/^\d/) ? 'º' : ''}${(m[4] ?? '').toUpperCase()}` : null,
    inc: m[5] ? m[5].toUpperCase() : null,
  }));

// Words that appear in almost every article, so sharing them says nothing about whether an inciso fits a sentence.
const GENERIC_LEGAL = new Set([
  'artigo', 'pessoa', 'quando', 'havendo', 'ainda', 'sendo', 'dessa', 'desse', 'pelos', 'pelas', 'coisa', 'alheia', 'agente', 'crime', 'pena',
  'caso', 'hipotese', 'hipoteses', 'qualifica', 'qualificado', 'qualificada', 'previsto', 'prevista', 'condicao', 'subtracao', 'subtrair',
  'mediante', 'furto', 'roubo', 'extorsao', 'homicidio', 'aumenta', 'aumento', 'diminui', 'reducao', 'reclusao', 'detencao', 'multa',
]);
const significant = (text: string): Set<string> => new Set(tokens(text).filter((t) => t.length >= 5 && !GENERIC_LEGAL.has(t)));

export interface Violation { where: 'stem' | 'options' | 'explanation'; reason: string; sentence?: string }

// A citation is valid when the article was retrieved, the paragraph exists in it, the inciso exists in that
// paragraph and its wording is related to what the sentence claims.
const citationProblem = (citation: Citation, index: ArticleIndex[], sentence: string, checkFit: boolean): string | null => {
  const article = index.find((a) => a.numero === citation.art);
  if (!article) return `art. ${citation.art} fora do texto da lei recuperado`;
  const key = citation.par ?? 'caput';
  const text = article.paragraphs.get(key);
  if (!text) return citation.par ? `${citation.par} não existe no art. ${citation.art}` : null;
  if (citation.inc) {
    const lines = text.split('\n');
    const line = lines.find((l) => new RegExp(`^${citation.inc}\\s*[–-]`).test(l.trim()));
    if (!line) return `inciso ${citation.inc} não existe em ${key} do art. ${citation.art}`;
    if (!checkFit) return null;
    const incisoWords = significant(line);
    const sentenceWords = significant(sentence.replace(citation.raw, ' '));
    const overlap = Array.from(incisoWords).some((word) => sentenceWords.has(word) || Array.from(sentenceWords).some((s) => s.startsWith(word.slice(0, 6))));
    if (!overlap) return `o inciso ${citation.inc} do art. ${citation.art} não trata do que a frase afirma`;
  }
  return null;
};

const PROTECTED = /\b(hediondos?|s[úu]mulas?(?:\s+vinculantes?)?(?:\s+n?[ºo°]?\s*\d+)?|STF|STJ|Supremo|Superior Tribunal|jurisprud[êe]ncia|ac[óo]rd[ãa]os?)\b/gi;

const lawPairsOf = (sources: TopicSource[]): Set<string> => {
  const text = sources.filter((s) => s.kind === 'lei').map((s) => s.text).join('\n');
  return new Set(Array.from(text.matchAll(/Lei(?:\s+Complementar)?\s*n[ºo°]\s*([\d.]+),\s*de\s*(\d{4})/g)).map((m) => `${m[1].replace(/\./g, '')}/${m[2]}`));
};

// Penalties are often written in words in the law ("reclusão, de doze a trinta anos"), so the allowed numbers
// include the digits of every number word found in the text.
const NUMBER_WORDS: Record<string, string> = {
  um: '1', uma: '1', dois: '2', duas: '2', tres: '3', quatro: '4', cinco: '5', seis: '6', sete: '7', oito: '8', nove: '9',
  dez: '10', onze: '11', doze: '12', treze: '13', catorze: '14', quatorze: '14', quinze: '15', dezesseis: '16',
  dezessete: '17', dezoito: '18', dezenove: '19', vinte: '20', trinta: '30', quarenta: '40', cinquenta: '50',
};

const penaltyNumbersOf = (sources: TopicSource[]): Set<string> => {
  const text = normalize(sources.filter((s) => s.kind === 'lei').map((s) => s.text).join('\n'));
  const out = new Set<string>([
    ...Array.from(text.matchAll(/(\d+)\s*\([a-z\s-]+\)/g)).map((m) => m[1]),
    ...Array.from(text.matchAll(/(\d+)\s*(?:anos?|meses)\b/g)).map((m) => m[1]),
  ]);
  for (const word of text.match(/[a-z]+/g) ?? []) if (NUMBER_WORDS[word]) out.add(NUMBER_WORDS[word]);
  return out;
};

const checkText = (where: Violation['where'], text: string, sources: TopicSource[], index: ArticleIndex[], stem: string): Violation[] => {
  const out: Violation[] = [];
  const hasLaw = index.length > 0;
  const sourceText = normalize(sources.map((s) => s.text).join('\n'));
  for (const sentence of splitSentences(text)) {
    if (hasLaw) {
      for (const citation of extractCitations(sentence)) {
        const problem = citationProblem(citation, index, sentence, where === 'explanation');
        if (problem) out.push({ where, reason: problem, sentence });
      }
      const pairs = lawPairsOf(sources);
      for (const m of sentence.matchAll(/\blei(?:\s+complementar)?\s*n?[ºo°]?\s*([\d.]{3,})(?:\s*(?:,|\/)?\s*(?:de\s*)?(\d{2,4}))?/gi)) {
        const digits = m[1].replace(/\./g, '');
        const known = Array.from(pairs).some((pair) => pair.startsWith(`${digits}/`));
        if (!known) out.push({ where, reason: `lei nº ${m[1]} não consta do texto da lei recuperado`, sentence });
      }
      const penalties = penaltyNumbersOf(sources);
      for (const m of sentence.matchAll(/(\d+)\s*(?:\([^)]*\)\s*)?(?:anos?|meses)\b/gi)) {
        if (!penalties.has(m[1]) && !new RegExp(`\\b${m[1]}\\b`).test(stem)) {
          out.push({ where, reason: `prazo de ${m[1]} não consta do texto da lei recuperado`, sentence });
        }
      }
    }
    if (where === 'explanation') {
      const swapped = conceptSwap(sentence);
      if (swapped) out.push({ where, reason: `conceito trocado: ${swapped}`, sentence });
    }
    for (const m of sentence.matchAll(PROTECTED)) {
      const term = normalize(m[0]).replace(/\s+/g, ' ').trim();
      if (!sourceText.includes(term)) out.push({ where, reason: `"${m[0]}" não aparece nas fontes (jurisprudência sem base)`, sentence });
    }
  }
  return out;
};

export const auditQuestion = (q: RawQuestion, sources: TopicSource[], optionCount = 5): { problems: string[]; violations: Violation[]; fixedExplanation: string } => {
  const problems: string[] = [];
  const options = q.options.map(stripLetter);
  if (!q.question || q.question.trim().length < 25) problems.push('enunciado curto ou vazio');
  if (options.length !== optionCount || options.some((o) => o.length < 2)) problems.push(`não tem ${optionCount} alternativas preenchidas`);
  if (new Set(options.map(optionKey)).size !== options.length) problems.push('alternativas repetidas');
  if (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer > optionCount - 1) problems.push('gabarito fora das alternativas');
  if (options.some((o) => /\b(todas as (alternativas|anteriores)|nenhuma das (alternativas|anteriores))\b/i.test(o))) problems.push('alternativa "todas/nenhuma das anteriores" (ambígua)');

  const index = sources.flatMap(buildArticleIndex);
  const violations: Violation[] = [];
  const stem = q.question;
  violations.push(...checkText('stem', q.question, sources, index, stem));
  violations.push(...checkText('options', options.join('. '), sources, index, stem));
  const explanationSentences = splitSentences(q.explanation ?? '');
  const kept: string[] = [];
  for (const sentence of explanationSentences) {
    const issues = checkText('explanation', sentence, sources, index, stem);
    if (issues.length === 0) kept.push(sentence); else violations.push(...issues);
  }
  return { problems, violations, fixedExplanation: kept.join(' ').trim() };
};

// ---------------------------------------------------------------- independent judge
const judgeSchema = (Type: any) => ({
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.INTEGER },
          chosen: { type: Type.INTEGER },
          ambiguous: { type: Type.BOOLEAN },
          evidence: { type: Type.STRING },
          rationale: { type: Type.STRING },
        },
        required: ['index', 'chosen', 'ambiguous', 'evidence', 'rationale'],
      },
    },
  },
  required: ['results'],
});

interface Verdict { index: number; chosen: number; ambiguous: boolean; evidence: string; rationale: string }

const judgePrompt = (questions: RawQuestion[], sources: TopicSource[], optionCount: number, notes: string): string => `Você é um REVISOR rigoroso (direito brasileiro e demais matérias). Responda cada questão de múltipla escolha de forma INDEPENDENTE: você não recebe o gabarito.
${questionSourcesBlock(sources)}${notes}
REGRAS:
1. "chosen" é o índice (0 a ${optionCount - 1}, equivalentes a ${'ABCDE'.slice(0, optionCount).split('').join(', ')}) da única alternativa correta. Use -1 se nenhuma estiver correta.
2. "ambiguous" = true se mais de uma alternativa puder ser considerada correta, se nenhuma estiver correta ou se o enunciado for impreciso ou contiver erro de fato ou de direito.
3. "evidence": copie LITERALMENTE das fontes acima o trecho (de 12 a 40 palavras) que sustenta a alternativa escolhida. Se não houver fonte para a questão, deixe "evidence" vazio. Nunca invente trecho.
4. "rationale": 2 frases justificando a escolha apenas com fatos das fontes ou conhecimento incontroverso. Não cite artigo, lei, súmula ou jurisprudência que não esteja nas fontes.
5. Seja cético: se o enunciado ou as alternativas citarem artigo, parágrafo, lei ou decisão que você não consegue confirmar, marque "ambiguous": true.

QUESTÕES:
${questions.map((q, i) => `Questão ${i}: ${q.question}\n${q.options.map((o, j) => `${'ABCDE'[j]}) ${stripLetter(o)}`).join('\n')}`).join('\n\n')}`;

const runJudge = async (questions: RawQuestion[], sources: TopicSource[], judge: JudgeFn, Type: any, optionCount: number, notes: string): Promise<Verdict[] | null> => {
  const verdicts: Verdict[] = [];
  const CHUNK = 6;
  for (let start = 0; start < questions.length; start += CHUNK) {
    const slice = questions.slice(start, start + CHUNK);
    try {
      const parsed = await judge(judgePrompt(slice, sources, optionCount, notes), judgeSchema(Type), 'question_judge');
      const results: any[] = Array.isArray(parsed?.results) ? parsed.results : [];
      if (results.length !== slice.length) return null;
      const byIndex = new Map<number, Verdict>();
      for (const r of results) {
        const i = Number(r?.index);
        const chosen = Number(r?.chosen);
        if (!Number.isInteger(i) || i < 0 || i >= slice.length || byIndex.has(i) ||
            !Number.isInteger(chosen) || chosen < -1 || chosen >= optionCount ||
            typeof r?.ambiguous !== 'boolean' || typeof r?.evidence !== 'string' || typeof r?.rationale !== 'string') return null;
        byIndex.set(i, { index: start + i, chosen, ambiguous: r.ambiguous, evidence: r.evidence, rationale: r.rationale });
      }
      if (byIndex.size !== slice.length) return null;
      for (let i = 0; i < slice.length; i++) verdicts.push(byIndex.get(i)!);
    } catch {
      return null;
    }
  }
  return verdicts;
};


// ---------------------------------------------------------------- explanation vs answer key
const LETTERS = 'ABCDE';

// Catches an explanation that names a different alternative as the right one ("a alternativa correta é a B",
// "gabarito: 2", "alternativa 3 é a correta") when the key is another one.
export const explanationContradictsKey = (q: RawQuestion): string | null => {
  const text = q.explanation ?? '';
  const claims: string[] = [];
  const patterns = [
    /\b(?:alternativa|op[çc][ãa]o|letra)\s+\(?([A-E]|[1-5])\)?\s+(?:é|está|seria|corresponde\s+à)\s+(?:a\s+)?(?:única\s+)?(?:correta|certa)/giu,
    /\b(?:gabarito|resposta\s+correta|alternativa\s+correta|op[çc][ãa]o\s+correta)\s*(?:é|seria|[:–-])\s*(?:a\s+)?(?:alternativa\s+|op[çc][ãa]o\s+|letra\s+)?\(?([A-E]|[1-5])\)?(?![\p{L}\d])/giu,
  ];
  for (const re of patterns) for (const m of text.matchAll(re)) claims.push(m[1]);
  for (const claim of claims) {
    const index = /^\d$/.test(claim) ? Number(claim) - 1 : LETTERS.indexOf(claim.toUpperCase());
    if (index >= 0 && index !== q.correctAnswer) return `a explicação diz que a alternativa ${claim.toUpperCase()} é a correta, mas o gabarito é ${LETTERS[q.correctAnswer]}`;
  }
  return null;
};

const reviewSchema = (Type: any) => ({
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.INTEGER },
          claims: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                verdict: { type: Type.STRING },
                why: { type: Type.STRING },
                sentenceIndices: { type: Type.ARRAY, items: { type: Type.INTEGER } },
              },
              required: ['text', 'verdict', 'why', 'sentenceIndices'],
            },
          },
          keyWrong: { type: Type.BOOLEAN },
        },
        required: ['index', 'claims', 'keyWrong'],
      },
    },
  },
  required: ['results'],
});

const reviewPrompt = (items: { q: RawQuestion; explanation: string }[], sources: TopicSource[], notes: string): string => `Você é um REVISOR crítico de gabaritos e explicações de questões de múltipla escolha (direito brasileiro e demais matérias). Analise estritamente de acordo com a lei brasileira (e, em Direito Penal, a Teoria Finalista da Ação) e a doutrina dominante.
${questionSourcesBlock(sources)}${notes}
POSTURA: NÃO tente justificar o gabarito. Gabaritos e explicações gerados por IA frequentemente trocam conceitos vizinhos (dolo direto x eventual, erro de tipo x erro de proibição, elemento subjetivo do tipo x da culpabilidade) e atribuem a um artigo o que ele não diz.

Para cada questão:
1. A EXPLICAÇÃO foi dividida em frases numeradas logo abaixo. Analise cada frase inteira e divida-a em afirmações atômicas (de 2 a 6). Cada afirmação diz uma coisa só (ex.: "o erro de tipo exclui X", "o art. N trata de Y").
2. Em cada afirmação, inclua "sentenceIndices" com os índices (começando em 0) de TODAS as frases que ela analisa. A união desses índices precisa cobrir todas as frases da explicação; não ignore nenhuma.
3. Para cada afirmação, em "verdict" escreva exatamente "correta", "incorreta" ou "nao_confirmavel", checando-a de forma INDEPENDENTE contra a lei e as notas de doutrina (não contra o gabarito). Em "why", uma frase. Marque "incorreta" quando o conceito estiver trocado, o artigo não disser isso, ou a afirmação contrariar a lei ou a doutrina. Não marque "incorreta" só por ser curta ou omitir detalhes.
4. "keyWrong" = true se a alternativa marcada no GABARITO não for a correta (ou se mais de uma ou nenhuma estiver correta).

QUESTÕES:
${items.map(({ q, explanation }, i) => `Questão ${i}: ${q.question}\n${q.options.map((o, j) => `${LETTERS[j]}) ${stripLetter(o)}`).join('\n')}\nGABARITO: ${LETTERS[q.correctAnswer]}) ${stripLetter(q.options[q.correctAnswer])}\nFRASES DA EXPLICAÇÃO (índice zero-based):\n${splitSentences(explanation).map((sentence, index) => `[${index}] ${sentence}`).join('\n')}`).join('\n\n')}`;

const runReview = async (items: { q: RawQuestion; explanation: string }[], sources: TopicSource[], judge: JudgeFn, Type: any, notes: string): Promise<Map<number, { agrees: boolean; keyWrong: boolean; problem: string }> | null> => {
  const out = new Map<number, { agrees: boolean; keyWrong: boolean; problem: string }>();
  const CHUNK = 4;
  for (let start = 0; start < items.length; start += CHUNK) {
    const slice = items.slice(start, start + CHUNK);
    try {
      const parsed = await judge(reviewPrompt(slice, sources, notes), reviewSchema(Type), 'explanation_review');
      const results: any[] = Array.isArray(parsed?.results) ? parsed.results : [];
      if (results.length !== slice.length) return null;
      const byIndex = new Map<number, { agrees: boolean; keyWrong: boolean; problem: string }>();
      for (const r of results) {
        const i = Number(r?.index);
        if (!Number.isInteger(i) || i < 0 || i >= slice.length || byIndex.has(i) || typeof r?.keyWrong !== 'boolean' ||
            !Array.isArray(r?.claims) || r.claims.length < 2 || r.claims.length > 6) return null;
        const sentenceCount = splitSentences(slice[i].explanation).length;
        const claims = r.claims.map((claim: any) => ({
          text: typeof claim?.text === 'string' ? claim.text.trim() : '',
          verdict: normalize(String(claim?.verdict ?? '')).trim(),
          why: typeof claim?.why === 'string' ? claim.why.trim() : '',
          sentenceIndices: Array.isArray(claim?.sentenceIndices) ? claim.sentenceIndices : [],
        }));
        if (claims.some((claim: any) => !claim.text || !claim.why || !['correta', 'incorreta', 'nao_confirmavel'].includes(claim.verdict) ||
            claim.sentenceIndices.length === 0 || claim.sentenceIndices.some((index: any) => !Number.isInteger(index) || index < 0 || index >= sentenceCount))) return null;
        const coveredSentences = new Set<number>(claims.flatMap((claim: any) => claim.sentenceIndices));
        if (coveredSentences.size !== sentenceCount) return null;
        const unresolved = claims.filter((claim: any) => claim.verdict !== 'correta');
        const problem = unresolved.map((claim: any) => `${claim.text} (${claim.why})`).join(' | ');
        byIndex.set(i, { agrees: unresolved.length === 0, keyWrong: r.keyWrong, problem });
      }
      if (byIndex.size !== slice.length) return null;
      for (let i = 0; i < slice.length; i++) out.set(start + i, byIndex.get(i)!);
    } catch {
      return null;
    }
  }
  return out;
};

// ---------------------------------------------------------------- orchestrator
export interface BuildOptions {
  topic: string;
  count: number;
  generate: (count: number, extraInstructions: string) => Promise<{ questions?: RawQuestion[] } | RawQuestion[] | null>;
  judge: JudgeFn;
  Type: any;
  /** Alternatives per question (5 for simulados A–E, 4 for the spaced-review sessions). */
  optionCount?: number;
}

const NEGATIVE_STEM = /\b(N[ÃA]O|EXCETO|INCORRET[AO]S?|FALS[AO]S?)\b|\b(exceto|incorret[ao]s?)\b/;
const keyTokens = (text: string): string[] => Array.from(new Set(tokens(text).filter((t) => t.length >= 4 || /^\d+$/.test(t))));

// The judge's quote must contain the substance of the correct option (or, for "NÃO/EXCETO" questions, of the
// statement being tested). A literal but unrelated sentence does not count as support.
const evidenceSupportsAnswer = (q: RawQuestion, evidence: string): boolean => {
  const target = NEGATIVE_STEM.test(q.question) ? `${q.question} ${q.options[q.correctAnswer]}` : q.options[q.correctAnswer];
  const wanted = keyTokens(target);
  if (wanted.length === 0) return false;
  const have = new Set(keyTokens(evidence));
  const matched = wanted.filter((t) => have.has(t)).length;
  return wanted.length <= 2 ? matched === wanted.length : matched >= 2 && matched / wanted.length >= 0.4;
};

const sourceHasEvidence = (sources: TopicSource[], evidence: string): { label: string; excerpt: string; kind: TopicSource['kind'] } | null => {
  for (const src of sources) {
    if (src.laws && src.laws.length > 0) {
      for (const law of src.laws) {
        const excerpt = findInSource(law.text, evidence);
        if (excerpt) return { label: `${law.label}, Art. ${law.numero}`, excerpt: clip(excerpt), kind: src.kind };
      }
    } else {
      const excerpt = findInSource(src.text, evidence);
      if (excerpt) return { label: src.kind === 'wikipedia' ? `Wikipédia: ${src.title}` : src.title, excerpt: clip(excerpt), kind: src.kind };
    }
  }
  return null;
};

export const buildVerifiedQuestions = async (opts: BuildOptions): Promise<{ questions: FinalQuestion[]; report: QualityReport }> => {
  const { topic, count, generate, judge, Type } = opts;
  const optionCount = opts.optionCount ?? 5;
  const sources = await gatherQuestionSources(topic);
  const notes = doctrineNotes(topic);
  const report: QualityReport = {
    sources: sources.map((s) => s.title), rounds: 0, generated: 0, rejectedStructure: 0, rejectedCitations: 0,
    rejectedByJudge: 0, explanationsFixed: 0, verified: 0, consistent: 0, unverified: 0, judgeAvailable: true, reasons: [],
  };
  const note = (reason: string) => { if (report.reasons.length < 14) report.reasons.push(reason); };

  const accepted: FinalQuestion[] = [];
  const avoid: string[] = [];

  // Two model opinions can confidently agree on the same false claim when no reference is available.
  // Refuse the batch before generation instead of presenting model-only explanations as checked.
  if (sources.length === 0) {
    note('nenhuma fonte confiável foi encontrada para o assunto');
    return { questions: [], report };
  }

  for (let round = 0; round < 3 && accepted.length < count; round++) {
    report.rounds = round + 1;
    const need = count - accepted.length;
    // Roughly half of the candidates are rejected by the audit and the judge, so over-ask instead of looping.
    const ask = Math.min(12, Math.max(need + 2, need * 2));
    const raw = await generate(ask, questionGenerationRules(sources, avoid, notes));
    const list: RawQuestion[] = (Array.isArray(raw) ? raw : raw?.questions) ?? [];
    report.generated += list.length;

    const candidates: { q: RawQuestion; explanation: string }[] = [];
    for (const original of list) {
      // Malformed items (missing text, options not a list) are rejected instead of crashing the whole batch.
      if (!original || typeof original.question !== 'string' || !Array.isArray(original.options)) { report.rejectedStructure++; continue; }
      const q: RawQuestion = { ...original, options: original.options.map(stripLetter), explanation: typeof original.explanation === 'string' ? original.explanation : '' };
      avoid.push(q.question);
      let audit: ReturnType<typeof auditQuestion>;
      try { audit = auditQuestion(q, sources, optionCount); } catch { report.rejectedStructure++; continue; }
      if (audit.problems.length > 0) { report.rejectedStructure++; note(`estrutura: ${audit.problems.join('; ')}`); continue; }
      const hardHits = audit.violations.filter((v) => v.where !== 'explanation');
      if (hardHits.length > 0) { report.rejectedCitations++; note(`${hardHits[0].where}: ${hardHits[0].reason}`); continue; }
      candidates.push({ q, explanation: audit.fixedExplanation });
    }
    if (candidates.length === 0) continue;

    const verdicts = await runJudge(candidates.map((c) => c.q), sources, judge, Type, optionCount, notes);
    if (!verdicts) {
      report.judgeAvailable = false;
      report.rejectedByJudge += candidates.length;
      note('a análise independente retornou dados incompletos ou indisponíveis');
      break;
    }

    type FirstPass = { c: { q: RawQuestion; explanation: string }; found: NonNullable<ReturnType<typeof sourceHasEvidence>> };
    const firstPass: FirstPass[] = [];
    candidates.forEach((c, i) => {
      const verdict = verdicts.find((v) => v.index === i);
      if (!verdict || verdict.ambiguous || verdict.chosen !== c.q.correctAnswer) { report.rejectedByJudge++; note('juiz não confirmou o gabarito'); return; }
      const found = verdict.evidence && evidenceSupportsAnswer(c.q, verdict.evidence) ? sourceHasEvidence(sources, verdict.evidence) : null;
      if (!found) { report.rejectedByJudge++; note('gabarito sem citação literal compatível com uma fonte recuperada'); return; }
      firstPass.push({ c, found });
    });

    // Check the answer a second time after reversing alternatives. A question survives only if both positions
    // identify the same source-supported answer.
    const flipped = firstPass.map(({ c }) => ({
      ...c.q,
      options: [...c.q.options].reverse(),
      correctAnswer: optionCount - 1 - c.q.correctAnswer,
    }));
    const secondVerdicts = firstPass.length > 0 ? await runJudge(flipped, sources, judge, Type, optionCount, notes) : [];
    if (firstPass.length > 0 && !secondVerdicts) {
      report.judgeAvailable = false;
      report.rejectedByJudge += firstPass.length;
      note('a segunda conferência do gabarito retornou dados incompletos ou indisponíveis');
      break;
    }

    const confirmed = firstPass.filter((item, i) => {
      const verdict = secondVerdicts?.find((v) => v.index === i);
      const flippedQuestion = flipped[i];
      const found = verdict?.evidence && evidenceSupportsAnswer(flippedQuestion, verdict.evidence)
        ? sourceHasEvidence(sources, verdict.evidence)
        : null;
      if (!verdict || verdict.ambiguous || verdict.chosen !== flippedQuestion.correctAnswer || !found) {
        report.rejectedByJudge++;
        note('a segunda análise não confirmou o mesmo gabarito com evidência literal');
        return false;
      }
      return true;
    });

    // Every explanation claim must be explicitly marked correct. "Not confirmable", missing, and malformed review
    // results are rejected; the previous fallback to the judge's own rationale bypassed this check.
    const review = confirmed.length > 0 ? await runReview(confirmed.map(({ c }) => ({ q: c.q, explanation: c.explanation })), sources, judge, Type, notes) : new Map();
    if (confirmed.length > 0 && !review) {
      report.judgeAvailable = false;
      report.rejectedByJudge += confirmed.length;
      note('a revisão completa da explicação retornou dados incompletos ou indisponíveis');
      break;
    }
    confirmed.forEach(({ c, found }, i) => {
      const contradiction = explanationContradictsKey({ ...c.q, explanation: c.explanation });
      const reviewed = review?.get(i);
      if (!reviewed || reviewed.keyWrong || !reviewed.agrees || contradiction) {
        report.rejectedByJudge++;
        note(`explicação rejeitada: ${contradiction ?? reviewed?.problem ?? 'afirmação não confirmada'}`);
        return;
      }
      const explanation = `${c.explanation}\n\nBase${found.kind === 'lei' ? ' legal' : ''}: ${found.label}: «${found.excerpt}»`.trim();
      report.verified++;
      accepted.push({ ...c.q, explanation, verification: { status: 'verified', source: found.label, evidence: found.excerpt } });
    });
  }

  // Never show the same question twice (the rewrite of two bad explanations can converge on one text).
  const seen = new Set<string>();
  const unique = accepted.filter((item) => { const key = optionKey(item.question); if (seen.has(key)) return false; seen.add(key); return true; });
  return { questions: unique.slice(0, count), report };
};
