import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Public (anon) client — safe for read queries with RLS.
export function supabasePublic() {
  return createClient(url, anon, { auth: { persistSession: false } });
}

// Admin client — server-only. Never import into client components.
export function supabaseAdmin() {
  if (!service) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, service, { auth: { persistSession: false } });
}

export type Review = {
  id?: string;
  product_handle: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  created_at?: string;
};
