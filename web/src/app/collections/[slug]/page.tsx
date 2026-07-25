import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import ProductCard from "@/components/ProductCard";
import JsonLd from "@/components/JsonLd";
import { CATEGORIES, productsInCategory, imgPath } from "@/lib/catalog";
import { absUrl } from "@/lib/seo";

export function generateStaticParams() {
  return CATEGORIES.filter((c) => c.slug !== "all").map((c) => ({ slug: c.slug }));
}

function collectionDescription(label: string, count: number): string {
  return `Shop ${count} ${label.toLowerCase()} pop-up power outlets with USB-C fast charging, wireless Qi and flush-mount designs. UL-approved with free US shipping.`;
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const cat = CATEGORIES.find((c) => c.slug === params.slug);
  if (!cat) return { title: "Collection" };
  const count = productsInCategory(params.slug).length;
  const description = collectionDescription(cat.label, count);
  return {
    title: `${cat.label} Pop-Up Outlets`,
    description,
    alternates: { canonical: `/collections/${cat.slug}` },
    openGraph: {
      type: "website",
      title: `${cat.label} Pop-Up Outlets | PopupOutlet`,
      description,
      url: absUrl(`/collections/${cat.slug}`),
    },
  };
}

export default function CollectionPage({ params }: { params: { slug: string } }) {
  const cat = CATEGORIES.find((c) => c.slug === params.slug);
  if (!cat) notFound();
  const products = productsInCategory(params.slug);

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${cat.label} Pop-Up Outlets`,
    description: collectionDescription(cat.label, products.length),
    url: absUrl(`/collections/${cat.slug}`),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.slice(0, 30).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absUrl(`/products/${p.handle}`),
        name: p.title,
        image: absUrl(imgPath(p.variants[0]?.primary_image || "")),
      })),
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absUrl("/") },
      { "@type": "ListItem", position: 2, name: cat.label, item: absUrl(`/collections/${cat.slug}`) },
    ],
  };

  return (
    <section className="section">
      <JsonLd data={[collectionLd, breadcrumbLd]} />
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">Home</Link> / <span>{cat.label}</span>
        </div>
        <div className="section-head" style={{ marginTop: 12 }}>
          <h1>{cat.label}</h1>
          <span className="muted">{products.length} products</span>
        </div>

        {products.length === 0 ? (
          <p className="muted">No products in this collection yet.</p>
        ) : (
          <div className="grid">
            {products.map((p) => (
              <ProductCard key={p.handle} p={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
