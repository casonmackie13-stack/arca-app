-- Store AI-assisted price estimate metadata alongside each card.
-- Additive only: does not affect card autofill or any existing columns.
alter table public.cards
  add column if not exists price_estimate_json jsonb;

comment on column public.cards.price_estimate_json is
  'AI-assisted price estimate: range (low/mid/high), confidence, pricing basis, recent sales used, provider name, and timestamp. Additive post-autofill metadata.';
