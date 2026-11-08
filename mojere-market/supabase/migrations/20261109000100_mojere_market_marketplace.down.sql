-- Undo 20261109000100_mojere_market_marketplace.sql
-- Removes the browsing functions and restores the original listing guard.
begin;
revoke select on public.favorites from anon;
drop function if exists public.mm_search_listings(text, text, uuid, bigint, bigint, text[], text, boolean, uuid, int, int);
drop function if exists public.mm_get_listing(uuid);
drop function if exists public.mm_record_listing_view(uuid);
create or replace function public.mm_protect_listing() returns trigger
language plpgsql set search_path = '' as $$
declare
  needs_review boolean := coalesce(
    (select (s.value)::text::boolean from public.app_settings s where s.key = 'listings_require_approval'),
    false);
begin
  if public.mm_is_staff() or auth.uid() is null then
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
commit;
