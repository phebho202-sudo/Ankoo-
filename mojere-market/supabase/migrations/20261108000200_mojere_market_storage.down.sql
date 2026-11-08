-- Undo 20261108000200_mojere_market_storage.sql
-- Removes Mojere Market's storage rules and its three buckets.
-- SAFETY: stops without changes if any photos are still stored in them,
-- so no uploaded file is ever deleted by this script.
begin;

do $check$
declare n int;
begin
  select count(*) into n from storage.objects
  where bucket_id in ('listing-images', 'profile-images', 'business-images');
  if n > 0 then
    raise exception 'Undo stopped, nothing was changed: % photo(s) are still stored in the Mojere Market buckets.', n;
  end if;
end
$check$;

drop policy if exists "mm upload own images" on storage.objects;
drop policy if exists "mm update own images" on storage.objects;
drop policy if exists "mm delete own images" on storage.objects;
delete from storage.buckets where id in ('listing-images', 'profile-images', 'business-images');

commit;
