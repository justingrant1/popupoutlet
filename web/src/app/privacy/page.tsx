import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How PopupOutlet collects, uses, and protects your personal information when you shop with us.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="container" style={{ maxWidth: 820, padding: "40px 20px 60px" }}>
      <h1 style={{ fontSize: 34, letterSpacing: "-0.02em", marginBottom: 8 }}>Privacy Policy</h1>
      <p className="muted" style={{ marginBottom: 24 }}>Last updated: {new Date().getFullYear()}</p>

      <div className="desc">
        <p>
          This Privacy Policy explains how PopupOutlet (&quot;we&quot;, &quot;us&quot;) collects,
          uses, and safeguards your information when you visit our website and make a purchase.
        </p>

        <h3>Information we collect</h3>
        <ul>
          <li>
            <strong>Order information:</strong> name, shipping/billing address, email, and phone
            number needed to fulfill your order.
          </li>
          <li>
            <strong>Payment information:</strong> processed securely by our payment provider
            (Stripe). We do not store your full card details.
          </li>
          <li>
            <strong>Usage data:</strong> anonymous analytics such as pages visited and device type
            to improve the site.
          </li>
        </ul>

        <h3>How we use your information</h3>
        <p>
          We use your information to process and ship orders, provide customer support, send order
          updates, and improve our products and website. We do not sell your personal information.
        </p>

        <h3>Cookies</h3>
        <p>
          We use cookies to keep your cart working, remember preferences, and understand site
          usage. You can disable cookies in your browser, though some features may not work.
        </p>

        <h3>Third-party services</h3>
        <p>
          We share only the data necessary with trusted providers such as our payment processor
          (Stripe) and shipping carriers. These providers are bound by their own privacy policies.
        </p>

        <h3>Your rights</h3>
        <p>
          You may request access to, correction of, or deletion of your personal data at any time by
          contacting us.
        </p>

        <h3>Contact</h3>
        <p>
          Questions about this policy? Email us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ textDecoration: "underline" }}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
