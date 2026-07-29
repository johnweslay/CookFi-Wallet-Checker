export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import { checkEvmEligibility } from "../../../lib/evm/checkEligibility";
import { checkSolanaEligibility } from "../../../lib/solana/checkEligibility";
import type { Mint } from "../../../lib/supabase";

export async function POST(req: Request) {
  const { mintId, wallet } = await req.json();
  if (!mintId || !wallet) {
    return NextResponse.json({ error: "mintId and wallet are required" }, { status: 400 });
  }

  const { data: mint, error } = await supabase
    .from("mints")
    .select("*")
    .eq("id", mintId)
    .single<Mint>();

  if (error || !mint) {
    return NextResponse.json({ error: "Mint not found" }, { status: 404 });
  }

  const result =
    mint.chain === "solana"
      ? await checkSolanaEligibility(wallet, mint)
      : await checkEvmEligibility(wallet, mint);

  // Log the check (best-effort, doesn't block the response)
  supabase
    .from("eligibility_checks")
    .insert({
      mint_id: mint.id,
      wallet_address: wallet,
      chain: mint.chain,
      eligible: result.eligible,
      reason: result.reason,
    })
    .then(() => {});

  return NextResponse.json(result);
}
