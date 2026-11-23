-- Публичные правки меток гистологии: сохраняет только разработчик, читают все.
create table if not exists public.medzo_histology_overrides (
  slide_id text primary key,
  points jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text not null
);
alter table public.medzo_histology_overrides enable row level security;
revoke all on table public.medzo_histology_overrides from public, anon, authenticated;
grant select, insert, update, delete on table public.medzo_histology_overrides to service_role;

-- Чтение всех правок одним запросом.
create or replace function public.medzo_histology_get_overrides()
returns jsonb
language sql security definer set search_path = '' stable as $$
  select coalesce(jsonb_object_agg(slide_id, points), '{}'::jsonb) from public.medzo_histology_overrides;
$$;
revoke all on function public.medzo_histology_get_overrides() from public, anon, authenticated;
grant execute on function public.medzo_histology_get_overrides() to service_role;
