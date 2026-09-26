-- NexaKit Pro username-only UX on top of Supabase Auth.
-- Run this in Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9._-]{3,24}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ponytail: root cause of "Database error saving new user" / "column
-- updated_at does not exist" — CREATE TABLE IF NOT EXISTS above is a no-op
-- when the table already exists (e.g. from an earlier partial run), so it
-- never adds columns that were missing on that earlier version of the
-- table. These two lines force them to exist regardless of table history.
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)))
  on conflict (id) do update set username = excluded.username, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ponytail: "create policy" has no IF NOT EXISTS in Postgres (unlike
-- table/function/trigger above), so re-running this file previously errored
-- here with "policy already exists" once it had run successfully once —
-- drop-then-create makes it safe to re-run this whole file any time.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles for delete
to authenticated
using (auth.uid() = id);

-- Optional helper to keep updated_at current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

-- VIP flag. Client can UPDATE their own profile row (policy above), but this
-- trigger silently reverts any change to is_vip unless the request runs as
-- service_role — so a user calling supabase.from('profiles').update({is_vip:true})
-- from the browser console has zero effect. Only flip this from the Supabase
-- Table Editor / SQL Editor (which runs with elevated rights), after you've
-- manually confirmed payment.
alter table public.profiles add column if not exists is_vip boolean not null default false;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;

-- The client resizes avatars to ~480px JPEG (data URL, typically well under
-- 200KB) before saving, but that resize is client-side only — a direct
-- supabase-js call from the browser console could otherwise write an
-- arbitrarily large string here. This bounds it server-side regardless of
-- what the client does: ~700KB of base64 comfortably covers a legitimate
-- compressed avatar with headroom, while still preventing unbounded row
-- growth / storage-bloat from a crafted request.
alter table public.profiles drop constraint if exists profiles_avatar_url_length;
alter table public.profiles add constraint profiles_avatar_url_length
  check (avatar_url is null or char_length(avatar_url) <= 700000);

-- Role + ban flag, protected the same way as is_vip above: a client PATCH to
-- these columns is silently reverted unless the request runs as service_role.
-- This is what makes the /api/admin.js endpoint's checks meaningful instead
-- of just a client-side suggestion — even a user who edits the JS in devtools
-- cannot grant themselves 'admin' by calling supabase.from('profiles').update().
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user','admin','owner'));
alter table public.profiles add column if not exists banned boolean not null default false;

create or replace function public.protect_is_vip()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.is_vip is distinct from old.is_vip then new.is_vip := old.is_vip; end if;
    if new.role is distinct from old.role then new.role := old.role; end if;
    if new.banned is distinct from old.banned then new.banned := old.banned; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_is_vip on public.profiles;
create trigger profiles_protect_is_vip
before update on public.profiles
for each row execute procedure public.protect_is_vip();

-- ================= ADMIN PANEL =================
-- Everything below is read/written by /api/admin.js using the
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely — that endpoint is
-- solely responsible for checking the caller's own profiles.role before
-- doing anything. These policies only govern what the *browser* (anon/
-- authenticated key) may do directly.

-- Per-tool on/off + maintenance + VVIP-lock. Public read so the app can grey
-- out a disabled tool or show a VVIP lock; only service_role can flip it
-- (admin panel). Applies to BOTH built-in tools (by slug) and custom_tools
-- below (also by slug) — one override table for either kind.
create table if not exists public.tool_status (
  slug text primary key,
  enabled boolean not null default true,
  maintenance boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.tool_status add column if not exists vvip_only boolean not null default false;
alter table public.tool_status enable row level security;
drop policy if exists "tool_status_select_all" on public.tool_status;
create policy "tool_status_select_all" on public.tool_status for select to anon, authenticated using (true);

-- Seed VVIP defaults for the new/moved tools discussed in chat. Uses
-- ON CONFLICT DO NOTHING so this only sets vvip_only the first time each
-- row is created — re-running this file later (e.g. after an admin has
-- since flipped one of these back off in the panel) won't silently
-- re-enable it.
insert into public.tool_status (slug, vvip_only)
values ('bypass-link', true), ('react-wa', true), ('fakebank-jago', true),
       ('fakegopay', true), ('komikindo', true)
on conflict (slug) do nothing;

-- Tools the admin creates from the panel itself (built-in tools stay
-- hardcoded in app.js — this table is only for genuinely new cards). Type is
-- constrained to the two generic templates the frontend already knows how to
-- render/run: a tool built here reuses that existing code path, it doesn't
-- get bespoke logic of its own. Provider must be one of the already
-- allowlisted keys in api/proxy.js's PROVIDERS map (never a raw URL — the
-- proxy's SSRF guard only fetches those fixed hosts, and letting an admin
-- field bypass that would defeat the whole point of the allowlist).
create table if not exists public.custom_tools (
  id bigint generated by default as identity primary key,
  slug text unique not null,
  title text not null,
  description text not null default '',
  tag text not null default '',
  icon text not null default 'wrench',
  icon_brand boolean not null default false,
  category text not null default 'tools' check (category in ('downloader','maker','tools','vault','external')),
  type text not null check (type in ('generic-downloader','image-generator')),
  provider text not null,
  param_key text not null default 'url',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.custom_tools enable row level security;
drop policy if exists "custom_tools_select_all" on public.custom_tools;
create policy "custom_tools_select_all" on public.custom_tools for select to anon, authenticated using (true);

-- Bug reports + suggestions from the in-app "Report Bug / Saran" form.
-- Users can only insert their own; nobody but service_role can read the
-- list back (that's what powers the admin Reports tab).
create table if not exists public.feedback (
  id bigint generated by default as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  username text,
  kind text not null check (kind in ('bug','suggestion')),
  message text not null,
  status text not null default 'pending' check (status in ('pending','reviewed','done')),
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback for insert to authenticated with check (auth.uid() = user_id);

-- One row per tool open, for the admin dashboard's usage counter. Insert-only
-- from the client; nobody but service_role can read it back.
create table if not exists public.tool_usage (
  id bigint generated by default as identity primary key,
  tool_slug text not null,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.tool_usage enable row level security;
drop policy if exists "tool_usage_insert_own" on public.tool_usage;
create policy "tool_usage_insert_own" on public.tool_usage for insert to authenticated with check (auth.uid() = user_id);

-- Small announcements banner. Public read of active ones; only service_role
-- writes (admin panel).
create table if not exists public.announcements (
  id bigint generated by default as identity primary key,
  title text not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists "announcements_select_active" on public.announcements;
create policy "announcements_select_active" on public.announcements for select to anon, authenticated using (active = true);

-- Admin audit trail. No policies at all — RLS is enabled with zero grants,
-- so this is service_role-only in both directions; the browser can't read
-- or write it under any circumstance.
create table if not exists public.activity_logs (
  id bigint generated by default as identity primary key,
  actor_id uuid,
  actor_username text,
  action text not null,
  target text,
  meta jsonb,
  created_at timestamptz not null default now()
);
alter table public.activity_logs enable row level security;
