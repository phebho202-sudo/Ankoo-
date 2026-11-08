-- Undo 20261110000100_mojere_market_selling.sql
begin;
drop policy if exists "mm read own images" on storage.objects;
commit;
