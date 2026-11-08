-- =====================================================================
-- Mojere Market — photo storage (Phase 2, part 2)
-- =====================================================================
-- Run AFTER 20261108000100_mojere_market_core.sql.
--
-- Creates three photo buckets. Photos are public to VIEW (listings are
-- public), but each user can only upload, replace or delete files inside a
-- folder named after their own user id. 5 MB limit for listing photos,
-- 2 MB for profile and business logos; JPEG, PNG and WebP only.
--
-- SAFETY: one transaction; stops without changes if a bucket with the same
-- name already exists. Undo: 20261108000200_mojere_market_storage.down.sql
-- =====================================================================

begin;

do $preflight$
declare clashes text;
begin
  select string_agg(id, ', ') into clashes from storage.buckets
  where id in ('listing-images', 'profile-images', 'business-images');
  if clashes is not null then
    raise exception 'Mojere Market storage setup stopped, nothing was changed. These buckets already exist: %.', clashes;
  end if;
end
$preflight$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('profile-images', 'profile-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('business-images', 'business-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "mm upload own images" on storage.objects for insert to authenticated
  with check (bucket_id in ('listing-images', 'profile-images', 'business-images')
    and (storage.foldername(name))[1] = auth.uid()::text);

create policy "mm update own images" on storage.objects for update to authenticated
  using (bucket_id in ('listing-images', 'profile-images', 'business-images')
    and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('listing-images', 'profile-images', 'business-images')
    and (storage.foldername(name))[1] = auth.uid()::text);

create policy "mm delete own images" on storage.objects for delete to authenticated
  using (bucket_id in ('listing-images', 'profile-images', 'business-images')
    and (storage.foldername(name))[1] = auth.uid()::text);

commit;
