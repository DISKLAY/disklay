-- Public participation is explicitly opt-in. Telegram IDs never leave the server.
create table public.medzo_leaderboard_members (
  user_id text primary key check (user_id ~ '^[1-9][0-9]{0,19}$'),
  public_id uuid not null default gen_random_uuid() unique,
  display_name text not null check (char_length(display_name) between 1 and 48),
  show_photo boolean not null default false,
  joined_at timestamptz not null default now()
);
alter table public.medzo_leaderboard_members enable row level security;
revoke all on public.medzo_leaderboard_members from public, anon, authenticated;
grant select,insert,update,delete on public.medzo_leaderboard_members to service_role;

create or replace function public.medzo_leaderboard_top()
returns table(display_name text, score bigint, photo text)
language sql security definer set search_path = '' stable as $$
  select m.display_name,
    coalesce((select sum(case
      when jsonb_typeof(e.value->'game'->'rating') = 'number'
       and e.value->'game'->>'rating' ~ '^[0-9]{1,8}$'
      then (e.value->'game'->>'rating')::bigint else 0 end)
      from jsonb_each(case when jsonb_typeof(s.snapshot->'records')='object' then s.snapshot->'records' else '{}'::jsonb end) e
      where e.key = any(array['anatomy-colloquium-v1','anatomy-colloquium-v1-2','anatomy-colloquium-v1-3','anatomy-colloquium-v1-4','anatomy-colloquium-v1-5','anatomy-colloquium-v1-6','anatomy-colloquium-v1-7','anatomy-colloquium-v1-credit-1','anatomy-colloquium-v1-credit-2','anatomy-colloquium-v1-stom-2','anatomy-colloquium-v1-stom-3'])
      ),0)::bigint as score,
    case when m.show_photo then p.jpeg_base64 else null end as photo
  from public.medzo_leaderboard_members m
  left join public.medzo_study_sync s on s.user_id=m.user_id
  left join public.medzo_profile_photos p on p.user_id=m.user_id
  order by score desc,m.joined_at asc,m.public_id asc limit 100;
$$;
revoke all on function public.medzo_leaderboard_top() from public, anon, authenticated;
grant execute on function public.medzo_leaderboard_top() to service_role;
