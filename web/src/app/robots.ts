import type { MetadataRoute } from "next";
import { absUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep transactional / non-indexable routes out of the index
        disallow: ["/api/", "/checkout/"],
      },
    ],
    sitemap: absUrl("/sitemap.xml"),
    host: absUrl("/"),
  };
}
