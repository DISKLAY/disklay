-- Isolated account foundation. NOT deployed or connected to the login endpoint.
-- Passwords belong to Supabase Auth, never these tables.
create table public.medzo_password_accounts (
  username text primary key check (username ~ '^[a-z0-9_]{4,32}$'),
  account_id uuid not null unique default gen_random_uuid(),
  reservation_id uuid not null unique default gen_random_uuid(),
  internal_email text not null unique,
  display_name text not null check (char_length(display_name) between 1 and 48),
  provider_id uuid unique,
  telegram_id text unique check (telegram_id is null or telegram_id ~ '^[1-9][0-9]{0,19}$'),
  state text not null default 'pending' check (state in ('pending','active')),
  created_at timestamptz not null default now(),
  check ((state='pending' and provider_id is null) or (state='active' and provider_id is not null))
);
create table public.medzo_password_attempts (
  action text not null check (action in ('register','login')),
  bucket text not null check (length(bucket)<=64),
  window_start timestamptz not null,
  attempts integer not null check (attempts>0),
  primary key(action,bucket,window_start)
);
alter table public.medzo_password_accounts enable row level security;
alter table public.medzo_password_attempts enable row level security;
revoke all on public.medzo_password_accounts,public.medzo_password_attempts from public,anon,authenticated;
grant select on public.medzo_password_accounts to service_role;

create or replace function public.medzo_password_allow(p_action text,p_username text)
returns boolean language plpgsql security definer set search_path='' as $$
declare start_at timestamptz; n integer; total integer;
begin
  if p_action not in ('login','register') or p_username !~ '^[a-z0-9_]{4,32}$' then return false; end if;
  start_at:=pg_catalog.to_timestamp(pg_catalog.floor(extract(epoch from pg_catalog.now())/900)*900);
  insert into public.medzo_password_attempts(action,bucket,window_start,attempts) values(p_action,'*',start_at,1)
    on conflict(action,bucket,window_start) do update set attempts=public.medzo_password_attempts.attempts+1 returning attempts into total;
  if total>(case when p_action='login' then 500 else 100 end) then return false; end if;
  insert into public.medzo_password_attempts(action,bucket,window_start,attempts) values(p_action,p_username,start_at,1)
    on conflict(action,bucket,window_start) do update set attempts=public.medzo_password_attempts.attempts+1 returning attempts into n;
  return n<=(case when p_action='login' then 10 else 3 end);
end $$;
create or replace function public.medzo_password_reserve(p_username text,p_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.medzo_password_accounts%rowtype; id uuid:=gen_random_uuid();
begin
  if p_username !~ '^[a-z0-9_]{4,32}$' or char_length(p_name) not between 1 and 48 then raise exception 'invalid input'; end if;
  insert into public.medzo_password_accounts(username,account_id,internal_email,display_name)
    values(p_username,id,id::text||'@accounts.medzo.invalid',p_name)
    on conflict(username) do nothing returning * into result;
  if result.username is null then return null; end if;
  return jsonb_build_object('reservation',result.reservation_id,'email',result.internal_email);
end $$;
create or replace function public.medzo_password_complete(p_reservation uuid,p_provider_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.medzo_password_accounts set state='active',provider_id=p_provider_id where reservation_id=p_reservation and state='pending';
  return found;
end $$;
revoke all on function public.medzo_password_allow(text,text),public.medzo_password_reserve(text,text),public.medzo_password_complete(uuid,uuid) from public,anon,authenticated;
grant execute on function public.medzo_password_allow(text,text),public.medzo_password_reserve(text,text),public.medzo_password_complete(uuid,uuid) to service_role;
