"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";
import { money } from "@/lib/catalog";

export default function CartDrawer() {
  const { items, open, setOpen, subtotal, remove, setQty, count } = useCart();
  const [loading, setLoading] = useState(false);

  async function checkout() {
    if (!items.length) return;
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ sku: i.sku, handle: i.handle, qty: i.qty })),
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Unable to start checkout");
        setLoading(false);
      }
    } catch (e) {
      alert("Checkout failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className={`drawer-overlay ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="drawer-head">
          <h3>Your cart ({count})</h3>
          <button onClick={() => setOpen(false)} aria-label="Close cart">×</button>
        </div>
        <div className="drawer-body">
          {items.length === 0 ? (
            <div className="cart-empty">
              <p>Your cart is empty.</p>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Continue shopping</button>
            </div>
          ) : (
            items.map((i) => (
              <div className="cart-line" key={i.key}>
                <img src={i.image} alt={i.title} />
                <div className="info">
                  <div className="nm">{i.title}</div>
                  {i.variant && <div className="var">{i.variant}</div>}
                  <div className="var">{money(i.price)}</div>
                  <div className="qty" style={{ marginTop: 8, transform: "scale(.85)", transformOrigin: "left" }}>
                    <button onClick={() => setQty(i.key, i.qty - 1)}>−</button>
                    <span>{i.qty}</span>
                    <button onClick={() => setQty(i.key, i.qty + 1)}>+</button>
                  </div>
                  <button className="rm" onClick={() => remove(i.key)}>Remove</button>
                </div>
                <div style={{ fontWeight: 800 }}>{money(i.price * i.qty)}</div>
              </div>
            ))
          )}
        </div>
        {items.length > 0 && (
          <div className="drawer-foot">
            <div className="subtotal">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
              Shipping & taxes calculated at checkout.
            </p>
            <button className="btn btn-primary btn-block" onClick={checkout} disabled={loading}>
              {loading ? "Redirecting…" : "Checkout"}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
