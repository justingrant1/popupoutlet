-- Run this in the Supabase SQL editor.

-- ---------- reviews ----------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_handle text not null,
  author text not null,
  rating int not null check (rating between 1 and 5),
  title text not null,
  body text not null,
  verified boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists reviews_handle_idx on public.reviews (product_handle);

alter table public.reviews enable row level security;

-- public read
drop policy if exists "reviews readable" on public.reviews;
create policy "reviews readable" on public.reviews
  for select using (true);
-- writes only via service role (bypasses RLS), so no insert policy for anon.

-- ---------- orders ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique,
  stripe_payment_intent text,
  email text,
  amount_total int,          -- cents
  currency text default 'usd',
  status text default 'pending', -- pending | paid | failed
  created_at timestamptz not null default now()
);
create index if not exists orders_session_idx on public.orders (stripe_session_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_handle text not null,
  sku text not null,
  title text not null,
  variant text,
  unit_amount int not null,  -- cents
  quantity int not null
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
-- No anon policies: orders are read/written only by the service role on the server.
