import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Returns & Refunds",
  description:
    "30-day returns on PopupOutlet products. How to start a return, refund timelines, and warranty coverage.",
  alternates: { canonical: "/returns" },
};

export default function ReturnsPage() {
  return (
    <div className="container" style={{ maxWidth: 820, padding: "40px 20px 60px" }}>
      <h1 style={{ fontSize: 34, letterSpacing: "-0.02em", marginBottom: 8 }}>Returns &amp; Refunds</h1>
      <p className="muted" style={{ marginBottom: 24 }}>Last updated: {new Date().getFullYear()}</p>

      <div className="desc">
        <h2>30-day return policy</h2>
        <p>
          We want you to love your purchase. If you&apos;re not completely satisfied, you may return
          eligible items within <strong>30 days of delivery</strong> for a full refund of the item
          price.
        </p>

        <h3>Return conditions</h3>
        <ul>
          <li>Items must be unused, uninstalled, and in their original packaging.</li>
          <li>Proof of purchase (order number) is required.</li>
          <li>Custom, made-to-order, or clearance items may not be eligible.</li>
        </ul>

        <h3>How to start a return</h3>
        <p>
          Email us at{" "}
          <a href="/contact" style={{ textDecoration: "underline" }}>our contact page</a> with your
          order number and the item(s) you&apos;d like to return. We&apos;ll send return
          instructions and, where applicable, a prepaid label.
        </p>

        <h3>Refunds</h3>
        <p>
          Once we receive and inspect your return, we&apos;ll process your refund to the original
          payment method within 5–10 business days. You&apos;ll get an email confirmation when the
          refund is issued.
        </p>

        <h3>Damaged or defective items</h3>
        <p>
          If your item arrives damaged or defective, contact us within 30 days and we&apos;ll
          arrange a free replacement or full refund — no return shipping cost to you.
        </p>

        <h3>Warranty</h3>
        <p>
          Our outlets are covered by a manufacturer warranty against defects in materials and
          workmanship. Reach out and we&apos;ll help you with any warranty claim.
        </p>
      </div>
    </div>
  );
}
