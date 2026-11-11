-- Genius Coffee Bar — step 3: create users and give them permissions from the admin portal.
-- Run AFTER 002_staff_and_phone.sql. Paste into Supabase > SQL Editor > New query > Run. Safe to run again.

create extension if not exists pgcrypto with schema extensions;

-- 1) per-person permissions (owners always have everything)
alter table public.admins add column if not exists perms text[] not null default '{orders,availability}';
update public.admins set perms = '{orders,availability,menu,insights,photos,settings}' where role = 'owner';

create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      and (a.role = 'owner' or p = any(a.perms)));
$$;
grant execute on function public.has_perm(text) to authenticated;

create or replace function public.my_perms() returns text[]
language sql stable security definer set search_path = public as $$
  select case when a.role = 'owner' then array['orders','availability','menu','insights','photos','settings','team'] else a.perms end
  from public.admins a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email','')) limit 1;
$$;
grant execute on function public.my_perms() to authenticated;

-- 2) sold-out switch
create or replace function public.set_sold_out(p_id uuid, p_val boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_perm('availability') or public.has_perm('menu')) then raise exception 'not allowed'; end if;
  update public.menu_items set sold_out = p_val where id = p_id;
end $$;
grant execute on function public.set_sold_out(uuid, boolean) to authenticated;

-- 3) policies now follow permissions
drop policy if exists groups_write on public.menu_groups;
create policy groups_write on public.menu_groups for all to authenticated using (public.has_perm('menu')) with check (public.has_perm('menu'));
drop policy if exists items_write on public.menu_items;
create policy items_write on public.menu_items for all to authenticated using (public.has_perm('menu')) with check (public.has_perm('menu'));

drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all to authenticated
  using (public.has_perm('settings') or (key = 'images' and public.has_perm('photos')))
  with check (public.has_perm('settings') or (key = 'images' and public.has_perm('photos')));

drop policy if exists orders_read on public.orders;
drop policy if exists orders_update on public.orders;
create policy orders_read   on public.orders for select to authenticated using (public.has_perm('orders') or public.has_perm('insights'));
create policy orders_update on public.orders for update to authenticated using (public.has_perm('orders')) with check (public.has_perm('orders'));

drop policy if exists photos_insert on storage.objects;
drop policy if exists photos_update on storage.objects;
drop policy if exists photos_delete on storage.objects;
create policy photos_insert on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.has_perm('photos'));
create policy photos_update on storage.objects for update to authenticated using (bucket_id = 'photos' and public.has_perm('photos'));
create policy photos_delete on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.has_perm('photos'));

-- 4) owner-only user management (creates a real login, no email needed)
create or replace function public.admin_create_user(p_email text, p_password text, p_role text, p_perms text[]) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
declare uid uuid; em text := lower(trim(p_email));
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email'; end if;
  if char_length(coalesce(p_password,'')) < 8 then raise exception 'password must be at least 8 characters'; end if;
  if p_role not in ('owner','staff') then raise exception 'bad role'; end if;
  select id into uid from auth.users where lower(email) = em limit 1;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, email_change_token_current, recovery_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em, crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  else
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = uid;
  end if;
  insert into public.admins (email, role, perms) values (em, p_role, coalesce(p_perms, '{}'))
    on conflict (email) do update set role = excluded.role, perms = excluded.perms;
end $$;

create or replace function public.admin_set_password(p_email text, p_password text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if char_length(coalesce(p_password,'')) < 8 then raise exception 'password must be at least 8 characters'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where lower(email) = lower(trim(p_email));
  if not found then raise exception 'no login exists for this email yet'; end if;
end $$;

create or replace function public.admin_remove_user(p_email text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_owner() then raise exception 'owner only'; end if;
  if lower(trim(p_email)) = lower(coalesce(auth.jwt() ->> 'email','')) then raise exception 'you cannot remove yourself'; end if;
  delete from public.admins where lower(email) = lower(trim(p_email));
  delete from auth.users where lower(email) = lower(trim(p_email));
end $$;

revoke execute on function public.admin_create_user(text,text,text,text[]) from public, anon;
revoke execute on function public.admin_set_password(text,text) from public, anon;
revoke execute on function public.admin_remove_user(text) from public, anon;
grant execute on function public.admin_create_user(text,text,text,text[]) to authenticated;
grant execute on function public.admin_set_password(text,text) to authenticated;
grant execute on function public.admin_remove_user(text) to authenticated;
