-- Полный рейтинг для режима разработчика: все аккаунты с облаком, не только opt-in.
-- Возвращает user_id, имя из рейтинга если есть, балл из снимков и фото по согласию.
create or replace function public.medzo_dev_all_ratings()
returns table(user_id text, display_name text, score bigint, photo text, updated_at timestamptz, in_leaderboard boolean)
language sql security definer set search_path = '' stable as $$
  select
    s.user_id,
    m.display_name,
    coalesce((
      select sum(case
        when jsonb_typeof(e.value->'game'->'rating') = 'number'
         and e.value->'game'->>'rating' ~ '^[0-9]{1,8}$'
        then (e.value->'game'->>'rating')::bigint else 0 end)
      from jsonb_each(case when jsonb_typeof(s.snapshot->'records')='object' then s.snapshot->'records' else '{}'::jsonb end) e
      where e.key = any(array['anatomy-colloquium-v1','anatomy-colloquium-v1-2','anatomy-colloquium-v1-3','anatomy-colloquium-v1-4','anatomy-colloquium-v1-5','anatomy-colloquium-v1-6','anatomy-colloquium-v1-7','anatomy-colloquium-v1-credit-1','anatomy-colloquium-v1-credit-2','anatomy-colloquium-v1-stom-2','anatomy-colloquium-v1-stom-3'])
    ),0)::bigint as score,
    case when m.show_photo then p.jpeg_base64 else null end as photo,
    s.updated_at,
    (m.user_id is not null) as in_leaderboard
  from public.medzo_study_sync s
  left join public.medzo_leaderboard_members m on m.user_id = s.user_id
  left join public.medzo_profile_photos p on p.user_id = s.user_id
  order by score desc, s.updated_at asc, s.user_id asc
  limit 500;
$$;
revoke all on function public.medzo_dev_all_ratings() from public, anon, authenticated;
grant execute on function public.medzo_dev_all_ratings() to service_role;
