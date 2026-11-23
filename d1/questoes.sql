-- Banco de questões reais do ToDaHORA no Cloudflare D1 (substitui a tabela
-- public.questoes do Supabase, que o plano grátis pausava a cada 7 dias sem uso).
--
-- As funções bank_* do Postgres não existem no SQLite: as mesmas consultas
-- moram em functions/api/banco.ts. Aqui ficam só a tabela e os índices.

create table if not exists questoes (
  id              text primary key,   -- source_externalId (o mesmo id do Supabase e do Firestore)
  source          text not null,
  external_id     text not null,
  import_subject  text,               -- matéria (ex.: "Direito Penal")
  subject_raw     text,               -- assunto (ex.: "Revelia")
  topic_raw       text,               -- carreira/pasta de origem
  question_type   text not null default 'multipla_escolha',
  statement       text not null,
  alternatives    text not null,      -- JSON [{letter,text,isCorrect,position}] (era jsonb)
  correct_letter  text not null,
  explanation     text not null default '',
  content_hash    text not null,
  exam_board      text,
  organization    text,
  position        text,               -- cargo, usado só em "Por prova oficial"
  area            text,               -- Policial, Jurídica, Tribunais, Fiscal, Administrativa, Concursos gerais
  exam_year       integer,
  created_at      text not null default (datetime('now'))
);

create unique index if not exists questoes_content_hash_uq on questoes (content_hash);
create index if not exists questoes_materia_idx on questoes (import_subject, subject_raw, area);
create index if not exists questoes_prova_idx   on questoes (exam_board, organization, position, exam_year);
create index if not exists questoes_area_idx    on questoes (area);
