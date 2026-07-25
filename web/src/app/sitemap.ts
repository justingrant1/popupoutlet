import type { MetadataRoute } from "next";
import { allProducts, CATEGORIES } from "@/lib/catalog";
import { absUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absUrl("/shipping"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absUrl("/returns"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absUrl("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absUrl("/contact"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];


  const collectionEntries: MetadataRoute.Sitemap = CATEGORIES.filter(
    (c) => c.slug !== "all"
  ).map((c) => ({
    url: absUrl(`/collections/${c.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productEntries: MetadataRoute.Sitemap = allProducts().map((p) => ({
    url: absUrl(`/products/${p.handle}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...collectionEntries, ...productEntries];
}
