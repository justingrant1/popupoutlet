"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";

export default function SuccessPage() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, [clear]);

  return (
    <section className="section">
      <div className="container center" style={{ maxWidth: 560 }}>
        <div className="success-check">✓</div>
        <h1>Thank you for your order!</h1>
        <p className="muted">
          Your payment was successful and a confirmation email is on its way. Your pop-up outlet
          will ship within 1–2 business days.
        </p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 16 }}>
          Continue shopping
        </Link>
      </div>
    </section>
  );
}
