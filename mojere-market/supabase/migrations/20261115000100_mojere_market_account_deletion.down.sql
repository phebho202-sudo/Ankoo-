-- Undo 20261115000100_mojere_market_account_deletion.sql
-- Note: if any payment records already lost their link (user_id is empty) because
-- someone deleted their account, the "not null" rule is not put back.
begin;
drop function if exists public.mm_delete_my_account(text);
alter table public.reports drop constraint reports_resolved_by_fkey;
alter table public.reports add constraint reports_resolved_by_fkey
  foreign key (resolved_by) references public.user_profiles (id);
alter table public.payment_records drop constraint payment_records_user_id_fkey;
alter table public.payment_records add constraint payment_records_user_id_fkey
  foreign key (user_id) references public.user_profiles (id) on delete restrict;
do $$ begin
  if not exists (select 1 from public.payment_records where user_id is null) then
    alter table public.payment_records alter column user_id set not null;
  end if;
end $$;
commit;
