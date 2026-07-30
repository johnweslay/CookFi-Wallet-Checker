export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { checkEvmHolderGate } from "../../../lib/evm/checkEligibility";
import { checkSolanaHolderGate } from "../../../lib/solana/checkEligibility";
import type { Mint, MintPhase, PhaseEligibility } from "../../../lib/supabase";

const EVM_CHAINS = new Set(["ethereum", "polygon", "base", "arbitrum", "robinhood", "arc"]);

export async function POST(req: Request) {
  const { mintId, wallet } = await req.json();
  if (!mintId || !wallet) {
    return NextResponse.json({ error: "mintId and wallet are required" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: mint, error: mintError } = await db
    .from("mints")
    .select("*")
    .eq("id", mintId)
    .single<Mint>();

  if (mintError || !mint) {
    return NextResponse.json({ error: "Mint not found" }, { status: 404 });
  }

  const { data: phases, error: phasesError } = await db
    .from("mint_phases")
    .select("*")
    .eq("mint_id", mintId)
    .order("sort_order", { ascending: true })
    .returns<MintPhase[]>();

  if (phasesError) {
    return NextResponse.json({ error: phasesError.message }, { status: 500 });
  }

  // No phases configured — fall back to a single overall check (legacy behavior).
  if (!phases || phases.length === 0) {
    return NextResponse.json({
      phases: [
        {
          phase_id: mint.id,
          phase_name: "Mint",
          eligible: false,
          reason: "No phases configured for this mint yet.",
        },
      ],
    });
  }

  const results: PhaseEligibility[] = [];

  for (const phase of phases) {
    results.push(await checkPhase(wallet, mint, phase, db));
  }

  // Best-effort logging, doesn't block the response.
  db.from("eligibility_checks")
    .insert({
      mint_id: mint.id,
      wallet_address: wallet,
      chain: mint.chain,
      eligible: results.some((r) => r.eligible),
      reason: results.map((r) => `${r.phase_name}: ${r.eligible ? "eligible" : "not eligible"}`).join("; "),
    })
    .then(() => {});

  return NextResponse.json({ phases: results });
}

async function checkPhase(
  wallet: string,
  mint: Mint,
  phase: MintPhase,
  db: ReturnType<typeof supabaseAdmin>
): Promise<PhaseEligibility> {
  const base = { phase_id: phase.id, phase_name: phase.name };

  if (phase.requirement_type === "team") {
    return { ...base, eligible: false, reason: "Team-only allocation — not checkable by wallet." };
  }

  if (phase.requirement_type === "public") {
    const opensAt = phase.opens_at ? new Date(phase.opens_at) : null;
    const isOpen = !opensAt || opensAt.getTime() <= Date.now();
    const soldOut = phase.phase_supply != null && phase.phase_minted >= phase.phase_supply;
    if (soldOut) return { ...base, eligible: false, reason: "This phase is sold out." };
    return {
      ...base,
      eligible: isOpen,
      reason: isOpen ? "Open to everyone." : `Opens ${opensAt!.toLocaleString()}.`,
    };
  }

  if (phase.requirement_type === "allowlist") {
    const { data, error } = await db
      .from("phase_allowlist")
      .select("wallet_address")
      .eq("phase_id", phase.id)
      .ilike("wallet_address", wallet)
      .maybeSingle();
    if (error) return { ...base, eligible: false, reason: "Could not check allowlist." };
    return {
      ...base,
      eligible: Boolean(data),
      reason: data ? "Wallet is on the allowlist." : "Wallet is not on the allowlist for this phase.",
    };
  }

  if (phase.requirement_type === "holder_gate") {
    if (!phase.gate_token_address) {
      return { ...base, eligible: false, reason: "Holder-gate phase is misconfigured (no token address)." };
    }
    const result = EVM_CHAINS.has(mint.chain)
      ? await checkEvmHolderGate(wallet, mint.chain as any, phase.gate_token_address, phase.gate_min_balance)
      : await checkSolanaHolderGate(wallet, phase.gate_token_address, phase.gate_min_balance);
    return { ...base, eligible: result.eligible, reason: result.reason };
  }

  return { ...base, eligible: false, reason: "Unknown phase requirement type." };
}
