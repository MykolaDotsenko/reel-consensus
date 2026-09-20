alter table public.rooms
  add column if not exists region text not null default 'US'
    check (region ~ '^[A-Z]{2}$'),
  add column if not exists provider_ids integer[] not null default '{}',
  add column if not exists monetization_types text[] not null
    default array['flatrate', 'free', 'ads']::text[]
    check (
      cardinality(monetization_types) > 0
      and monetization_types <@ array['flatrate', 'free', 'ads', 'rent', 'buy']::text[]
    ),
  add column if not exists require_availability boolean not null default true;

update public.rooms
set region = upper(region)
where region <> upper(region);
