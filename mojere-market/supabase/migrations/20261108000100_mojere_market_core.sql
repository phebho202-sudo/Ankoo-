-- =====================================================================
-- Mojere Market — core database migration (Phase 2)
-- =====================================================================
--
-- WHAT THIS DOES
--   Creates Mojere Market's tables, security rules (Row Level Security)
--   and server functions, and seeds the 18 Ondo State LGAs, the product
--   categories, business plans and promotion prices.
--
-- SAFETY
--   * It only ADDS things. It never drops, deletes or edits existing data.
--   * It runs as ONE transaction: if anything fails, nothing is changed.
--   * Before creating anything it checks for name clashes with what already
--     exists in your project and stops with a clear message if it finds one.
--   * To undo it, run 20261108000100_mojere_market_core.down.sql.
--   * Profiles live in `user_profiles` (not `profiles`) so that an older,
--     unrelated `profiles` table in the project is left completely untouched.
--
-- Run supabase/inspect/00_readonly_inspection.sql FIRST and share the result.
-- Photo storage is set up separately in 20261108000200_mojere_market_storage.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Pre-flight check: refuse to run if any name is already taken
-- ---------------------------------------------------------------------
do $preflight$
declare
  wanted_tables text[] := array[
    'app_settings','user_roles','locations','categories','user_profiles',
    'business_plans','business_profiles','business_subscriptions',
    'listings','listing_images','favorites','user_blocks',
    'conversations','messages','offers','reviews','reports',
    'meetup_locations','promotion_packages','promotions','payment_records',
    'admin_actions','notifications','notification_preferences','push_tokens',
    'declutter_sessions','declutter_session_items'];
  clashes text;
begin
  select string_agg(table_name, ', ') into clashes
  from information_schema.tables
  where table_schema = 'public' and table_name = any (wanted_tables);
  if clashes is not null then
    raise exception 'Mojere Market migration stopped, nothing was changed. These tables already exist: %. Share this message so the migration can be adapted safely.', clashes;
  end if;

end
$preflight$;

-- ---------------------------------------------------------------------
-- 1. Shared helpers
-- ---------------------------------------------------------------------
create function public.mm_set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Admin and moderator roles live in their own table. Nobody can write to it
-- from the app: roles are granted by the founder in the Supabase SQL editor.
create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  granted_at timestamptz not null default now(),
  note text
);

create function public.mm_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin');
$$;

create function public.mm_is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('admin', 'moderator'));
$$;

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Reference data: locations and categories
-- ---------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 2 and 80),
  kind text not null check (kind in ('lga', 'town')),
  parent_id uuid references public.locations (id) on delete restrict,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((kind = 'lga' and parent_id is null) or (kind = 'town' and parent_id is not null))
);
create index locations_parent_idx on public.locations (parent_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 2 and 80),
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Profiles
-- ---------------------------------------------------------------------
create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 60),
  avatar_path text,
  bio text check (char_length(bio) <= 300),
  lga_id uuid references public.locations (id),
  town_id uuid references public.locations (id),
  neighbourhood text check (char_length(neighbourhood) <= 80),
  terms_accepted_at timestamptz,
  account_status text not null default 'active' check (account_status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_profiles_updated_at before update on public.user_profiles
  for each row execute function public.mm_set_updated_at();

create function public.mm_is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.account_status = 'active');
$$;

-- Users may edit their own profile, but never their account status.
create function public.mm_protect_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.mm_is_admin() or auth.uid() is null then
    return new;  -- admins and trusted server code
  end if;
  if tg_op = 'INSERT' then
    new.account_status := 'active';
  elsif new.account_status is distinct from old.account_status
     or new.id is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'You cannot change these profile fields.';
  end if;
  return new;
end;
$$;
create trigger user_profiles_protect before insert or update on public.user_profiles
  for each row execute function public.mm_protect_profile();

-- Create a profile automatically when someone signs up.
create function public.mm_handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if char_length(name) < 2 then
    name := 'Mojere user';
  end if;
  insert into public.user_profiles (id, display_name, terms_accepted_at)
  values (
    new.id,
    left(name, 60),
    case when (new.raw_user_meta_data ->> 'terms_accepted') = 'true' then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger mojere_on_auth_user_created after insert on auth.users
  for each row execute function public.mm_handle_new_user();

-- Public verification indicators: only true when Supabase Auth actually
-- confirmed the email or phone. Never exposes the email/phone itself.
create function public.mm_verification_status(user_ids uuid[])
returns table (user_id uuid, email_verified boolean, phone_verified boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email_confirmed_at is not null, u.phone_confirmed_at is not null
  from auth.users u where u.id = any (user_ids);
$$;

-- ---------------------------------------------------------------------
-- 4. Businesses
-- ---------------------------------------------------------------------
create table public.business_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  price_kobo bigint not null check (price_kobo >= 0),
  billing_interval text not null default 'month' check (billing_interval in ('month')),
  max_active_listings int check (max_active_listings > 0),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
create trigger business_plans_updated_at before update on public.business_plans
  for each row execute function public.mm_set_updated_at();

create table public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.user_profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  description text check (char_length(description) <= 1000),
  category_id uuid references public.categories (id),
  logo_path text,
  contact_phone text check (char_length(contact_phone) <= 20),
  contact_email text check (char_length(contact_email) <= 120),
  whatsapp text check (char_length(whatsapp) <= 20),
  lga_id uuid references public.locations (id),
  town_id uuid references public.locations (id),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger business_profiles_updated_at before update on public.business_profiles
  for each row execute function public.mm_set_updated_at();

create function public.mm_protect_business() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.mm_is_admin() or auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'active';
  elsif new.status is distinct from old.status or new.owner_id is distinct from old.owner_id then
    raise exception 'You cannot change these business fields.';
  end if;
  return new;
end;
$$;
create trigger business_profiles_protect before insert or update on public.business_profiles
  for each row execute function public.mm_protect_business();

-- ---------------------------------------------------------------------
-- 5. Payments (written ONLY by trusted server code, never by the app)
-- ---------------------------------------------------------------------
create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete restrict,
  purpose text not null check (purpose in ('promotion', 'business_subscription', 'assisted_listing')),
  provider text not null default 'paystack' check (provider in ('paystack')),
  reference text not null unique,  -- unique: the same payment can never be processed twice
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'initialized' check (status in ('initialized', 'success', 'failed', 'abandoned')),
  provider_response jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_records_user_idx on public.payment_records (user_id, created_at desc);
create trigger payment_records_updated_at before update on public.payment_records
  for each row execute function public.mm_set_updated_at();

create table public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  plan_id uuid not null references public.business_plans (id),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'expired', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  payment_record_id uuid references public.payment_records (id),
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index business_subscriptions_business_idx on public.business_subscriptions (business_id, created_at desc);

-- ---------------------------------------------------------------------
-- 6. Listings and photos
-- ---------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.user_profiles (id) on delete cascade,
  business_id uuid references public.business_profiles (id) on delete set null,
  category_id uuid not null references public.categories (id),
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  condition text not null check (condition in ('brand_new', 'like_new', 'good', 'fair', 'for_parts')),
  -- Prices are whole kobo (₦1 = 100 kobo). Upper limit ₦100,000,000.
  price_kobo bigint not null check (price_kobo between 0 and 10000000000),
  is_negotiable boolean not null default false,
  lga_id uuid not null references public.locations (id),
  town_id uuid references public.locations (id),
  neighbourhood text check (char_length(neighbourhood) <= 80),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'reserved', 'sold', 'removed')),
  moderation_status text not null default 'approved'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  moderation_note text,
  view_count int not null default 0,
  published_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored
);
create index listings_feed_idx on public.listings (status, moderation_status, published_at desc);
create index listings_seller_idx on public.listings (seller_id, created_at desc);
create index listings_category_idx on public.listings (category_id, published_at desc);
create index listings_lga_idx on public.listings (lga_id, published_at desc);
create index listings_price_idx on public.listings (price_kobo);
create index listings_search_idx on public.listings using gin (search);
create trigger listings_updated_at before update on public.listings
  for each row execute function public.mm_set_updated_at();

-- Sellers manage their listings; moderation fields belong to staff only.
create function public.mm_protect_listing() returns trigger
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
create trigger listings_protect before insert or update on public.listings
  for each row execute function public.mm_protect_listing();

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null,
  position smallint not null check (position between 0 and 9),
  width int,
  height int,
  created_at timestamptz not null default now(),
  unique (listing_id, position)
);

create table public.favorites (
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index favorites_listing_idx on public.favorites (listing_id);

-- ---------------------------------------------------------------------
-- 7. Blocking, conversations and messages
-- ---------------------------------------------------------------------
create table public.user_blocks (
  blocker_id uuid not null references public.user_profiles (id) on delete cascade,
  blocked_id uuid not null references public.user_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create function public.mm_is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  buyer_id uuid not null references public.user_profiles (id) on delete cascade,
  seller_id uuid not null references public.user_profiles (id) on delete cascade,
  last_message_at timestamptz,
  buyer_last_read_at timestamptz,
  seller_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);
create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.user_profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

create function public.mm_is_participant(conv uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conv and auth.uid() in (c.buyer_id, c.seller_id));
$$;

-- ---------------------------------------------------------------------
-- 8. Offers, handover confirmation and reviews
-- ---------------------------------------------------------------------
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.user_profiles (id) on delete cascade,
  seller_id uuid not null references public.user_profiles (id) on delete cascade,
  made_by text not null check (made_by in ('buyer', 'seller')),
  parent_offer_id uuid references public.offers (id) on delete set null,
  amount_kobo bigint not null check (amount_kobo between 100 and 10000000000),
  message text check (char_length(message) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'countered', 'withdrawn', 'expired')),
  expires_at timestamptz not null default (now() + interval '3 days'),
  responded_at timestamptz,
  -- A sale only counts as a confirmed transaction when BOTH sides confirm the handover.
  buyer_confirmed_at timestamptz,
  seller_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);
create index offers_listing_idx on public.offers (listing_id, created_at desc);
create index offers_buyer_idx on public.offers (buyer_id, created_at desc);
create index offers_seller_idx on public.offers (seller_id, created_at desc);
create unique index offers_one_open_per_buyer on public.offers (listing_id, buyer_id) where status = 'pending';

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  reviewer_id uuid not null references public.user_profiles (id) on delete cascade,
  reviewee_id uuid not null references public.user_profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (offer_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);

-- ---------------------------------------------------------------------
-- 9. Promotions
-- ---------------------------------------------------------------------
create table public.promotion_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  kind text not null check (kind in ('featured', 'homepage', 'assisted_listing')),
  duration_days int check (duration_days between 1 and 90),
  price_kobo bigint not null check (price_kobo >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
create trigger promotion_packages_updated_at before update on public.promotion_packages
  for each row execute function public.mm_set_updated_at();

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  package_id uuid not null references public.promotion_packages (id),
  purchaser_id uuid not null references public.user_profiles (id) on delete cascade,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'expired', 'cancelled', 'refunded')),
  price_kobo bigint not null check (price_kobo >= 0),  -- price at the time of request
  starts_at timestamptz,
  ends_at timestamptz,
  payment_record_id uuid references public.payment_records (id),
  created_at timestamptz not null default now()
);
create index promotions_active_idx on public.promotions (status, ends_at);
create index promotions_listing_idx on public.promotions (listing_id);

-- ---------------------------------------------------------------------
-- 10. Safety: reports, admin audit log, meetup spots
-- ---------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.user_profiles (id) on delete cascade,
  target_type text not null check (target_type in ('listing', 'user', 'message')),
  listing_id uuid references public.listings (id) on delete set null,
  reported_user_id uuid references public.user_profiles (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  reason text not null check (reason in
    ('scam', 'prohibited_item', 'fake_or_misleading', 'offensive', 'harassment', 'spam', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution_note text,
  resolved_by uuid references public.user_profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (target_type = 'listing' and listing_id is not null) or
    (target_type = 'user' and reported_user_id is not null) or
    (target_type = 'message' and message_id is not null))
);
create index reports_status_idx on public.reports (status, created_at);

-- Append-only log of sensitive staff actions.
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_actions_created_idx on public.admin_actions (created_at desc);

create table public.meetup_locations (
  id uuid primary key default gen_random_uuid(),
  lga_id uuid not null references public.locations (id),
  name text not null check (char_length(name) between 3 and 120),
  description text check (char_length(description) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 11. Notifications
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  type text not null check (type in
    ('message', 'offer_new', 'offer_countered', 'offer_accepted', 'offer_rejected',
     'listing_status', 'favorite_sold', 'account', 'promotion')),
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.notification_preferences (
  user_id uuid primary key references public.user_profiles (id) on delete cascade,
  messages boolean not null default true,
  offers boolean not null default true,
  listing_updates boolean not null default true,
  account boolean not null default true,
  promotions boolean not null default true,
  push_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function public.mm_set_updated_at();

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now()
);

-- Internal: create a notification if the user's preferences allow it.
create function public.mm_notify(target uuid, kind text, ttl text, msg text, payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  prefs public.notification_preferences;
  allowed boolean := true;
begin
  select * into prefs from public.notification_preferences where user_id = target;
  if found then
    allowed := case
      when kind = 'message' then prefs.messages
      when kind like 'offer_%' then prefs.offers
      when kind in ('listing_status', 'favorite_sold') then prefs.listing_updates
      when kind = 'promotion' then prefs.promotions
      else prefs.account end;
  end if;
  if allowed then
    insert into public.notifications (user_id, type, title, body, data)
    values (target, kind, ttl, msg, coalesce(payload, '{}'::jsonb));
  end if;
end;
$$;

-- Notifications may only be marked read by their owner.
create function public.mm_protect_notification() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
    raise exception 'Only the read status of a notification can be changed.';
  end if;
  return new;
end;
$$;
create trigger notifications_protect before update on public.notifications
  for each row execute function public.mm_protect_notification();

-- ---------------------------------------------------------------------
-- 12. Declutter My Home
-- Draft items are ordinary listings with status 'draft', grouped by session.
-- ---------------------------------------------------------------------
create table public.declutter_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  title text not null default 'My declutter session' check (char_length(title) between 1 and 80),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index declutter_sessions_user_idx on public.declutter_sessions (user_id, created_at desc);
create trigger declutter_sessions_updated_at before update on public.declutter_sessions
  for each row execute function public.mm_set_updated_at();

create table public.declutter_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.declutter_sessions (id) on delete cascade,
  listing_id uuid not null unique references public.listings (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 13. Row Level Security: every table is locked down, then opened
--     only as far as each feature needs.
-- =====================================================================
alter table public.app_settings enable row level security;
alter table public.user_roles enable row level security;
alter table public.locations enable row level security;
alter table public.categories enable row level security;
alter table public.user_profiles enable row level security;
alter table public.business_plans enable row level security;
alter table public.business_profiles enable row level security;
alter table public.business_subscriptions enable row level security;
alter table public.payment_records enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.favorites enable row level security;
alter table public.user_blocks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.offers enable row level security;
alter table public.reviews enable row level security;
alter table public.promotion_packages enable row level security;
alter table public.promotions enable row level security;
alter table public.reports enable row level security;
alter table public.admin_actions enable row level security;
alter table public.meetup_locations enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_tokens enable row level security;
alter table public.declutter_sessions enable row level security;
alter table public.declutter_session_items enable row level security;

-- Table-level access. RLS policies below decide which ROWS each user sees.
grant select on public.app_settings, public.locations, public.categories, public.user_profiles,
  public.business_plans, public.business_profiles, public.listings, public.listing_images,
  public.reviews, public.promotion_packages, public.promotions, public.meetup_locations
  to anon, authenticated;
grant select on public.user_roles, public.business_subscriptions, public.payment_records,
  public.favorites, public.user_blocks, public.conversations, public.messages, public.offers,
  public.reports, public.admin_actions, public.notifications, public.notification_preferences,
  public.push_tokens, public.declutter_sessions, public.declutter_session_items
  to authenticated;
grant insert, update, delete on public.user_profiles, public.business_profiles, public.listings,
  public.listing_images, public.favorites, public.user_blocks, public.notification_preferences,
  public.push_tokens, public.declutter_sessions, public.declutter_session_items
  to authenticated;
grant insert on public.messages, public.reports to authenticated;
grant update, delete on public.notifications to authenticated;
grant update on public.reports to authenticated;
-- Staff-managed reference data (policies restrict this to admins).
grant insert, update, delete on public.app_settings, public.locations, public.categories,
  public.business_plans, public.promotion_packages, public.meetup_locations to authenticated;
grant all on public.app_settings, public.user_roles, public.locations, public.categories,
  public.user_profiles, public.business_plans, public.business_profiles, public.business_subscriptions,
  public.payment_records, public.listings, public.listing_images, public.favorites,
  public.user_blocks, public.conversations, public.messages, public.offers, public.reviews,
  public.promotion_packages, public.promotions, public.reports, public.admin_actions,
  public.meetup_locations, public.notifications, public.notification_preferences,
  public.push_tokens, public.declutter_sessions, public.declutter_session_items
  to service_role;

-- app_settings, locations, categories, plans, packages, meetup spots:
-- everyone reads active rows; only admins change them.
create policy "read settings" on public.app_settings for select using (true);
create policy "admins manage settings" on public.app_settings for all
  using (public.mm_is_admin()) with check (public.mm_is_admin());

create policy "read active locations" on public.locations for select
  using (is_active or public.mm_is_admin());
create policy "admins manage locations" on public.locations for all
  using (public.mm_is_admin()) with check (public.mm_is_admin());

create policy "read active categories" on public.categories for select
  using (is_active or public.mm_is_admin());
create policy "admins manage categories" on public.categories for all
  using (public.mm_is_admin()) with check (public.mm_is_admin());

create policy "read active plans" on public.business_plans for select
  using (is_active or public.mm_is_admin());
create policy "admins manage plans" on public.business_plans for all
  using (public.mm_is_admin()) with check (public.mm_is_admin());

create policy "read active packages" on public.promotion_packages for select
  using (is_active or public.mm_is_admin());
create policy "admins manage packages" on public.promotion_packages for all
  using (public.mm_is_admin()) with check (public.mm_is_admin());

create policy "read active meetup spots" on public.meetup_locations for select
  using (is_active or public.mm_is_admin());
create policy "admins manage meetup spots" on public.meetup_locations for all
  using (public.mm_is_admin()) with check (public.mm_is_admin());

-- user_roles: you may see your own role; nobody can write from the app.
create policy "see own role" on public.user_roles for select
  using (user_id = auth.uid() or public.mm_is_admin());

-- user_profiles: public information is readable; you edit only your own.
create policy "read profiles" on public.user_profiles for select using (true);
create policy "create own profile" on public.user_profiles for insert
  with check (id = auth.uid());
create policy "update own profile" on public.user_profiles for update
  using (id = auth.uid() or public.mm_is_admin())
  with check (id = auth.uid() or public.mm_is_admin());

-- business profiles
create policy "read businesses" on public.business_profiles for select
  using (status = 'active' or owner_id = auth.uid() or public.mm_is_staff());
create policy "create own business" on public.business_profiles for insert
  with check (owner_id = auth.uid() and public.mm_is_active_user());
create policy "update own business" on public.business_profiles for update
  using (owner_id = auth.uid() or public.mm_is_admin())
  with check (owner_id = auth.uid() or public.mm_is_admin());
create policy "delete own business" on public.business_profiles for delete
  using (owner_id = auth.uid());

-- subscriptions and payments: read your own; only the server writes.
create policy "read own subscriptions" on public.business_subscriptions for select
  using (public.mm_is_admin() or exists (
    select 1 from public.business_profiles b where b.id = business_id and b.owner_id = auth.uid()));
create policy "read own payments" on public.payment_records for select
  using (user_id = auth.uid() or public.mm_is_admin());

-- listings
create policy "read visible listings" on public.listings for select using (
  (status in ('active', 'reserved', 'sold') and moderation_status = 'approved')
  or seller_id = auth.uid()
  or public.mm_is_staff());
create policy "create own listings" on public.listings for insert
  with check (seller_id = auth.uid() and public.mm_is_active_user()
    and (business_id is null or exists (
      select 1 from public.business_profiles b where b.id = business_id and b.owner_id = auth.uid())));
create policy "update own listings" on public.listings for update
  using (seller_id = auth.uid() or public.mm_is_staff())
  with check ((seller_id = auth.uid() and public.mm_is_active_user()) or public.mm_is_staff());
create policy "delete own listings" on public.listings for delete
  using (seller_id = auth.uid() or public.mm_is_admin());

-- listing photos follow their listing
create policy "read photos of visible listings" on public.listing_images for select
  using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "add photos to own listings" on public.listing_images for insert
  with check (
    storage_path like auth.uid()::text || '/%'
    and exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "change photos of own listings" on public.listing_images for update
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (storage_path like auth.uid()::text || '/%');
create policy "remove photos of own listings" on public.listing_images for delete
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

-- favourites and blocks: strictly your own
create policy "own favourites" on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own blocks" on public.user_blocks for all
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- conversations and messages: participants only. Conversations are
-- started through mm_start_conversation(), not inserted directly.
create policy "participants read conversations" on public.conversations for select
  using (auth.uid() in (buyer_id, seller_id));
create policy "participants read messages" on public.messages for select
  using (public.mm_is_participant(conversation_id));
create policy "participants send messages" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and public.mm_is_active_user()
    and public.mm_is_participant(conversation_id)
    and not exists (
      select 1 from public.conversations c
      where c.id = conversation_id and public.mm_is_blocked_between(c.buyer_id, c.seller_id)));

-- offers: only the buyer and seller see them; changes go through functions.
create policy "parties read offers" on public.offers for select
  using (auth.uid() in (buyer_id, seller_id) or public.mm_is_staff());

-- reviews: public to read; written through mm_submit_review().
create policy "read reviews" on public.reviews for select using (true);
create policy "admins remove reviews" on public.reviews for delete using (public.mm_is_admin());
grant delete on public.reviews to authenticated;

-- promotions: active ones are public (to show "Featured"); purchasers see theirs.
create policy "read promotions" on public.promotions for select
  using (status = 'active' or purchaser_id = auth.uid() or public.mm_is_admin());

-- reports: anyone signed in may report; reporters see their own; staff see all.
create policy "file reports" on public.reports for insert
  with check (reporter_id = auth.uid() and status = 'open' and resolved_by is null);
create policy "read own reports" on public.reports for select
  using (reporter_id = auth.uid() or public.mm_is_staff());
create policy "staff update reports" on public.reports for update
  using (public.mm_is_staff()) with check (public.mm_is_staff());

-- audit log: staff can read; nobody can edit or delete from the app.
create policy "staff read audit log" on public.admin_actions for select using (public.mm_is_staff());

-- notifications
create policy "own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "mark own notifications" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own notifications" on public.notifications for delete using (user_id = auth.uid());
create policy "own notification preferences" on public.notification_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own push tokens" on public.push_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- declutter
create policy "own declutter sessions" on public.declutter_sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own declutter items" on public.declutter_session_items for all
  using (exists (select 1 from public.declutter_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (
    exists (select 1 from public.declutter_sessions s where s.id = session_id and s.user_id = auth.uid())
    and exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

-- =====================================================================
-- 14. Server-side functions (validated on the server, called by the app)
-- =====================================================================

-- Limit photos per listing.
create function public.mm_limit_listing_images() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.listing_images where listing_id = new.listing_id) >= 10 then
    raise exception 'A listing can have at most 10 photos.';
  end if;
  return new;
end;
$$;
create trigger listing_images_limit before insert on public.listing_images
  for each row execute function public.mm_limit_listing_images();

-- New message: update the conversation and notify the other person.
create function public.mm_after_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  conv public.conversations;
  recipient uuid;
  sender_name text;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  update public.conversations set last_message_at = new.created_at,
    buyer_last_read_at = case when new.sender_id = conv.buyer_id then new.created_at else buyer_last_read_at end,
    seller_last_read_at = case when new.sender_id = conv.seller_id then new.created_at else seller_last_read_at end
  where id = conv.id;
  recipient := case when new.sender_id = conv.buyer_id then conv.seller_id else conv.buyer_id end;
  select display_name into sender_name from public.user_profiles where id = new.sender_id;
  perform public.mm_notify(recipient, 'message', 'New message from ' || coalesce(sender_name, 'a user'),
    left(new.body, 120), jsonb_build_object('conversation_id', conv.id));
  return new;
end;
$$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.mm_after_message();

-- Start (or reopen) a conversation with a listing's seller.
create function public.mm_start_conversation(p_listing_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  l public.listings;
  conv_id uuid;
begin
  if me is null then raise exception 'Please sign in first.'; end if;
  if not public.mm_is_active_user() then raise exception 'Your account cannot send messages.'; end if;
  select * into l from public.listings where id = p_listing_id;
  if not found or l.status not in ('active', 'reserved') or l.moderation_status <> 'approved' then
    raise exception 'This listing is not available.';
  end if;
  if l.seller_id = me then raise exception 'You cannot message yourself.'; end if;
  if public.mm_is_blocked_between(me, l.seller_id) then raise exception 'You cannot message this user.'; end if;

  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (l.id, me, l.seller_id)
  on conflict (listing_id, buyer_id) do nothing
  returning id into conv_id;
  if conv_id is null then
    select id into conv_id from public.conversations where listing_id = l.id and buyer_id = me;
  end if;
  return conv_id;
end;
$$;

create function public.mm_mark_conversation_read(p_conversation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set
    buyer_last_read_at = case when buyer_id = auth.uid() then now() else buyer_last_read_at end,
    seller_last_read_at = case when seller_id = auth.uid() then now() else seller_last_read_at end
  where id = p_conversation_id and auth.uid() in (buyer_id, seller_id);
end;
$$;

-- Offers ---------------------------------------------------------------
create function public.mm_expire_offers() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.offers set status = 'expired' where status = 'pending' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

create function public.mm_make_offer(p_listing_id uuid, p_amount_kobo bigint, p_message text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  l public.listings;
  new_id uuid;
begin
  if me is null then raise exception 'Please sign in first.'; end if;
  if not public.mm_is_active_user() then raise exception 'Your account cannot make offers.'; end if;
  perform public.mm_expire_offers();
  select * into l from public.listings where id = p_listing_id for update;
  if not found or l.status <> 'active' or l.moderation_status <> 'approved' then
    raise exception 'This listing is not accepting offers.';
  end if;
  if l.seller_id = me then raise exception 'You cannot make an offer on your own listing.'; end if;
  if public.mm_is_blocked_between(me, l.seller_id) then raise exception 'You cannot make offers to this user.'; end if;
  if p_amount_kobo is null or p_amount_kobo < 100 then raise exception 'Enter a valid offer amount.'; end if;
  if exists (select 1 from public.offers where listing_id = l.id and buyer_id = me and status = 'pending') then
    raise exception 'You already have an open offer on this item.';
  end if;

  insert into public.offers (listing_id, buyer_id, seller_id, made_by, amount_kobo, message)
  values (l.id, me, l.seller_id, 'buyer', p_amount_kobo, nullif(btrim(p_message), ''))
  returning id into new_id;

  perform public.mm_notify(l.seller_id, 'offer_new', 'New offer on ' || l.title,
    null, jsonb_build_object('offer_id', new_id, 'listing_id', l.id));
  return new_id;
end;
$$;

-- p_action: 'accept' | 'reject' | 'counter' | 'withdraw'
create function public.mm_respond_to_offer(p_offer_id uuid, p_action text, p_counter_kobo bigint default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  o public.offers;
  l public.listings;
  receiver uuid;
  creator uuid;
  new_id uuid;
begin
  if me is null then raise exception 'Please sign in first.'; end if;
  perform public.mm_expire_offers();
  select * into o from public.offers where id = p_offer_id for update;
  if not found or me not in (o.buyer_id, o.seller_id) then raise exception 'Offer not found.'; end if;
  if o.status <> 'pending' then raise exception 'This offer is no longer open (status: %).', o.status; end if;

  creator := case when o.made_by = 'buyer' then o.buyer_id else o.seller_id end;
  receiver := case when o.made_by = 'buyer' then o.seller_id else o.buyer_id end;

  if p_action = 'withdraw' then
    if me <> creator then raise exception 'Only the person who made this offer can withdraw it.'; end if;
    update public.offers set status = 'withdrawn', responded_at = now() where id = o.id;
    return o.id;
  end if;

  if me <> receiver then raise exception 'You cannot respond to your own offer.'; end if;
  select * into l from public.listings where id = o.listing_id for update;

  if p_action = 'accept' then
    if l.status <> 'active' then raise exception 'This item is no longer available.'; end if;
    update public.offers set status = 'accepted', responded_at = now() where id = o.id;
    update public.listings set status = 'reserved' where id = l.id;
    perform public.mm_notify(creator, 'offer_accepted', 'Offer accepted for ' || l.title,
      'Arrange a safe meetup and confirm the handover in the app.',
      jsonb_build_object('offer_id', o.id, 'listing_id', l.id));
    return o.id;
  elsif p_action = 'reject' then
    update public.offers set status = 'rejected', responded_at = now() where id = o.id;
    perform public.mm_notify(creator, 'offer_rejected', 'Offer declined for ' || l.title, null,
      jsonb_build_object('offer_id', o.id, 'listing_id', l.id));
    return o.id;
  elsif p_action = 'counter' then
    if p_counter_kobo is null or p_counter_kobo < 100 then raise exception 'Enter a valid counteroffer amount.'; end if;
    if l.status <> 'active' then raise exception 'This item is no longer available.'; end if;
    update public.offers set status = 'countered', responded_at = now() where id = o.id;
    insert into public.offers (listing_id, buyer_id, seller_id, made_by, parent_offer_id, amount_kobo)
    values (o.listing_id, o.buyer_id, o.seller_id,
      case when me = o.seller_id then 'seller' else 'buyer' end, o.id, p_counter_kobo)
    returning id into new_id;
    perform public.mm_notify(creator, 'offer_countered', 'Counteroffer on ' || l.title, null,
      jsonb_build_object('offer_id', new_id, 'listing_id', l.id));
    return new_id;
  else
    raise exception 'Unknown action.';
  end if;
end;
$$;

-- Both buyer and seller confirm the handover. Only then is it a confirmed
-- transaction (the listing becomes sold and reviews are allowed).
create function public.mm_confirm_handover(p_offer_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  o public.offers;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if not found or me not in (o.buyer_id, o.seller_id) then raise exception 'Offer not found.'; end if;
  if o.status <> 'accepted' then raise exception 'Only an accepted offer can be confirmed.'; end if;
  if me = o.buyer_id then
    update public.offers set buyer_confirmed_at = coalesce(buyer_confirmed_at, now()) where id = o.id;
  else
    update public.offers set seller_confirmed_at = coalesce(seller_confirmed_at, now()) where id = o.id;
  end if;
  select * into o from public.offers where id = p_offer_id;
  if o.buyer_confirmed_at is not null and o.seller_confirmed_at is not null then
    update public.listings set status = 'sold', sold_at = coalesce(sold_at, now()) where id = o.listing_id;
  end if;
end;
$$;

create function public.mm_submit_review(p_offer_id uuid, p_rating int, p_comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  o public.offers;
  new_id uuid;
begin
  select * into o from public.offers where id = p_offer_id;
  if not found or me not in (o.buyer_id, o.seller_id) then
    raise exception 'You can only review people you completed a transaction with.';
  end if;
  if o.status <> 'accepted' or o.buyer_confirmed_at is null or o.seller_confirmed_at is null then
    raise exception 'Reviews open after both buyer and seller confirm the handover.';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Rating must be 1 to 5.'; end if;
  insert into public.reviews (offer_id, reviewer_id, reviewee_id, rating, comment)
  values (o.id, me, case when me = o.buyer_id then o.seller_id else o.buyer_id end,
    p_rating, nullif(btrim(p_comment), ''))
  returning id into new_id;
  return new_id;
exception when unique_violation then
  raise exception 'You have already reviewed this transaction.';
end;
$$;

-- Notify people who saved a listing when it sells; notify the seller on moderation.
create function public.mm_after_listing_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare fav record;
begin
  if new.status = 'sold' and old.status is distinct from 'sold' then
    for fav in select user_id from public.favorites where listing_id = new.id and user_id <> new.seller_id loop
      perform public.mm_notify(fav.user_id, 'favorite_sold', 'A saved item has sold',
        new.title, jsonb_build_object('listing_id', new.id));
    end loop;
  end if;
  if new.moderation_status is distinct from old.moderation_status
     or (new.status = 'removed' and old.status is distinct from 'removed') then
    perform public.mm_notify(new.seller_id, 'listing_status', 'Update on your listing: ' || new.title,
      coalesce(new.moderation_note, 'Status: ' || new.moderation_status),
      jsonb_build_object('listing_id', new.id));
  end if;
  return new;
end;
$$;
create trigger listings_after_update after update on public.listings
  for each row execute function public.mm_after_listing_change();

-- Promotions: the app may only REQUEST one. It becomes active only after
-- server-side payment verification (Phase 7) or an admin action.
create function public.mm_request_promotion(p_listing_id uuid, p_package_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  pkg public.promotion_packages;
  new_id uuid;
begin
  if not exists (select 1 from public.listings
                 where id = p_listing_id and seller_id = me and status = 'active' and moderation_status = 'approved') then
    raise exception 'You can only promote your own active listings.';
  end if;
  select * into pkg from public.promotion_packages where code = p_package_code and is_active and kind <> 'assisted_listing';
  if not found then raise exception 'That promotion package is not available.'; end if;
  insert into public.promotions (listing_id, package_id, purchaser_id, price_kobo)
  values (p_listing_id, pkg.id, me, pkg.price_kobo) returning id into new_id;
  return new_id;
end;
$$;

-- Admin actions (each one is written to the audit log) -------------------
create function public.mm_log_admin_action(p_action text, p_target_type text, p_target_id text,
  p_reason text, p_details jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_actions (admin_id, action, target_type, target_id, reason, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_reason, coalesce(p_details, '{}'::jsonb));
$$;

create function public.mm_admin_moderate_listing(p_listing_id uuid, p_decision text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.mm_is_staff() then raise exception 'Not authorised.'; end if;
  if p_decision = 'approve' then
    update public.listings set moderation_status = 'approved', moderation_note = p_reason where id = p_listing_id;
  elsif p_decision = 'reject' then
    update public.listings set moderation_status = 'rejected', moderation_note = p_reason where id = p_listing_id;
  elsif p_decision = 'remove' then
    update public.listings set status = 'removed', moderation_note = p_reason where id = p_listing_id;
  elsif p_decision = 'restore' then
    update public.listings set status = 'paused', moderation_note = p_reason where id = p_listing_id and status = 'removed';
  else
    raise exception 'Unknown decision.';
  end if;
  if not found then raise exception 'Listing not found.'; end if;
  perform public.mm_log_admin_action('listing_' || p_decision, 'listing', p_listing_id::text, p_reason);
end;
$$;

create function public.mm_admin_set_account_status(p_user_id uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.mm_is_admin() then raise exception 'Not authorised.'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot change your own account status.'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required.'; end if;
  update public.user_profiles set account_status = p_status where id = p_user_id;
  if not found then raise exception 'User not found.'; end if;
  perform public.mm_log_admin_action('account_' || p_status, 'user', p_user_id::text, p_reason);
  perform public.mm_notify(p_user_id, 'account', 'Your account status changed', p_reason, '{}'::jsonb);
end;
$$;

create function public.mm_admin_resolve_report(p_report_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.mm_is_staff() then raise exception 'Not authorised.'; end if;
  if p_status not in ('reviewing', 'resolved', 'dismissed') then raise exception 'Unknown status.'; end if;
  update public.reports set status = p_status, resolution_note = p_note,
    resolved_by = case when p_status in ('resolved', 'dismissed') then auth.uid() end,
    resolved_at = case when p_status in ('resolved', 'dismissed') then now() end
  where id = p_report_id;
  if not found then raise exception 'Report not found.'; end if;
  perform public.mm_log_admin_action('report_' || p_status, 'report', p_report_id::text, p_note);
end;
$$;

-- Audit every change admins make to reference data and prices.
create function public.mm_audit_reference_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    perform public.mm_log_admin_action(lower(tg_op), tg_table_name,
      coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'), (to_jsonb(new) ->> 'key')),
      null, jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
  end if;
  return coalesce(new, old);
end;
$$;
create trigger audit_app_settings after insert or update or delete on public.app_settings
  for each row execute function public.mm_audit_reference_change();
create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function public.mm_audit_reference_change();
create trigger audit_locations after insert or update or delete on public.locations
  for each row execute function public.mm_audit_reference_change();
create trigger audit_business_plans after insert or update or delete on public.business_plans
  for each row execute function public.mm_audit_reference_change();
create trigger audit_promotion_packages after insert or update or delete on public.promotion_packages
  for each row execute function public.mm_audit_reference_change();
create trigger audit_meetup_locations after insert or update or delete on public.meetup_locations
  for each row execute function public.mm_audit_reference_change();

-- Function permissions: nothing is callable by logged-out visitors except
-- the public verification indicator; internal helpers are not callable at all.
-- Only Mojere Market's own functions (names starting mm_) are touched here.
do $perms$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'mm\_%' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end
$perms$;
grant execute on function
  public.mm_is_admin(), public.mm_is_staff(), public.mm_is_active_user(),
  public.mm_is_blocked_between(uuid, uuid), public.mm_is_participant(uuid),
  public.mm_verification_status(uuid[]), public.mm_start_conversation(uuid),
  public.mm_mark_conversation_read(uuid), public.mm_make_offer(uuid, bigint, text),
  public.mm_respond_to_offer(uuid, text, bigint), public.mm_confirm_handover(uuid),
  public.mm_submit_review(uuid, int, text), public.mm_request_promotion(uuid, text),
  public.mm_admin_moderate_listing(uuid, text, text),
  public.mm_admin_set_account_status(uuid, text, text),
  public.mm_admin_resolve_report(uuid, text, text),
  public.mm_expire_offers()
  to authenticated;
grant execute on function public.mm_verification_status(uuid[]), public.mm_is_admin(),
  public.mm_is_staff(), public.mm_is_active_user() to anon;

-- Realtime for chat (only rows a user may read are delivered, thanks to RLS).
do $realtime$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.conversations, public.notifications;
  end if;
end
$realtime$;

-- =====================================================================
-- 15. Seed data (reference data only — no users, listings or reviews)
-- =====================================================================
insert into public.app_settings (key, value, description) values
  ('listings_require_approval', 'false',
   'If true, new listings stay hidden until a moderator approves them.');

insert into public.locations (slug, name, kind, sort_order) values
  ('akoko-north-east', 'Akoko North-East', 'lga', 1),
  ('akoko-north-west', 'Akoko North-West', 'lga', 2),
  ('akoko-south-east', 'Akoko South-East', 'lga', 3),
  ('akoko-south-west', 'Akoko South-West', 'lga', 4),
  ('akure-north', 'Akure North', 'lga', 5),
  ('akure-south', 'Akure South', 'lga', 6),
  ('ese-odo', 'Ese Odo', 'lga', 7),
  ('idanre', 'Idanre', 'lga', 8),
  ('ifedore', 'Ifedore', 'lga', 9),
  ('ilaje', 'Ilaje', 'lga', 10),
  ('ile-oluji-okeigbo', 'Ile Oluji/Okeigbo', 'lga', 11),
  ('irele', 'Irele', 'lga', 12),
  ('odigbo', 'Odigbo', 'lga', 13),
  ('okitipupa', 'Okitipupa', 'lga', 14),
  ('ondo-east', 'Ondo East', 'lga', 15),
  ('ondo-west', 'Ondo West', 'lga', 16),
  ('ose', 'Ose', 'lga', 17),
  ('owo', 'Owo', 'lga', 18);

-- Main town of each LGA. Admins can add more towns and neighbourhoods later.
insert into public.locations (slug, name, kind, parent_id, sort_order)
select t.slug, t.name, 'town', l.id, t.sort_order
from (values
  ('ikare', 'Ikare', 'akoko-north-east', 1),
  ('okeagbe', 'Okeagbe', 'akoko-north-west', 1),
  ('isua', 'Isua', 'akoko-south-east', 1),
  ('oka', 'Oka', 'akoko-south-west', 1),
  ('iju-itaogbolu', 'Iju/Itaogbolu', 'akure-north', 1),
  ('akure', 'Akure', 'akure-south', 1),
  ('igbekebo', 'Igbekebo', 'ese-odo', 1),
  ('owena', 'Owena', 'idanre', 1),
  ('igbara-oke', 'Igbara-Oke', 'ifedore', 1),
  ('igbokoda', 'Igbokoda', 'ilaje', 1),
  ('ile-oluji', 'Ile Oluji', 'ile-oluji-okeigbo', 1),
  ('irele-town', 'Irele', 'irele', 1),
  ('ore', 'Ore', 'odigbo', 1),
  ('okitipupa-town', 'Okitipupa', 'okitipupa', 1),
  ('bolorunduro', 'Bolorunduro', 'ondo-east', 1),
  ('ondo-town', 'Ondo', 'ondo-west', 1),
  ('ifon', 'Ifon', 'ose', 1),
  ('owo-town', 'Owo', 'owo', 1)
) as t (slug, name, lga_slug, sort_order)
join public.locations l on l.slug = t.lga_slug;

insert into public.categories (slug, name, icon, sort_order) values
  ('phones-tablets', 'Phones and tablets', 'phone-portrait-outline', 1),
  ('electronics', 'Electronics', 'tv-outline', 2),
  ('furniture', 'Furniture', 'bed-outline', 3),
  ('home-appliances', 'Home appliances', 'snow-outline', 4),
  ('fashion-clothing', 'Fashion and clothing', 'shirt-outline', 5),
  ('shoes-bags', 'Shoes and bags', 'bag-handle-outline', 6),
  ('baby-children', 'Baby and children’s items', 'happy-outline', 7),
  ('books-education', 'Books and educational materials', 'book-outline', 8),
  ('sports-fitness', 'Sports and fitness', 'football-outline', 9),
  ('tools-equipment', 'Tools and equipment', 'hammer-outline', 10),
  ('kitchen-household', 'Kitchen and household', 'restaurant-outline', 11),
  ('vehicles-accessories', 'Vehicles and accessories', 'car-outline', 12),
  ('other', 'Other items', 'apps-outline', 13);

-- Test prices (hypotheses, editable by admins). Amounts are in kobo.
insert into public.business_plans (code, name, price_kobo, max_active_listings, features, sort_order) values
  ('free', 'Business Free', 0, 10, '["Business profile", "Up to 10 active listings"]', 1),
  ('basic', 'Business Basic', 500000, 50, '["Business profile", "Up to 50 active listings", "Basic listing performance"]', 2),
  ('premium', 'Business Premium', 1000000, null, '["Business profile", "Unlimited active listings", "Listing performance", "Priority support"]', 3);

insert into public.promotion_packages (code, name, kind, duration_days, price_kobo, sort_order) values
  ('featured_3d', 'Featured listing — 3 days', 'featured', 3, 50000, 1),
  ('featured_7d', 'Featured listing — 7 days', 'featured', 7, 100000, 2),
  ('homepage', 'Homepage promotion', 'homepage', 3, 200000, 3),
  ('assisted_listing', 'Assisted listing service', 'assisted_listing', null, 50000, 4);

commit;
