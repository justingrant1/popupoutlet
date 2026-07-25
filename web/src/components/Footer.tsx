export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="logo" style={{ marginBottom: 10 }}>
              Popup<span style={{ color: "var(--accent)" }}>Outlet</span>
            </div>

            <p style={{ maxWidth: 320 }}>
              Premium pop-up power outlets for kitchens, islands, offices and workspaces.
              Flush-mount design, fast USB-C charging, wireless Qi and UL-approved builds.
            </p>
          </div>
          <div>
            <h4>Shop</h4>
            <a href="/collections/gas-strut">Gas-Strut Lift</a>
            <a href="/collections/motorized">Motorized</a>
            <a href="/collections/hubbell">Hubbell</a>
            <a href="/collections/accessories">Accessories</a>
          </div>
          <div>
            <h4>Support</h4>
            <a href="/shipping">Shipping</a>
            <a href="/returns">Returns &amp; refunds</a>
            <a href="/contact">Contact</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="/privacy">Privacy policy</a>
            <a href="/contact">Contact us</a>
          </div>

        </div>
        <p style={{ marginTop: 30, fontSize: 12 }}>
          © {new Date().getFullYear()} PopupOutlet (demo store). Prices in USD.

        </p>
      </div>
    </footer>
  );
}
