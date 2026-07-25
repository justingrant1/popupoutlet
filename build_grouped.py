#!/usr/bin/env python3
"""
Build a US-only, color-grouped catalog from data/products_enriched.json.

Color siblings (same model/region/config, only color differs) are merged into a
single parent product. Each colour becomes a variant that points at its own
image folder (data/images/<handle>/...), so the storefront can swap images when
a shopper clicks a colour.

Outputs:
  data/us_products_grouped.json   9 parent products, variants -> image folders
  data/us_products.csv            one row per parent product
  data/us_variants.csv            one row per variant (colour / power)

Usage:
  python build_grouped.py
"""

import csv
import json
import os

DATA_DIR = "data"
ENRICHED = os.path.join(DATA_DIR, "products_enriched.json")
OUT_JSON = os.path.join(DATA_DIR, "us_products_grouped.json")
OUT_PRODUCTS_CSV = os.path.join(DATA_DIR, "us_products.csv")
OUT_VARIANTS_CSV = os.path.join(DATA_DIR, "us_variants.csv")

# --------------------------------------------------------------------------- #
# Grouping plan (US-only). Each entry defines a parent product and the source
# product handles (from products_enriched.json) that become its colour variants.
#   handle: source handle in enriched data
#   color:  variant colour label
#   power:  optional 2nd option value (Point Pod Connect 15W/65W)
# For products already carrying their own variants (Hubbell) or single items,
# we pass them through unchanged.
# --------------------------------------------------------------------------- #
GROUPS = [
    {
        "handle": "v16-pop-up-outlet-with-light-65w-usb-c",
        "title": "V16: Pop Up Outlet with Light & 65W USB-C",
        "option_names": ["Color"],
        "source": "v16b-black-pop-up-outlet-with-light-65w-usb-c",  # description/seo base
        "variants": [
            {"handle": "v16b-black-pop-up-outlet-with-light-65w-usb-c", "color": "Black"},
            {"handle": "v16s-silver-pop-up-outlet-with-light-and-65w-usb-c", "color": "Silver"},
        ],
    },
    {
        "handle": "v15-quad-sided-pop-up-outlet-with-usb-and-qi",
        "title": "V15: Quad-Sided Pop Up Outlet with USB and Qi",
        "option_names": ["Color"],
        "source": "v15-quad-sided-black-pop-up-outlet-with-usb-and-qi",
        "variants": [
            {"handle": "v15-quad-sided-black-pop-up-outlet-with-usb-and-qi", "color": "Black"},
            {"handle": "v15-white-pop-up-outlet-with-usb-and-qi", "color": "White"},
        ],
    },
    {
        "handle": "v3c-motorized-pop-up-outlet-with-usb",
        "title": "V3C: Motorized Pop Up Outlet with USB",
        "option_names": ["Color"],
        "source": "v3c-motorized-pop-up-outlet-with-usb",
        "variants": [
            {"handle": "v3c-motorized-pop-up-outlet-with-usb", "color": "Black"},
            {"handle": "v3cs-motorized-pop-up-outlet-with-usb", "color": "Silver"},
            {"handle": "v3cw-white-motorized-pop-up-outlet-with-usb", "color": "White"},
        ],
    },
    {
        "handle": "point-pod-connect-kitchen-pop-up-outlet",
        "title": "Point Pod Connect Kitchen Counter Pop Up Outlet",
        "option_names": ["Color", "Power"],
        "source": "point-pod-connect-black-pop-up-electrical-outlet",
        # Each source product already has 15W/65W variants; we keep those and add colour.
        "variants": [
            {"handle": "point-pod-connect-black-pop-up-electrical-outlet", "color": "Black",
             "expand_power": True},
            {"handle": "point-pod-connect-silver-counter-pop-up-outlet", "color": "Silver",
             "expand_power": True},
        ],
    },
]

# Single / pass-through US products (kept as their own product, variants intact)
PASSTHROUGH = [
    "v15-white-pop-up-outlet",                       # basic no-USB, white, $89.95
    "hubbell-tri-power-countertop-pop-up-receptacle",
    "hubbell-dual-sided-pop-up-electrical-outlet",
    "hole-saw-4-for-point-pod",                      # 4" US hole saw
    "gfci-adapter",
]


def img_folder(handle):
    return "images/%s" % handle


def load_enriched():
    with open(ENRICHED, encoding="utf-8") as f:
        data = json.load(f)
    return {p["handle"]: p for p in data}


def images_for(prod):
    """Ordered list of local image paths for a product handle."""
    out = []
    for img in sorted(prod.get("images", []), key=lambda i: i.get("position", 0)):
        out.append({
            "position": img.get("position"),
            "src": img.get("src"),
            "local_path": "%s/%02d-%s" % (
                img_folder(prod["handle"]),
                img.get("position", 0),
                os.path.basename((img.get("src") or "").split("?")[0]),
            ),
            "width": img.get("width"),
            "height": img.get("height"),
        })
    return out


def power_label(variant_title):
    t = (variant_title or "").lower()
    if "65" in t:
        return "65W"
    if "15" in t:
        return "15W"
    return ""


def build():
    enriched = load_enriched()
    parents = []

    # ---- grouped color products ----
    for g in GROUPS:
        base = enriched[g["source"]]
        colors = []
        variants_out = []
        for v in g["variants"]:
            src = enriched[v["handle"]]
            colors.append(v["color"])
            imgs = images_for(src)
            primary = imgs[0]["local_path"] if imgs else ""
            if v.get("expand_power"):
                # keep the product's own 15W/65W variants, add colour
                for sv in src.get("variants", []):
                    pw = power_label(sv.get("title")) or (
                        power_label(sv.get("option1")) or power_label(sv.get("option2")))
                    variants_out.append({
                        "color": v["color"],
                        "power": pw,
                        "sku": sv.get("sku"),
                        "price": sv.get("price"),
                        "available": sv.get("available"),
                        "image_folder": img_folder(src["handle"]),
                        "primary_image": primary,
                        "images": [i["local_path"] for i in imgs],
                        "source_handle": src["handle"],
                    })
            else:
                sv = (src.get("variants") or [{}])[0]
                variants_out.append({
                    "color": v["color"],
                    "sku": sv.get("sku"),
                    "price": sv.get("price"),
                    "available": sv.get("available"),
                    "image_folder": img_folder(src["handle"]),
                    "primary_image": primary,
                    "images": [i["local_path"] for i in imgs],
                    "source_handle": src["handle"],
                })

        prices = [float(x["price"]) for x in variants_out if x.get("price")]
        options = [{"name": "Color", "values": colors}]
        if "Power" in g["option_names"]:
            powers = sorted({x.get("power") for x in variants_out if x.get("power")})
            options.append({"name": "Power", "values": powers})

        parents.append({
            "handle": g["handle"],
            "title": g["title"],
            "vendor": base.get("vendor"),
            "product_type": base.get("product_type"),
            "region": "US",
            "tags": base.get("tags", []),
            "currency": base.get("currency", "USD"),
            "price_min": min(prices) if prices else None,
            "price_max": max(prices) if prices else None,
            "description_html": base.get("description_html", ""),
            "seo": base.get("seo", {}),
            "collections": base.get("collections", []),
            "videos": base.get("videos", []),
            "options": options,
            "variants": variants_out,
        })

    # ---- pass-through products ----
    for handle in PASSTHROUGH:
        p = enriched[handle]
        imgs = images_for(p)
        primary = imgs[0]["local_path"] if imgs else ""
        variants_out = []
        for sv in p.get("variants", []):
            variants_out.append({
                "title": sv.get("title"),
                "option1": sv.get("option1"),
                "option2": sv.get("option2"),
                "sku": sv.get("sku"),
                "price": sv.get("price"),
                "available": sv.get("available"),
                "image_folder": img_folder(handle),
                "primary_image": primary,
                "images": [i["local_path"] for i in imgs],
                "source_handle": handle,
            })
        prices = [float(x["price"]) for x in variants_out if x.get("price")]
        parents.append({
            "handle": handle,
            "title": p.get("title"),
            "vendor": p.get("vendor"),
            "product_type": p.get("product_type"),
            "region": "US",
            "tags": p.get("tags", []),
            "currency": p.get("currency", "USD"),
            "price_min": min(prices) if prices else None,
            "price_max": max(prices) if prices else None,
            "description_html": p.get("description_html", ""),
            "seo": p.get("seo", {}),
            "collections": p.get("collections", []),
            "videos": p.get("videos", []),
            "options": p.get("options", []),
            "variants": variants_out,
        })

    # ---- write JSON ----
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(parents, f, ensure_ascii=False, indent=2)
    print("Wrote %s (%d parent products)" % (OUT_JSON, len(parents)))

    # ---- products csv ----
    with open(OUT_PRODUCTS_CSV, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["handle", "title", "vendor", "product_type", "region",
                    "price_min", "price_max", "option_names", "variant_count",
                    "collections", "primary_image"])
        for p in parents:
            w.writerow([
                p["handle"], p["title"], p.get("vendor", ""),
                p.get("product_type", ""), p["region"],
                p.get("price_min"), p.get("price_max"),
                " | ".join(o["name"] for o in p.get("options", [])),
                len(p["variants"]),
                " | ".join(p.get("collections", [])),
                (p["variants"][0]["primary_image"] if p["variants"] else ""),
            ])
    print("Wrote %s" % OUT_PRODUCTS_CSV)

    # ---- variants csv ----
    with open(OUT_VARIANTS_CSV, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["product_handle", "product_title", "color", "power",
                    "variant_title", "sku", "price", "available",
                    "image_folder", "primary_image", "image_count"])
        for p in parents:
            for v in p["variants"]:
                w.writerow([
                    p["handle"], p["title"],
                    v.get("color", ""), v.get("power", ""),
                    v.get("title", ""), v.get("sku", ""),
                    v.get("price", ""), v.get("available", ""),
                    v.get("image_folder", ""), v.get("primary_image", ""),
                    len(v.get("images", [])),
                ])
    print("Wrote %s" % OUT_VARIANTS_CSV)

    # ---- summary ----
    total_variants = sum(len(p["variants"]) for p in parents)
    print("\n=== SUMMARY ===")
    print("Parent products: %d" % len(parents))
    print("Total variants:  %d" % total_variants)
    for p in parents:
        opt = ", ".join("%s(%s)" % (o["name"], "/".join(o["values"]))
                        for o in p.get("options", []) if o.get("values"))
        print("  - %-55s %d variant(s)  %s"
              % (p["title"][:55], len(p["variants"]), opt))


if __name__ == "__main__":
    build()
