import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description:
    "Free US shipping on all PopupOutlet orders. Processing times, delivery estimates, and tracking details.",
  alternates: { canonical: "/shipping" },
};

export default function ShippingPage() {
  return (
    <div className="container" style={{ maxWidth: 820, padding: "40px 20px 60px" }}>
      <h1 style={{ fontSize: 34, letterSpacing: "-0.02em", marginBottom: 8 }}>Shipping Policy</h1>
      <p className="muted" style={{ marginBottom: 24 }}>Last updated: {new Date().getFullYear()}</p>

      <div className="desc">
        <h2>Shipping rates & delivery</h2>
        <p>
          We offer <strong>free standard shipping on all orders within the United States</strong>.
          Orders are processed within 1–2 business days. Standard delivery typically arrives within
          3–7 business days after processing, depending on your location.
        </p>

        <h3>Order processing</h3>
        <p>
          Orders placed before 1:00 PM ET on a business day are usually processed the same day.
          Orders placed on weekends or holidays are processed the next business day. You&apos;ll
          receive a confirmation email as soon as your order ships.
        </p>

        <h3>Tracking</h3>
        <p>
          A tracking number is emailed to you when your order leaves our warehouse. If you
          haven&apos;t received tracking within 3 business days, please contact us.
        </p>

        <h3>Shipping destinations</h3>
        <p>
          We currently ship to all 50 US states. For questions about international shipping, please
          reach out and we&apos;ll do our best to help.
        </p>

        <h3>Lost or delayed packages</h3>
        <p>
          If your package is delayed, lost, or arrives damaged, contact us at{" "}
          <a href="/contact" style={{ textDecoration: "underline" }}>our contact page</a> and
          we&apos;ll make it right.
        </p>
      </div>
    </div>
  );
}
