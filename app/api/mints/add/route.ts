export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const required = ["name", "chain", "contract_address"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }

  const db = supabaseAdmin();

  const { data: mint, error } = await db
    .from("mints")
    .insert({
      name: body.name,
      chain: body.chain,
      contract_address: body.contract_address,
      source: body.source ?? "manual",
      source_url: body.source_url ?? null,
      website_url: body.website_url ?? null,
      twitter_url: body.twitter_url ?? null,
      image_url: body.image_url ?? null,
      mint_type: body.mint_type ?? "unknown",
      gate_token_address: body.gate_token_address ?? null,
      gate_min_balance: body.gate_min_balance ?? 1,
      mint_start: body.mint_start ?? null,
      mint_end: body.mint_end ?? null,
      status: body.status ?? "upcoming",
      total_supply: body.total_supply ?? null,
      total_minted: body.total_minted ?? 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert phases, if provided.
  const phases = Array.isArray(body.phases) ? body.phases : [];
  if (phases.length > 0) {
    const rows = phases.map((p: any, i: number) => ({
      mint_id: mint.id,
      name: p.name,
      requirement_type: p.requirement_type,
      price_display: p.price_display || "Free",
      per_wallet_limit: p.per_wallet_limit ?? 1,
      opens_at: p.opens_at || null,
      phase_supply: p.phase_supply ?? null,
      phase_minted: p.phase_minted ?? 0,
      gate_token_address: p.gate_token_address || null,
      gate_min_balance: p.gate_min_balance ?? 1,
      sort_order: i,
    }));
    const { error: phaseError } = await db.from("mint_phases").insert(rows);
    if (phaseError) {
      return NextResponse.json(
        { error: `Mint created, but phases failed: ${phaseError.message}`, mint },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ mint });
}
