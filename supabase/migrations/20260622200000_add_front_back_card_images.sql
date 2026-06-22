alter table public.cards
  add column if not exists front_image_url text,
  add column if not exists back_image_url text,
  add column if not exists original_front_image_url text,
  add column if not exists original_back_image_url text;

alter table public.card_training_events
  add column if not exists original_front_image_path text,
  add column if not exists original_back_image_path text,
  add column if not exists original_front_image_url text,
  add column if not exists original_back_image_url text;

update public.cards as card
set
  original_front_image_url = coalesce(
    card.original_front_image_url,
    card.original_image_url,
    (select image.image_url from public.card_images image where image.card_id = card.id and image.image_type = 'front' order by image.created_at asc limit 1)
  ),
  front_image_url = coalesce(
    card.front_image_url,
    card.display_image_url,
    card.original_image_url,
    (select image.image_url from public.card_images image where image.card_id = card.id and image.image_type = 'front' order by image.created_at asc limit 1)
  ),
  display_image_url = coalesce(
    card.display_image_url,
    card.original_image_url,
    (select image.image_url from public.card_images image where image.card_id = card.id and image.image_type = 'front' order by image.created_at asc limit 1)
  ),
  back_image_url = coalesce(
    card.back_image_url,
    (select image.image_url from public.card_images image where image.card_id = card.id and image.image_type = 'back' order by image.created_at asc limit 1)
  ),
  original_back_image_url = coalesce(
    card.original_back_image_url,
    (select image.image_url from public.card_images image where image.card_id = card.id and image.image_type = 'back' order by image.created_at asc limit 1)
  );

update public.card_training_events
set
  original_front_image_path = coalesce(original_front_image_path, original_image_path),
  original_front_image_url = coalesce(original_front_image_url, original_image_url)
where original_front_image_path is null or original_front_image_url is null;

create unique index if not exists card_images_one_front_back_per_card_idx
  on public.card_images (card_id, image_type)
  where image_type in ('front', 'back');

create index if not exists card_images_card_id_idx on public.card_images (card_id);
