#!/usr/bin/env python3
"""
Generate original, SEO-friendly product descriptions with Claude (Sonnet).

For each product in data/us_products_grouped.json we feed the model:
  - title, vendor, product type, price, colour/power variants
  - technical specs from data/specs.csv
  - the original scraped description (reference only -> rewrite, don't copy)

The model returns JSON with:
  description_html, meta_title, meta_description, key_features[]

We back up the original description, then OVERWRITE description_html + seo in
the grouped JSON, and also write:
  data/descriptions_ai.csv                 (handle, meta_title, meta_description)
  data/descriptions/<handle>.html          (rendered new copy for review)
  data/descriptions/_originals/<handle>.txt (backup of prior description_html)

Auth: reads ANTHROPIC_API_KEY from the environment.
Usage:  set ANTHROPIC_API_KEY=...   &&  python generate_descriptions.py
"""

import csv
import json
import os
import re
import sys
import time

try:
    import anthropic
except ImportError:
    sys.exit("Missing dependency. Run: pip install anthropic")

DATA_DIR = "data"
GROUPED = os.path.join(DATA_DIR, "us_products_grouped.json")
SPECS = os.path.join(DATA_DIR, "specs.csv")
OUT_CSV = os.path.join(DATA_DIR, "descriptions_ai.csv")
DESC_DIR = os.path.join(DATA_DIR, "descriptions")
ORIG_DIR = os.path.join(DESC_DIR, "_originals")

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
MAX_TOKENS = 2000

SPEC_LABELS = {
    "amperage": "Amperage",
    "hole_size_mm": "Install hole size (mm)",
    "lift_type": "Lift mechanism",
    "usb_a": "USB-A port",
    "usb_c": "USB-C port",
    "wireless_charging": "Wireless (Qi) charging",
    "hdmi": "HDMI passthrough",
    "rj45": "RJ45 data",
    "light": "Integrated light",
    "spill_sealed": "Spill-sealed lid",
}

SYSTEM = (
    "You are a senior e-commerce copywriter for a premium electrical hardware "
    "brand (pop-up power outlets for kitchens, offices and workspaces). You "
    "write original, professional, benefit-driven product descriptions that are "
    "SEO-friendly, accurate to the provided specs, and never copied from the "
    "reference text. You always respond with a single valid JSON object and "
    "nothing else."
)

PROMPT_TMPL = """Write a brand-new product description for the item below.

PRODUCT
- Title: {title}
- Brand: {vendor}
- Type: {ptype}
- Price (USD): {price}
- Variants: {variants}

TECHNICAL SPECS (authoritative — do not contradict)
{specs}

REFERENCE DESCRIPTION (for facts only — REWRITE completely, do NOT copy phrasing)
\"\"\"{reference}\"\"\"

REQUIREMENTS
- Original wording. Premium, professional, benefit-driven tone.
- 350-550 words of body copy.
- Valid semantic HTML for a Shopify product page: use <h2>/<h3> headings,
  <p> paragraphs, and one <ul><li> "Key Features" list. No inline styles,
  no <html>/<body> wrapper, no markdown.
- Structure: compelling intro paragraph, a benefits/use-case section, a
  "Key Features" bullet list, and an "Installation & Setup" section.
- Naturally include SEO keywords a US shopper would search (e.g. "pop up outlet",
  "kitchen countertop outlet", "USB-C charging", relevant model name) — no keyword stuffing.
- Be accurate to the specs. Do not invent certifications or features not implied
  by the specs/reference. This is the US market (US sockets, 120V).

Respond with ONLY this JSON object:
{{
  "description_html": "<h2>...</h2><p>...</p><ul><li>...</li></ul>...",
  "meta_title": "<= 60 characters, includes model + core benefit>",
  "meta_description": "<= 155 characters, compelling, keyword-aware>",
  "key_features": ["short feature 1", "short feature 2", "..."]
}}"""


def load_specs():
    specs = {}
    with open(SPECS, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            specs[row["product_handle"]] = row
    return specs


def specs_for(product, specs_by_handle):
    """Collect specs from any of the product's source variant handles."""
    lines = []
    seen = {}
    handles = {v.get("source_handle") for v in product.get("variants", [])}
    handles.add(product["handle"])
    for h in handles:
        row = specs_by_handle.get(h)
        if not row:
            continue
        for key, label in SPEC_LABELS.items():
            val = (row.get(key) or "").strip()
            if val and label not in seen:
                pretty = "Yes" if val == "yes" else val
                seen[label] = pretty
    for label, val in seen.items():
        lines.append("- %s: %s" % (label, val))
    return "\n".join(lines) if lines else "- (no additional structured specs)"


def variants_summary(product):
    parts = []
    for v in product.get("variants", []):
        bits = []
        if v.get("color"):
            bits.append(v["color"])
        if v.get("power"):
            bits.append(v["power"])
        if v.get("title") and v["title"] != "Default Title":
            bits.append(v["title"])
        label = " / ".join(bits) if bits else "Standard"
        price = v.get("price")
        parts.append("%s ($%s)" % (label, price) if price else label)
    return "; ".join(dict.fromkeys(parts)) or "Single option"


def html_to_text(html):
    text = re.sub(r"<br\s*/?>", "\n", html or "")
    text = re.sub(r"</(p|h2|h3|li|ul)>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def extract_json(txt):
    txt = txt.strip()
    if txt.startswith("```"):
        txt = re.sub(r"^```(json)?", "", txt).strip()
        txt = re.sub(r"```$", "", txt).strip()
    start = txt.find("{")
    end = txt.rfind("}")
    if start != -1 and end != -1:
        txt = txt[start:end + 1]
    return json.loads(txt)


def call_claude(client, prompt):
    last_err = None
    for attempt in range(4):
        try:
            msg = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
            return extract_json(text)
        except Exception as e:  # noqa: BLE001
            last_err = e
            wait = 2 ** attempt
            print("   ! attempt %d failed (%s); retrying in %ds" % (attempt + 1, e, wait))
            time.sleep(wait)
    raise RuntimeError("Claude call failed after retries: %s" % last_err)


def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY in the environment first.")

    os.makedirs(DESC_DIR, exist_ok=True)
    os.makedirs(ORIG_DIR, exist_ok=True)

    client = anthropic.Anthropic()
    specs_by_handle = load_specs()

    with open(GROUPED, encoding="utf-8") as f:
        products = json.load(f)

    csv_rows = []
    for i, p in enumerate(products, 1):
        print("[%d/%d] %s" % (i, len(products), p["title"]))

        # back up original
        with open(os.path.join(ORIG_DIR, "%s.txt" % p["handle"]), "w", encoding="utf-8") as f:
            f.write(html_to_text(p.get("description_html", "")))

        price = ("$%s" % p["price_min"] if p.get("price_min") == p.get("price_max")
                 else "$%s-$%s" % (p.get("price_min"), p.get("price_max")))
        prompt = PROMPT_TMPL.format(
            title=p["title"],
            vendor=p.get("vendor", ""),
            ptype=p.get("product_type", "Pop Up Outlet"),
            price=price,
            variants=variants_summary(p),
            specs=specs_for(p, specs_by_handle),
            reference=html_to_text(p.get("description_html", ""))[:2500],
        )

        result = call_claude(client, prompt)

        # overwrite
        p["description_html"] = result["description_html"]
        seo = p.setdefault("seo", {})
        seo["meta_title"] = result["meta_title"]
        seo["meta_description"] = result["meta_description"]
        p["key_features"] = result.get("key_features", [])

        # per-product review file
        with open(os.path.join(DESC_DIR, "%s.html" % p["handle"]), "w", encoding="utf-8") as f:
            f.write("<!-- %s | %s -->\n" % (p["title"], seo["meta_title"]))
            f.write("<!-- meta: %s -->\n" % seo["meta_description"])
            f.write(result["description_html"])

        csv_rows.append([p["handle"], p["title"], seo["meta_title"], seo["meta_description"]])
        print("   ok  (%d chars, meta_title %d chars)"
              % (len(result["description_html"]), len(seo["meta_title"])))
        time.sleep(1)

    with open(GROUPED, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    with open(OUT_CSV, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["handle", "title", "meta_title", "meta_description"])
        w.writerows(csv_rows)

    print("\nDone. Overwrote descriptions in %s" % GROUPED)
    print("Wrote %s and %d review HTML files in %s/" % (OUT_CSV, len(csv_rows), DESC_DIR))
    print("Originals backed up in %s/" % ORIG_DIR)


if __name__ == "__main__":
    main()
