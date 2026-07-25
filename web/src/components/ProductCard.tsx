import Link from "next/link";
import { RawProduct, money, imgPath, ratingFor, isOnSale, compareAtPrice, saleDiscountPct } from "@/lib/catalog";

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return <span className="stars">{"★".repeat(full)}{"☆".repeat(5 - full)}</span>;
}

export default function ProductCard({ p }: { p: RawProduct }) {
  const r = ratingFor(p.handle);
  const sale = isOnSale(p);
  const was = compareAtPrice(p);
  const pct = saleDiscountPct(p);
  const swatches = p.variants.map((v) => v.color).filter(Boolean);

  return (
    <Link href={`/products/${p.handle}`} className="card">
      <div className="thumb">
        {sale && pct > 0 && <span className="tag-sale">−{pct}%</span>}
        <img src={imgPath(p.variants[0]?.primary_image || "")} alt={p.title} loading="lazy" />
      </div>
      <div className="body">
        <div className="type">{p.product_type}</div>
        <div className="name">{p.title}</div>
        <div className="rating">
          <Stars rating={r.rating} /> {r.rating} ({r.count})
        </div>
        {swatches.length > 1 && (
          <div className="swatches">
            {swatches.map((c) => (
              <span
                key={c}
                className="swatch"
                title={c}
                style={{ background: colorHex(c) }}
              />
            ))}
          </div>
        )}
        <div className="price">
          {money(p.price_min)}
          {was && <span className="was">{money(was)}</span>}
        </div>
      </div>
    </Link>
  );
}

function colorHex(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("black")) return "#1a1a1a";
  if (n.includes("silver")) return "#c8ccd1";
  if (n.includes("white")) return "#f4f4f4";
  if (n.includes("gold")) return "#c9a227";
  if (n.includes("grey") || n.includes("gray")) return "#8a8f98";
  return "#999";
}
