import Link from "next/link";

export default function CancelPage() {
  return (
    <section className="section">
      <div className="container center" style={{ maxWidth: 560 }}>
        <h1>Checkout canceled</h1>
        <p className="muted">
          No worries — your cart has been saved. You can pick up right where you left off.
        </p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 16 }}>
          Return to store
        </Link>
      </div>
    </section>
  );
}
