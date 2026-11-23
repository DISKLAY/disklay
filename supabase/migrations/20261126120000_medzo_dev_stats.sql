-- Платформенная аналитика для режима разработчика: только через Edge Function.
create or replace function public.medzo_dev_overview()
returns jsonb
language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'total_users', (select count(*) from public.medzo_study_sync),
    'leaderboard_total', (select count(*) from public.medzo_leaderboard_members),
    'photos_total', (select count(*) from public.medzo_profile_photos),
    'active_24h', (select count(*) from public.medzo_study_sync where updated_at >= now() - interval '1 day'),
    'active_7d', (select count(*) from public.medzo_study_sync where updated_at >= now() - interval '7 days'),
    'active_30d', (select count(*) from public.medzo_study_sync where updated_at >= now() - interval '30 days')
  )
$$;
revoke all on function public.medzo_dev_overview() from public, anon, authenticated;
grant execute on function public.medzo_dev_overview() to service_role;
