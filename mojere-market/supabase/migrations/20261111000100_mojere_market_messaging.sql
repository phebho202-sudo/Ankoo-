-- =====================================================================
-- Mojere Market — messaging inbox (Phase 6)
-- =====================================================================
-- Adds one function that builds the signed-in user's conversation list:
-- the item, the other person, the last message and whether it is unread.
-- It ONLY adds a function: no tables or data are changed. It runs with the
-- caller's own permissions, so people only ever see their own chats.
-- Undo: the matching .down.sql.
-- =====================================================================
begin;

do $preflight$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'mm_my_conversations') then
    raise exception 'Mojere Market messaging migration stopped, nothing was changed: it has already been applied.';
  end if;
end
$preflight$;

create function public.mm_my_conversations()
returns table (
  id uuid,
  listing_id uuid,
  listing_title text,
  listing_price_kobo bigint,
  listing_status text,
  listing_cover_path text,
  i_am_seller boolean,
  other_id uuid,
  other_name text,
  last_body text,
  last_from_me boolean,
  last_message_at timestamptz,
  unread boolean,
  blocked_by_me boolean
)
language sql stable security invoker set search_path = '' as $$
  select
    c.id,
    c.listing_id,
    l.title,
    l.price_kobo,
    l.status,
    (select i.storage_path from public.listing_images i where i.listing_id = l.id order by i.position limit 1),
    c.seller_id = auth.uid(),
    o.id,
    o.display_name,
    m.body,
    m.sender_id = auth.uid(),
    coalesce(c.last_message_at, c.created_at),
    coalesce(
      m.sender_id <> auth.uid()
      and m.created_at > coalesce(
        case when c.buyer_id = auth.uid() then c.buyer_last_read_at else c.seller_last_read_at end,
        '-infinity'::timestamptz),
      false),
    exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = o.id)
  from public.conversations c
  left join public.listings l on l.id = c.listing_id
  left join public.user_profiles o
    on o.id = case when c.buyer_id = auth.uid() then c.seller_id else c.buyer_id end
  left join lateral (
    select x.body, x.sender_id, x.created_at from public.messages x
    where x.conversation_id = c.id order by x.created_at desc limit 1
  ) m on true
  where auth.uid() in (c.buyer_id, c.seller_id)
  order by coalesce(c.last_message_at, c.created_at) desc
  limit 200;
$$;

revoke execute on function public.mm_my_conversations() from public, anon;
grant execute on function public.mm_my_conversations() to authenticated, service_role;

commit;
