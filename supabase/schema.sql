-- PrintLab · Supabase PostgreSQL / Auth / Storage
-- Uruchom CAŁY plik JEDNORAZOWO w Supabase SQL Editor w nowym projekcie.
-- Nie wklejaj żadnych kluczy service_role do frontendu.
create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Funkcja w schemacie nieudostępnianym przez Data API.
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);

create or replace function private.create_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values(new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists printlab_user_profile on auth.users;
create trigger printlab_user_profile after insert on auth.users
for each row execute function private.create_user_profile();

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 90),
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete restrict,
  description text not null default '',
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint category_not_own_parent check (id is distinct from parent_id)
);
create index if not exists categories_parent_idx on public.categories(parent_id,position);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check(length(trim(name)) between 1 and 180),
  slug text not null unique,
  description text not null default '',
  base_price numeric(12,2) not null default 0 check(base_price >= 0),
  sku text unique,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id,created_at desc);

-- "Podprodukty" to warianty przypięte do jednego produktu.
-- Każdy wariant ma niezależną cenę, SKU, stan magazynowy i zdjęcie.
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 120),
  sku text unique,
  price numeric(12,2) not null check(price >= 0),
  stock integer not null default 0 check(stock >= 0),
  color text not null default '',
  size text not null default '',
  attributes jsonb not null default '{}'::jsonb check(jsonb_typeof(attributes) = 'object'),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists variants_product_idx on public.product_variants(product_id);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Główny',
  recipient text not null,
  street text not null,
  city text not null,
  postal_code text not null,
  phone text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses(user_id);

-- Struktura pod przyszłe integracje płatnicze / InPost.
-- Klient NIE ma bezpośrednich uprawnień INSERT do orders/order_items.
-- Przyszły checkout musi działać przez zweryfikowaną funkcję po stronie serwera.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'new' check(status in ('new','pending_payment','paid','in_production','shipped','delivered','cancelled','refunded')),
  payment_status text not null default 'unpaid' check(payment_status in ('unpaid','pending','paid','refunded')),
  total numeric(12,2) not null check(total >= 0),
  delivery_cost numeric(12,2) not null default 0 check(delivery_cost >= 0),
  shipping jsonb not null default '{}'::jsonb,
  inpost_tracking text,
  created_at timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders(user_id,created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_name text not null default '',
  quantity integer not null check(quantity between 1 and 999),
  unit_price numeric(12,2) not null check(unit_price >= 0)
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- RLS: nie wystarczy ukryć panel admina — ograniczenia są po stronie bazy.
alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Uprawnienia ograniczone: anon tylko publiczny katalog, klient tylko jego dane,
-- administrator modyfikuje katalog dzięki RLS.
revoke all on public.admins,public.profiles,public.categories,public.products,public.product_variants,public.addresses,public.orders,public.order_items from anon,authenticated;
grant select on public.categories,public.products,public.product_variants to anon,authenticated;
grant insert,update,delete on public.categories,public.products,public.product_variants to authenticated;
grant select on public.admins to authenticated;
grant select on public.profiles to authenticated;
grant update(display_name,phone) on public.profiles to authenticated;
grant select,insert,update,delete on public.addresses to authenticated;
grant select on public.orders,public.order_items to authenticated;
grant update(status,inpost_tracking) on public.orders to authenticated;

create policy admins_read_own on public.admins for select to authenticated
  using (user_id = (select auth.uid()));

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy categories_public_read on public.categories for select to anon,authenticated
  using (is_active or (select private.is_admin()));
create policy categories_admin_insert on public.categories for insert to authenticated
  with check ((select private.is_admin()));
create policy categories_admin_update on public.categories for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy categories_admin_delete on public.categories for delete to authenticated
  using ((select private.is_admin()));

create policy products_public_read on public.products for select to anon,authenticated
  using ((is_active and exists(select 1 from public.categories c where c.id=category_id and c.is_active)) or (select private.is_admin()));
create policy products_admin_insert on public.products for insert to authenticated
  with check ((select private.is_admin()));
create policy products_admin_update on public.products for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy products_admin_delete on public.products for delete to authenticated
  using ((select private.is_admin()));

create policy variants_public_read on public.product_variants for select to anon,authenticated
  using ((is_active and exists(select 1 from public.products p where p.id = product_id and p.is_active)) or (select private.is_admin()));
create policy variants_admin_insert on public.product_variants for insert to authenticated
  with check ((select private.is_admin()));
create policy variants_admin_update on public.product_variants for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy variants_admin_delete on public.product_variants for delete to authenticated
  using ((select private.is_admin()));

create policy addresses_read_own on public.addresses for select to authenticated
  using (user_id = (select auth.uid()));
create policy addresses_insert_own on public.addresses for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy addresses_update_own on public.addresses for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy addresses_delete_own on public.addresses for delete to authenticated
  using (user_id = (select auth.uid()));

create policy orders_read_own_or_admin on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy orders_admin_update on public.orders for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy order_items_read_own_or_admin on public.order_items for select to authenticated
  using ((select private.is_admin()) or exists(select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));

-- Grafiki produktów: publiczne czytanie, dodawanie tylko admin.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

create policy printlab_images_public_read on storage.objects for select to anon,authenticated
  using (bucket_id = 'product-images');
create policy printlab_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select private.is_admin()));
create policy printlab_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()))
  with check (bucket_id = 'product-images' and (select private.is_admin()));
create policy printlab_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));

-- Nadanie uprawnień do pierwszego konta admina: osobno uruchom seed-admin.sql.
