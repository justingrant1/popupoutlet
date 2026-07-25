"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "./CartProvider";
import type { RawProduct, Spec, Variant } from "@/lib/catalog";

type Props = {
  product: RawProduct;
  spec?: Spec;
  was: number | null;
  pct: number;
  rating: { rating: number; count: number };
  bundle: { handle: string; title: string; price: number; image: string; sku: string; variant: string } | null;
};

function imgPath(rel: string) {
  return "/" + (rel || "").replace(/^\/+/, "");
}
function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function yn(v?: boolean) {
  return v ? "Yes" : "—";
}

export default function ProductView({ product, spec, was, pct, rating, bundle }: Props) {
  const { add, setOpen } = useCart();
  const [variantIdx, setVariantIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [addBundle, setAddBundle] = useState(false);

  const variant: Variant = product.variants[variantIdx];
  const images = variant.images?.length ? variant.images : [variant.primary_image];
  const price = parseFloat(variant.price) || product.price_min;

  const colorOption = product.options.find((o) => /colou?r/i.test(o.name));

  function selectVariant(color: string) {
    const idx = product.variants.findIndex((v) => v.color === color);
    if (idx >= 0) {
      setVariantIdx(idx);
      setImgIdx(0);
    }
  }

  function addToCart() {
    add(
      {
        handle: product.handle,
        sku: variant.sku,
        title: product.title,
        variant: variant.color || "",
        price,
        image: imgPath(variant.primary_image),
      },
      qty
    );
    if (addBundle && bundle) {
      add({
        handle: bundle.handle,
        sku: bundle.sku,
        title: bundle.title,
        variant: bundle.variant,
        price: bundle.price,
        image: bundle.image,
      });
    }
  }

  const bundleTotal = price + (bundle ? bundle.price : 0);

  const specRows = useMemo(() => {
    if (!spec) return [];
    const rows: [string, string][] = [];
    if (spec.amperage) rows.push(["Amperage", `${spec.amperage} A`]);
    if (spec.hole_size_mm) rows.push(["Cutout hole size", `${spec.hole_size_mm} mm`]);
    if (spec.lift_type) rows.push(["Lift mechanism", spec.lift_type.replace(/-/g, " ")]);
    rows.push(["USB-A", yn(spec.usb_a)]);
    rows.push(["USB-C", yn(spec.usb_c)]);
    rows.push(["Wireless charging", yn(spec.wireless_charging)]);
    if (spec.hdmi) rows.push(["HDMI", yn(spec.hdmi)]);
    if (spec.rj45) rows.push(["Ethernet (RJ45)", yn(spec.rj45)]);
    rows.push(["Integrated light", yn(spec.light)]);
    if (spec.spill_sealed) rows.push(["Spill-sealed", yn(spec.spill_sealed)]);
    return rows;
  }, [spec]);

  return (
    <>
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">Home</Link> / <span>{product.product_type}</span> / <span>{product.title}</span>
        </div>
      </div>

      <div className="container pdp">
        {/* gallery */}
        <div className="gallery">
          <div className="main">
            <img src={imgPath(images[imgIdx] || variant.primary_image)} alt={product.title} />
          </div>
          {images.length > 1 && (
            <div className="thumbs">
              {images.slice(0, 12).map((im, i) => (
                <button
                  key={im + i}
                  className={i === imgIdx ? "active" : ""}
                  onClick={() => setImgIdx(i)}
                  aria-label={`Image ${i + 1}`}
                >
                  <img src={imgPath(im)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* buy box */}
        <div>
          <div className="type" style={{ textTransform: "uppercase", letterSpacing: ".06em", fontSize: 12, color: "var(--ink-soft)", fontWeight: 700 }}>
            {product.vendor}
          </div>
          <h1>{product.title}</h1>
          <div className="rating">
            <span className="stars">{"★".repeat(Math.round(rating.rating))}{"☆".repeat(5 - Math.round(rating.rating))}</span>{" "}
            {rating.rating} · {rating.count} reviews
          </div>

          <div className="price-row">
            <span className="price-now">{money(price)}</span>
            {was && <span className="price-was">{money(was)}</span>}
            {pct > 0 && <span className="save">Save {pct}%</span>}
          </div>

          {colorOption && colorOption.values.length > 1 && (
            <div className="opt-group">
              <div className="label">Color: {variant.color}</div>
              <div className="opt-values">
                {colorOption.values.map((c) => (
                  <button
                    key={c}
                    className={variant.color === c ? "active" : ""}
                    onClick={() => selectVariant(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="opt-group">
            <div className="label">Quantity</div>
            <div className="qty">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)}>+</button>
            </div>
          </div>

          {bundle && (
            <div className="bundle">
              <h3>Frequently bought together</h3>
              <label className="bundle-row" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={addBundle}
                  onChange={(e) => setAddBundle(e.target.checked)}
                />
                <img src={bundle.image} alt={bundle.title} />
                <span className="nm">
                  Add {bundle.title}
                  {bundle.variant ? ` (${bundle.variant})` : ""}
                </span>
                <span>{money(bundle.price)}</span>
              </label>
              <div className="bundle-total">
                <span>Bundle total</span>
                <span>{money(addBundle ? bundleTotal : price)}</span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button className="btn btn-primary btn-block" onClick={addToCart}>
              Add to cart · {money(addBundle && bundle ? bundleTotal * 1 : price * qty)}
            </button>
          </div>

          {!variant.available && <div className="notice">This variant is currently made to order.</div>}

          {product.key_features?.length > 0 && (
            <ul className="features">
              {product.key_features.slice(0, 8).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}

          {specRows.length > 0 && (
            <>
              <h3 style={{ marginTop: 26, fontSize: 16 }}>Specifications</h3>
              <table className="specs">
                <tbody>
                  {specRows.map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* description */}
      <div className="container">
        <div className="desc" dangerouslySetInnerHTML={{ __html: product.description_html }} />
      </div>

      {/* sticky ATC (mobile) */}
      <div className="sticky-atc">
        <span className="p">{money(price * qty)}</span>
        <button className="btn btn-primary btn-block" onClick={addToCart}>
          Add to cart
        </button>
      </div>
    </>
  );
}
