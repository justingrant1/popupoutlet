import {
  allProducts,
  categoryOf,
  compareAtPrice,
  imgPath,
  type RawProduct,
  type Variant,
} from "@/lib/catalog";
import { SITE_URL, BRAND_FALLBACK } from "@/lib/seo";

/**
 * Google Merchant Center product feed (RSS 2.0).
 * Submit this URL in Merchant Center → Products → Feeds → Scheduled fetch:
 *   https://popupoutlet.com/feed.xml
 *
 * One <item> per variant, grouped by item_group_id so color variants
 * (Black / Silver) surface as a single product family.
 */

export const dynamic = "force-static";
export const revalidate = 86400; // refresh daily

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function abs(rel: string): string {
  if (/^https?:\/\//i.test(rel)) return rel;
  return SITE_URL + imgPath(rel);
}

// Google product category: Home & Garden > Household Appliance Accessories > Power Strips / outlets
const GOOGLE_CATEGORY = "Hardware > Building Materials > Electrical > Electrical Outlets & Receptacles";

function itemXml(p: RawProduct, v: Variant): string {
  const link = `${SITE_URL}/products/${p.handle}`;
  const price = parseFloat(v.price) || p.price_min;
  const was = compareAtPrice(p); // original price when on sale, else null

  const images = (v.images?.length ? v.images : [v.primary_image]).filter(Boolean);
  const mainImage = abs(images[0] || v.primary_image);
  const extraImages = images.slice(1, 11).map(abs);

  const desc =
    p.seo?.meta_description || stripHtml(p.description_html).slice(0, 4000) || p.title;
  const brand = p.vendor || BRAND_FALLBACK;
  const productType = categoryOf(p).join(" > ");

  const parts: string[] = [
    `<item>`,
    `<g:id>${esc(v.sku || `${p.handle}-${v.color}`)}</g:id>`,
    `<g:item_group_id>${esc(p.handle)}</g:item_group_id>`,
    `<title>${esc(p.title)}${v.color ? " - " + esc(v.color) : ""}</title>`,
    `<description>${esc(desc)}</description>`,
    `<link>${esc(link)}</link>`,
    `<g:image_link>${esc(mainImage)}</g:image_link>`,
    ...extraImages.map((im) => `<g:additional_image_link>${esc(im)}</g:additional_image_link>`),
    `<g:availability>${v.available ? "in_stock" : "out_of_stock"}</g:availability>`,
    `<g:condition>new</g:condition>`,
    `<g:price>${price.toFixed(2)} ${p.currency || "USD"}</g:price>`,
  ];

  // On-sale products: current price is the sale price, `was` is the original.
  if (was && was > price) {
    parts.push(`<g:sale_price>${price.toFixed(2)} ${p.currency || "USD"}</g:sale_price>`);
    // Override the base price with the original so Google shows a strikethrough.
    parts[parts.length - 2] = `<g:price>${was.toFixed(2)} ${p.currency || "USD"}</g:price>`;
  }

  parts.push(
    `<g:brand>${esc(brand)}</g:brand>`,
    `<g:mpn>${esc(v.sku || p.handle)}</g:mpn>`,
    // No UPC/EAN/GTIN on these custom-brand goods → tell Google identifiers don't exist.
    `<g:identifier_exists>false</g:identifier_exists>`,
    `<g:google_product_category>${esc(GOOGLE_CATEGORY)}</g:google_product_category>`,
    `<g:product_type>${esc(productType)}</g:product_type>`,
  );

  if (v.color) parts.push(`<g:color>${esc(v.color)}</g:color>`);

  parts.push(`</item>`);
  return parts.join("");
}

export function GET() {
  const products = allProducts();

  const items = products
    .flatMap((p) => p.variants.map((v) => itemXml(p, v)))
    .join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `<channel>\n` +
    `<title>PopupOutlet</title>\n` +
    `<link>${SITE_URL}</link>\n` +
    `<description>Premium flush-mount pop-up power outlets with USB-C, wireless charging and LED light.</description>\n` +
    items +
    `\n</channel>\n</rss>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
