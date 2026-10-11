-- Área como 1º filtro do banco de reais: as matérias passam a poder ser filtradas por área, e há uma função com todas as áreas.
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar de novo. O app antigo continua funcionando (o argumento é opcional).

drop function if exists public.bank_subjects();

create or replace function public.bank_subjects(p_area text default null)
returns table(value text, count bigint) language sql stable as $$
  select import_subject, count(*) from public.questoes
  where import_subject is not null and (p_area is null or area = p_area)
  group by 1 order by 1;
$$;

create or replace function public.bank_all_areas()
returns table(value text, count bigint) language sql stable as $$
  select area, count(*) from public.questoes where area is not null group by 1 order by 2 desc, 1;
$$;

grant execute on function public.bank_subjects(text), public.bank_all_areas() to anon, authenticated;
