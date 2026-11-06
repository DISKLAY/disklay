-- Educational snapshots only; the API is accessed exclusively through the verified Edge Function.
create table if not exists public.medzo_study_sync (
  user_id text primary key check (user_id ~ '^[1-9][0-9]{0,19}$'),
  revision bigint not null default 0 check (revision >= 0),
  snapshot jsonb not null default '{"schema":1,"records":{}}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.medzo_study_sync_history (
  id bigint generated always as identity primary key,
  user_id text not null references public.medzo_study_sync(user_id) on delete cascade,
  revision bigint not null,
  snapshot jsonb not null,
  saved_at timestamptz not null default now()
);
alter table public.medzo_study_sync enable row level security;
alter table public.medzo_study_sync_history enable row level security;
revoke all on table public.medzo_study_sync, public.medzo_study_sync_history from public, anon, authenticated;
create or replace function public.medzo_study_sync_put(p_user_id text, p_expected bigint, p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare oldrow public.medzo_study_sync%rowtype; newrow public.medzo_study_sync%rowtype;
begin
  if p_user_id !~ '^[1-9][0-9]{0,19}$' or p_expected < 0 or jsonb_typeof(p_snapshot) <> 'object' or octet_length(p_snapshot::text)>1048576 then
    raise exception 'Invalid snapshot';
  end if;
  insert into public.medzo_study_sync(user_id) values(p_user_id) on conflict do nothing;
  select * into oldrow from public.medzo_study_sync where user_id=p_user_id for update;
  if oldrow.revision <> p_expected then return jsonb_build_object('conflict',true,'revision',oldrow.revision); end if;
  if oldrow.revision > 0 then
    insert into public.medzo_study_sync_history(user_id,revision,snapshot) values(oldrow.user_id,oldrow.revision,oldrow.snapshot);
    delete from public.medzo_study_sync_history where id in (select id from public.medzo_study_sync_history where user_id=p_user_id order by revision desc offset 10);
  end if;
  update public.medzo_study_sync set revision=revision+1,snapshot=p_snapshot,updated_at=now() where user_id=p_user_id returning * into newrow;
  return jsonb_build_object('conflict',false,'revision',newrow.revision,'updatedAt',newrow.updated_at);
end $$;
revoke all on function public.medzo_study_sync_put(text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.medzo_study_sync_put(text,bigint,jsonb) to service_role;

-- Consume each OIDC nonce once, after the ID token signature has been verified.
create table if not exists public.medzo_study_login_nonces (
  nonce_hash text primary key check (nonce_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null
);
alter table public.medzo_study_login_nonces enable row level security;
revoke all on table public.medzo_study_login_nonces from public, anon, authenticated;
create or replace function public.medzo_study_claim_nonce(p_hash text, p_expires bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed text;
begin
  if p_hash !~ '^[0-9a-f]{64}$' or p_expires < extract(epoch from now()) or p_expires > extract(epoch from now())+180 then return false; end if;
  delete from public.medzo_study_login_nonces where expires_at < now();
  insert into public.medzo_study_login_nonces(nonce_hash,expires_at) values(p_hash,pg_catalog.to_timestamp(p_expires)) on conflict do nothing returning nonce_hash into claimed;
  return claimed is not null;
end $$;
revoke all on function public.medzo_study_claim_nonce(text,bigint) from public, anon, authenticated;
grant execute on function public.medzo_study_claim_nonce(text,bigint) to service_role;
