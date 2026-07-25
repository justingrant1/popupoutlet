import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the PopupOutlet team for order help, product questions, returns, and wholesale enquiries.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="container" style={{ maxWidth: 820, padding: "40px 20px 60px" }}>
      <h1 style={{ fontSize: 34, letterSpacing: "-0.02em", marginBottom: 8 }}>Contact Us</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        We&apos;re here to help with orders, product questions, and returns.
      </p>

      <div className="desc">
        <h3>Email</h3>
        <p>
          The fastest way to reach us is by email at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ textDecoration: "underline" }}>
            {SUPPORT_EMAIL}
          </a>
          . We typically reply within 1 business day.
        </p>

        <h3>Customer support hours</h3>
        <p>Monday–Friday, 9:00 AM – 5:00 PM ET (excluding US holidays).</p>

        <h3>Order &amp; shipping questions</h3>
        <p>
          Include your order number in your message so we can help faster. See our{" "}
          <a href="/shipping" style={{ textDecoration: "underline" }}>Shipping Policy</a> and{" "}
          <a href="/returns" style={{ textDecoration: "underline" }}>Returns &amp; Refunds</a> for
          quick answers.
        </p>

        <h3>Wholesale &amp; trade</h3>
        <p>
          Interested in bulk or trade pricing for your business or project? Email us with details
          and we&apos;ll get back to you with a quote.
        </p>
      </div>
    </div>
  );
}
