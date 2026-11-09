-- =====================================================================
-- Mojere Market — admin dashboard functions (Phase 8)
-- =====================================================================
-- Staff-only functions for the admin dashboard. Every function checks the
-- caller's role on the server; ordinary users get "Not authorised".
-- Sensitive actions are written to the audit log. No data is changed.
-- Undo: the matching .down.sql.
-- =====================================================================
begin;

do $preflight$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname in
               ('mm_admin_stats', 'mm_admin_list_users', 'mm_admin_report_context', 'mm_admin_set_promotion_status')) then
    raise exception 'Mojere Market admin migration stopped, nothing was changed: it has already been applied.';
  end if;
end
$preflight$;

-- Headline numbers for the dashboard.
create function public.mm_admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.mm_is_staff() then raise exception 'Not authorised.'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.user_profiles),
    'new_users_7d', (select count(*) from public.user_profiles where created_at > now() - interval '7 days'),
    'suspended_users', (select count(*) from public.user_profiles where account_status = 'suspended'),
    'active_listings', (select count(*) from public.listings where status = 'active' and moderation_status = 'approved'),
    'new_listings_7d', (select count(*) from public.listings where created_at > now() - interval '7 days'),
    'pending_review', (select count(*) from public.listings where moderation_status = 'pending' and status <> 'draft'),
    'sold_listings', (select count(*) from public.listings where status = 'sold'),
    'confirmed_sales', (select count(*) from public.offers where buyer_confirmed_at is not null and seller_confirmed_at is not null),
    'open_reports', (select count(*) from public.reports where status in ('open', 'reviewing')),
    'conversations', (select count(*) from public.conversations),
    'businesses', (select count(*) from public.business_profiles),
    'active_promotions', (select count(*) from public.promotions where status = 'active' and (ends_at is null or ends_at > now())),
    'pending_promotions', (select count(*) from public.promotions where status = 'pending_payment'),
    'revenue_kobo', (select coalesce(sum(amount_kobo), 0) from public.payment_records where status = 'success'),
    'revenue_30d_kobo', (select coalesce(sum(amount_kobo), 0) from public.payment_records
                          where status = 'success' and verified_at > now() - interval '30 days')
  );
end;
$$;

-- Users with their email (only staff can see emails), newest first.
create function public.mm_admin_list_users(p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, display_name text, email text, account_status text, created_at timestamptz,
  email_verified boolean, active_listings bigint, open_reports bigint, role text
)
language plpgsql stable security definer set search_path = '' as $$
declare q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.mm_is_staff() then raise exception 'Not authorised.'; end if;
  return query
    select p.id, p.display_name, u.email::text, p.account_status, p.created_at,
      u.email_confirmed_at is not null,
      (select count(*) from public.listings l where l.seller_id = p.id and l.status = 'active'),
      (select count(*) from public.reports r where r.reported_user_id = p.id and r.status in ('open', 'reviewing')),
      (select r.role from public.user_roles r where r.user_id = p.id)
    from public.user_profiles p
    left join auth.users u on u.id = p.id
    where q is null or p.display_name ilike '%' || q || '%' or u.email ilike '%' || q || '%'
    order by p.created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- What a report is about, so staff can judge it. Reading a reported
-- message is logged in the audit trail.
create function public.mm_admin_report_context(p_report_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.reports;
  m_body text;
  m_created timestamptz;
  m_sender uuid;
  m_name text;
begin
  if not public.mm_is_staff() then raise exception 'Not authorised.'; end if;
  select * into r from public.reports where id = p_report_id;
  if not found then raise exception 'Report not found.'; end if;
  if r.message_id is not null then
    select m.body, m.created_at, m.sender_id, sp.display_name
      into m_body, m_created, m_sender, m_name
      from public.messages m left join public.user_profiles sp on sp.id = m.sender_id
      where m.id = r.message_id;
    perform public.mm_log_admin_action('report_view_message', 'report', r.id::text, null);
  end if;
  return jsonb_build_object(
    'reporter', (select display_name from public.user_profiles where id = r.reporter_id),
    'reported_user', (select jsonb_build_object('id', p.id, 'name', p.display_name, 'status', p.account_status)
                      from public.user_profiles p where p.id = r.reported_user_id),
    'listing', (select jsonb_build_object('id', l.id, 'title', l.title, 'status', l.status,
                       'moderation_status', l.moderation_status, 'seller_id', l.seller_id)
                from public.listings l where l.id = r.listing_id),
    'message', case when m_body is null then null else
      jsonb_build_object('body', m_body, 'created_at', m_created, 'sender_id', m_sender, 'sender_name', m_name) end,
    'other_reports_on_target', (
      select count(*) from public.reports o
      where o.id <> r.id
        and ((r.listing_id is not null and o.listing_id = r.listing_id)
          or (r.reported_user_id is not null and o.reported_user_id = r.reported_user_id)))
  );
end;
$$;

-- Cancel or mark a promotion refunded (refunds themselves are made in Paystack).
create function public.mm_admin_set_promotion_status(p_promotion_id uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.mm_is_admin() then raise exception 'Not authorised.'; end if;
  if p_status not in ('cancelled', 'refunded', 'expired') then raise exception 'Unknown status.'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required.'; end if;
  update public.promotions set status = p_status, ends_at = least(coalesce(ends_at, now()), now())
    where id = p_promotion_id;
  if not found then raise exception 'Promotion not found.'; end if;
  perform public.mm_log_admin_action('promotion_' || p_status, 'promotion', p_promotion_id::text, p_reason);
end;
$$;

revoke execute on function public.mm_admin_stats(), public.mm_admin_list_users(text, int, int),
  public.mm_admin_report_context(uuid), public.mm_admin_set_promotion_status(uuid, text, text) from public, anon;
grant execute on function public.mm_admin_stats(), public.mm_admin_list_users(text, int, int),
  public.mm_admin_report_context(uuid), public.mm_admin_set_promotion_status(uuid, text, text) to authenticated, service_role;

commit;
