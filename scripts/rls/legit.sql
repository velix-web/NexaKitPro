\set QUIET on
insert into auth.users (id,email,raw_user_meta_data) values ('22222222-2222-2222-2222-222222222222','ok@users.x.local','{"username":"okuser"}');
update public.profiles set is_vip = true where username='okuser';   -- admin (SQL) grants VIP
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false), set_config('request.jwt.claim.role','authenticated',false) \gset
-- exactly what auth.js updateProfile() does: upsert on id
insert into public.profiles (id, username, display_name, avatar_url) values (auth.uid(),'okuser','Nama Baru','data:image/png;base64,AAAA')
  on conflict (id) do update set username=excluded.username, display_name=excluded.display_name, avatar_url=excluded.avatar_url;
select 'upsert ok ', display_name, role, is_vip, banned from public.profiles where id = auth.uid();
-- normal feedback + usage still work
insert into public.feedback (user_id, kind, message) values (auth.uid(),'bug','halo');
insert into public.tool_usage (tool_slug, user_id) values ('tiktok', auth.uid());
-- bounds
\set ON_ERROR_STOP off
insert into public.tool_usage (tool_slug, user_id) values ('x; drop table', auth.uid());
insert into public.feedback (user_id, kind, message) values (auth.uid(),'bug',repeat('a',5000));
reset role;
select 'counts', (select count(*) from public.feedback) as feedback, (select count(*) from public.tool_usage) as usage;

-- the owner's "set VVIP" goes through the service role: the protect trigger must let that through
set role service_role;
select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \gset
update public.profiles set is_vip = false where username = 'okuser';
reset role;
select 'svc vip    ', is_vip from public.profiles where username = 'okuser';
