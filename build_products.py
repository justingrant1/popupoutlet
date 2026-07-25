#!/usr/bin/env python3
"""
Fetch all products from the Modern Power Solutions Shopify store and export them
to clean local files:

  data/products_raw.json  - raw Shopify products.json response(s)
  data/products.json      - cleaned, structured product data
  data/products.csv       - one row per product (summary)
  data/variants.csv       - one row per variant (flattened options)

Usage:
  python build_products.py
"""

import csv
import html
import json
import os
import re
import time
import urllib.request
import urllib.error

BASE_URL = "https://modernpower.solutions"
PRODUCTS_ENDPOINT = BASE_URL + "/products.json"
DATA_DIR = "data"
RAW_PATH = os.path.join(DATA_DIR, "products_raw.json")
JSON_PATH = os.path.join(DATA_DIR, "products.json")
PRODUCTS_CSV_PATH = os.path.join(DATA_DIR, "products.csv")
VARIANTS_CSV_PATH = os.path.join(DATA_DIR, "variants.csv")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"[ \t\r\f\v]+")
MULTI_NL_RE = re.compile(r"\n{3,}")


def fetch_url(url, max_retries=5):
    """Fetch a URL with a browser-like UA, retrying on rate limits/errors."""
    last_err = None
    for attempt in range(1, max_retries + 1):
        req = urllib.request.Request(url, headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
        })
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8", errors="replace")
            stripped = body.strip()
            # Shopify throttling returns a plain text sentinel, not JSON.
            if stripped == "" or not stripped.startswith("{"):
                raise ValueError("Non-JSON response (likely rate limited): %r"
                                 % stripped[:60])
            return body
        except (urllib.error.HTTPError, urllib.error.URLError, ValueError) as e:
            last_err = e
            wait = attempt * 5
            print("  attempt %d/%d failed (%s); retrying in %ds..."
                  % (attempt, max_retries, e, wait))
            time.sleep(wait)
    raise RuntimeError("Failed to fetch %s: %s" % (url, last_err))


def fetch_all_products():
    """Page through the products.json endpoint until no more products."""
    all_products = []
    page = 1
    while True:
        url = "%s?limit=250&page=%d" % (PRODUCTS_ENDPOINT, page)
        print("Fetching page %d ..." % page)
        body = fetch_url(url)
        data = json.loads(body)
        products = data.get("products", [])
        if not products:
            break
        all_products.extend(products)
        print("  got %d products (running total: %d)"
              % (len(products), len(all_products)))
        if len(products) < 250:
            break
        page += 1
        time.sleep(2)  # be polite between pages
    return all_products


def html_to_text(raw_html):
    if not raw_html:
        return ""
    text = raw_html
    text = re.sub(r"(?i)<\s*br\s*/?\s*>", "\n", text)
    text = re.sub(r"(?i)</\s*(p|div|li|tr|h[1-6])\s*>", "\n", text)
    text = re.sub(r"(?i)<\s*li[^>]*>", "- ", text)
    text = TAG_RE.sub("", text)
    text = html.unescape(text)
    text = WS_RE.sub(" ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    text = MULTI_NL_RE.sub("\n\n", text)
    return text.strip()


def clean_product(p):
    handle = p.get("handle", "")
    variants = []
    prices = []
    for v in p.get("variants", []):
        price = v.get("price")
        try:
            if price is not None:
                prices.append(float(price))
        except (TypeError, ValueError):
            pass
        variants.append({
            "id": v.get("id"),
            "title": v.get("title"),
            "sku": v.get("sku"),
            "price": price,
            "compare_at_price": v.get("compare_at_price"),
            "available": v.get("available"),
            "option1": v.get("option1"),
            "option2": v.get("option2"),
            "option3": v.get("option3"),
            "grams": v.get("grams"),
            "weight": v.get("weight"),
            "weight_unit": v.get("weight_unit"),
            "barcode": v.get("barcode"),
            "requires_shipping": v.get("requires_shipping"),
            "taxable": v.get("taxable"),
        })

    images = [img.get("src") for img in p.get("images", []) if img.get("src")]
    options = [{"name": o.get("name"), "values": o.get("values", [])}
               for o in p.get("options", [])]

    return {
        "id": p.get("id"),
        "title": p.get("title"),
        "handle": handle,
        "url": "%s/products/%s" % (BASE_URL, handle) if handle else "",
        "vendor": p.get("vendor"),
        "product_type": p.get("product_type"),
        "tags": p.get("tags", []),
        "published_at": p.get("published_at"),
        "created_at": p.get("created_at"),
        "updated_at": p.get("updated_at"),
        "description_html": p.get("body_html") or "",
        "description_text": html_to_text(p.get("body_html")),
        "options": options,
        "images": images,
        "price_min": min(prices) if prices else None,
        "price_max": max(prices) if prices else None,
        "variant_count": len(variants),
        "variants": variants,
    }


def write_products_csv(products, path):
    fields = [
        "id", "title", "handle", "url", "vendor", "product_type",
        "tags", "price_min", "price_max", "variant_count",
        "main_image", "image_count", "description_text",
    ]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for p in products:
            w.writerow({
                "id": p["id"],
                "title": p["title"],
                "handle": p["handle"],
                "url": p["url"],
                "vendor": p["vendor"],
                "product_type": p["product_type"],
                "tags": ", ".join(p["tags"]),
                "price_min": p["price_min"],
                "price_max": p["price_max"],
                "variant_count": p["variant_count"],
                "main_image": p["images"][0] if p["images"] else "",
                "image_count": len(p["images"]),
                "description_text": p["description_text"],
            })


def write_variants_csv(products, path):
    # Map option position -> option name per product for readable headers.
    fields = [
        "product_id", "product_title", "product_handle", "product_url",
        "vendor", "product_type",
        "variant_id", "variant_title", "sku", "price", "compare_at_price",
        "available",
        "option1_name", "option1_value",
        "option2_name", "option2_value",
        "option3_name", "option3_value",
        "grams", "weight", "weight_unit", "barcode",
    ]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for p in products:
            opt_names = [o["name"] for o in p["options"]]

            def opt_name(idx):
                return opt_names[idx] if idx < len(opt_names) else ""

            for v in p["variants"]:
                w.writerow({
                    "product_id": p["id"],
                    "product_title": p["title"],
                    "product_handle": p["handle"],
                    "product_url": p["url"],
                    "vendor": p["vendor"],
                    "product_type": p["product_type"],
                    "variant_id": v["id"],
                    "variant_title": v["title"],
                    "sku": v["sku"],
                    "price": v["price"],
                    "compare_at_price": v["compare_at_price"],
                    "available": v["available"],
                    "option1_name": opt_name(0),
                    "option1_value": v["option1"],
                    "option2_name": opt_name(1),
                    "option2_value": v["option2"],
                    "option3_name": opt_name(2),
                    "option3_value": v["option3"],
                    "grams": v["grams"],
                    "weight": v["weight"],
                    "weight_unit": v["weight_unit"],
                    "barcode": v["barcode"],
                })


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    raw_products = fetch_all_products()

    with open(RAW_PATH, "w", encoding="utf-8") as f:
        json.dump({"products": raw_products}, f, ensure_ascii=False, indent=2)
    print("Saved raw data -> %s" % RAW_PATH)

    cleaned = [clean_product(p) for p in raw_products]

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(cleaned, f, ensure_ascii=False, indent=2)
    print("Saved cleaned JSON -> %s" % JSON_PATH)

    write_products_csv(cleaned, PRODUCTS_CSV_PATH)
    print("Saved products CSV -> %s" % PRODUCTS_CSV_PATH)

    write_variants_csv(cleaned, VARIANTS_CSV_PATH)
    print("Saved variants CSV -> %s" % VARIANTS_CSV_PATH)

    total_variants = sum(p["variant_count"] for p in cleaned)
    print("\n=== SUMMARY ===")
    print("Products: %d" % len(cleaned))
    print("Variants: %d" % total_variants)
    print("\nSample products:")
    for p in cleaned[:5]:
        pr = ("$%s" % p["price_min"]) if p["price_min"] is not None else "n/a"
        print("  - %s | %s | %d variant(s) | from %s"
              % (p["title"], p["product_type"] or "(no type)",
                 p["variant_count"], pr))


if __name__ == "__main__":
    main()
