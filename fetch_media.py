#!/usr/bin/env python3
"""
Enrich the Modern Power Solutions catalog for an ecommerce database import.

Reads data/products_raw.json (produced by build_products.py) and:
  * Downloads every product image to data/images/<handle>/NN-<file>
  * Scrapes each product page for video links (YouTube/Vimeo/mp4)
  * Extracts SEO meta (title, description, og:*) and currency (JSON-LD / meta)
  * Fetches collections and maps products -> collections
  * Parses structured specs from tags + description

Outputs:
  data/images.csv        one row per image (+ variant<->image mapping, dims)
  data/videos.csv        one row per video link
  data/collections.csv   collection <-> product membership
  data/specs.csv         parsed structured specs per product
  data/products_enriched.json   full merged record per product

Usage:
  python fetch_media.py
"""

import csv
import json
import os
import re
import time
import urllib.request
import urllib.error
import urllib.parse

BASE_URL = "https://modernpower.solutions"
DATA_DIR = "data"
RAW_PATH = os.path.join(DATA_DIR, "products_raw.json")
IMAGES_DIR = os.path.join(DATA_DIR, "images")
IMAGES_CSV = os.path.join(DATA_DIR, "images.csv")
VIDEOS_CSV = os.path.join(DATA_DIR, "videos.csv")
COLLECTIONS_CSV = os.path.join(DATA_DIR, "collections.csv")
SPECS_CSV = os.path.join(DATA_DIR, "specs.csv")
ENRICHED_JSON = os.path.join(DATA_DIR, "products_enriched.json")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)


# --------------------------------------------------------------------------- #
# Networking helpers
# --------------------------------------------------------------------------- #
def _request(url, max_retries=5, binary=False):
    last_err = None
    for attempt in range(1, max_retries + 1):
        req = urllib.request.Request(url, headers={
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
        })
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = resp.read()
            if not binary:
                text = data.decode("utf-8", errors="replace")
                if text.strip() == "local_rate_limited":
                    raise ValueError("rate limited")
                return text
            if len(data) < 100:  # suspiciously tiny -> likely an error body
                raise ValueError("tiny response (%d bytes)" % len(data))
            return data
        except (urllib.error.HTTPError, urllib.error.URLError, ValueError) as e:
            last_err = e
            wait = attempt * 4
            print("    retry %d/%d (%s) in %ds" % (attempt, max_retries, e, wait))
            time.sleep(wait)
    raise RuntimeError("Failed to fetch %s: %s" % (url, last_err))


def fetch_text(url):
    return _request(url, binary=False)


def fetch_binary(url):
    return _request(url, binary=True)


# --------------------------------------------------------------------------- #
# Image download
# --------------------------------------------------------------------------- #
def clean_filename(url):
    path = urllib.parse.urlparse(url).path
    name = os.path.basename(path) or "image"
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)


def download_images(products, image_rows):
    os.makedirs(IMAGES_DIR, exist_ok=True)
    downloaded = 0
    skipped = 0
    failed = 0
    for p in products:
        handle = p.get("handle", "product")
        pdir = os.path.join(IMAGES_DIR, handle)
        os.makedirs(pdir, exist_ok=True)
        for img in p.get("images", []):
            src = img.get("src")
            if not src:
                continue
            pos = img.get("position", 0)
            fname = "%02d-%s" % (pos, clean_filename(src))
            local_path = os.path.join(pdir, fname)
            rel_path = os.path.relpath(local_path, DATA_DIR).replace("\\", "/")
            if not os.path.exists(local_path):
                try:
                    blob = fetch_binary(src)
                    with open(local_path, "wb") as fh:
                        fh.write(blob)
                    downloaded += 1
                    print("  downloaded %s" % rel_path)
                    time.sleep(0.3)
                except Exception as e:  # noqa: BLE001
                    failed += 1
                    print("  FAILED %s (%s)" % (src, e))
                    local_path = ""
                    rel_path = ""
            else:
                skipped += 1
                print("  exists   %s" % rel_path)

            image_rows.append({
                "product_id": p.get("id"),
                "product_handle": handle,
                "position": pos,
                "image_id": img.get("id"),
                "image_url": src,
                "local_path": rel_path,
                "width": img.get("width"),
                "height": img.get("height"),
                "variant_ids": ";".join(str(v) for v in img.get("variant_ids", [])),
            })
    print("Images: %d downloaded, %d already existed, %d failed"
          % (downloaded, skipped, failed))


# --------------------------------------------------------------------------- #
# Page scraping: videos, SEO meta, currency
# --------------------------------------------------------------------------- #
YT_RE = re.compile(
    r"(?:youtube\.com/(?:embed/|watch\?v=)|youtu\.be/)([A-Za-z0-9_-]{11})")
VIMEO_RE = re.compile(r"(?:player\.)?vimeo\.com/(?:video/)?(\d+)")
MP4_RE = re.compile(r"https?://[^\s\"'<>]+\.mp4[^\s\"'<>]*")
META_RE = re.compile(
    r"<meta\s+[^>]*?(?:name|property)\s*=\s*[\"']([^\"']+)[\"'][^>]*?"
    r"content\s*=\s*[\"']([^\"']*)[\"']", re.IGNORECASE)
META_RE2 = re.compile(
    r"<meta\s+[^>]*?content\s*=\s*[\"']([^\"']*)[\"'][^>]*?"
    r"(?:name|property)\s*=\s*[\"']([^\"']+)[\"']", re.IGNORECASE)
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
LDJSON_RE = re.compile(
    r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
    re.IGNORECASE | re.DOTALL)


def parse_meta(html):
    meta = {}
    for name, content in META_RE.findall(html):
        meta.setdefault(name.lower(), content)
    for content, name in META_RE2.findall(html):
        meta.setdefault(name.lower(), content)
    return meta


def extract_currency(html, meta):
    # Try meta first
    for key in ("og:price:currency", "product:price:currency"):
        if meta.get(key):
            return meta[key]
    # Try JSON-LD offers
    for block in LDJSON_RE.findall(html):
        try:
            data = json.loads(block.strip())
        except Exception:  # noqa: BLE001
            continue
        candidates = data if isinstance(data, list) else [data]
        for obj in candidates:
            offers = obj.get("offers") if isinstance(obj, dict) else None
            if isinstance(offers, dict) and offers.get("priceCurrency"):
                return offers["priceCurrency"]
            if isinstance(offers, list):
                for off in offers:
                    if isinstance(off, dict) and off.get("priceCurrency"):
                        return off["priceCurrency"]
    m = re.search(r'"currency"\s*:\s*"([A-Z]{3})"', html)
    if m:
        return m.group(1)
    return ""


def scrape_page(handle):
    url = "%s/products/%s" % (BASE_URL, handle)
    html = fetch_text(url)
    meta = parse_meta(html)

    videos = []
    seen = set()
    for vid in YT_RE.findall(html):
        u = "https://www.youtube.com/watch?v=%s" % vid
        if u not in seen:
            seen.add(u)
            videos.append({"type": "youtube", "url": u})
    for vid in VIMEO_RE.findall(html):
        u = "https://vimeo.com/%s" % vid
        if u not in seen:
            seen.add(u)
            videos.append({"type": "vimeo", "url": u})
    for u in MP4_RE.findall(html):
        if u not in seen:
            seen.add(u)
            videos.append({"type": "mp4", "url": u})

    title_m = TITLE_RE.search(html)
    seo = {
        "meta_title": (title_m.group(1).strip() if title_m else ""),
        "meta_description": meta.get("description", ""),
        "og_title": meta.get("og:title", ""),
        "og_description": meta.get("og:description", ""),
        "og_image": meta.get("og:image", ""),
    }
    currency = extract_currency(html, meta)
    return videos, seo, currency


# --------------------------------------------------------------------------- #
# Collections
# --------------------------------------------------------------------------- #
def fetch_collections():
    """Return dict handle-> {title, product_handles set}."""
    result = {}
    try:
        body = fetch_text("%s/collections.json?limit=250" % BASE_URL)
        cols = json.loads(body).get("collections", [])
    except Exception as e:  # noqa: BLE001
        print("Could not fetch collections list: %s" % e)
        return result
    for c in cols:
        handle = c.get("handle")
        if not handle:
            continue
        prod_handles = set()
        page = 1
        while True:
            url = "%s/collections/%s/products.json?limit=250&page=%d" % (
                BASE_URL, handle, page)
            try:
                data = json.loads(fetch_text(url))
            except Exception as e:  # noqa: BLE001
                print("  collection %s page %d failed: %s" % (handle, page, e))
                break
            prods = data.get("products", [])
            if not prods:
                break
            for p in prods:
                if p.get("handle"):
                    prod_handles.add(p["handle"])
            if len(prods) < 250:
                break
            page += 1
            time.sleep(1)
        result[handle] = {"title": c.get("title", handle),
                          "products": prod_handles}
        print("  collection '%s' -> %d products" % (handle, len(prod_handles)))
        time.sleep(1)
    return result


# --------------------------------------------------------------------------- #
# Spec parsing
# --------------------------------------------------------------------------- #
def parse_specs(product):
    tags = [t.lower() for t in product.get("tags", [])]
    text = (product.get("body_html", "") or "").lower()
    blob = " ".join(tags) + " " + text

    def has(*words):
        return any(w in blob for w in words)

    region = ""
    if "us socket" in blob or "u.s." in blob or "usa" in blob or "us plug" in blob:
        region = "US"
    elif "uk socket" in blob or "uk plug" in blob:
        region = "UK"
    elif "au socket" in blob or "australia" in blob or "australian" in blob:
        region = "AU"
    elif "eu socket" in blob or "european" in blob:
        region = "EU"

    amperage = ""
    m = re.search(r"(\d{1,2})\s*amp", blob)
    if m:
        amperage = m.group(1)

    hole = ""
    m = re.search(r"(\d{2,3})\s*mm", blob)
    if m:
        hole = m.group(1)

    lift = ""
    if has("motoris", "motoriz"):
        lift = "motorised"
    elif has("gas-strut", "gas strut"):
        lift = "gas-strut"
    elif has("manual", "spring-lift", "spring lift"):
        lift = "manual/spring"

    return {
        "product_id": product.get("id"),
        "product_handle": product.get("handle"),
        "region": region,
        "amperage": amperage,
        "hole_size_mm": hole,
        "lift_type": lift,
        "usb_a": "yes" if has("usb-a") else "",
        "usb_c": "yes" if has("usb-c") else "",
        "wireless_charging": "yes" if has("wireless charg", "qi") else "",
        "hdmi": "yes" if has("hdmi") else "",
        "rj45": "yes" if has("rj45") else "",
        "light": "yes" if ("light" in tags or "led light" in blob) else "",
        "spill_sealed": "yes" if has("spill-seal", "spill seal", "waterproof",
                                     "water seal") else "",
    }


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main():
    with open(RAW_PATH, encoding="utf-8") as f:
        products = json.load(f)["products"]
    print("Loaded %d products" % len(products))

    # A. Images
    print("\n--- Downloading images ---")
    image_rows = []
    download_images(products, image_rows)
    with open(IMAGES_CSV, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=[
            "product_id", "product_handle", "position", "image_id",
            "image_url", "local_path", "width", "height", "variant_ids"])
        w.writeheader()
        w.writerows(image_rows)
    print("Wrote %s (%d rows)" % (IMAGES_CSV, len(image_rows)))

    # B/C. Videos + SEO + currency via page scrape
    print("\n--- Scraping product pages (videos, SEO, currency) ---")
    video_rows = []
    per_product_extra = {}
    currencies = {}
    for i, p in enumerate(products, 1):
        handle = p.get("handle")
        print("  [%d/%d] %s" % (i, len(products), handle))
        try:
            videos, seo, currency = scrape_page(handle)
        except Exception as e:  # noqa: BLE001
            print("    page failed: %s" % e)
            videos, seo, currency = [], {}, ""
        per_product_extra[handle] = {"videos": videos, "seo": seo,
                                     "currency": currency}
        for v in videos:
            video_rows.append({
                "product_id": p.get("id"),
                "product_handle": handle,
                "video_type": v["type"],
                "video_url": v["url"],
            })
        if currency:
            currencies[currency] = currencies.get(currency, 0) + 1
        time.sleep(0.8)

    with open(VIDEOS_CSV, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=[
            "product_id", "product_handle", "video_type", "video_url"])
        w.writeheader()
        w.writerows(video_rows)
    print("Wrote %s (%d rows)" % (VIDEOS_CSV, len(video_rows)))

    # D. Collections
    print("\n--- Fetching collections ---")
    collections = fetch_collections()
    col_rows = []
    handle_to_collections = {}
    for chandle, info in collections.items():
        for phandle in info["products"]:
            col_rows.append({
                "collection_handle": chandle,
                "collection_title": info["title"],
                "product_handle": phandle,
            })
            handle_to_collections.setdefault(phandle, []).append(info["title"])
    with open(COLLECTIONS_CSV, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=[
            "collection_handle", "collection_title", "product_handle"])
        w.writeheader()
        w.writerows(col_rows)
    print("Wrote %s (%d rows)" % (COLLECTIONS_CSV, len(col_rows)))

    # E. Specs
    print("\n--- Parsing specs ---")
    spec_rows = [parse_specs(p) for p in products]
    spec_fields = ["product_id", "product_handle", "region", "amperage",
                   "hole_size_mm", "lift_type", "usb_a", "usb_c",
                   "wireless_charging", "hdmi", "rj45", "light", "spill_sealed"]
    with open(SPECS_CSV, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=spec_fields)
        w.writeheader()
        w.writerows(spec_rows)
    print("Wrote %s (%d rows)" % (SPECS_CSV, len(spec_rows)))

    # F. Enriched JSON
    print("\n--- Writing enriched JSON ---")
    specs_by_handle = {s["product_handle"]: s for s in spec_rows}
    enriched = []
    for p in products:
        handle = p.get("handle")
        extra = per_product_extra.get(handle, {})
        enriched.append({
            "id": p.get("id"),
            "title": p.get("title"),
            "handle": handle,
            "url": "%s/products/%s" % (BASE_URL, handle),
            "vendor": p.get("vendor"),
            "product_type": p.get("product_type"),
            "tags": p.get("tags", []),
            "currency": extra.get("currency", ""),
            "seo": extra.get("seo", {}),
            "collections": handle_to_collections.get(handle, []),
            "specs": specs_by_handle.get(handle, {}),
            "description_html": p.get("body_html", ""),
            "options": p.get("options", []),
            "variants": [{
                "id": v.get("id"), "title": v.get("title"), "sku": v.get("sku"),
                "price": v.get("price"),
                "compare_at_price": v.get("compare_at_price"),
                "available": v.get("available"),
                "option1": v.get("option1"), "option2": v.get("option2"),
                "option3": v.get("option3"), "grams": v.get("grams"),
                "barcode": v.get("barcode"),
                "featured_image": v.get("featured_image"),
            } for v in p.get("variants", [])],
            "images": [{
                "id": img.get("id"), "position": img.get("position"),
                "src": img.get("src"), "width": img.get("width"),
                "height": img.get("height"),
                "variant_ids": img.get("variant_ids", []),
            } for img in p.get("images", [])],
            "videos": extra.get("videos", []),
        })
    with open(ENRICHED_JSON, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)
    print("Wrote %s" % ENRICHED_JSON)

    # G. Summary
    total_images = len(image_rows)
    prods_with_video = len({r["product_handle"] for r in video_rows})
    print("\n=== SUMMARY ===")
    print("Products:            %d" % len(products))
    print("Image records:       %d" % total_images)
    print("Video links:         %d (across %d products)"
          % (len(video_rows), prods_with_video))
    print("Collections:         %d" % len(collections))
    print("Currencies detected: %s"
          % (", ".join("%s(%d)" % (k, v) for k, v in currencies.items())
             or "none"))


if __name__ == "__main__":
    main()
