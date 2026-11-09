-- Undo 20261112000100_mojere_market_business.sql
begin;
drop trigger if exists listings_business_limit on public.listings;
drop function if exists public.mm_enforce_business_limit();
drop function if exists public.mm_expire_promotions();
drop function if exists public.mm_admin_activate_promotion(uuid, text);
drop function if exists public.mm_process_payment(text, bigint, text, jsonb);
drop function if exists public.mm_create_payment(uuid, text, uuid);
drop function if exists public.mm_request_business_plan(text);
commit;
