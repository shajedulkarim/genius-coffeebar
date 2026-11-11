-- Genius Coffee Bar — step 2: customer phone on orders + staff accounts.
-- Paste into Supabase > SQL Editor > New query > Run. Safe to run more than once.

-- 1) customer phone on orders (optional)
alter table public.orders add column if not exists phone text;
alter table public.orders drop constraint if exists orders_phone_len;
alter table public.orders add constraint orders_phone_len check (phone is null or char_length(phone) <= 20);

-- 2) roles: existing admins become owners; new rows default to staff
alter table public.admins add column if not exists role text not null default 'owner';
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('owner','staff'));
alter table public.admins alter column role set default 'staff';

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email','')) and a.role = 'owner');
$$;
grant execute on function public.is_owner() to anon, authenticated;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select a.role from public.admins a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email','')) limit 1;
$$;
grant execute on function public.my_role() to authenticated;

-- staff may flip "sold out" on an item and nothing else on the menu
create or replace function public.set_sold_out(p_id uuid, p_val boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.menu_items set sold_out = p_val where id = p_id;
end $$;
grant execute on function public.set_sold_out(uuid, boolean) to authenticated;

-- 3) menu, settings, photos: owner only (staff keep read access)
drop policy if exists groups_write on public.menu_groups;
create policy groups_write on public.menu_groups for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists items_write on public.menu_items;
create policy items_write on public.menu_items for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists photos_insert on storage.objects;
drop policy if exists photos_update on storage.objects;
drop policy if exists photos_delete on storage.objects;
create policy photos_insert on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_owner());
create policy photos_update on storage.objects for update to authenticated using (bucket_id = 'photos' and public.is_owner());
create policy photos_delete on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_owner());

-- 4) orders: any admin (owner or staff) can read and update; only owners delete
drop policy if exists orders_admin on public.orders;
drop policy if exists orders_read on public.orders;
drop policy if exists orders_update on public.orders;
drop policy if exists orders_delete on public.orders;
create policy orders_read   on public.orders for select to authenticated using (public.is_admin());
create policy orders_update on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy orders_delete on public.orders for delete to authenticated using (public.is_owner());

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert to anon, authenticated
  with check (
    status = 'new'
    and total >= 0 and total < 10000
    and jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 60
    and char_length(coalesce(name,''))   <= 80
    and char_length(coalesce(pickup,'')) <= 60
    and char_length(coalesce(note,''))   <= 500
    and char_length(coalesce(phone,''))  <= 20
  );

-- 5) the team list: only owners can read or change it
drop policy if exists admins_owner on public.admins;
create policy admins_owner on public.admins for all to authenticated using (public.is_owner()) with check (public.is_owner());
grant select, insert, update, delete on public.admins to authenticated;
