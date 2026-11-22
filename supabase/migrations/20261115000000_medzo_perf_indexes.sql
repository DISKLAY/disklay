-- Производительность синхронизации: чистка мёртвых артефактов и индексы
-- под самые частые запросы. Идемпотентно (if not exists / delete only expired).
-- Применено к продакшену 2026-11-15 через Supabase migration medzo_perf_indexes.
delete from public.medzo_study_sessions where expires_at < now();
delete from public.medzo_study_login_nonces where expires_at < now();
delete from public.medzo_password_attempts where window_start < now() - interval '2 hours';
-- medzo_study_sync_history: подзапрос «оставить последние 10 ревизий» при каждом put
create index if not exists medzo_study_sync_history_user_revision
  on public.medzo_study_sync_history(user_id, revision desc);
-- medzo_study_sessions / medzo_study_login_nonces: периодическая чистка по expires_at
create index if not exists medzo_study_sessions_expires_at
  on public.medzo_study_sessions(expires_at);
create index if not exists medzo_study_login_nonces_expires_at
  on public.medzo_study_login_nonces(expires_at);
-- medzo_password_attempts: чистка окон старше 2 часов
create index if not exists medzo_password_attempts_window_start
  on public.medzo_password_attempts(window_start);
