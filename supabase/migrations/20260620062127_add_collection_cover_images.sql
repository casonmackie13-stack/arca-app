alter table public.collections
add column if not exists cover_image_url text;

insert into storage.buckets (id, name, public)
values ('collection_covers', 'collection_covers', true)
on conflict (id) do update set public = true;

drop policy if exists "Users can upload their collection covers" on storage.objects;
create policy "Users can upload their collection covers"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'collection_covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their collection covers" on storage.objects;
create policy "Users can delete their collection covers"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'collection_covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);
