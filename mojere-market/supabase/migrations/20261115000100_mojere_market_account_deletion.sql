-- =====================================================================
-- Mojere Market — "Delete my account" (required by Apple and Google)
-- =====================================================================
-- Lets a signed-in person permanently delete their own account.
-- * Their profile, listings, photos records, messages, offers, reviews,
--   saved items, notifications and business are removed (existing
--   "on delete cascade" rules).
-- * Payment records are KEPT for accounting/legal reasons, but the link to
--   the person is removed (user_id becomes empty).
-- * Staff (admins/moderators) cannot delete themselves this way, so the
--   app can never lose its last admin by accident.
-- Changes only Mojere Market tables. Undo: the matching .down.sql.
-- =====================================================================
begin;

do $preflight$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'mm_delete_my_account') then
    raise exception 'Mojere Market account-deletion migration stopped, nothing was changed: it has already been applied.';
  end if;
end
$preflight$;

-- Keep payment records when a person deletes their account; just unlink them.
alter table public.payment_records alter column user_id drop not null;
alter table public.payment_records drop constraint payment_records_user_id_fkey;
alter table public.payment_records add constraint payment_records_user_id_fkey
  foreign key (user_id) references public.user_profiles (id) on delete set null;

-- Reports resolved by a former staff member stay, without the name.
alter table public.reports drop constraint reports_resolved_by_fkey;
alter table public.reports add constraint reports_resolved_by_fkey
  foreign key (resolved_by) references public.user_profiles (id) on delete set null;

create function public.mm_delete_my_account(p_confirm text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Please log in first.'; end if;
  if p_confirm is distinct from 'DELETE' then raise exception 'Please type DELETE to confirm.'; end if;
  if exists (select 1 from public.user_roles where user_id = me) then
    raise exception 'Staff accounts cannot be deleted from the app. Ask another admin to remove your staff role first.';
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, reason)
  values (null, 'account_deleted_by_owner', 'user', me::text, 'Deleted by the account owner');
  delete from auth.users where id = me;
end;
$$;
revoke all on function public.mm_delete_my_account(text) from public, anon;
grant execute on function public.mm_delete_my_account(text) to authenticated;

commit;
