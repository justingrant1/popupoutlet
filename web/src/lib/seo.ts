/**
 * Central SEO configuration.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://popupoutlet.com).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://popupoutlet.com"
).replace(/\/+$/, "");

/** Business/brand details used across SEO, structured data and the Merchant feed. */
export const BRAND_FALLBACK = "PopupOutlet";
export const SUPPORT_EMAIL = "support@popupoutlet.com";


export const SITE_NAME = "PopupOutlet";

export const SITE_DESCRIPTION =
  "Premium flush-mount pop-up power outlets with 65W USB-C fast charging, wireless Qi and ambient LED light for kitchens, islands, desks and workspaces. UL-approved with free US shipping.";

/** Absolute URL helper for canonicals, sitemaps and structured data. */
export function absUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  return SITE_URL + "/" + path.replace(/^\/+/, "");
}
