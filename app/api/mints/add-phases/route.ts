export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

// Attaches phases to a mint that already exists (found by chain + contract address),
// instead of requiring the mint to be re-created via /api/mints/add.
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.chain || !body.contract_address || !Array.isArray(body.phases) || body.phases.length === 0) {
    return NextResponse.json(
      { error: "chain, contract_address, and a non-empty phases array are required" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  const { data: mint, error: findError } = await db
    .from("mints")
    .select("id, name")
    .eq("chain", body.chain)
    .ilike("contract_address", body.contract_address.trim())
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!mint) {
    return NextResponse.json({ error: "No mint found with that chain + contract address." }, { status: 404 });
  }

  // Replace existing manually-added phases for this mint (external_stage_id is null for those)
  // so re-submitting the form updates instead of duplicating. Synced (OpenSea) phases,
  // which have an external_stage_id, are left untouched.
  await db.from("mint_phases").delete().eq("mint_id", mint.id).is("external_stage_id", null);

  const rows = body.phases.map((p: any, i: number) => ({
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

  const { error: insertError } = await db.from("mint_phases").insert(rows);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ mint_name: mint.name, phases_added: rows.length });
}
