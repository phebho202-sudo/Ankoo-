-- TEST ONLY. Runs after 01–06. "Delete my account".
\set ON_ERROR_STOP 1
\set QUIET 1

set role authenticated;
-- Nobody logged in: refused.
select set_config('request.jwt.claim.sub', '', false);
select public.t_blocked($q$select public.mm_delete_my_account('DELETE')$q$, 'deleting needs a logged-in person');

-- Staff cannot delete themselves.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select public.t_blocked($q$select public.mm_delete_my_account('DELETE')$q$, 'staff cannot delete their own account in the app');

-- The shop owner (has a business, listings and verified payments).
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select public.t_blocked($q$select public.mm_delete_my_account('yes')$q$, 'deleting needs the word DELETE');
select public.mm_delete_my_account('DELETE');

reset role;
select public.t_check((select count(*) from auth.users where id = '00000000-0000-0000-0000-0000000000b1') = 0,
  'the login is removed');
select public.t_check((select count(*) from public.user_profiles where id = '00000000-0000-0000-0000-0000000000b1') = 0,
  'the profile is removed');
select public.t_check((select count(*) from public.listings where seller_id = '00000000-0000-0000-0000-0000000000b1') = 0,
  'their listings are removed');
select public.t_check((select count(*) from public.business_profiles where slug = 'akure-gadgets') = 0,
  'their business is removed');
select public.t_check((select count(*) from public.payment_records where user_id is null and status = 'success') = 2,
  'payment records are kept for accounting, without the person');
select public.t_check((select count(*) from public.admin_actions where action = 'account_deleted_by_owner') = 1,
  'the deletion is recorded in the audit log');

-- Other people are untouched.
select public.t_check((select count(*) from public.user_profiles where id in
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000ad')) = 2, 'other accounts are untouched');

-- Alice (seller with conversations, offers and reviews) can delete too.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.mm_delete_my_account('DELETE');
reset role;
select public.t_check((select count(*) from public.user_profiles where id = '00000000-0000-0000-0000-00000000000a') = 0,
  'a seller with chats, offers and reviews can delete their account');
select public.t_check((select count(*) from public.messages m where not exists
  (select 1 from public.conversations c where c.id = m.conversation_id)) = 0, 'no orphaned messages are left');
