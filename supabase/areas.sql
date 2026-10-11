-- Área separada do cargo no banco de questões reais. Cole no SQL Editor do Supabase e clique em Run. Pode rodar de novo.
-- Antes: o filtro "Área" usava o campo `position`, que no Gran Cursos guarda o CARGO (Advogado, Juiz…) e nas questões do FC é vazio.
-- Agora: campo `area` próprio (Jurídica, Policial, Tribunais, Fiscal, Administrativa, Concursos gerais). `position` continua sendo o cargo
-- usado só no caminho "Por prova oficial".

alter table public.questoes add column if not exists area text;
create index if not exists questoes_area_idx on public.questoes (import_subject, subject_raw, area);

update public.questoes set area = case
  when position in ('Jurídica', 'Policial') then position                                   -- Estratégia (pasta do Drive)
  when source = 'gran_cursos' and position ~* 'advogado|juiz|procurador|residente jur|^jur[ií]dica' then 'Jurídica'
  when source = 'gran_cursos' and position ~* 'investigador|agente da autoridade|policial' then 'Policial'
  when source = 'gran_cursos' and position ~* 'judici[aá]rio' then 'Tribunais'
  when source = 'gran_cursos' and position ~* 'auditor|fiscal' then 'Fiscal'
  when source = 'gran_cursos' and position ~* 'administrativ|assistente|analista de gest' then 'Administrativa'
  else 'Concursos gerais'                                                                   -- FC Concursos e o que não tem área
end
where area is null;

-- As funções do filtro (mesmos nomes e argumentos que o app já chama) passam a usar `area`.
create or replace function public.bank_topics(p_subject text, p_area text default null)
returns table(value text, count bigint) language sql stable as $$
  select subject_raw, count(*) from public.questoes
  where import_subject = p_subject and subject_raw is not null and (p_area is null or area = p_area)
  group by 1 order by 1;
$$;

create or replace function public.bank_areas(p_subject text, p_topic text default null)
returns table(value text, count bigint) language sql stable as $$
  select area, count(*) from public.questoes
  where import_subject = p_subject and area is not null and (p_topic is null or subject_raw = p_topic)
  group by 1 order by 1;
$$;

create or replace function public.bank_count(p_subject text, p_topic text default null, p_area text default null)
returns bigint language sql stable as $$
  select count(*) from public.questoes
  where import_subject = p_subject and (p_topic is null or subject_raw = p_topic) and (p_area is null or area = p_area);
$$;

create or replace function public.bank_random(p_subject text, p_topic text default null, p_area text default null, p_count int default 10)
returns setof public.questoes language sql stable as $$
  select * from public.questoes
  where import_subject = p_subject and (p_topic is null or subject_raw = p_topic) and (p_area is null or area = p_area)
  order by random() limit greatest(1, least(p_count, 100));
$$;
