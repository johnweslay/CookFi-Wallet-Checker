import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public client — lazily created so importing this module never throws at build time
// (Next.js/Vercel imports route modules during "Collecting page data", before some
// env vars may be resolvable). The client is only actually constructed on first use.
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — set these in your Vercel project's Environment Variables."
      );
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// Kept for compatibility with existing imports — behaves like the old top-level export,
// but each property access goes through getSupabase() so it's still lazy.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase() as any;
    return client[prop];
  },
});

// Admin client — server-only, uses the service role key. NEVER import this in client components.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — set these in your Vercel project's Environment Variables."
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export type Mint = {
  id: string;
  name: string;
  chain: "ethereum" | "polygon" | "base" | "robinhood" | "arc" | "arbitrum" | "solana"
  contract_address: string;
  source: string | null;
  source_url: string | null;
  mint_type:
    | "thirdweb_drop"
    | "manifold"
    | "highlight"
    | "candy_machine_v3"
    | "seaport_drop"
    | "unknown";
  gate_token_address: string | null;
  gate_min_balance: number;
  mint_start: string | null;
  mint_end: string | null;
  status: "upcoming" | "live" | "ended";
  created_at: string;
};
