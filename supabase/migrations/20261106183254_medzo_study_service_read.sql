-- The verified Edge Function reads the current snapshot through PostgREST.
grant select on table public.medzo_study_sync to service_role;
