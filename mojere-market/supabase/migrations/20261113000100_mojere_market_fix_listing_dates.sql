-- =====================================================================
-- Mojere Market — fix: always record publish and sold dates
-- =====================================================================
-- Listings changed by staff accounts (e.g. the founder, who is an admin)
-- were saved without a "published" date, so they showed no "posted" time
-- and sorted last under "Newest first". This updates the listing guard so
-- the dates are always recorded, and fills in missing dates on existing
-- listings using the date each listing was created.
-- Undo: the matching .down.sql (restores the previous guard; filled-in
-- dates are kept, as they are correct).
-- =====================================================================
begin;

create or replace function public.mm_protect_listing() returns trigger
language plpgsql set search_path = '' as $$
declare
  needs_review boolean := coalesce(
    (select (s.value)::text::boolean from public.app_settings s where s.key = 'listings_require_approval'),
    false);
begin
  -- Always record when a listing was published or sold, whoever changes it.
  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  if new.status = 'sold' and new.sold_at is null then
    new.sold_at := now();
  end if;

  -- Trusted server functions run as the database owner, not as the app's
  -- 'anon'/'authenticated' roles; they are allowed through, as are staff.
  if public.mm_is_staff() or auth.uid() is null
     or current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.moderation_status := case when needs_review then 'pending' else 'approved' end;
    new.moderation_note := null;
    new.view_count := 0;
    new.sold_at := null;
    if new.status not in ('draft', 'active') then
      raise exception 'A new listing must start as a draft or be published.';
    end if;
  else
    if new.seller_id is distinct from old.seller_id
       or new.moderation_status is distinct from old.moderation_status
       or new.moderation_note is distinct from old.moderation_note
       or new.view_count is distinct from old.view_count then
      raise exception 'You cannot change these listing fields.';
    end if;
    if old.status = 'removed' then
      raise exception 'This listing was removed by Mojere Market and cannot be edited.';
    end if;
    if new.status = 'removed' then
      raise exception 'Only Mojere Market staff can remove a listing. Delete it instead.';
    end if;
    -- A rejected listing that is edited goes back for review.
    if old.moderation_status = 'rejected' then
      new.moderation_status := 'pending';
    end if;
  end if;

  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  if new.status = 'sold' and new.sold_at is null then
    new.sold_at := now();
  end if;
  return new;
end;
$$;

update public.listings set published_at = created_at
where status in ('active', 'reserved', 'sold') and published_at is null;

update public.listings set sold_at = updated_at
where status = 'sold' and sold_at is null;

commit;
