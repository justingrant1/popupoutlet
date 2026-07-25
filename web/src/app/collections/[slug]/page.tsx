import { notFound } from "next/navigation";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { CATEGORIES, productsInCategory } from "@/lib/catalog";

export function generateStaticParams() {
  return CATEGORIES.filter((c) => c.slug !== "all").map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const cat = CATEGORIES.find((c) => c.slug === params.slug);
  return { title: cat ? `${cat.label} — PopupOutlet` : "Collection" };

}

export default function CollectionPage({ params }: { params: { slug: string } }) {
  const cat = CATEGORIES.find((c) => c.slug === params.slug);
  if (!cat) notFound();
  const products = productsInCategory(params.slug);

  return (
    <section className="section">
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">Home</Link> / <span>{cat.label}</span>
        </div>
        <div className="section-head" style={{ marginTop: 12 }}>
          <h2>{cat.label}</h2>
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
