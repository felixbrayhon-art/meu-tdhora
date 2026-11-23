// Banco de questões reais (tabela `questoes` do D1 `todahora-questoes`, carregada por
// scripts/banco-questoes/para-d1.mjs). Substitui a tabela do mesmo nome no Supabase.
//
// Por que saiu do Supabase: o plano grátis PAUSA o projeto depois de 7 dias sem uso, e em 2026-11-23 o app
// ficou sem questão nenhuma — o endereço do projeto parou de resolver em DNS. O D1 não pausa.
//
// As funções `bank_*` do Postgres não existem no SQLite, então as mesmas consultas viraram operações daqui.
// Os nomes das colunas das questões continuam os do Postgres (`import_subject`, `exam_board`…), porque o
// services/questionBankService.ts já traduz esses nomes para os do app.
//
// GET  /api/banco?op=areas
// GET  /api/banco?op=materias&area=Policial
// GET  /api/banco?op=assuntos&materia=Direito%20Penal&area=Policial
// GET  /api/banco?op=areas-da-materia&materia=...&assunto=...
// GET  /api/banco?op=contar&materia=...&assunto=...&area=...
// GET  /api/banco?op=sortear&materia=...&assunto=...&area=...&quantas=10
// GET  /api/banco?op=bancas
// GET  /api/banco?op=orgaos&banca=...
// GET  /api/banco?op=cargos&banca=...&orgao=...
// GET  /api/banco?op=anos&banca=...&orgao=...&cargo=...
// GET  /api/banco?op=sortear-prova&banca=&orgao=&cargo=&ano=&materia=&assunto=&quantas=10   (todos opcionais)
// GET  /api/banco?op=linhas          (metadados de todas as questões, para os filtros de "todos")
// POST /api/banco  { op: 'por-ids', ids: [...] }

interface D1Comando {
  bind: (...values: unknown[]) => D1Comando;
  all: <T>() => Promise<{ results: T[] }>;
  first: <T>() => Promise<T | null>;
}
interface D1Like { prepare: (sql: string) => D1Comando }
interface Context {
  request: Request;
  env: Record<string, unknown> & { QUESTOES?: D1Like };
  waitUntil: (p: Promise<unknown>) => void;
}

const COLUNAS = 'id, source, external_id, import_subject, subject_raw, topic_raw, question_type, statement, ' +
  'alternatives, correct_letter, explanation, content_hash, exam_board, organization, position, area, exam_year';
/** Só o que os filtros precisam: a lista inteira com enunciado e explicação passaria de 30 MB. */
const COLUNAS_META = 'id, area, exam_board, organization, position, exam_year, import_subject, subject_raw';
const MAX_SORTEIO = 100;
const DIA = 86_400;
const HORA = 3_600;

const resposta = (corpo: unknown, cacheSegundos: number, status = 200) => new Response(JSON.stringify(corpo), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheSegundos ? `public, max-age=${cacheSegundos}` : 'no-store',
  },
});
const erro = (mensagem: string, status: number) => resposta({ error: mensagem }, 0, status);

const inteiro = (valor: string | null, padrao: number, maximo: number) => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), maximo) : padrao;
};

/** `alternatives` é TEXT no SQLite; o app espera o array que o `jsonb` do Postgres devolvia. */
const comAlternativas = <T extends { alternatives: unknown }>(linhas: T[]): T[] => linhas.map((linha) => ({
  ...linha,
  alternatives: typeof linha.alternatives === 'string' ? JSON.parse(linha.alternatives || '[]') : linha.alternatives,
}));

type Faceta = { value: string; count: number };
const faceta = (db: D1Like, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args).all<Faceta>().then((r) => r.results);

/** Monta o `where` só com os campos informados — é o que faz um filtro em "todas as bancas" valer. */
const onde = (pares: [string, unknown][]) => {
  const usados = pares.filter(([, v]) => v !== null && v !== undefined && v !== '');
  return {
    sql: usados.length ? usados.map(([coluna], i) => `${coluna} = ?${i + 1}`).join(' and ') : '1 = 1',
    args: usados.map(([, v]) => v),
  };
};

const sortear = async (db: D1Like, pares: [string, unknown][], quantas: number) => {
  const { sql, args } = onde(pares);
  // `order by random()` existe no SQLite igual ao do Postgres.
  const { results } = await db.prepare(`select ${COLUNAS} from questoes where ${sql} order by random() limit ?${args.length + 1}`)
    .bind(...args, quantas).all<{ alternatives: unknown }>();
  return comAlternativas(results);
};

const responder = async (db: D1Like, url: URL): Promise<Response> => {
  const p = (nome: string) => url.searchParams.get(nome) || null;
  const quantas = inteiro(p('quantas'), 10, MAX_SORTEIO);
  const ano = p('ano');

  switch (url.searchParams.get('op')) {
    // --- Área → matéria → assunto ---
    case 'areas':
      return resposta(await faceta(db, 'select area as value, count(*) as count from questoes where area is not null group by area order by count desc, area'), DIA);
    case 'materias':
      return resposta(await faceta(db,
        'select import_subject as value, count(*) as count from questoes where import_subject is not null and (?1 is null or area = ?1) group by import_subject order by import_subject',
        p('area')), DIA);
    case 'assuntos':
      return resposta(await faceta(db,
        'select subject_raw as value, count(*) as count from questoes where import_subject = ?1 and subject_raw is not null and (?2 is null or area = ?2) group by subject_raw order by subject_raw',
        p('materia'), p('area')), DIA);
    case 'areas-da-materia':
      return resposta(await faceta(db,
        'select area as value, count(*) as count from questoes where import_subject = ?1 and area is not null and (?2 is null or subject_raw = ?2) group by area order by area',
        p('materia'), p('assunto')), DIA);
    case 'contar': {
      const linha = await db.prepare(
        'select count(*) as n from questoes where import_subject = ?1 and (?2 is null or subject_raw = ?2) and (?3 is null or area = ?3)',
      ).bind(p('materia'), p('assunto'), p('area')).first<{ n: number }>();
      return resposta(Number(linha?.n ?? 0), DIA);
    }
    case 'sortear':
      return resposta(await sortear(db, [['import_subject', p('materia')], ['subject_raw', p('assunto')], ['area', p('area')]], quantas), 0);

    // --- Por prova oficial: banca → órgão → cargo → ano ---
    case 'bancas':
      return resposta(await faceta(db, "select exam_board as value, count(*) as count from questoes where exam_board is not null and exam_board <> '' group by exam_board order by exam_board"), DIA);
    case 'orgaos':
      return resposta(await faceta(db,
        "select organization as value, count(*) as count from questoes where exam_board = ?1 and organization is not null and organization <> '' group by organization order by organization",
        p('banca')), DIA);
    case 'cargos':
      return resposta(await faceta(db,
        "select position as value, count(*) as count from questoes where exam_board = ?1 and organization = ?2 and position is not null and position <> '' group by position order by position",
        p('banca'), p('orgao')), DIA);
    case 'anos':
      return resposta(await faceta(db,
        'select cast(exam_year as text) as value, count(*) as count from questoes where exam_board = ?1 and organization = ?2 and position = ?3 and exam_year is not null group by exam_year order by exam_year desc',
        p('banca'), p('orgao'), p('cargo')), DIA);
    case 'sortear-prova':
      return resposta(await sortear(db, [
        ['exam_board', p('banca')], ['organization', p('orgao')], ['position', p('cargo')],
        ['exam_year', ano === null ? null : Number(ano)], ['import_subject', p('materia')], ['subject_raw', p('assunto')],
      ], quantas), 0);

    // --- Metadados de tudo: o filtro de várias marcações cruza e conta no navegador ---
    case 'linhas': {
      const { results } = await db.prepare(`select ${COLUNAS_META} from questoes order by id`).all();
      return resposta(results, HORA);
    }
    default:
      return erro('Operação desconhecida.', 400);
  }
};

export const onRequest = async ({ request, env, waitUntil }: Context): Promise<Response> => {
  const db = env.QUESTOES;
  if (!db) return erro('O banco de questões não está ligado neste ambiente.', 503);

  try {
    if (request.method === 'POST') {
      const corpo = await request.json() as { op?: string; ids?: unknown };
      if (corpo.op !== 'por-ids') return erro('Operação desconhecida.', 400);
      const ids = Array.isArray(corpo.ids) ? corpo.ids.filter((id): id is string => typeof id === 'string').slice(0, MAX_SORTEIO) : [];
      if (!ids.length) return resposta([], 0);
      const { results } = await db.prepare(`select ${COLUNAS} from questoes where id in (${ids.map(() => '?').join(',')})`)
        .bind(...ids).all<{ alternatives: unknown }>();
      return resposta(comAlternativas(results), 0);
    }

    const url = new URL(request.url);
    // As listas de filtro e os metadados só mudam quando entra carga nova (manual, semanas de distância).
    // Sem cache de verdade, cada aluno que abre o filtro relê milhares de linhas da cota diária do D1 —
    // `op=linhas` sozinho lê as 8.907. O Cache-Control não basta: a borda só guarda o que for posto aqui.
    const cache = (caches as unknown as { default: Cache }).default;
    const guardavel = url.searchParams.get('op') !== 'sortear' && url.searchParams.get('op') !== 'sortear-prova';
    if (guardavel) {
      const guardada = await cache.match(request);
      if (guardada) return guardada;
    }

    const saida = await responder(db, url);
    if (guardavel && saida.ok) waitUntil(cache.put(request, saida.clone()));
    return saida;
  } catch (causa) {
    return erro(`O banco de questões não respondeu: ${causa instanceof Error ? causa.message : String(causa)}`, 502);
  }
};
