-- Questões comentadas (professores + banca) para a busca por tema do ToDaHORA, no Supabase (substitui a tabela questoes_comentadas do D1).
-- Cole tudo no SQL Editor do Supabase e clique em Run. Pode rodar de novo sem estragar nada.

create table if not exists public.questoes_comentadas (
  id           bigint generated always as identity primary key,
  hash         text not null unique,                 -- enunciado normalizado: evita duplicata
  fonte        text,
  disciplina   text,                                 -- Direito Penal, Língua Portuguesa…
  materia      text,
  assunto      text,
  enunciado    text not null,
  alternativas jsonb not null,                       -- {"A": "...", "B": "..."}
  gabarito     text not null,
  comentario   text not null,                        -- Markdown
  tsv          tsvector generated always as (
                 to_tsvector('portuguese', coalesce(assunto,'') || ' ' || coalesce(materia,'') || ' ' || enunciado)
               ) stored
);

create index if not exists questoes_comentadas_tsv_idx  on public.questoes_comentadas using gin (tsv);
create index if not exists questoes_comentadas_disc_idx on public.questoes_comentadas (disciplina);

alter table public.questoes_comentadas enable row level security;
drop policy if exists "leitura publica" on public.questoes_comentadas;
create policy "leitura publica" on public.questoes_comentadas for select to anon, authenticated using (true);

-- Busca por tema: palavras do tema no enunciado/assunto/matéria (com a disciplina quando o tema vem como "Matéria: assunto").
create or replace function public.buscar_comentadas(p_topic text, p_disciplina text default null, p_count int default 5)
returns setof public.questoes_comentadas language sql stable as $$
  select * from public.questoes_comentadas
  where tsv @@ plainto_tsquery('portuguese', p_topic)
    and (p_disciplina is null or disciplina = p_disciplina)
  order by random()
  limit greatest(1, least(p_count, 50));
$$;

grant execute on function public.buscar_comentadas(text, text, int) to anon, authenticated;
