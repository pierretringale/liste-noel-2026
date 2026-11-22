-- Liste de Noël 2026 : trois tables, RLS activée sans politique.
-- Seule la fonction Edge `noel` (clé secrète) lit et écrit.

create table public.noel_gifts (
  id          uuid primary key default gen_random_uuid(),
  child       text not null check (child in ('Loula', 'Sacha')),
  name        text not null check (char_length(name) between 1 and 140),
  url         text check (url is null or url ~ '^https?://'),
  price       numeric(8,2) check (price is null or price >= 0),
  note        text check (note is null or char_length(note) <= 80),
  photo_url   text check (photo_url is null or photo_url ~ '^https://'),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.noel_claims (
  gift_id     uuid primary key references public.noel_gifts(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  created_at  timestamptz not null default now()
);

create table public.noel_login_attempts (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  at          timestamptz not null default now()
);

alter table public.noel_gifts          enable row level security;
alter table public.noel_claims         enable row level security;
alter table public.noel_login_attempts enable row level security;
-- Aucune politique : seule la clé de service (fonction noel) lit et écrit.

comment on table public.noel_gifts is 'Liste de Noël 2026 (perso). RLS sans politique : fonction noel seule. À supprimer en janvier 2027.';
comment on table public.noel_claims is 'Liste de Noël 2026 : une réservation par cadeau (clé primaire = cadeau).';
comment on table public.noel_login_attempts is 'Liste de Noël 2026 : essais de code parents, purgés au fil de l''eau.';
