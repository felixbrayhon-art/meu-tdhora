// Real-question bank on Supabase (table public.questoes + the bank_* functions of supabase-schema.sql).
// The publishable key below is public by design: it only reads (row-level security has a single SELECT policy).
// Writes happen from the loader script with the secret key, never from the app.
const SUPABASE_URL = 'https://tslcjsvetgqgsgqpyruf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zEesejaS_9r3Ox7OJaaZ-Q_rgt9TWIz';

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
  exam_year: number | null;
}

export const bankRpc = async <T,>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Banco de questões indisponível (${response.status}).`);
  return response.json() as Promise<T>;
};
