export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

// Magic Eden's public Launchpad endpoint — Solana only (their EVM marketplace/API
// was discontinued in March 2026). No API key required for this volume of traffic.
const ME_LAUNCHPAD_URL = "https://api-mainnet.magiceden.dev/v2/launchpad/collections?offset=0&limit=100";

// Only sync collections launching within this window either side of "now" — the feed
// includes years of history sorted newest-first, and we only care about upcoming/live drops.
const PAST_WINDOW_MS = 24 * 60 * 60 * 1000; // include things that launched in the last 24h (still "live")
const FUTURE_WINDOW_MS = 45 * 24 * 60 * 60 * 1000; // don't bother with drops more than 45 days out

type MeCollection = {
  symbol: string;
  name: string;
  description?: string;
  image?: string;
  price: number | null;
  size: number;
  launchDatetime: string;
  chainId: string;
  contractAddress: string;
};

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const isAuthorized =
    authHeader === `Bearer ${process.env.ADMIN_SECRET}` || authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(ME_LAUNCHPAD_URL, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: `Magic Eden API returned ${res.status}` }, { status: 502 });
  }
  const collections: MeCollection[] = await res.json();

  const now = Date.now();
  const relevant = collections.filter((c) => {
    if (c.chainId !== "solana") return false; // EVM launchpad data on ME is stale/discontinued
    if (!c.launchDatetime || !c.contractAddress) return false;
    const launchTime = new Date(c.launchDatetime).getTime();
    return launchTime > now - PAST_WINDOW_MS && launchTime < now + FUTURE_WINDOW_MS;
  });

  const db = supabaseAdmin();
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const c of relevant) {
    const launchTime = new Date(c.launchDatetime).getTime();
    const status = launchTime <= now ? "live" : "upcoming";
    const priceDisplay = c.price === 0 || c.price == null ? "Free" : `${c.price} SOL`;

    const { data: existing } = await db
      .from("mints")
      .select("id")
      .eq("chain", "solana")
      .eq("contract_address", c.contractAddress)
      .maybeSingle();

    const { data: mint, error } = await db
      .from("mints")
      .upsert(
        {
          name: c.name,
          chain: "solana",
          contract_address: c.contractAddress,
          source: "magiceden",
          source_url: `https://magiceden.io/launchpad/${c.symbol}`,
          image_url: c.image ?? null,
          mint_type: "candy_machine_v3",
          mint_start: c.launchDatetime,
          status,
          total_supply: c.size ?? null,
          total_minted: 0,
        },
        { onConflict: "chain,contract_address" }
      )
      .select()
      .single();

    if (error || !mint) {
      errors.push(`${c.symbol}: ${error?.message ?? "unknown error"}`);
      continue;
    }

    if (existing) {
      updated++;
    } else {
      created++;
      // Only Magic Eden's aggregate price/supply is available — represent it as a single
      // "Public" phase. If an admin later adds real phase data by hand, this sync won't
      // touch phases for a mint that already has any (see check below on future syncs).
      await db.from("mint_phases").insert({
        mint_id: mint.id,
        name: "Public",
        requirement_type: "public",
        price_display: priceDisplay,
        per_wallet_limit: 1,
        opens_at: c.launchDatetime,
        phase_supply: c.size ?? null,
        phase_minted: 0,
        sort_order: 0,
      });
    }
  }

  return NextResponse.json({ scanned: collections.length, matched: relevant.length, created, updated, errors });
}
