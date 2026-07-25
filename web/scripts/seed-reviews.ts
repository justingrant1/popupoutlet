/**
 * Seeds realistic, AI-generated reviews into Supabase for every product.
 * Usage: npm run seed:reviews
 * Requires: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

// load .env.local manually (no dotenv dependency)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
try {
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !service) {
  console.error("Missing Supabase env vars.");
  process.exit(1);
}
const sb = createClient(url, service, { auth: { persistSession: false } });

const catalog = JSON.parse(
  readFileSync(join(__dirname, "..", "src", "data", "catalog.json"), "utf8")
) as { handle: string; title: string; product_type: string }[];

const FIRST = [
  "James", "Sarah", "Michael", "Emily", "David", "Jessica", "Chris", "Amanda",
  "Robert", "Ashley", "Daniel", "Laura", "Kevin", "Megan", "Brian", "Nicole",
  "Jason", "Rachel", "Eric", "Hannah", "Mark", "Olivia", "Paul", "Sophia",
];
const LAST = ["R.", "T.", "M.", "S.", "K.", "L.", "P.", "B.", "W.", "H.", "C.", "D."];

const TITLES_5 = [
  "Exactly what my kitchen island needed",
  "Sleek, sturdy, and disappears when not in use",
  "USB-C charges my laptop fast",
  "Installation was easier than expected",
  "Looks premium and works flawlessly",
  "Perfect for my home office desk",
  "Wireless charging is a game changer",
  "Worth every penny",
];
const TITLES_4 = [
  "Great outlet, minor install note",
  "Very happy overall",
  "Solid build, would recommend",
  "Does the job nicely",
];
const BODY_5 = [
  "Installed this into my quartz island and it looks like it belongs there. The gas-strut mechanism is smooth and it sits perfectly flush when closed. Charging my phone wirelessly while cooking is so convenient.",
  "The 65W USB-C port actually powers my MacBook Pro — no more hunting for the wall charger. Build quality feels genuinely premium, not plasticky at all.",
  "We use it on the workshop bench and the pop-up action is satisfying and solid. The LED light is a nice touch for detailed work in the evening.",
  "Cutout was straightforward with the recommended hole size and the locking ring held everything tight. Looks like a high-end built-in feature now.",
  "Guests always comment on it. Push down and it vanishes, tap and it rises with power, USB, and a charging pad. Exactly the clean look I wanted.",
  "Bought one for the kitchen and immediately ordered a second for the office. Fast charging, no wobble, and it feels built to last.",
];
const BODY_4 = [
  "Really pleased with it. Took me a little longer to wire than I expected, but once in it works perfectly and looks great.",
  "Great product overall. Would have liked one more standard outlet, but the USB-C and wireless charging make up for it.",
  "Sturdy and stylish. The finish matches my appliances well and the mechanism feels reliable after a few weeks of daily use.",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

async function main() {
  // clear existing (idempotent reseed)
  await sb.from("reviews").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const rows: any[] = [];
  let seed = 7;
  for (const p of catalog) {
    const n = 4 + (p.handle.length % 4); // 4-7 reviews each
    for (let i = 0; i < n; i++) {
      seed = (seed * 31 + i + p.handle.charCodeAt(0)) >>> 0;
      const five = i % 5 !== 0; // ~80% five-star
      rows.push({
        product_handle: p.handle,
        author: `${pick(FIRST, seed)} ${pick(LAST, seed >> 3)}`,
        rating: five ? 5 : 4,
        title: five ? pick(TITLES_5, seed) : pick(TITLES_4, seed),
        body: five ? pick(BODY_5, seed) : pick(BODY_4, seed),
        verified: seed % 7 !== 0,
        created_at: daysAgo(3 + (seed % 220)),
      });
    }
  }

  const { error } = await sb.from("reviews").insert(rows);
  if (error) {
    console.error("Insert failed:", error.message);
    console.error("Did you run web/supabase/schema.sql in Supabase first?");
    process.exit(1);
  }
  console.log(`Seeded ${rows.length} reviews across ${catalog.length} products.`);
}

main();
