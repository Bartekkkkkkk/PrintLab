-- PrintLab: osobna tabela płatności Stripe, zgodna z dotychczasowymi tabelami.
create table if not exists public.checkout_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 email text not null,
 recipient text not null,
 phone text not null,
 inpost_point text not null,
 items jsonb not null check(jsonb_typeof(items)='array'),
 total numeric(12,2) not null check(total>=0),
 shipping_cost numeric(12,2) not null check(shipping_cost>=0),
 stripe_session_id text unique,
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid','refunded')),
 status text not null default 'pending_payment',
 inpost_tracking text,
 paid_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists checkout_orders_user_idx on public.checkout_orders(user_id,created_at desc);
alter table public.checkout_orders enable row level security;
revoke all on public.checkout_orders from anon,authenticated;
grant select on public.checkout_orders to authenticated;
drop policy if exists checkout_orders_read on public.checkout_orders;
create policy checkout_orders_read on public.checkout_orders for select to authenticated
 using (user_id=(select auth.uid()) or exists (select 1 from public.admins a where a.user_id=(select auth.uid())));
-- Brak publicznych INSERT/UPDATE: tylko funkcje serwerowe z SUPABASE_SERVICE_ROLE_KEY.
