import { supabasePublic, type Review } from "@/lib/supabase";

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return <span className="stars">{"★".repeat(full)}{"☆".repeat(5 - full)}</span>;
}

async function loadReviews(handle: string): Promise<Review[]> {
  try {
    const sb = supabasePublic();
    const { data, error } = await sb
      .from("reviews")
      .select("*")
      .eq("product_handle", handle)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return [];
    return (data as Review[]) || [];
  } catch {
    return [];
  }
}

export default async function Reviews({ handle }: { handle: string }) {
  const reviews = await loadReviews(handle);
  if (!reviews.length) {
    return (
      <div className="container reviews">
        <h2>Reviews</h2>
        <p className="muted">
          No reviews loaded yet. Run <code>npm run seed:reviews</code> after creating the Supabase
          <code> reviews</code> table.
        </p>
      </div>
    );
  }

  const avg = reviews.reduce((n, r) => n + r.rating, 0) / reviews.length;

  return (
    <div className="container reviews">
      <h2>Customer reviews</h2>
      <div className="review-summary">
        <div className="big">{avg.toFixed(1)}</div>
        <div>
          <Stars rating={avg} />
          <div className="muted">{reviews.length} reviews</div>
        </div>
      </div>
      {reviews.map((r) => (
        <div className="review" key={r.id}>
          <div className="top">
            <span className="author">{r.author}</span>
            {r.verified && <span className="verified">✓ Verified buyer</span>}
          </div>
          <Stars rating={r.rating} />
          <div className="rtitle">{r.title}</div>
          <div className="rbody">{r.body}</div>
          {r.created_at && (
            <div className="date">{new Date(r.created_at).toLocaleDateString()}</div>
          )}
        </div>
      ))}
    </div>
  );
}
