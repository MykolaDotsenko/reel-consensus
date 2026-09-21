-- Harden the Data API boundary for shared rooms.
-- Supabase no longer guarantees automatic grants for newly created public tables,
-- so every browser-visible privilege is explicit and paired with RLS.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.is_room_host(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rooms
    where id = p_room_id
      and host_user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_room_member(uuid) from public, anon;
revoke all on function private.is_room_host(uuid) from public, anon;
grant execute on function private.is_room_member(uuid) to authenticated, service_role;
grant execute on function private.is_room_host(uuid) to authenticated, service_role;

drop policy if exists "room members can read rooms" on public.rooms;
create policy "room members can read rooms"
on public.rooms
for select
to authenticated
using (private.is_room_member(id));

drop policy if exists "room members can update room settings" on public.rooms;
drop policy if exists "room hosts can update room settings" on public.rooms;
create policy "room hosts can update room settings"
on public.rooms
for update
to authenticated
using (private.is_room_host(id))
with check (private.is_room_host(id));

drop policy if exists "room members can read members" on public.room_members;
create policy "room members can read members"
on public.room_members
for select
to authenticated
using (private.is_room_member(room_id));

drop policy if exists "members can update themselves" on public.room_members;
create policy "members can update themselves"
on public.room_members
for update
to authenticated
using (
  user_id = (select auth.uid())
  and private.is_room_member(room_id)
)
with check (
  user_id = (select auth.uid())
  and private.is_room_member(room_id)
);

-- Data API object privileges are explicit. RLS still decides which rows are visible.
revoke all privileges on table public.rooms from anon;
revoke all privileges on table public.room_members from anon;

revoke all privileges on table public.rooms from authenticated;
revoke all privileges on table public.room_members from authenticated;

grant select on table public.rooms to authenticated;
grant select on table public.room_members to authenticated;

grant update (
  state,
  shared_brief,
  max_runtime,
  min_rating,
  excluded_genres,
  fairness_mode,
  region,
  provider_ids,
  monetization_types,
  require_availability
) on table public.rooms to authenticated;

grant update (
  display_name,
  ready,
  liked_genres,
  avoided_genres,
  moods,
  last_seen_at
) on table public.room_members to authenticated;

grant all privileges on table public.rooms to service_role;
grant all privileges on table public.room_members to service_role;

-- RPC functions are the only browser path that inserts room/member rows.
revoke all on function public.create_movie_night(text, text, integer, numeric, text[], text)
  from public, anon;
revoke all on function public.join_movie_night(text, text)
  from public, anon;

grant execute on function public.create_movie_night(text, text, integer, numeric, text[], text)
  to authenticated, service_role;
grant execute on function public.join_movie_night(text, text)
  to authenticated, service_role;

-- Remove the old public helper after all policies have moved to the private helper.
drop function if exists public.is_room_member(uuid);
