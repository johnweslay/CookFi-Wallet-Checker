import { createPublicClient, http, getAddress, defineChain, type Address } from "viem";
import { mainnet, polygon, base, arbitrum } from "viem/chains";
import type { Mint } from "../supabase";

// Robinhood Chain (mainnet) — Ethereum-compatible L2 built on Arbitrum, launched July 2026.
const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
});

// Arc (testnet) — Circle's stablecoin-native L1. NOTE: Arc has no mainnet yet as of writing —
// any mint added on this chain is a testnet mint, not a real asset. Flag this to users if you
// surface "arc" mints anywhere, and re-check before Arc's mainnet beta ships.
const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: ["https://testnet.arc.network"] } },
  blockExplorers: { default: { name: "Arcscan", url: "https://testnet.arcscan.app" } },
});

const CHAIN_MAP = {
  ethereum: mainnet,
  polygon: polygon,
  base: base,
  arbitrum: arbitrum,
  robinhood: robinhood,
  arc: arcTestnet,
} as const;

function alchemyRpcUrl(chain: keyof typeof CHAIN_MAP) {
  const key = process.env.ALCHEMY_API_KEY!;
  const subdomain: Record<keyof typeof CHAIN_MAP, string> = {
    ethereum: "eth-mainnet",
    polygon: "polygon-mainnet",
    base: "base-mainnet",
    arbitrum: "arb-mainnet",
    robinhood: "robinhood-mainnet",
    arc: "arc-testnet",
  };
  return `https://${subdomain[chain]}.g.alchemy.com/v2/${key}`;
}

function getClient(chain: keyof typeof CHAIN_MAP) {
  return createPublicClient({
    chain: CHAIN_MAP[chain],
    transport: http(alchemyRpcUrl(chain)),
  });
}

// Minimal ERC721/1155 ABI fragments used for holder-gate checks
const ERC721_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// thirdweb DropERC721/1155 claim-condition read (covers a large share of self-serve EVM drops)
const THIRDWEB_DROP_ABI = [
  {
    name: "getActiveClaimConditionId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getClaimConditionById",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "conditionId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "startTimestamp", type: "uint256" },
          { name: "maxClaimableSupply", type: "uint256" },
          { name: "supplyClaimed", type: "uint256" },
          { name: "quantityLimitPerWallet", type: "uint256" },
          { name: "merkleRoot", type: "bytes32" },
          { name: "pricePerToken", type: "uint256" },
          { name: "currency", type: "address" },
          { name: "metadata", type: "string" },
        ],
      },
    ],
  },
] as const;

export type EligibilityResult = {
  eligible: boolean;
  reason: string;
  details?: Record<string, unknown>;
};

/**
 * Checks wallet eligibility for an EVM mint.
 *
 * Two mechanisms are supported out of the box:
 *  1. Holder-gate: wallet must hold >= gate_min_balance of gate_token_address. Fully on-chain, always accurate.
 *  2. Public claim phase: if the drop contract exposes thirdweb-style claim conditions and the
 *     active phase has an empty merkleRoot, the mint is open to everyone (subject to supply/limits).
 *
 * NOTE: allowlist phases gated by an on-chain merkle root cannot be verified from the root alone —
 * proving membership requires the exact leaf/proof data from whoever built the tree (thirdweb, Manifold,
 * Highlight, or a custom build each hash addresses differently). If you have the raw allowlist
 * addresses for a mint, store them and check membership directly (see checkAgainstStoredAllowlist below)
 * rather than trying to reconstruct a matching proof.
 */
export async function checkEvmEligibility(
  wallet: string,
  mint: Mint
): Promise<EligibilityResult> {
  const chain = mint.chain as keyof typeof CHAIN_MAP;
  if (!(chain in CHAIN_MAP)) {
    return { eligible: false, reason: "Unsupported EVM chain for this mint." };
  }
  const client = getClient(chain);
  const walletAddress = getAddress(wallet);
  const contract = getAddress(mint.contract_address);

  // 1. Holder-gate check, if configured — this is fully verifiable on-chain.
  if (mint.gate_token_address) {
    try {
      const balance = await client.readContract({
        address: getAddress(mint.gate_token_address),
        abi: ERC721_BALANCE_ABI,
        functionName: "balanceOf",
        args: [walletAddress],
      });
      const meetsGate = Number(balance) >= (mint.gate_min_balance ?? 1);
      if (!meetsGate) {
        return {
          eligible: false,
          reason: `Requires holding at least ${mint.gate_min_balance} token(s) of ${mint.gate_token_address}.`,
          details: { balance: balance.toString() },
        };
      }
    } catch (err) {
      return {
        eligible: false,
        reason: "Could not read holder-gate contract — check the contract address.",
      };
    }
  }

  // 2. Try reading a thirdweb-style public claim phase.
  try {
    const conditionId = await client.readContract({
      address: contract,
      abi: THIRDWEB_DROP_ABI,
      functionName: "getActiveClaimConditionId",
    });
    const condition = await client.readContract({
      address: contract,
      abi: THIRDWEB_DROP_ABI,
      functionName: "getClaimConditionById",
      args: [conditionId],
    });

    const ZERO_ROOT =
      "0x0000000000000000000000000000000000000000000000000000000000000000".slice(0, 66);
    const isPublicPhase = condition.merkleRoot === ZERO_ROOT || /^0x0+$/.test(condition.merkleRoot);
    const supplyLeft = condition.maxClaimableSupply - condition.supplyClaimed;

    if (isPublicPhase) {
      return {
        eligible: supplyLeft > 0n,
        reason: supplyLeft > 0n ? "Public mint phase is open." : "Public phase is sold out.",
        details: { supplyLeft: supplyLeft.toString() },
      };
    }

    return {
      eligible: false,
      reason:
        "Current phase is allowlist-gated on-chain. This platform can't derive proof-of-membership from the merkle root alone — add the raw allowlist for this mint to check it directly.",
    };
  } catch {
    // Not a thirdweb-style contract, or the read failed — fall through.
  }

  return {
    eligible: false,
    reason:
      "Couldn't determine mint phase automatically for this contract type. Add mint_type-specific handling or a stored allowlist for this mint.",
  };
}

/** Checks a wallet against an admin-uploaded allowlist (exact-match, chain-agnostic). */
export function checkAgainstStoredAllowlist(wallet: string, allowlist: string[]): boolean {
  const normalized = getAddress(wallet);
  return allowlist.some((a) => {
    try {
      return getAddress(a) === normalized;
    } catch {
      return false;
    }
  });
}
