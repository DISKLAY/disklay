-- Profile pictures are separate from educational snapshots and game state.
-- Only the verified Edge Function may read or write them.
create table public.medzo_profile_photos (
  user_id text primary key check (user_id ~ '^[1-9][0-9]{0,19}$'),
  jpeg_base64 text not null check (length(jpeg_base64) between 4 and 90000 and jpeg_base64 ~ '^[A-Za-z0-9+/]*={0,2}$'),
  updated_at timestamptz not null default now()
);
alter table public.medzo_profile_photos enable row level security;
revoke all on public.medzo_profile_photos from public, anon, authenticated;
grant select, insert, update, delete on public.medzo_profile_photos to service_role;
