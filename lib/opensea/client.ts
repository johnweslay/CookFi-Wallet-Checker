// Thin client for OpenSea's Drops API — https://docs.opensea.io/reference/get_drops

const OPENSEA_BASE = "https://api.opensea.io/api/v2";

// Maps OpenSea's chain slugs to the ones this app supports. Chains we don't
// track (zora, blast, sei, etc.) are simply skipped during sync.
const CHAIN_MAP: Record<string, string> = {
  ethereum: "ethereum",
  polygon: "polygon",
  base: "base",
  arbitrum: "arbitrum",
  solana: "solana",
};

export const SUPPORTED_OPENSEA_CHAINS = Object.keys(CHAIN_MAP);

export type OpenSeaDropSummary = {
  collection_slug: string;
  collection_name?: string;
  chain: string;
  contract_address: string;
  drop_type: string;
  is_minting: boolean;
  image_url?: string;
  opensea_url: string;
};

export type OpenSeaDropStage = {
  uuid: string;
  stage_type: string;
  label?: string;
  price: string; // wei, decimal string
  price_currency_address: string;
  start_time: string;
  end_time: string;
  max_per_wallet: string;
};

export type OpenSeaDropDetail = OpenSeaDropSummary & {
  stages: OpenSeaDropStage[];
  total_supply?: string; // confusingly named by OpenSea — this is CURRENT minted count
  max_supply?: string; // this is the actual max supply
};

function headers() {
  const key = process.env.OPENSEA_API_KEY;
  if (!key) throw new Error("Missing OPENSEA_API_KEY environment variable.");
  return { "x-api-key": key };
}

/** Get a page of drops. type: 'featured' | 'upcoming' | 'recently_minted' */
export async function getDrops(
  type: "featured" | "upcoming" | "recently_minted",
  limit = 100
): Promise<OpenSeaDropSummary[]> {
  const chains = SUPPORTED_OPENSEA_CHAINS.join(",");
  const url = `${OPENSEA_BASE}/drops?type=${type}&limit=${limit}&chains=${chains}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`OpenSea getDrops(${type}) failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.drops ?? [];
}

/** Get full stage/supply detail for one drop by its OpenSea collection slug. */
export async function getDropDetail(slug: string): Promise<OpenSeaDropDetail | null> {
  const res = await fetch(`${OPENSEA_BASE}/drops/${encodeURIComponent(slug)}`, { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`OpenSea getDropDetail(${slug}) failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export function mapOpenSeaChain(chain: string): string | null {
  return CHAIN_MAP[chain] ?? null;
}

/** Formats a wei-denominated price string into a display string. Best-effort — assumes the
 *  chain's native token when price_currency_address is the zero address; otherwise just shows
 *  the raw token amount, since resolving arbitrary ERC-20 symbols isn't worth the extra RPC call. */
export function formatPrice(priceWei: string, chain: string): string {
  if (!priceWei || priceWei === "0") return "Free";
  const eth = Number(priceWei) / 1e18;
  const symbol = chain === "solana" ? "SOL" : chain === "polygon" ? "MATIC" : "ETH";
  return `${eth} ${symbol}`;
}

/** Best-effort mapping from OpenSea's stage_type to this app's requirement_type.
 *  OpenSea doesn't expose gated-phase address lists via this API (eligibility for those
 *  is checked through their own wallet-authenticated flow) — so anything that isn't clearly
 *  a public sale is marked 'allowlist' here, which will show "not eligible" until you upload
 *  addresses for it, or "unknown" if you'd rather flag it for manual follow-up instead. */
export function mapStageType(stageType: string): "public" | "allowlist" {
  return stageType === "public_sale" ? "public" : "allowlist";
}
