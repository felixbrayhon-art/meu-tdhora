-- Banco de questões reais do ToDaHORA no Supabase (substitui a coleção `questions` do Firestore).
-- Cole tudo no SQL Editor do Supabase e clique em Run. Pode rodar de novo sem estragar nada.

create table if not exists public.questoes (
  id              text primary key,                       -- source_externalId (mesmo id do Firestore)
  source          text not null,
  external_id     text not null,
  import_subject  text,                                   -- matéria (ex.: "Direito Penal")
  subject_raw     text,                                   -- assunto (ex.: "Revelia")
  topic_raw       text,                                   -- carreira/pasta de origem
  question_type   text not null default 'multipla_escolha',
  statement       text not null,
  alternatives    jsonb not null,                         -- [{letter,text,isCorrect,position}]
  correct_letter  text not null,
  explanation     text not null default '',
  content_hash    text not null,
  exam_board      text,
  organization    text,
  position        text,                                   -- área (ex.: "Policial", "Jurídica")
  exam_year       int,
  created_at      timestamptz not null default now()
);

create unique index if not exists questoes_content_hash_uq on public.questoes (content_hash);
create index if not exists questoes_materia_idx on public.questoes (import_subject, subject_raw, position);
create index if not exists questoes_prova_idx   on public.questoes (exam_board, organization, position, exam_year);

-- Leitura aberta (o app usa a chave pública); escrita só com a chave secreta (que ignora as regras).
alter table public.questoes enable row level security;
drop policy if exists "leitura publica" on public.questoes;
create policy "leitura publica" on public.questoes for select to anon, authenticated using (true);

-- Facetas (nível 1 matéria, nível 2 assunto, área) --------------------------------------------------
create or replace function public.bank_subjects()
returns table(value text, count bigint) language sql stable as $$
  select import_subject, count(*) from public.questoes where import_subject is not null group by 1 order by 1;
$$;

create or replace function public.bank_topics(p_subject text, p_area text default null)
returns table(value text, count bigint) language sql stable as $$
  select subject_raw, count(*) from public.questoes
  where import_subject = p_subject and subject_raw is not null and (p_area is null or position = p_area)
  group by 1 order by 1;
$$;

create or replace function public.bank_areas(p_subject text, p_topic text default null)
returns table(value text, count bigint) language sql stable as $$
  select position, count(*) from public.questoes
  where import_subject = p_subject and position is not null and (p_topic is null or subject_raw = p_topic)
  group by 1 order by 1;
$$;

create or replace function public.bank_count(p_subject text, p_topic text default null, p_area text default null)
returns bigint language sql stable as $$
  select count(*) from public.questoes
  where import_subject = p_subject and (p_topic is null or subject_raw = p_topic) and (p_area is null or position = p_area);
$$;

create or replace function public.bank_random(p_subject text, p_topic text default null, p_area text default null, p_count int default 10)
returns setof public.questoes language sql stable as $$
  select * from public.questoes
  where import_subject = p_subject and (p_topic is null or subject_raw = p_topic) and (p_area is null or position = p_area)
  order by random() limit greatest(1, least(p_count, 100));
$$;

-- Por prova (banca → órgão → cargo/área → ano) -----------------------------------------------------
create or replace function public.bank_exam_boards()
returns table(value text, count bigint) language sql stable as $$
  select exam_board, count(*) from public.questoes where exam_board is not null and exam_board <> '' group by 1 order by 1;
$$;

create or replace function public.bank_exam_institutions(p_board text)
returns table(value text, count bigint) language sql stable as $$
  select organization, count(*) from public.questoes where exam_board = p_board and organization is not null and organization <> '' group by 1 order by 1;
$$;

create or replace function public.bank_exam_positions(p_board text, p_institution text)
returns table(value text, count bigint) language sql stable as $$
  select position, count(*) from public.questoes where exam_board = p_board and organization = p_institution and position is not null and position <> '' group by 1 order by 1;
$$;

create or replace function public.bank_exam_years(p_board text, p_institution text, p_position text)
returns table(value text, count bigint) language sql stable as $$
  select exam_year::text, count(*) from public.questoes
  where exam_board = p_board and organization = p_institution and position = p_position and exam_year is not null
  group by 1 order by 1 desc;
$$;

create or replace function public.bank_exam_random(p_board text, p_institution text, p_position text, p_year int, p_count int default 10)
returns setof public.questoes language sql stable as $$
  select * from public.questoes
  where exam_board = p_board and organization = p_institution and position = p_position and exam_year = p_year
  order by random() limit greatest(1, least(p_count, 100));
$$;

grant execute on all functions in schema public to anon, authenticated;
