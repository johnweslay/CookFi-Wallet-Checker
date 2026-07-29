import { createClient } from "@supabase/supabase-js";

// Public client — safe for browser use, respects RLS policies (read-only on mints).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin client — server-only, uses the service role key. NEVER import this in client components.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export type Mint = {
  id: string;
  name: string;
  chain: "ethereum" | "polygon" | "base" | "arbitrum" | "solana";
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
