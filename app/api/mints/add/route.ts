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

  const { data, error } = await supabaseAdmin()
    .from("mints")
    .insert({
      name: body.name,
      chain: body.chain,
      contract_address: body.contract_address,
      source: body.source ?? "manual",
      source_url: body.source_url ?? null,
      mint_type: body.mint_type ?? "unknown",
      gate_token_address: body.gate_token_address ?? null,
      gate_min_balance: body.gate_min_balance ?? 1,
      mint_start: body.mint_start ?? null,
      mint_end: body.mint_end ?? null,
      status: body.status ?? "upcoming",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ mint: data });
}
