-- =====================================================================
-- Mojere Market — businesses, promotions and payment processing (Phase 7)
-- =====================================================================
-- Adds server functions for business plans, promotion payments and an
-- active-listing limit for business plans. No tables or data are changed.
--
-- PAYMENT SAFETY
--   * Amounts are always taken from the database (plan/package prices),
--     never from the phone.
--   * Only trusted server code (the Paystack webhook, running with the
--     service role) can mark a payment as successful.
--   * Each payment reference can only be processed once.
--   * No card details are ever stored.
-- Undo: the matching .down.sql.
-- =====================================================================
begin;

do $preflight$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname in
               ('mm_request_business_plan', 'mm_create_payment', 'mm_process_payment',
                'mm_admin_activate_promotion', 'mm_expire_promotions', 'mm_enforce_business_limit')) then
    raise exception 'Mojere Market business migration stopped, nothing was changed: it has already been applied.';
  end if;
end
$preflight$;

-- Business plan request ------------------------------------------------
-- The free plan starts immediately. Paid plans wait for payment.
create function public.mm_request_business_plan(p_plan_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  biz public.business_profiles;
  plan public.business_plans;
  new_id uuid;
begin
  select * into biz from public.business_profiles where owner_id = auth.uid();
  if not found then raise exception 'Create your business profile first.'; end if;
  if biz.status <> 'active' then raise exception 'This business is suspended.'; end if;
  select * into plan from public.business_plans where code = p_plan_code and is_active;
  if not found then raise exception 'That plan is not available.'; end if;

  if plan.price_kobo = 0 then
    update public.business_subscriptions set status = 'cancelled'
      where business_id = biz.id and status in ('active', 'pending_payment');
    insert into public.business_subscriptions (business_id, plan_id, status, starts_at)
    values (biz.id, plan.id, 'active', now()) returning id into new_id;
  else
    -- Replace any older unpaid request so only one is waiting.
    update public.business_subscriptions set status = 'cancelled'
      where business_id = biz.id and status = 'pending_payment';
    insert into public.business_subscriptions (business_id, plan_id, status)
    values (biz.id, plan.id, 'pending_payment') returning id into new_id;
  end if;
  return new_id;
end;
$$;

-- Payment creation (service role only: called by the payment server) ----
-- Works out the price from the database and records a new payment.
create function public.mm_create_payment(p_user_id uuid, p_purpose text, p_target_id uuid)
returns table (payment_id uuid, reference text, amount_kobo bigint, email text)
language plpgsql security definer set search_path = '' as $$
declare
  amount bigint;
  ref text := 'MM-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  pay_id uuid;
begin
  if p_purpose = 'promotion' then
    select pr.price_kobo into amount from public.promotions pr
      where pr.id = p_target_id and pr.purchaser_id = p_user_id and pr.status = 'pending_payment';
  elsif p_purpose = 'business_subscription' then
    select bp.price_kobo into amount
      from public.business_subscriptions s
      join public.business_plans bp on bp.id = s.plan_id
      join public.business_profiles b on b.id = s.business_id
      where s.id = p_target_id and b.owner_id = p_user_id and s.status = 'pending_payment';
  else
    raise exception 'Unknown payment purpose.';
  end if;
  if amount is null then raise exception 'Nothing is waiting for payment.'; end if;
  if amount <= 0 then raise exception 'This item is free.'; end if;

  insert into public.payment_records (user_id, purpose, reference, amount_kobo, status)
  values (p_user_id, p_purpose, ref, amount, 'initialized') returning id into pay_id;

  if p_purpose = 'promotion' then
    update public.promotions set payment_record_id = pay_id where id = p_target_id;
  else
    update public.business_subscriptions set payment_record_id = pay_id where id = p_target_id;
  end if;

  return query select pay_id, ref, amount, (select u.email::text from auth.users u where u.id = p_user_id);
end;
$$;

-- Payment processing (service role only: called after Paystack confirms) --
-- Returns 'activated', 'already_processed', 'amount_mismatch' or 'not_found'.
create function public.mm_process_payment(p_reference text, p_paid_kobo bigint, p_currency text, p_provider_response jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  rec public.payment_records;
  promo record;
begin
  -- Lock the row so two webhook deliveries cannot process it at the same time.
  select * into rec from public.payment_records where reference = p_reference for update;
  if not found then return 'not_found'; end if;
  if rec.status = 'success' then return 'already_processed'; end if;

  if p_paid_kobo is distinct from rec.amount_kobo or upper(coalesce(p_currency, '')) <> 'NGN' then
    update public.payment_records set status = 'failed', provider_response = p_provider_response
      where id = rec.id;
    return 'amount_mismatch';
  end if;

  update public.payment_records
    set status = 'success', verified_at = now(), provider_response = p_provider_response
    where id = rec.id;

  for promo in
    select pr.id, pk.duration_days from public.promotions pr
    join public.promotion_packages pk on pk.id = pr.package_id
    where pr.payment_record_id = rec.id and pr.status = 'pending_payment'
  loop
    update public.promotions
      set status = 'active', starts_at = now(), ends_at = now() + make_interval(days => coalesce(promo.duration_days, 1))
      where id = promo.id;
    perform public.mm_notify(rec.user_id, 'promotion', 'Your promotion is live',
      'Payment received. Your item is now promoted.', jsonb_build_object('promotion_id', promo.id));
  end loop;

  update public.business_subscriptions s
    set status = 'cancelled'
    where s.status = 'active'
      and s.business_id in (select business_id from public.business_subscriptions where payment_record_id = rec.id);
  update public.business_subscriptions
    set status = 'active', starts_at = now(), ends_at = now() + interval '1 month'
    where payment_record_id = rec.id and status = 'pending_payment';

  return 'activated';
end;
$$;

-- Staff can activate a promotion manually (e.g. paid in cash). Audited.
create function public.mm_admin_activate_promotion(p_promotion_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare promo record;
begin
  if not public.mm_is_admin() then raise exception 'Not authorised.'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required.'; end if;
  select pr.id, pr.purchaser_id, pk.duration_days into promo
    from public.promotions pr join public.promotion_packages pk on pk.id = pr.package_id
    where pr.id = p_promotion_id and pr.status = 'pending_payment' for update of pr;
  if not found then raise exception 'No pending promotion found.'; end if;
  update public.promotions
    set status = 'active', starts_at = now(), ends_at = now() + make_interval(days => coalesce(promo.duration_days, 1))
    where id = promo.id;
  perform public.mm_log_admin_action('promotion_activate_manual', 'promotion', promo.id::text, p_reason);
  perform public.mm_notify(promo.purchaser_id, 'promotion', 'Your promotion is live', p_reason,
    jsonb_build_object('promotion_id', promo.id));
end;
$$;

-- Housekeeping: mark finished promotions and subscriptions as expired.
create function public.mm_expire_promotions() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.promotions set status = 'expired' where status = 'active' and ends_at < now();
  get diagnostics n = row_count;
  update public.business_subscriptions set status = 'expired' where status = 'active' and ends_at < now();
  return n;
end;
$$;

-- Business plan limit on active listings --------------------------------
create function public.mm_enforce_business_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  max_active int;
  current_count int;
begin
  if new.business_id is null or new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' and old.business_id is not distinct from new.business_id then
    return new;
  end if;
  select bp.max_active_listings into max_active
    from public.business_subscriptions s join public.business_plans bp on bp.id = s.plan_id
    where s.business_id = new.business_id and s.status = 'active'
      and (s.ends_at is null or s.ends_at > now())
    order by s.created_at desc limit 1;
  if not found then
    select max_active_listings into max_active from public.business_plans where code = 'free';
  end if;
  if max_active is null then return new; end if;  -- unlimited
  select count(*) into current_count from public.listings
    where business_id = new.business_id and status = 'active' and id <> new.id;
  if current_count >= max_active then
    raise exception 'Your business plan allows % active listings. Pause one or upgrade your plan.', max_active;
  end if;
  return new;
end;
$$;
create trigger listings_business_limit before insert or update of status, business_id on public.listings
  for each row execute function public.mm_enforce_business_limit();

-- Permissions -----------------------------------------------------------
revoke execute on function public.mm_request_business_plan(text) from public, anon;
revoke execute on function public.mm_create_payment(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.mm_process_payment(text, bigint, text, jsonb) from public, anon, authenticated;
revoke execute on function public.mm_admin_activate_promotion(uuid, text) from public, anon;
revoke execute on function public.mm_expire_promotions() from public, anon, authenticated;
revoke execute on function public.mm_enforce_business_limit() from public, anon, authenticated;
grant execute on function public.mm_request_business_plan(text) to authenticated;
grant execute on function public.mm_admin_activate_promotion(uuid, text) to authenticated;
grant execute on function public.mm_create_payment(uuid, text, uuid), public.mm_process_payment(text, bigint, text, jsonb),
  public.mm_expire_promotions(), public.mm_request_business_plan(text), public.mm_admin_activate_promotion(uuid, text)
  to service_role;

commit;
