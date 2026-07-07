-- Support sports card season years like 2020-21 in addition to plain four-digit years.

alter table public.cards
  drop constraint if exists cards_year_check;

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
