#!/usr/bin/env python3
"""
Load the US catalog into Supabase (Postgres).

Reads:
  data/us_products_grouped.json  (products, options, variants, seo, collections, key_features)
  data/images.csv                (per-image rows, joined by source_handle)
  data/videos.csv                (per-video rows, joined by source_handle)
  data/specs.csv                 (per source_handle specs)

Applies supabase/schema.sql first, then upserts everything. Idempotent.

Auth: reads DATABASE_URL from the environment, e.g.
  postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
The password is URL-encoded automatically if you pass raw parts via env vars
PGPASSWORD / PGHOST etc. (DATABASE_URL takes precedence).

Usage (PowerShell):
  $env:DATABASE_URL="postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres"
  python load_to_supabase.py
"""

import csv
import json
import os
import sys
from urllib.parse import quote

try:
    import psycopg2
    import psycopg2.extras as extras
except ImportError:
    sys.exit("Missing dependency. Run: pip install psycopg2-binary")

DATA = "data"
GROUPED = os.path.join(DATA, "us_products_grouped.json")
IMAGES = os.path.join(DATA, "images.csv")
VIDEOS = os.path.join(DATA, "videos.csv")
SPECS = os.path.join(DATA, "specs.csv")
SCHEMA = os.path.join("supabase", "schema.sql")

BOOL_SPECS = ("usb_a", "usb_c", "wireless_charging", "hdmi", "rj45", "light", "spill_sealed")


def get_conn():
    url = os.environ.get("DATABASE_URL")
    if not url:
        host = os.environ.get("PGHOST")
        pw = os.environ.get("PGPASSWORD")
        if host and pw:
            url = "postgresql://%s:%s@%s:%s/%s" % (
                os.environ.get("PGUSER", "postgres"),
                quote(pw, safe=""),
                host,
                os.environ.get("PGPORT", "5432"),
                os.environ.get("PGDATABASE", "postgres"),
            )
    if not url:
        sys.exit("Set DATABASE_URL (or PGHOST/PGPASSWORD) in the environment.")
    return psycopg2.connect(url, sslmode="require")


def to_bool(v):
    v = (v or "").strip().lower()
    if v in ("yes", "true", "1"):
        return True
    if v in ("no", "false", "0"):
        return False
    return None


def read_csv(path):
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def slugify(name):
    out = "".join(c.lower() if c.isalnum() else "-" for c in name)
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-")


def apply_schema(cur):
    with open(SCHEMA, encoding="utf-8") as f:
        cur.execute(f.read())
    print("Schema applied.")


def main():
    products = json.load(open(GROUPED, encoding="utf-8"))
    images = read_csv(IMAGES)
    videos = read_csv(VIDEOS)
    specs = {r["product_handle"]: r for r in read_csv(SPECS)}

    # source_handle -> product handle, for joining images/videos/specs
    src_to_handle = {}
    for p in products:
        for v in p.get("variants", []):
            if v.get("source_handle"):
                src_to_handle[v["source_handle"]] = p["handle"]
        src_to_handle.setdefault(p["handle"], p["handle"])

    conn = get_conn()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        apply_schema(cur)

        # Clean load (idempotent): wipe catalog rows, keep schema.
        cur.execute(
            "truncate product_collections, product_specs, product_images, "
            "product_videos, product_options, variants, collections, products "
            "restart identity cascade;"
        )

        handle_to_id = {}
        for p in products:
            cur.execute(
                """insert into products
                   (handle,title,vendor,product_type,region,currency,price_min,price_max,
                    description_html,key_features,tags,meta_title,meta_description,
                    og_title,og_description,og_image)
                   values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   returning id""",
                (
                    p["handle"], p["title"], p.get("vendor"), p.get("product_type"),
                    p.get("region"), p.get("currency", "USD"),
                    p.get("price_min"), p.get("price_max"),
                    p.get("description_html"),
                    json.dumps(p.get("key_features", [])),
                    p.get("tags", []),
                    (p.get("seo") or {}).get("meta_title"),
                    (p.get("seo") or {}).get("meta_description"),
                    (p.get("seo") or {}).get("og_title"),
                    (p.get("seo") or {}).get("og_description"),
                    (p.get("seo") or {}).get("og_image"),
                ),
            )
            pid = cur.fetchone()[0]
            handle_to_id[p["handle"]] = pid

            # options
            for i, opt in enumerate(p.get("options", [])):
                cur.execute(
                    "insert into product_options (product_id,name,values,position) "
                    "values (%s,%s,%s,%s)",
                    (pid, opt["name"], opt.get("values", []), i),
                )

            # variants
            for i, v in enumerate(p.get("variants", [])):
                cur.execute(
                    """insert into variants
                       (product_id,sku,color,power,variant_title,price,available,
                        image_folder,primary_image,source_handle,position)
                       values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (
                        pid, v.get("sku"), v.get("color"), v.get("power"),
                        v.get("title") if v.get("title") != "Default Title" else None,
                        v.get("price"), v.get("available", True),
                        v.get("image_folder"), v.get("primary_image"),
                        v.get("source_handle"), i,
                    ),
                )

            # collections + join
            for name in p.get("collections", []):
                cur.execute(
                    "insert into collections (name,slug) values (%s,%s) "
                    "on conflict (name) do update set slug=excluded.slug returning id",
                    (name, slugify(name)),
                )
                cid = cur.fetchone()[0]
                cur.execute(
                    "insert into product_collections (product_id,collection_id) "
                    "values (%s,%s) on conflict do nothing",
                    (pid, cid),
                )

            # specs (merge across the product's source handles)
            merged = {}
            handles = {v.get("source_handle") for v in p.get("variants", [])}
            handles.add(p["handle"])
            for h in handles:
                row = specs.get(h)
                if not row:
                    continue
                for k in ("amperage", "hole_size_mm", "lift_type"):
                    if row.get(k) and not merged.get(k):
                        merged[k] = row[k]
                for k in BOOL_SPECS:
                    b = to_bool(row.get(k))
                    if b is not None and merged.get(k) is None:
                        merged[k] = b
            if merged:
                cur.execute(
                    """insert into product_specs
                       (product_id,amperage,hole_size_mm,lift_type,usb_a,usb_c,
                        wireless_charging,hdmi,rj45,light,spill_sealed)
                       values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (
                        pid, merged.get("amperage"), merged.get("hole_size_mm"),
                        merged.get("lift_type"), merged.get("usb_a"), merged.get("usb_c"),
                        merged.get("wireless_charging"), merged.get("hdmi"),
                        merged.get("rj45"), merged.get("light"), merged.get("spill_sealed"),
                    ),
                )

        # images (join by source_handle -> product)
        img_rows = []
        for r in images:
            pid = handle_to_id.get(src_to_handle.get(r["product_handle"]))
            if not pid:
                continue
            img_rows.append((
                pid, r["product_handle"], int(r["position"] or 0),
                r.get("image_url"), r.get("local_path"),
                int(r["width"]) if r.get("width") else None,
                int(r["height"]) if r.get("height") else None,
            ))
        extras.execute_values(
            cur,
            "insert into product_images "
            "(product_id,source_handle,position,image_url,local_path,width,height) values %s",
            img_rows,
        )

        # videos (join by source_handle -> product, dedupe per product+url)
        vid_seen = set()
        vid_rows = []
        for r in videos:
            pid = handle_to_id.get(src_to_handle.get(r["product_handle"]))
            if not pid:
                continue
            key = (pid, r["video_url"])
            if key in vid_seen:
                continue
            vid_seen.add(key)
            vid_rows.append((pid, r.get("video_type"), r["video_url"]))
        extras.execute_values(
            cur,
            "insert into product_videos (product_id,video_type,video_url) values %s "
            "on conflict do nothing",
            vid_rows,
        )

        conn.commit()

        # verification
        print("\nRow counts:")
        for t in ("products", "product_options", "variants", "product_images",
                  "product_videos", "collections", "product_collections", "product_specs"):
            cur.execute("select count(*) from %s" % t)
            print("  %-22s %d" % (t, cur.fetchone()[0]))

    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

    print("\nDone.")


if __name__ == "__main__":
    main()
