-- Undo 20261111000100_mojere_market_messaging.sql
begin;
drop function if exists public.mm_my_conversations();
commit;
