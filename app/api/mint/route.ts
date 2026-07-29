import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("mints")
    .select("*")
    .in("status", ["upcoming", "live"])
    .order("mint_start", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ mints: data });
}
