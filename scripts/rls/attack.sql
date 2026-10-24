\set QUIET on
\set VERBOSITY terse
-- victim signs up (trigger creates a plain profile), then an admin bans them
insert into auth.users (id,email,raw_user_meta_data) values ('11111111-1111-1111-1111-111111111111','victim@users.x.local','{"username":"victim"}');
update public.profiles set banned = true where username = 'victim';
select 'start      ', role, is_vip, banned from public.profiles;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false), set_config('request.jwt.claim.role','authenticated',false) \gset

-- A: plain UPDATE escalation (the pre-existing trigger should stop this)
update public.profiles set role='owner', is_vip=true, banned=false where id = auth.uid();
select 'A update   ', role, is_vip, banned from public.profiles;

-- B: delete own row
delete from public.profiles where id = auth.uid();
select 'B rows left', count(*) from public.profiles;

-- C: re-insert own row with elevated values
\set ON_ERROR_STOP off
insert into public.profiles (id, username, role, is_vip, banned) values (auth.uid(), 'victim', 'owner', true, false);
select 'C reinsert ', role, is_vip, banned from public.profiles;

-- D: feedback spoofing
insert into public.feedback (user_id, username, kind, message, status) values (auth.uid(), 'Admin123', 'bug', 'x', 'done');
reset role;
select 'D feedback ', username, status from public.feedback;
