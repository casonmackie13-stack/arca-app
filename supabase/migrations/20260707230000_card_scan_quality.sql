-- Store deterministic + optional AI capture quality metadata with each card.
alter table public.cards
  add column if not exists scan_quality_json jsonb;

comment on column public.cards.scan_quality_json is
  'Capture quality metrics from ARCA scanner (blur, glare, edge confidence, optional AI QA).';
