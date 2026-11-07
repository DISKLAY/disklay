-- Prevent older clients from replacing a v2 snapshot (which includes rewards)
-- with a v1 snapshot that cannot represent them. The check is under row lock.
create or replace function public.medzo_study_sync_put(p_user_id text, p_expected bigint, p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare oldrow public.medzo_study_sync%rowtype; newrow public.medzo_study_sync%rowtype;
begin
  if p_user_id !~ '^[1-9][0-9]{0,19}$' or p_expected < 0 or jsonb_typeof(p_snapshot) <> 'object' or octet_length(p_snapshot::text)>1048576 then
    raise exception 'Invalid snapshot';
  end if;
  insert into public.medzo_study_sync(user_id) values(p_user_id) on conflict do nothing;
  select * into oldrow from public.medzo_study_sync where user_id=p_user_id for update;
  if oldrow.revision <> p_expected or (oldrow.snapshot->>'schema' = '2' and p_snapshot->>'schema' is distinct from '2') then
    return jsonb_build_object('conflict',true,'revision',oldrow.revision);
  end if;
  if oldrow.revision > 0 then
    insert into public.medzo_study_sync_history(user_id,revision,snapshot) values(oldrow.user_id,oldrow.revision,oldrow.snapshot);
    delete from public.medzo_study_sync_history where id in (select id from public.medzo_study_sync_history where user_id=p_user_id order by revision desc offset 10);
  end if;
  update public.medzo_study_sync set revision=revision+1,snapshot=p_snapshot,updated_at=now() where user_id=p_user_id returning * into newrow;
  return jsonb_build_object('conflict',false,'revision',newrow.revision,'updatedAt',newrow.updated_at);
end $$;
revoke all on function public.medzo_study_sync_put(text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.medzo_study_sync_put(text,bigint,jsonb) to service_role;
