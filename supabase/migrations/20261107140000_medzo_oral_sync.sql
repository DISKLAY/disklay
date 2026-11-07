-- Separate storage: older clients never see or overwrite the oral snapshot.
create table public.medzo_oral_sync (
  user_id text primary key check (user_id ~ '^([1-9][0-9]{0,19}|p_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
  revision bigint not null default 0,
  snapshot jsonb not null default '{"schema":1,"tickets":{},"cards":{}}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.medzo_oral_sync_history (
  id bigint generated always as identity primary key,
  user_id text not null references public.medzo_oral_sync(user_id) on delete cascade,
  revision bigint not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id,revision)
);
alter table public.medzo_oral_sync enable row level security;
alter table public.medzo_oral_sync_history enable row level security;
revoke all on public.medzo_oral_sync, public.medzo_oral_sync_history from public, anon, authenticated;
grant select on public.medzo_oral_sync to service_role;
create function public.medzo_oral_sync_put(p_user_id text,p_expected bigint,p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare oldrow public.medzo_oral_sync%rowtype; newrow public.medzo_oral_sync%rowtype;
begin
  if p_user_id is null or p_user_id !~ '^([1-9][0-9]{0,19}|p_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$' or p_expected is null or p_expected<0 or jsonb_typeof(p_snapshot) is distinct from 'object' or octet_length(p_snapshot::text)>50000 then raise exception 'Invalid snapshot'; end if;
  insert into public.medzo_oral_sync(user_id) values(p_user_id) on conflict do nothing;
  select * into oldrow from public.medzo_oral_sync where user_id=p_user_id for update;
  if oldrow.revision<>p_expected then return jsonb_build_object('conflict',true,'revision',oldrow.revision); end if;
  if oldrow.revision>0 then
    insert into public.medzo_oral_sync_history(user_id,revision,snapshot) values(oldrow.user_id,oldrow.revision,oldrow.snapshot);
    delete from public.medzo_oral_sync_history where id in (select id from public.medzo_oral_sync_history where user_id=p_user_id order by revision desc offset 10);
  end if;
  update public.medzo_oral_sync set revision=revision+1,snapshot=p_snapshot,updated_at=now() where user_id=p_user_id returning * into newrow;
  return jsonb_build_object('conflict',false,'revision',newrow.revision,'updatedAt',newrow.updated_at);
end $$;
revoke all on function public.medzo_oral_sync_put(text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.medzo_oral_sync_put(text,bigint,jsonb) to service_role;
