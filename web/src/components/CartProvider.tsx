"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

export type CartItem = {
  key: string; // handle::sku
  handle: string;
  sku: string;
  title: string;
  variant: string; // e.g. color
  price: number;
  image: string;
  qty: number;
};

type CartState = {
  items: CartItem[];
  open: boolean;
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "key" | "qty">, qty?: number) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  setOpen: (o: boolean) => void;
};

const CartCtx = createContext<CartState | null>(null);
const STORAGE_KEY = "mps_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const add = useCallback((item: Omit<CartItem, "key" | "qty">, qty = 1) => {
    const key = `${item.handle}::${item.sku}`;
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, qty: i.qty + qty } : i));
      }
      return [...prev, { ...item, key, qty }];
    });
    setOpen(true);
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setItems((prev) =>
      prev.flatMap((i) => (i.key === key ? (qty <= 0 ? [] : [{ ...i, qty }]) : [i]))
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((n, i) => n + i.qty, 0);
  const subtotal = items.reduce((n, i) => n + i.qty * i.price, 0);

  const value = useMemo<CartState>(
    () => ({ items, open, count, subtotal, add, remove, setQty, clear, setOpen }),
    [items, open, count, subtotal, add, remove, setQty, clear]
  );

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
