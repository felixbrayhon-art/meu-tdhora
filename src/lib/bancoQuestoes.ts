// Cliente do banco de questões reais. Fala com /api/banco (functions/api/banco.ts), que lê a tabela
// `questoes` do D1 `todahora-questoes`.
//
// Antes isto batia direto no Supabase com a chave pública (src/lib/supabaseBank.ts). O plano grátis do
// Supabase pausa o projeto depois de 7 dias sem uso e em 2026-11-23 o banco sumiu do app por isso. Agora a
// consulta passa pelo nosso próprio endpoint: o D1 não pausa, não há chave nenhuma no navegador, e as
// listas de filtro ficam guardadas na borda em vez de reler a base a cada aluno.
//
// Os nomes das colunas continuam os do Postgres porque é assim que o questionBankService.ts já os lê.

export interface BankRow {
  id: string;
  source: string;
  external_id: string;
  import_subject: string | null;
  subject_raw: string | null;
  topic_raw: string | null;
  question_type: string;
  statement: string;
  alternatives: { letter: string; text: string; isCorrect: boolean; position: number }[];
  correct_letter: string;
  explanation: string;
  content_hash: string;
  exam_board: string | null;
  organization: string | null;
  position: string | null;
  area: string | null;
  exam_year: number | null;
}

export interface Faceta { value: string; count: number }

/** Metadados de uma questão: o que os filtros de "todos" precisam para cruzar e contar. */
export interface LinhaMeta {
  id: string;
  area: string | null;
  exam_board: string | null;
  organization: string | null;
  position: string | null;
  exam_year: number | null;
  import_subject: string | null;
  subject_raw: string | null;
}

type Params = Record<string, string | number | null | undefined>;

const chamar = async <T,>(op: string, params: Params = {}, tempoLimite = 20000): Promise<T> => {
  const busca = new URLSearchParams({ op });
  Object.entries(params).forEach(([chave, valor]) => {
    if (valor !== null && valor !== undefined && valor !== '') busca.set(chave, String(valor));
  });
  const resposta = await fetch(`/api/banco?${busca}`, { signal: AbortSignal.timeout(tempoLimite) });
  if (!resposta.ok) {
    const detalhe = await resposta.json().catch(() => null) as { error?: string } | null;
    throw new Error(detalhe?.error || `Banco de questões indisponível (${resposta.status}).`);
  }
  return resposta.json() as Promise<T>;
};

export const bancoFaceta = (op: 'areas' | 'materias' | 'assuntos' | 'areas-da-materia' | 'bancas' | 'orgaos' | 'cargos' | 'anos', params: Params = {}): Promise<Faceta[]> =>
  chamar<Faceta[]>(op, params);

export const bancoContar = (params: Params): Promise<number> =>
  chamar<number>('contar', params).then((n) => Number(n) || 0);

export const bancoSortear = (params: Params): Promise<BankRow[]> =>
  chamar<BankRow[]>('sortear', params);

/** Sorteio por prova. Todo campo é opcional: o que ficar de fora vale como "todos". */
export const bancoSortearProva = (params: Params): Promise<BankRow[]> =>
  chamar<BankRow[]>('sortear-prova', params);

/** Metadados de todas as questões (cerca de 1,5 MB), guardados na borda por uma hora. */
export const bancoLinhas = (): Promise<LinhaMeta[]> => chamar<LinhaMeta[]>('linhas', {}, 30000);

export const bancoPorIds = async (ids: string[]): Promise<BankRow[]> => {
  if (!ids.length) return [];
  const resposta = await fetch('/api/banco', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'por-ids', ids }),
    signal: AbortSignal.timeout(20000),
  });
  if (!resposta.ok) throw new Error(`Banco de questões indisponível (${resposta.status}).`);
  return resposta.json() as Promise<BankRow[]>;
};
