import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "no stripe" }, { status: 500 });

  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await req.text();

  let event;
  try {
    if (sig && secret) {
      event = stripe.webhooks.constructEvent(raw, sig, secret);
    } else {
      // Dev fallback if no signing secret configured.
      event = JSON.parse(raw);
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    try {
      const sb = supabaseAdmin();
      await sb
        .from("orders")
        .update({
          status: "paid",
          email: session.customer_details?.email ?? null,
          stripe_payment_intent: session.payment_intent ?? null,
          amount_total: session.amount_total ?? null,
        })
        .eq("stripe_session_id", session.id);
    } catch {
      // ignore if Supabase not configured
    }
  }

  return NextResponse.json({ received: true });
}
