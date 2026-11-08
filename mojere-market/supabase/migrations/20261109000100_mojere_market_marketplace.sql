-- =====================================================================
-- Mojere Market — marketplace browsing functions (Phase 4)
-- =====================================================================
-- Adds server functions for the home feed, search, filters and the
-- product page. It ONLY adds functions: no tables or data are changed.
--
-- The functions run with the caller's own permissions ("security
-- invoker"), so the existing Row Level Security rules still decide which
-- listings anyone can see: drafts, paused, removed and unapproved
-- listings never appear to the public.
--
-- Run AFTER the core and storage migrations. Undo: the matching .down.sql.
-- =====================================================================

begin;

do $preflight$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname in ('mm_search_listings', 'mm_get_listing', 'mm_record_listing_view')) then
    raise exception 'Mojere Market marketplace migration stopped, nothing was changed: its functions already exist.';
  end if;
  if to_regclass('public.listings') is null then
    raise exception 'Run 20261108000100_mojere_market_core.sql first.';
  end if;
end
$preflight$;

-- Search and browse ---------------------------------------------------
-- p_sort: 'newest' (default) | 'price_asc' | 'price_desc'
create function public.mm_search_listings(
  p_query text default null,
  p_category_slug text default null,
  p_lga_id uuid default null,
  p_min_kobo bigint default null,
  p_max_kobo bigint default null,
  p_conditions text[] default null,
  p_sort text default 'newest',
  p_featured_only boolean default false,
  p_seller_id uuid default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  title text,
  price_kobo bigint,
  is_negotiable boolean,
  condition text,
  status text,
  published_at timestamptz,
  category_slug text,
  category_name text,
  lga_name text,
  town_name text,
  neighbourhood text,
  cover_path text,
  seller_id uuid,
  seller_name text,
  is_featured boolean
)
language sql stable security invoker set search_path = '' as $$
  with params as (
    select
      nullif(btrim(left(coalesce(p_query, ''), 100)), '') as q,
      greatest(1, least(coalesce(p_limit, 20), 50)) as lim,
      greatest(0, coalesce(p_offset, 0)) as off
  ),
  base as (
    select l.*,
      exists (
        select 1 from public.promotions pr
        join public.promotion_packages pk on pk.id = pr.package_id
        where pr.listing_id = l.id and pr.status = 'active'
          and pk.kind in ('featured', 'homepage')
          and (pr.ends_at is null or pr.ends_at > now())
      ) as featured
    from public.listings l, params
    where l.moderation_status = 'approved'
      and (
        -- A seller's own page also shows sold items; general browsing does not.
        (p_seller_id is null and l.status in ('active', 'reserved'))
        or (p_seller_id is not null and l.seller_id = p_seller_id and l.status in ('active', 'reserved', 'sold'))
      )
      and (params.q is null
           or l.search @@ websearch_to_tsquery('english', params.q)
           or l.title ilike '%' || replace(replace(replace(params.q, '\', '\\'), '%', '\%'), '_', '\_') || '%')
      and (p_category_slug is null or exists (
             select 1 from public.categories c where c.id = l.category_id and c.slug = p_category_slug))
      and (p_lga_id is null or l.lga_id = p_lga_id)
      and (p_min_kobo is null or l.price_kobo >= p_min_kobo)
      and (p_max_kobo is null or l.price_kobo <= p_max_kobo)
      and (p_conditions is null or cardinality(p_conditions) = 0 or l.condition = any (p_conditions))
  )
  select
    b.id, b.title, b.price_kobo, b.is_negotiable, b.condition, b.status, b.published_at,
    c.slug, c.name, lga.name, town.name, b.neighbourhood,
    (select i.storage_path from public.listing_images i
      where i.listing_id = b.id order by i.position limit 1),
    b.seller_id, sp.display_name, b.featured
  from base b
  join public.categories c on c.id = b.category_id
  join public.locations lga on lga.id = b.lga_id
  left join public.locations town on town.id = b.town_id
  left join public.user_profiles sp on sp.id = b.seller_id
  where (not p_featured_only or b.featured)
  order by
    case when p_sort = 'price_asc' then b.price_kobo end asc nulls last,
    case when p_sort = 'price_desc' then b.price_kobo end desc nulls last,
    b.published_at desc nulls last,
    b.id
  limit (select lim from params) offset (select off from params);
$$;

-- One listing with everything the product page needs -------------------
-- Returns null if the listing does not exist or the caller may not see it.
create function public.mm_get_listing(p_listing_id uuid)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', l.id,
    'title', l.title,
    'description', l.description,
    'condition', l.condition,
    'price_kobo', l.price_kobo,
    'is_negotiable', l.is_negotiable,
    'status', l.status,
    'moderation_status', l.moderation_status,
    'published_at', l.published_at,
    'created_at', l.created_at,
    'neighbourhood', l.neighbourhood,
    'view_count', case when l.seller_id = auth.uid() then l.view_count end,
    'category', jsonb_build_object('slug', c.slug, 'name', c.name),
    'lga_name', lga.name,
    'town_name', town.name,
    'images', coalesce((
      select jsonb_agg(jsonb_build_object('path', i.storage_path, 'width', i.width, 'height', i.height)
                       order by i.position)
      from public.listing_images i where i.listing_id = l.id), '[]'::jsonb),
    'seller', jsonb_build_object(
      'id', sp.id,
      'display_name', sp.display_name,
      'avatar_path', sp.avatar_path,
      'member_since', sp.created_at,
      'area', concat_ws(', ', sp.neighbourhood, st.name, sl.name)),
    'is_own', l.seller_id = auth.uid(),
    'is_favourite', exists (
      select 1 from public.favorites f where f.listing_id = l.id and f.user_id = auth.uid())
  )
  from public.listings l
  join public.categories c on c.id = l.category_id
  join public.locations lga on lga.id = l.lga_id
  left join public.locations town on town.id = l.town_id
  left join public.user_profiles sp on sp.id = l.seller_id
  left join public.locations sl on sl.id = sp.lga_id
  left join public.locations st on st.id = sp.town_id
  where l.id = p_listing_id;
$$;

-- Let trusted server functions (like the view counter below) update
-- protected listing fields. App users are still blocked as before.
create or replace function public.mm_protect_listing() returns trigger
language plpgsql set search_path = '' as $$
declare
  needs_review boolean := coalesce(
    (select (s.value)::text::boolean from public.app_settings s where s.key = 'listings_require_approval'),
    false);
begin
  -- Trusted server functions run as the database owner, not as the app's
  -- 'anon'/'authenticated' roles; they are allowed through.
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

-- Count a view (for the seller's listing performance). Sellers viewing
-- their own listing are not counted. Runs with owner rights because
-- view_count is protected from direct edits.
create function public.mm_record_listing_view(p_listing_id uuid)
returns void
language sql volatile security definer set search_path = '' as $$
  update public.listings set view_count = view_count + 1
  where id = p_listing_id
    and status in ('active', 'reserved')
    and moderation_status = 'approved'
    and seller_id is distinct from auth.uid();
$$;

-- Logged-out visitors may run the "is this my favourite?" check on the
-- product page. Row Level Security still only ever returns a person's own
-- favourites, so visitors simply get "no".
grant select on public.favorites to anon;

revoke execute on function public.mm_search_listings(text, text, uuid, bigint, bigint, text[], text, boolean, uuid, int, int) from public;
revoke execute on function public.mm_get_listing(uuid) from public;
revoke execute on function public.mm_record_listing_view(uuid) from public;
grant execute on function public.mm_search_listings(text, text, uuid, bigint, bigint, text[], text, boolean, uuid, int, int) to anon, authenticated, service_role;
grant execute on function public.mm_get_listing(uuid) to anon, authenticated, service_role;
grant execute on function public.mm_record_listing_view(uuid) to anon, authenticated, service_role;

commit;
