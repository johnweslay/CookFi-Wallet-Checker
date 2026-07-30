export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("mints")
    .select("*, phases:mint_phases(*)")
    .in("status", ["upcoming", "live"])
    .order("mint_start", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sort phases within each mint by sort_order (Supabase doesn't order nested selects).
  const mints = (data ?? []).map((m: any) => ({
    ...m,
    phases: (m.phases ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
  }));

  return NextResponse.json({ mints });
}
