import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import ProductView from "@/components/ProductView";
import Reviews from "@/components/Reviews";
import ProductCard from "@/components/ProductCard";
import JsonLd from "@/components/JsonLd";
import {
  allProducts,
  getProduct,
  specFor,
  compareAtPrice,
  saleDiscountPct,
  ratingFor,
  relatedProducts,
  accessoryProducts,
  imgPath,
} from "@/lib/catalog";
import { absUrl, SITE_NAME } from "@/lib/seo";

export function generateStaticParams() {
  return allProducts().map((p) => ({ handle: p.handle }));
}

function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function generateMetadata({ params }: { params: { handle: string } }): Metadata {
  const p = getProduct(params.handle);
  if (!p) return { title: "Product not found" };

  const desc =
    p.seo?.meta_description ||
    stripHtml(p.description_html).slice(0, 155) ||
    `${p.title} — premium pop-up power outlet from ${SITE_NAME}.`;
  const image = p.variants[0]?.primary_image
    ? absUrl(imgPath(p.variants[0].primary_image))
    : p.seo?.og_image;

  return {
    title: p.seo?.meta_title || p.title,
    description: desc,
    alternates: { canonical: `/products/${p.handle}` },
    openGraph: {
      type: "website",
      title: p.seo?.og_title || p.title,
      description: p.seo?.og_description || desc,
      url: absUrl(`/products/${p.handle}`),
      images: image ? [{ url: image, alt: p.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: p.title,
      description: desc,
      images: image ? [image] : undefined,
    },
  };
}


export default function ProductPage({ params }: { params: { handle: string } }) {
  const product = getProduct(params.handle);
  if (!product) notFound();

  const spec = specFor(product);
  const was = compareAtPrice(product);
  const pct = saleDiscountPct(product);
  const rating = ratingFor(product.handle);

  // pick a bundle: prefer an accessory (hole saw / adapter), else a related product
  const accessories = accessoryProducts().filter((a) => a.handle !== product.handle);
  const bundleSrc = accessories[0] || relatedProducts(product, 1)[0];
  const bundle = bundleSrc
    ? {
        handle: bundleSrc.handle,
        title: bundleSrc.title,
        price: parseFloat(bundleSrc.variants[0]?.price) || bundleSrc.price_min,
        image: imgPath(bundleSrc.variants[0]?.primary_image || ""),
        sku: bundleSrc.variants[0]?.sku || bundleSrc.handle,
        variant: bundleSrc.variants[0]?.color || "",
      }
    : null;

  const related = relatedProducts(product, 4).filter((r) => r.handle !== bundleSrc?.handle);

  // ---- Structured data (Product + Breadcrumb) for rich results ----
  const images = (product.variants[0]?.images?.length
    ? product.variants[0].images
    : [product.variants[0]?.primary_image]
  )
    .filter(Boolean)
    .map((im) => absUrl(imgPath(im)));

  const inStock = product.variants.some((v) => v.available);
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: stripHtml(product.description_html).slice(0, 500),
    image: images,
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: product.vendor || SITE_NAME },
    category: product.product_type,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: rating.rating,
      reviewCount: rating.count,
      bestRating: 5,
      worstRating: 1,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: product.currency || "USD",
      price: product.price_min.toFixed(2),
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/BackOrder",
      url: absUrl(`/products/${product.handle}`),
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absUrl("/") },
      {
        "@type": "ListItem",
        position: 2,
        name: product.product_type,
        item: absUrl("/collections/all"),
      },
      { "@type": "ListItem", position: 3, name: product.title, item: absUrl(`/products/${product.handle}`) },
    ],
  };

  return (
    <>
      <JsonLd data={[productLd, breadcrumbLd]} />
      <ProductView

        product={product}
        spec={spec}
        was={was}
        pct={pct}
        rating={rating}
        bundle={bundle}
      />

      <Suspense fallback={<div className="container reviews"><p className="muted">Loading reviews…</p></div>}>
        <Reviews handle={product.handle} />
      </Suspense>


      {related.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <h2>You might also like</h2>
            </div>
            <div className="grid">
              {related.map((p) => (
                <ProductCard key={p.handle} p={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
