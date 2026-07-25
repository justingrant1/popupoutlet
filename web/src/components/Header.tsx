"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";
import { CATEGORIES } from "@/lib/catalog";

export default function Header() {
  const { count, setOpen } = useCart();
  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="logo">
          Popup<span>Outlet</span>
        </Link>

        <nav className="nav">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={c.slug === "all" ? "/" : `/collections/${c.slug}`}
              className={c.sale ? "sale" : ""}
            >
              {c.label}
            </Link>
          ))}
        </nav>
        <button className="cart-btn" onClick={() => setOpen(true)}>
          Cart <span className="badge">{count}</span>
        </button>
      </div>
    </header>
  );
}
