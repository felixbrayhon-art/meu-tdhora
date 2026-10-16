// Filtro de consenso entre fontes: mede o quanto os trechos recuperados CONCORDAM entre si e passa o resultado para a IA.
//
// Ideia (jurado de Condorcet): se cada fonte independente acerta com probabilidade p > 0,5, a chance de uma afirmação estar
// certa cresce quando mais fontes independentes dizem a mesma coisa. Em log-odds, cada fonte soma r = ln(p / (1 - p)):
//     confiança = 1 / (1 + e^-(n · r))        com p = 0,8:  1 fonte 80 % · 2 fontes 94 % · 3 fontes 98,5 %
//
// Duas salvaguardas, porque concordância não é verdade:
//  1. Independência: trechos do mesmo autor/curso contam como UM voto (erros do mesmo autor se repetem). Ver clusterOf.
//  2. Divergência: quando fontes diferentes dão valores diferentes para o mesmo ponto, a confiança desse ponto cai para 50 %
//     e a IA é instruída a seguir a lei, sem afirmar o número.
// O que isto mede é consistência entre fontes. A lei fornecida no pedido continua sendo a âncora final.

export interface Trecho {
  doc: string;
  text: string;
  score: number;
}

export interface Ancora {
  chave: string; // identidade normalizada: "art:312", "sumula:473", "sumulav:13"
  rotulo: string; // como aparece para a IA: "art. 312", "Súmula 473"
}

export interface PontoAnalisado {
  rotulo: string;
  fontes: number; // fontes independentes (clusters) que citam o ponto
  confianca: number; // 0-1
}

export interface Divergencia {
  rotulo: string;
  valores: string[]; // prazos diferentes encontrados junto do ponto, ex.: ["10 dias", "15 dias"]
}

export interface Analise {
  nivel: 'ALTO' | 'MEDIO' | 'BAIXO';
  confianca: number; // 0-1, média ponderada dos pontos (ou estimativa por nº de fontes quando não há pontos verificáveis)
  fontesIndependentes: number;
  confirmados: PontoAnalisado[]; // citados por 2+ fontes independentes
  unicos: PontoAnalisado[]; // citados por 1 fonte
  divergencias: Divergencia[];
}

export const CONFIABILIDADE_FONTE = 0.8; // p: premissa configurável (resumos de concurso: bons, mas não infalíveis)

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const logOdds = (p: number) => Math.log(p / (1 - p));
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Votos independentes: "AULA 00", "AULA 09" (mesmo curso) valem um voto; "Concurseiro Fora da Caixa - Direito Penal (resumo)" é outro. */
export const clusterOf = (doc: string): string => {
  const parte = doc.includes(' · ') ? doc.split(' · ').slice(1).join(' · ') : doc;
  const autor = normalize(parte.split(/\s[-–]\s/)[0])
    .replace(/\b(aula|parte|capitulo|cap|modulo|resumo|simplificada|extra)\b/g, ' ')
    .replace(/[\d()_.–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // "curso-223981-aula-03-…" são as aulas do mesmo curso, não um autor por arquivo.
  return autor && !/^curso\b/.test(autor) ? autor : 'aulas';
};

const ARTIGO = /\bart(?:igo|s?\.)\s*(\d+)\s*[º°o]?(?:\s*-\s*([A-Z])\b)?/gi;
// aceita listas: "Súmulas 346 e 473", "Súmulas Vinculantes 13, 11 e 56", "Súmula 473"
const SUMULA = /s[úu]mulas?\s+(vinculantes?\s+)?(?:n[º°.o]*\s*)?(\d+(?:\s*(?:,|e|ou)\s*\d+)*)/gi;
const PRAZO = /\b(\d{1,3})\s*(?:\([^)]{1,30}\)\s*)?(dias?|meses|m[eê]s|anos?|horas?)\b/gi;

// Lei citada logo depois do artigo ("art. 312 do CPP", "art. 53 da Lei 9.784/99"): sem ela, "art. 37" da CF e de outra lei seriam um ponto só.
const LEI = /^[^.;]{0,40}?\b(?:da|do|de|na|no)\s+(CF|CRFB|Constitui[çc][ãa]o(?:\s+Federal)?|CP|C[óo]digo\s+Penal|CPP|C[óo]digo\s+de\s+Processo\s+Penal|CPC|C[óo]digo\s+de\s+Processo\s+Civil|CC|C[óo]digo\s+Civil|CLT|LINDB|Lei(?:\s+Complementar)?(?:\s+n[º°.o]*)?\s*[\d.]+)(?![A-Za-zÀ-ú])/i;
const leiKey = (raw: string): string => {
  const n = normalize(raw).replace(/\s+/g, ' ');
  if (/^(cf|crfb|constituicao)/.test(n)) return 'cf';
  if (/^(cp|codigo penal)$/.test(n)) return 'cp';
  if (/^(cpp|codigo de processo penal)$/.test(n)) return 'cpp';
  if (/^(cpc|codigo de processo civil)$/.test(n)) return 'cpc';
  if (/^(cc|codigo civil)$/.test(n)) return 'cc';
  if (/^(clt|lindb)$/.test(n)) return n;
  const digitos = n.replace(/[^0-9]/g, '');
  return digitos ? `${/complementar/.test(n) ? 'lc' : 'lei'}${digitos}` : n;
};
const LEI_ROTULO: Record<string, string> = { cf: 'CF', cp: 'CP', cpp: 'CPP', cpc: 'CPC', cc: 'CC', clt: 'CLT', lindb: 'LINDB' };

export const extractAnchors = (text: string): Ancora[] => {
  const found = new Map<string, Ancora>();
  for (const m of text.matchAll(ARTIGO)) {
    const letra = m[2] ? m[2].toUpperCase() : '';
    const depois = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 80);
    const lei = LEI.exec(depois);
    const k = lei ? leiKey(lei[1]) : '';
    const rotuloLei = k ? ` da ${LEI_ROTULO[k] ?? (k.startsWith('lc') ? `LC ${k.slice(2)}` : k.startsWith('lei') ? `Lei ${k.slice(3)}` : k)}` : '';
    const chave = `art:${k ? k + ':' : ''}${m[1]}${letra}`;
    found.set(chave, { chave, rotulo: `art. ${m[1]}${letra ? '-' + letra : ''}${rotuloLei}` });
  }
  for (const m of text.matchAll(SUMULA)) {
    const vinc = !!m[1];
    for (const n of m[2].match(/\d+/g) ?? []) {
      found.set(`sumula${vinc ? 'v' : ''}:${n}`, { chave: `sumula${vinc ? 'v' : ''}:${n}`, rotulo: `Súmula ${vinc ? 'Vinculante ' : ''}${n}` });
    }
  }
  return [...found.values()];
};

const unidade = (u: string) => {
  const n = normalize(u);
  if (n.startsWith('dia')) return 'dias';
  if (n.startsWith('mes')) return 'meses';
  if (n.startsWith('ano')) return 'anos';
  return 'horas';
};

/** Prazos ditos perto de um ponto (janela de ~220 caracteres em volta da citação). */
const prazosPerto = (text: string, ancora: Ancora): string[] => {
  const alvo = ancora.chave.startsWith('art:')
    ? new RegExp(`\\bart(?:igo|s?\\.)\\s*${(ancora.chave.split(':').pop() ?? '').replace(/[A-Z]$/, '')}\\b`, 'gi')
    : new RegExp(`s[úu]mulas?[^.;]{0,40}?\\b${ancora.chave.split(':')[1]}\\b`, 'gi');
  const out = new Set<string>();
  for (const hit of text.matchAll(alvo)) {
    const ini = Math.max(0, (hit.index ?? 0) - 220);
    const janela = text.slice(ini, (hit.index ?? 0) + hit[0].length + 220);
    for (const p of janela.matchAll(PRAZO)) out.add(`${Number(p[1])} ${unidade(p[2])}`);
  }
  return [...out];
};

export interface OpcoesAnalise {
  p?: number; // confiabilidade de cada fonte independente
}

export const analyze = (trechos: Trecho[], opcoes: OpcoesAnalise = {}): Analise => {
  const r = logOdds(opcoes.p ?? CONFIABILIDADE_FONTE);
  const clusters = new Set(trechos.map((t) => clusterOf(t.doc)));
  const porAncora = new Map<string, { ancora: Ancora; clusters: Set<string>; prazos: Map<string, Set<string>> }>();

  for (const t of trechos) {
    const cluster = clusterOf(t.doc);
    for (const ancora of extractAnchors(t.text)) {
      const entry = porAncora.get(ancora.chave) ?? { ancora, clusters: new Set<string>(), prazos: new Map<string, Set<string>>() };
      entry.clusters.add(cluster);
      const prazos = prazosPerto(t.text, ancora);
      if (prazos.length) entry.prazos.set(cluster, new Set([...(entry.prazos.get(cluster) ?? []), ...prazos]));
      porAncora.set(ancora.chave, entry);
    }
  }

  const confirmados: PontoAnalisado[] = [];
  const unicos: PontoAnalisado[] = [];
  const divergencias: Divergencia[] = [];
  for (const { ancora, clusters: apoio, prazos } of porAncora.values()) {
    // Divergência: duas fontes independentes dão conjuntos de prazos sem nenhum valor em comum para o mesmo ponto.
    const conjuntos = [...prazos.values()];
    let diverge = false;
    for (let i = 0; i < conjuntos.length && !diverge; i++) {
      for (let j = i + 1; j < conjuntos.length; j++) {
        if (![...conjuntos[i]].some((v) => conjuntos[j].has(v))) { diverge = true; break; }
      }
    }
    if (diverge) {
      divergencias.push({ rotulo: ancora.rotulo, valores: [...new Set(conjuntos.flatMap((c) => [...c]))].sort() });
      continue;
    }
    const ponto = { rotulo: ancora.rotulo, fontes: apoio.size, confianca: sigmoid(apoio.size * r) };
    (apoio.size >= 2 ? confirmados : unicos).push(ponto);
  }
  const porConfianca = (a: PontoAnalisado, b: PontoAnalisado) => b.confianca - a.confianca || a.rotulo.localeCompare(b.rotulo);
  confirmados.sort(porConfianca);
  unicos.sort(porConfianca);

  const pontos = [...confirmados, ...unicos];
  const total = pontos.length + divergencias.length;
  const fontesIndependentes = clusters.size;
  // Sem pontos verificáveis (nenhum artigo ou súmula citado), só o número de fontes independentes sustenta a estimativa, com desconto.
  const confianca = total === 0
    ? (fontesIndependentes === 0 ? 0 : sigmoid(fontesIndependentes * r * 0.5))
    : (pontos.reduce((s, p) => s + p.confianca, 0) + divergencias.length * 0.5) / total;
  let nivel: Analise['nivel'];
  if (fontesIndependentes === 0 || divergencias.length > 0 && divergencias.length >= pontos.length) nivel = 'BAIXO';
  else if (total === 0) nivel = fontesIndependentes >= 2 ? 'MEDIO' : 'BAIXO';
  else if (fontesIndependentes >= 2 && confirmados.length >= Math.ceil(total / 2) && divergencias.length === 0) nivel = 'ALTO';
  else nivel = 'MEDIO';
  return { nivel, confianca, fontesIndependentes, confirmados, unicos, divergencias };
};

/** Monta o conjunto analisado: os melhores de CADA fonte independente primeiro, depois completa pela relevância. */
export const montarPool = (ordenados: Trecho[], max: number, porFonte = 3): Trecho[] => {
  const contagem = new Map<string, number>();
  const pool: Trecho[] = [];
  for (const t of ordenados) {
    const c = clusterOf(t.doc);
    if ((contagem.get(c) ?? 0) < porFonte) { contagem.set(c, (contagem.get(c) ?? 0) + 1); pool.push(t); }
  }
  for (const t of ordenados) {
    if (pool.length >= max) break;
    if (!pool.includes(t)) pool.push(t);
  }
  return pool.slice(0, max).sort((a, b) => b.score - a.score);
};

/** Escolhe até `max` trechos priorizando fontes independentes diferentes (um por cluster antes de repetir cluster). */
export const escolherTrechos = (ordenados: Trecho[], max: number): Trecho[] => {
  const escolhidos: Trecho[] = [];
  const vistos = new Set<string>();
  for (const t of ordenados) {
    const c = clusterOf(t.doc);
    if (!vistos.has(c) && escolhidos.length < max) { vistos.add(c); escolhidos.push(t); }
  }
  for (const t of ordenados) {
    if (escolhidos.length >= max) break;
    if (!escolhidos.includes(t)) escolhidos.push(t);
  }
  return escolhidos;
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Bloco em português que vai junto das instruções da IA. */
export const descrever = (a: Analise): string => {
  const linhas = [`ANÁLISE ESTATÍSTICA DAS FONTES (${a.fontesIndependentes} fonte(s) independente(s), nível de confiança ${a.nivel}, ${pct(a.confianca)}):`];
  if (a.confirmados.length) linhas.push(`- Confirmados por 2 ou mais fontes independentes: ${a.confirmados.map((p) => `${p.rotulo} (${pct(p.confianca)})`).join('; ')}.`);
  if (a.unicos.length) linhas.push(`- Citados por uma única fonte (use com cautela; só afirme se a lei fornecida confirmar): ${a.unicos.map((p) => p.rotulo).join('; ')}.`);
  if (a.divergencias.length) linhas.push(`- FONTES DIVERGEM em: ${a.divergencias.map((d) => `${d.rotulo} (valores: ${d.valores.join(' x ')})`).join('; ')}. Siga a lei fornecida e não afirme esses valores se ela não os trouxer.`);
  linhas.push('Como usar: dê prioridade aos pontos confirmados; o texto legal prevalece sobre qualquer fonte; ' + (a.nivel === 'BAIXO' ? 'a confiança é baixa, então indique ao aluno que confira na lei.' : 'não invente pontos que nenhuma fonte sustenta.'));
  return linhas.join('\n');
};
