alter table public.cards
  add column if not exists team text,
  add column if not exists parallel text,
  add column if not exists rookie_card boolean,
  add column if not exists serial_number text,
  add column if not exists condition text,
  add column if not exists original_image_url text,
  add column if not exists display_image_url text,
  add column if not exists image_source text,
  add column if not exists image_source_url text,
  add column if not exists image_replacement_status text not null default 'original';

create table if not exists public.card_training_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  original_image_path text,
  original_image_url text,
  display_image_url text,
  ai_extracted_json jsonb not null default '{}'::jsonb,
  user_corrected_json jsonb not null default '{}'::jsonb,
  field_feedback_json jsonb not null default '{}'::jsonb,
  sales_query text,
  sales_results_json jsonb not null default '[]'::jsonb,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source text not null default 'manual',
  training_eligible boolean not null default false,
  consented_at timestamptz,
  archive_status text not null default 'captured',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.card_training_events enable row level security;
revoke all on public.card_training_events from public, anon;
grant select, insert, update, delete on public.card_training_events to authenticated;
drop policy if exists "Owners read card training events" on public.card_training_events;
drop policy if exists "Owners create card training events" on public.card_training_events;
drop policy if exists "Owners update card training events" on public.card_training_events;
drop policy if exists "Owners delete card training events" on public.card_training_events;
create policy "Owners read card training events" on public.card_training_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners create card training events" on public.card_training_events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners update card training events" on public.card_training_events for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners delete card training events" on public.card_training_events for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists card_training_events_user_created_idx on public.card_training_events(user_id, created_at desc);
create index if not exists card_training_events_card_idx on public.card_training_events(card_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card_training_images', 'card_training_images', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners upload training images" on storage.objects;
drop policy if exists "Owners read training images" on storage.objects;
drop policy if exists "Owners update training images" on storage.objects;
drop policy if exists "Owners delete training images" on storage.objects;
create policy "Owners upload training images" on storage.objects for insert to authenticated with check (bucket_id = 'card_training_images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners read training images" on storage.objects for select to authenticated using (bucket_id = 'card_training_images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners update training images" on storage.objects for update to authenticated using (bucket_id = 'card_training_images' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'card_training_images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners delete training images" on storage.objects for delete to authenticated using (bucket_id = 'card_training_images' and (storage.foldername(name))[1] = (select auth.uid())::text);
