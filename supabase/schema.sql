-- NexaKit Pro username-only UX on top of Supabase Auth.
-- Run this in Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9._-]{3,24}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

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

create or replace function public.protect_is_vip()
returns trigger
language plpgsql
as $$
begin
  if new.is_vip is distinct from old.is_vip and auth.role() <> 'service_role' then
    new.is_vip := old.is_vip;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_is_vip on public.profiles;
create trigger profiles_protect_is_vip
before update on public.profiles
for each row execute procedure public.protect_is_vip();
