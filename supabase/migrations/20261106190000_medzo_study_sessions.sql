-- Revocable persistent sessions; bearer tokens are not stored in the database.
create table public.medzo_study_sessions (
  session_hash text primary key check (session_hash ~ '^[0-9a-f]{64}$'),
  user_id text not null check (user_id ~ '^[1-9][0-9]{0,19}$'),
  expires_at timestamptz not null
);
alter table public.medzo_study_sessions enable row level security;
revoke all on public.medzo_study_sessions from public, anon, authenticated;
grant select, insert, delete on public.medzo_study_sessions to service_role;
