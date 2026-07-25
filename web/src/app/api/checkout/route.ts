import { NextRequest, NextResponse } from "next/server";
import { stripe, siteUrl } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { priceLookup } from "@/lib/catalog";

export const runtime = "nodejs";

type IncomingItem = { sku: string; handle: string; qty: number };

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local." },
      { status: 500 }
    );
  }

  let body: { items: IncomingItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const items = (body.items || []).filter((i) => i && i.sku && i.qty > 0);
  if (!items.length) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // Re-price everything on the server from our own catalog (never trust the client).
  const line_items: any[] = [];
  const resolved: {
    handle: string;
    sku: string;
    title: string;
    variant: string;
    unit_amount: number;
    quantity: number;
  }[] = [];

  for (const it of items) {
    const found = priceLookup(it.sku);
    if (!found) {
      return NextResponse.json({ error: `Unknown item: ${it.sku}` }, { status: 400 });
    }
    const unit_amount = Math.round(found.price * 100);
    const qty = Math.min(Math.max(1, Math.floor(it.qty)), 20);
    line_items.push({
      quantity: qty,
      price_data: {
        currency: "usd",
        unit_amount,
        product_data: {
          name: found.title + (found.variant ? ` — ${found.variant}` : ""),
          images: found.image ? [`${siteUrl()}${found.image}`] : undefined,
          metadata: { sku: found.sku, handle: found.handle },
        },
      },
    });
    resolved.push({
      handle: found.handle,
      sku: found.sku,
      title: found.title,
      variant: found.variant,
      unit_amount,
      quantity: qty,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "AU"] },
    automatic_tax: { enabled: false },
    success_url: `${siteUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/checkout/cancel`,
    metadata: { source: "modernpower-demo" },
  });

  // Record a pending order (best-effort; ignore if Supabase not configured).
  try {
    const sb = supabaseAdmin();
    const { data: order } = await sb
      .from("orders")
      .insert({
        stripe_session_id: session.id,
        amount_total: line_items.reduce(
          (n, li) => n + li.price_data.unit_amount * li.quantity,
          0
        ),
        currency: "usd",
        status: "pending",
      })
      .select("id")
      .single();

    if (order?.id) {
      await sb.from("order_items").insert(
        resolved.map((r) => ({
          order_id: order.id,
          product_handle: r.handle,
          sku: r.sku,
          title: r.title,
          variant: r.variant,
          unit_amount: r.unit_amount,
          quantity: r.quantity,
        }))
      );
    }
  } catch {
    // Supabase optional for checkout to work in demo mode.
  }

  return NextResponse.json({ url: session.url });
}
