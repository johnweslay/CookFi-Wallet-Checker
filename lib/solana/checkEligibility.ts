import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fetchCandyMachine, fetchCandyGuard } from "@metaplex-foundation/mpl-candy-machine";
import { publicKey } from "@metaplex-foundation/umi";
import type { Mint } from "../supabase";

function heliusRpcUrl() {
  const key = process.env.HELIUS_API_KEY!;
  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
}

export type EligibilityResult = {
  eligible: boolean;
  reason: string;
  details?: Record<string, unknown>;
};

/** Standalone holder-gate check, reusable for any phase (not just a whole mint). */
export async function checkSolanaHolderGate(
  wallet: string,
  collectionAddress: string,
  _minBalance: number
): Promise<EligibilityResult> {
  try {
    const holds = await walletHoldsCollection(wallet, collectionAddress);
    return holds
      ? { eligible: true, reason: "Holds an NFT from the required collection." }
      : { eligible: false, reason: `Requires holding an NFT from collection ${collectionAddress}.` };
  } catch {
    return { eligible: false, reason: "Could not verify holder-gate via Helius DAS API." };
  }
}

/** Holder-gate check via Helius DAS API — does the wallet hold an asset from the required collection? */
async function walletHoldsCollection(wallet: string, collectionAddress: string): Promise<boolean> {
  const res = await fetch(heliusRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "eligibility-check",
      method: "getAssetsByOwner",
      params: { ownerAddress: wallet, page: 1, limit: 1000 },
    }),
  });
  const data = await res.json();
  const items: any[] = data?.result?.items ?? [];
  return items.some((item) => item.grouping?.some((g: any) => g.group_value === collectionAddress));
}

/**
 * Checks wallet eligibility for a Solana mint running on a Metaplex Candy Machine v3.
 *
 * Supported out of the box:
 *  1. Holder-gate: wallet must hold an NFT from gate_token_address (a collection mint address).
 *  2. Public/default guard group: if the CM's default guard set has no allowlist-type guard
 *     (addressGate/allowList) and mint dates are open, it's open to everyone.
 *
 * NOTE: like EVM, an on-chain merkle allowlist guard only stores a root — proving membership
 * needs the original address list. If you have it, store it per-mint and check membership directly.
 */
export async function checkSolanaEligibility(
  wallet: string,
  mint: Mint
): Promise<EligibilityResult> {
  const umi = createUmi(heliusRpcUrl());

  // 1. Holder-gate check, if configured.
  if (mint.gate_token_address) {
    try {
      const holds = await walletHoldsCollection(wallet, mint.gate_token_address);
      if (!holds) {
        return {
          eligible: false,
          reason: `Requires holding an NFT from collection ${mint.gate_token_address}.`,
        };
      }
    } catch {
      return { eligible: false, reason: "Could not verify holder-gate via Helius DAS API." };
    }
  }

  // 2. Read the Candy Machine + Candy Guard to determine current phase.
  try {
    const candyMachine = await fetchCandyMachine(umi, publicKey(mint.contract_address));
    if (!candyMachine.mintAuthority) {
      return { eligible: false, reason: "Candy Machine has no mint authority configured." };
    }

    const candyGuard = await fetchCandyGuard(umi, candyMachine.mintAuthority);
    const guards = candyGuard.guards;

    const hasAllowlistGuard = Boolean(guards.allowList?.__option === "Some");
    const hasAddressGate = Boolean(guards.addressGate?.__option === "Some");
    const startDate = guards.startDate?.__option === "Some" ? guards.startDate.value.date : null;
    const now = BigInt(Math.floor(Date.now() / 1000));

    if (startDate && now < BigInt(startDate)) {
      return { eligible: false, reason: "Mint has not started yet." };
    }

    if (hasAllowlistGuard || hasAddressGate) {
      return {
        eligible: false,
        reason:
          "This Candy Machine's default group is allowlist-gated on-chain. Add the raw allowlist for this mint to check membership directly, or point to the correct guard group if this project uses multiple groups.",
      };
    }

    if (candyMachine.itemsRedeemed >= candyMachine.data.itemsAvailable) {
      return { eligible: false, reason: "Collection is sold out." };
    }

    return { eligible: true, reason: "Public mint phase is open." };
  } catch (err) {
    return {
      eligible: false,
      reason: "Couldn't read Candy Machine state — check the contract (Candy Machine) address.",
    };
  }
}

/** Checks a wallet against an admin-uploaded allowlist (exact-match). */
export function checkAgainstStoredAllowlist(wallet: string, allowlist: string[]): boolean {
  return allowlist.includes(wallet);
}
