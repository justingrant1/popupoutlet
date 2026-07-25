-- Modern Power Solutions — US catalog schema for Supabase (Postgres)
-- Idempotent: safe to run multiple times.

-- Extensions ---------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- Tables -------------------------------------------------------------------
create table if not exists products (
  id                uuid primary key default gen_random_uuid(),
  handle            text not null unique,
  title             text not null,
  vendor            text,
  product_type      text,
  region            text,
  currency          text default 'USD',
  price_min         numeric(10,2),
  price_max         numeric(10,2),
  description_html  text,
  key_features      jsonb default '[]'::jsonb,
  tags              text[] default '{}',
  meta_title        text,
  meta_description  text,
  og_title          text,
  og_description    text,
  og_image          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists product_options (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  name        text not null,
  values      text[] not null default '{}',
  position    int default 0,
  unique (product_id, name)
);

create table if not exists variants (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  sku           text not null unique,
  color         text,
  power         text,
  variant_title text,
  price         numeric(10,2),
  available     boolean default true,
  image_folder  text,
  primary_image text,
  source_handle text,
  position      int default 0
);

create table if not exists product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  source_handle text,
  position      int default 0,
  image_url     text,
  local_path    text,
  width         int,
  height        int
);

create table if not exists product_videos (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  video_type  text,
  video_url   text,
  unique (product_id, video_url)
);

create table if not exists collections (
  id     uuid primary key default gen_random_uuid(),
  name   text not null unique,
  slug   text
);

create table if not exists product_collections (
  product_id    uuid not null references products(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  primary key (product_id, collection_id)
);

create table if not exists product_specs (
  product_id        uuid primary key references products(id) on delete cascade,
  amperage          text,
  hole_size_mm      text,
  lift_type         text,
  usb_a             boolean,
  usb_c             boolean,
  wireless_charging boolean,
  hdmi              boolean,
  rj45              boolean,
  light             boolean,
  spill_sealed      boolean
);

-- Indexes ------------------------------------------------------------------
create index if not exists idx_variants_product      on variants(product_id);
create index if not exists idx_variants_source       on variants(source_handle);
create index if not exists idx_images_product        on product_images(product_id);
create index if not exists idx_images_source         on product_images(source_handle);
create index if not exists idx_videos_product        on product_videos(product_id);
create index if not exists idx_options_product       on product_options(product_id);
create index if not exists idx_pc_collection         on product_collections(collection_id);

-- Row Level Security: public read-only catalog ----------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'products','product_options','variants','product_images',
    'product_videos','collections','product_collections','product_specs'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "public read %1$s" on %1$I;', t);
    execute format(
      'create policy "public read %1$s" on %1$I for select using (true);', t
    );
  end loop;
end $$;
