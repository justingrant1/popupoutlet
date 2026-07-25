import type { Metadata } from "next";
import ProductCard from "@/components/ProductCard";
import JsonLd from "@/components/JsonLd";
import { allProducts, productsInCategory, imgPath } from "@/lib/catalog";
import { absUrl } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const products = allProducts();
  const bestSellers = productsInCategory("gas-strut").slice(0, 4);

  // ItemList structured data helps Google understand the storefront catalog.
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Pop-Up Power Outlets",
    itemListElement: products.slice(0, 30).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absUrl(`/products/${p.handle}`),
      name: p.title,
      image: absUrl(imgPath(p.variants[0]?.primary_image || "")),
    })),
  };


  return (
    <>
      <JsonLd data={itemListLd} />
      <section className="hero">

        <div className="container center">
          <span className="pill">UL-Approved • Free US Shipping</span>
          <h1>Power that rises to the occasion.</h1>
          <p>
            Premium flush-mount pop-up outlets with 65W USB-C fast charging, wireless Qi and
            ambient LED light — hidden until you need them.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <a href="#catalog" className="btn btn-primary">Shop all outlets</a>
            <a href="/collections/sale" className="btn btn-ghost">View sale</a>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="trust">
          <div className="item"><b>65W USB-C</b><span>Laptop-class charging</span></div>
          <div className="item"><b>Wireless Qi</b><span>Drop-and-charge pad</span></div>
          <div className="item"><b>Flush mount</b><span>Disappears when closed</span></div>
          <div className="item"><b>UL approved</b><span>Certified & safe</span></div>
        </div>
      </div>

      {bestSellers.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <h2>Best sellers</h2>
              <a href="#catalog" className="muted">View all →</a>
            </div>
            <div className="grid">
              {bestSellers.map((p) => (
                <ProductCard key={p.handle} p={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section" id="catalog">
        <div className="container">
          <div className="section-head">
            <h2>All products</h2>
            <span className="muted">{products.length} products</span>
          </div>
          <div className="grid">
            {products.map((p) => (
              <ProductCard key={p.handle} p={p} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
