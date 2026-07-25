# Modern Power Solutions — Store (Next.js + Supabase + Stripe)

A production-style storefront rebuilt from the real product catalog scraped from
`modernpower.solutions/collections/all`. Includes product pages with variant image
swapping, spec tables, "frequently bought together" bundles, a persistent cart,
Supabase-backed reviews, and full Stripe Checkout.

## Stack
- **Next.js 14** (App Router, TypeScript, SSG for catalog pages)
- **Supabase** (Postgres) for `reviews`, `orders`, `order_items`
- **Stripe Checkout** (test mode) with re-priced-on-server line items + webhook

## Project layout
```
web/
  src/data/catalog.json     # real products (handles, variants, images, SEO, features)
  src/data/specs.json       # per-product spec sheet (amperage, USB-C, hole size…)
  src/lib/catalog.ts        # catalog access + categorisation + server price lookup
  src/lib/supabase.ts       # public (anon) + admin (service role) clients
  src/lib/stripe.ts         # stripe client
  src/components/*           # Header, Footer, Cart, ProductCard, ProductView, Reviews
  src/app/*                  # home, collections/[slug], products/[handle], checkout, api
  supabase/schema.sql        # tables + RLS
  scripts/seed-reviews.ts    # AI-generated reviews seeder
public/images/*             # downloaded product media
```

## 1. Install
```bash
cd web
npm install
```

## 2. Environment
Edit `web/.env.local` (already scaffolded):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SITE_URL` (http://localhost:3000 for local)

> ⚠️ **Security:** the keys currently in `.env.local` were shared in chat and should be
> considered compromised. Rotate them (Supabase → Project Settings → API → *Reset*, and
> Stripe → Developers → API keys → *Roll*) before using anything beyond local testing.
> `.env.local` is already in `.gitignore`.

## 3. Database
In the Supabase dashboard → **SQL Editor**, paste and run `web/supabase/schema.sql`.
This creates `reviews`, `orders`, `order_items` with row-level security (reviews are
publicly readable; orders are service-role only).

## 4. Seed reviews (AI-generated)
```bash
npm run seed:reviews
```
Creates 4–7 realistic verified reviews per product. Re-running replaces them.

## 5. Run
```bash
npm run dev      # http://localhost:3000
```

## 6. Test Stripe Checkout locally
In a second terminal:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhook
```
Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`, restart `npm run dev`,
add items to the cart, click **Checkout**, and pay with test card `4242 4242 4242 4242`
(any future expiry / any CVC). The order flips from `pending` → `paid` in Supabase via
the webhook.

## How pricing stays safe
The client cart only sends `{ sku, handle, qty }`. `/api/checkout` re-looks up every
price from `catalog.json` server-side (`priceLookup`) so a tampered client can never
change the amount charged.

## Deploy (Vercel)
1. Push the `web/` folder to a Git repo and import into Vercel.
2. Add all env vars from `.env.local` (with **rotated** keys) in Vercel → Settings → Environment Variables.
3. Set `NEXT_PUBLIC_SITE_URL` to the production domain.
4. In Stripe → Webhooks, add an endpoint `https://<domain>/api/webhook` for
   `checkout.session.completed`, and set its signing secret as `STRIPE_WEBHOOK_SECRET`.
```
