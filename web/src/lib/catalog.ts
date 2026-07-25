import catalogJson from "@/data/catalog.json";
import specsJson from "@/data/specs.json";


export type Variant = {
  color: string;
  sku: string;
  price: string;
  available: boolean;
  image_folder: string;
  primary_image: string;
  images: string[];
  source_handle: string;
};

export type RawProduct = {
  handle: string;
  title: string;
  vendor: string;
  product_type: string;
  region: string;
  tags: string[];
  currency: string;
  price_min: number;
  price_max: number;
  description_html: string;
  seo: {
    meta_title?: string;
    meta_description?: string;
    og_title?: string;
    og_description?: string;
    og_image?: string;
  };
  collections: string[];
  videos: string[];
  options: { name: string; values: string[] }[];
  variants: Variant[];
  key_features: string[];
};

export type Spec = {
  amperage?: string;
  hole_size_mm?: string;
  lift_type?: string;
  usb_a?: boolean;
  usb_c?: boolean;
  wireless_charging?: boolean;
  hdmi?: boolean;
  rj45?: boolean;
  light?: boolean;
  spill_sealed?: boolean;
};

export type Category = {
  slug: string;
  label: string;
  sale?: boolean;
};

// Catalog-accurate navigation
export const CATEGORIES: Category[] = [
  { slug: "all", label: "All products" },
  { slug: "gas-strut", label: "Gas-Strut Lift" },
  { slug: "motorized", label: "Motorized" },
  { slug: "hubbell", label: "Hubbell" },
  { slug: "point-pod", label: "Point Pod" },
  { slug: "accessories", label: "Accessories" },
  { slug: "sale", label: "Sale", sale: true },
];

/** Remove leading model-code prefixes like "V16: ", "V3C: ", "V15 - " from titles. */
export function cleanTitle(title: string): string {
  return title
    .replace(/^\s*V\d+[A-Za-z]?\s*[:\-–—]\s*/i, "")
    .trim();
}

const products = (catalogJson as unknown as RawProduct[]).map((p) => ({
  ...p,
  title: cleanTitle(p.title),
}));


/* -------- specs (prebuilt JSON) -------- */
const SPECS = specsJson as unknown as Record<string, Spec>;


/* -------- category classification -------- */
export function categoryOf(p: RawProduct): string[] {
  const cats: string[] = [];
  const tags = p.tags.map((t) => t.toLowerCase());
  const title = p.title.toLowerCase();
  const type = p.product_type.toLowerCase();

  if (tags.some((t) => t.includes("gas-strut") || t.includes("gas strut"))) cats.push("gas-strut");
  if (tags.some((t) => t.includes("motoris") || t.includes("motoriz"))) cats.push("motorized");
  if (title.includes("hubbell")) cats.push("hubbell");
  if (title.includes("point pod") || title.includes("hole saw") || tags.some((t) => t.includes("point pod")))
    cats.push("point-pod");
  if (
    type.includes("accessor") ||
    title.includes("hole saw") ||
    title.includes("adapter") ||
    title.includes("gpo") ||
    title.includes("blanking")
  )
    cats.push("accessories");

  if (cats.length === 0) cats.push("gas-strut"); // default bucket for outlets
  return Array.from(new Set(cats));
}

export function isOnSale(p: RawProduct): boolean {
  return p.collections.some((c) => /(\d+)PCOFF/i.test(c) || /sale/i.test(c));
}

export function saleDiscountPct(p: RawProduct): number {
  let pct = 0;
  for (const c of p.collections) {
    const m = c.match(/(\d+)PCOFF/i);
    if (m) pct = Math.max(pct, parseInt(m[1], 10));
  }
  return pct;
}

export function compareAtPrice(p: RawProduct): number | null {
  const pct = saleDiscountPct(p);
  if (!pct) return null;
  // current price is the sale price; compute original
  return Math.round((p.price_min / (1 - pct / 100)) * 100) / 100;
}

/* -------- deterministic pseudo-rating (until real reviews) -------- */
export function ratingFor(handle: string): { rating: number; count: number } {
  let h = 0;
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) >>> 0;
  const rating = 4.6 + (h % 4) / 10; // 4.6 - 4.9
  const count = 80 + (h % 800);
  return { rating: Math.round(rating * 10) / 10, count };
}

/* -------- public API -------- */
export function allProducts(): RawProduct[] {
  return products;
}

export function getProduct(handle: string): RawProduct | undefined {
  return products.find((p) => p.handle === handle);
}

export function specFor(p: RawProduct): Spec | undefined {
  for (const v of p.variants) {
    if (SPECS[v.source_handle]) return SPECS[v.source_handle];
  }
  return SPECS[p.handle];
}

export function productsInCategory(slug: string): RawProduct[] {
  if (slug === "all") return products;
  if (slug === "sale") return products.filter(isOnSale);
  return products.filter((p) => categoryOf(p).includes(slug));
}

export function relatedProducts(p: RawProduct, n = 4): RawProduct[] {
  const cats = categoryOf(p);
  const scored = products
    .filter((x) => x.handle !== p.handle)
    .map((x) => {
      const xc = categoryOf(x);
      const overlap = xc.filter((c) => cats.includes(c)).length;
      return { x, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap);
  return scored.slice(0, n).map((s) => s.x);
}

export function accessoryProducts(): RawProduct[] {
  return products.filter((p) => categoryOf(p).includes("accessories") || categoryOf(p).includes("point-pod"));
}

/* -------- server-side price resolution for checkout -------- */
export type ResolvedItem = {
  handle: string;
  sku: string;
  title: string;
  variant: string;
  price: number;
  image: string;
};

export function priceLookup(sku: string): ResolvedItem | null {
  for (const p of products) {
    const v = p.variants.find((vr) => vr.sku === sku);
    if (v) {
      return {
        handle: p.handle,
        sku: v.sku,
        title: p.title,
        variant: v.color || "",
        price: parseFloat(v.price) || p.price_min,
        image: imgPath(v.primary_image || ""),
      };
    }
  }
  return null;
}

export function money(n: number): string {

  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function imgPath(rel: string): string {
  // stored as "images/..."; served from /public
  return "/" + rel.replace(/^\/+/, "");
}
