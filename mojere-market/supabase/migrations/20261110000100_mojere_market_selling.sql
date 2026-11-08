-- =====================================================================
-- Mojere Market — selling support (Phase 5)
-- =====================================================================
-- Lets signed-in users look up THEIR OWN photo files, which Supabase
-- needs in order to delete them (e.g. when a listing or photo is
-- removed). Without it, deleted listings would leave orphan photos
-- behind in storage. It adds one storage rule and changes nothing else.
-- Undo: the matching .down.sql.
-- =====================================================================
begin;

do $preflight$
begin
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and policyname = 'mm read own images') then
    raise exception 'Mojere Market selling migration stopped, nothing was changed: it has already been applied.';
  end if;
end
$preflight$;

create policy "mm read own images" on storage.objects for select to authenticated
  using (bucket_id in ('listing-images', 'profile-images', 'business-images')
    and (storage.foldername(name))[1] = auth.uid()::text);

commit;
