-- Genius Coffee Bar — database setup for Supabase.
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- STEP: change OWNER_EMAIL_HERE (last section) to the email the owner logs in with.
-- Safe to run more than once.

-- ---------- tables ----------
create table if not exists public.admins (
  email text primary key
);

create table if not exists public.menu_groups (
  id uuid primary key default gen_random_uuid(),
  tab text not null check (tab in ('coffee','matcha','cold','tea','sweet')),
  title text not null,
  dual boolean not null default false,          -- true = Hot / Iced columns
  sort int not null default 0
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.menu_groups(id) on delete cascade,
  name text not null,
  hot numeric(8,3),                              -- the price (or Hot price when group is dual)
  iced numeric(8,3),                             -- Iced price (dual groups only)
  sold_out boolean not null default false,
  hidden boolean not null default false,
  sort int not null default 0
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text,
  pickup text,
  note text,
  items jsonb not null,
  total numeric(10,3) not null,
  status text not null default 'new' check (status in ('new','preparing','ready','done','cancelled'))
);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- ---------- who is an admin ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email','')));
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- row level security ----------
alter table public.admins       enable row level security;   -- no policies = nobody can read it directly
alter table public.menu_groups  enable row level security;
alter table public.menu_items   enable row level security;
alter table public.settings     enable row level security;
alter table public.orders       enable row level security;

drop policy if exists groups_read  on public.menu_groups;
drop policy if exists groups_write on public.menu_groups;
create policy groups_read  on public.menu_groups for select to anon, authenticated using (true);
create policy groups_write on public.menu_groups for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists items_read  on public.menu_items;
drop policy if exists items_write on public.menu_items;
create policy items_read  on public.menu_items for select to anon, authenticated using (hidden = false or public.is_admin());
create policy items_write on public.menu_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists settings_read  on public.settings;
drop policy if exists settings_write on public.settings;
create policy settings_read  on public.settings for select to anon, authenticated using (true);
create policy settings_write on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists orders_insert on public.orders;
drop policy if exists orders_admin  on public.orders;
create policy orders_insert on public.orders for insert to anon, authenticated
  with check (
    status = 'new'
    and total >= 0 and total < 10000
    and jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 60
    and char_length(coalesce(name,''))   <= 80
    and char_length(coalesce(pickup,'')) <= 60
    and char_length(coalesce(note,''))   <= 500
  );
create policy orders_admin on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.menu_groups, public.menu_items, public.settings to anon, authenticated;
grant insert, update, delete on public.menu_groups, public.menu_items, public.settings to authenticated;
grant insert on public.orders to anon;
grant select, insert, update, delete on public.orders to authenticated;

-- ---------- photo storage ----------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
  on conflict (id) do update set public = true;

drop policy if exists photos_read   on storage.objects;
drop policy if exists photos_insert on storage.objects;
drop policy if exists photos_update on storage.objects;
drop policy if exists photos_delete on storage.objects;
create policy photos_read   on storage.objects for select to anon, authenticated using (bucket_id = 'photos');
create policy photos_insert on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_admin());
create policy photos_update on storage.objects for update to authenticated using (bucket_id = 'photos' and public.is_admin());
create policy photos_delete on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_admin());

-- ---------- default settings ----------
insert into public.settings (key, value) values
  ('announcement', '{"on": false, "text": ""}'),
  ('hours',        '{"open": 7, "close_sun_wed": 23, "close_thu_sat": 24, "temp_closed": false}'),
  ('rating',       '{"score": "5.0", "count": 36, "url": "https://share.google/oaJuCNQMd1S131yry"}'),
  ('images',       '{}')
on conflict (key) do nothing;

-- ---------- the owner ----------
-- Replace with the real email (the same one you create in Authentication > Users). Add more rows for more admins.
insert into public.admins (email) values ('OWNER_EMAIL_HERE') on conflict do nothing;
