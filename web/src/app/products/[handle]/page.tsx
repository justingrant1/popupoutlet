import { notFound } from "next/navigation";
import { Suspense } from "react";
import ProductView from "@/components/ProductView";
import Reviews from "@/components/Reviews";
import ProductCard from "@/components/ProductCard";
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

export function generateStaticParams() {
  return allProducts().map((p) => ({ handle: p.handle }));
}

export function generateMetadata({ params }: { params: { handle: string } }) {
  const p = getProduct(params.handle);
  if (!p) return { title: "Product" };
  return {
    title: `${p.title} — PopupOutlet`,
    description: p.seo?.meta_description,
    openGraph: {
      title: p.title,

      description: p.seo?.og_description,
      images: p.seo?.og_image ? [p.seo.og_image] : undefined,
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

  return (
    <>
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
