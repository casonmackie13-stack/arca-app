-- Ensure season years like 2025-26 save correctly (text column + format check).
alter table public.cards
  drop constraint if exists cards_year_check;

alter table public.cards
  drop constraint if exists cards_year_format_check;

alter table public.cards
  alter column year type text using (
    case
      when year is null then null
      else year::text
    end
  );

alter table public.cards
  add constraint cards_year_format_check check (
    year is null
    or year ~ '^\d{4}$'
    or year ~ '^\d{4}-\d{2}$'
  );

comment on column public.cards.year is
  'Release or season year — plain (2020) or hyphenated season (2025-26).';
