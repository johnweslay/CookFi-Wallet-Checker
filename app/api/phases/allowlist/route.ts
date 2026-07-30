export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phaseId, addresses } = await req.json();
  if (!phaseId || !Array.isArray(addresses) || addresses.length === 0) {
    return NextResponse.json({ error: "phaseId and a non-empty addresses array are required" }, { status: 400 });
  }

  const rows = addresses
    .map((a: string) => a.trim())
    .filter(Boolean)
    .map((wallet_address: string) => ({ phase_id: phaseId, wallet_address }));

  const db = supabaseAdmin();
  const { error, count } = await db.from("phase_allowlist").upsert(rows, { onConflict: "phase_id,wallet_address" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ added: rows.length });
}
