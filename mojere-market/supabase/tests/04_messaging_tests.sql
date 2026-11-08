-- TEST ONLY. Runs after 01–03. Inbox, unread markers, privacy and blocking.
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'funmi@example.test', now(), '{"display_name":"Funmi"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'gbenga@example.test', now(), '{"display_name":"Gbenga"}');

set role authenticated;
-- Gbenga sells a fan.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
insert into public.listings (seller_id, category_id, title, condition, price_kobo, lga_id, status)
select auth.uid(), c.id, 'Standing fan', 'good', 2500000, l.id, 'active'
from public.categories c, public.locations l where c.slug = 'home-appliances' and l.slug = 'akure-south';
select set_config('t.fan', (select id::text from public.listings where title = 'Standing fan'), false);
select public.t_check((select count(*) from public.mm_my_conversations()) = 0, 'a new user has an empty inbox');

-- Funmi messages him.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select set_config('t.conv', public.mm_start_conversation(current_setting('t.fan')::uuid)::text, false);
insert into public.messages (conversation_id, sender_id, body) values (current_setting('t.conv')::uuid, auth.uid(), 'Is the fan still available?');
select public.t_check((select not unread and last_from_me and other_name = 'Gbenga' and listing_title = 'Standing fan'
  from public.mm_my_conversations()), 'sender sees the chat as read, with the item and the seller');

-- Gbenga sees it as unread.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
select public.t_check((select unread and i_am_seller and other_name = 'Funmi' and last_body = 'Is the fan still available?'
  from public.mm_my_conversations()), 'seller sees a new unread message from the buyer');
select public.mm_mark_conversation_read(current_setting('t.conv')::uuid);
select public.t_check((select not unread from public.mm_my_conversations()), 'opening the chat marks it read');
insert into public.messages (conversation_id, sender_id, body) values (current_setting('t.conv')::uuid, auth.uid(), 'Yes it is.');

-- Funmi now has an unread reply; outsiders see nothing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select public.t_check((select unread and last_body = 'Yes it is.' from public.mm_my_conversations()), 'buyer sees the unread reply');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.t_check((select count(*) from public.mm_my_conversations() where id = current_setting('t.conv')::uuid) = 0,
  'outsiders never see other people''s chats');

-- Offer, counteroffer, acceptance, handover and review, all within this chat.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select set_config('t.o1', public.mm_make_offer(current_setting('t.fan')::uuid, 2000000, 'Can you do 20k?')::text, false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
select public.t_check((select count(*) from public.notifications where type = 'offer_new'
  and data ->> 'offer_id' = current_setting('t.o1')) = 1, 'seller is notified of the offer');
select set_config('t.o2', public.mm_respond_to_offer(current_setting('t.o1')::uuid, 'counter', 2200000)::text, false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select public.t_check((select count(*) from public.notifications where type = 'offer_countered') = 1, 'buyer is notified of the counteroffer');
select public.t_check((select count(*) from public.offers where listing_id = current_setting('t.fan')::uuid) = 2,
  'both offers are visible to the buyer');
select public.mm_respond_to_offer(current_setting('t.o2')::uuid, 'accept');
select public.mm_confirm_handover(current_setting('t.o2')::uuid);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
select public.t_check((select count(*) from public.notifications where type = 'offer_accepted') = 1, 'seller is notified of acceptance');
select public.mm_confirm_handover(current_setting('t.o2')::uuid);
select public.mm_submit_review(current_setting('t.o2')::uuid, 5, 'Polite buyer');
select public.t_check((select listing_status = 'sold' from public.mm_my_conversations()), 'the inbox shows the item as sold');

-- Notification preferences are respected.
insert into public.notification_preferences (user_id, messages) values (auth.uid(), false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
insert into public.messages (conversation_id, sender_id, body) values (current_setting('t.conv')::uuid, auth.uid(), 'Thanks!');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
select public.t_check((select count(*) from public.notifications where type = 'message' and body = 'Thanks!') = 0,
  'turning off message notifications stops them');

-- Blocking.
insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000f1');
select public.t_check((select blocked_by_me from public.mm_my_conversations()), 'the inbox shows who I have blocked');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select public.t_blocked($q$insert into public.messages (conversation_id, sender_id, body)
  values (current_setting('t.conv')::uuid, auth.uid(), 'hello?')$q$, 'a blocked buyer cannot keep messaging');
select public.t_check((select not blocked_by_me from public.mm_my_conversations()), 'the blocked person is not told who blocked them');
reset role;
set role anon;
select public.t_blocked($q$select * from public.mm_my_conversations()$q$, 'logged-out visitors have no inbox');
reset role;

\echo 'ALL MESSAGING TESTS PASSED'
