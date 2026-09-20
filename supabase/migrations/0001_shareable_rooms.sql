create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'setup' check (state in ('setup', 'ready', 'deciding', 'decided', 'closed')),
  shared_brief text not null default '',
  max_runtime integer null check (max_runtime is null or max_runtime between 30 and 360),
  min_rating numeric null check (min_rating is null or min_rating between 0 and 10),
  excluded_genres text[] not null default '{}',
  fairness_mode text not null default 'balanced' check (fairness_mode in ('balanced', 'democratic', 'no-one-hates-it')),
  invite_token_hash text not null,
  invite_expires_at timestamptz not null default (now() + interval '30 days'),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  role text not null default 'member' check (role in ('host', 'member')),
  ready boolean not null default false,
  liked_genres text[] not null default '{}',
  avoided_genres text[] not null default '{}',
  moods text[] not null default '{}',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

drop policy if exists "room members can read rooms" on public.rooms;
create policy "room members can read rooms"
on public.rooms for select
to authenticated
using (public.is_room_member(id));

drop policy if exists "room members can update room settings" on public.rooms;
create policy "room members can update room settings"
on public.rooms for update
to authenticated
using (public.is_room_member(id))
with check (public.is_room_member(id));

drop policy if exists "room members can read members" on public.room_members;
create policy "room members can read members"
on public.room_members for select
to authenticated
using (public.is_room_member(room_id));

drop policy if exists "members can update themselves" on public.room_members;
create policy "members can update themselves"
on public.room_members for update
to authenticated
using (user_id = auth.uid() and public.is_room_member(room_id))
with check (user_id = auth.uid() and public.is_room_member(room_id));

create or replace function public.create_movie_night(
  p_display_name text,
  p_shared_brief text default '',
  p_max_runtime integer default null,
  p_min_rating numeric default null,
  p_excluded_genres text[] default '{}',
  p_fairness_mode text default 'balanced'
)
returns table(room_id uuid, invite_token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room_id uuid;
  v_token text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_name := left(trim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g')), 40);
  if char_length(v_name) = 0 then
    raise exception 'Display name required';
  end if;

  if p_fairness_mode not in ('balanced', 'democratic', 'no-one-hates-it') then
    raise exception 'Invalid fairness mode';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.rooms (
    host_user_id,
    shared_brief,
    max_runtime,
    min_rating,
    excluded_genres,
    fairness_mode,
    invite_token_hash
  )
  values (
    auth.uid(),
    left(coalesce(p_shared_brief, ''), 800),
    p_max_runtime,
    p_min_rating,
    coalesce(p_excluded_genres, '{}'),
    p_fairness_mode,
    encode(digest(v_token, 'sha256'), 'hex')
  )
  returning id into v_room_id;

  insert into public.room_members (room_id, user_id, display_name, role)
  values (v_room_id, auth.uid(), v_name, 'host');

  return query select v_room_id, v_token;
end;
$$;

create or replace function public.join_movie_night(
  p_invite_token text,
  p_display_name text
)
returns table(room_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room_id uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_name := left(trim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g')), 40);
  if char_length(v_name) = 0 then
    raise exception 'Display name required';
  end if;

  select r.id
  into v_room_id
  from public.rooms r
  where r.invite_token_hash = encode(digest(p_invite_token, 'sha256'), 'hex')
    and r.invite_expires_at > now()
    and r.expires_at > now()
    and r.state <> 'closed'
  limit 1;

  if v_room_id is null then
    raise exception 'Invite is invalid or expired';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = v_room_id and user_id = auth.uid()
  ) and (
    select count(*) from public.room_members where room_id = v_room_id
  ) >= 5 then
    raise exception 'This room is full';
  end if;

  insert into public.room_members (room_id, user_id, display_name, role)
  values (v_room_id, auth.uid(), v_name, 'member')
  on conflict (room_id, user_id)
  do update set
    display_name = excluded.display_name,
    last_seen_at = now();

  return query select v_room_id;
end;
$$;

revoke all on function public.create_movie_night(text, text, integer, numeric, text[], text) from public;
revoke all on function public.join_movie_night(text, text) from public;
grant execute on function public.create_movie_night(text, text, integer, numeric, text[], text) to authenticated;
grant execute on function public.join_movie_night(text, text) to authenticated;

create index if not exists room_members_user_idx on public.room_members(user_id);
create index if not exists rooms_expiry_idx on public.rooms(expires_at);
create index if not exists rooms_invite_hash_idx on public.rooms(invite_token_hash);
