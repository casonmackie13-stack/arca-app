-- The safe collection deletion migration installs authenticated-only policies
-- with stricter ownership checks. Remove the older permissive equivalents so
-- PostgreSQL does not evaluate duplicate policies or allow a weaker update path.
drop policy if exists "Users can update their own cards" on public.cards;
drop policy if exists "Users can delete their own collections" on public.collections;
