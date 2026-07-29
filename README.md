# NFT Mint Eligibility Checker

Public platform for checking wallet eligibility across upcoming/live NFT mints — EVM and Solana.

## Architecture

- **No wallet connect required** — users paste their wallet address(es) into a plain input field. This is a read-only lookup (no signature, no transaction), so there's no reason to ask people to connect a wallet to an unfamiliar site. `viem`'s `isAddress` and `@solana/web3.js`'s `PublicKey` are used client-side just to validate the format before hitting the API.
- **Discovery**: mints are added manually via `POST /api/mints/add` (admin-only, protected by `ADMIN_SECRET`). No third-party API reliably lists all upcoming mints across OpenSea + LaunchMyNFT + others, so this is curated for now.
- **Eligibility**: checked **on-chain**, not through marketplace APIs — marketplace APIs (OpenSea, Magic Eden) don't expose per-wallet allowlist data anyway.
  - EVM: `lib/evm/checkEligibility.ts` — reads holder-gate balances and thirdweb-style public claim conditions via Alchemy RPC (`viem`).
  - Solana: `lib/solana/checkEligibility.ts` — reads holder-gate balances via Helius DAS API and Candy Machine v3 guard state via `@metaplex-foundation/mpl-candy-machine`.

## Known limitation: on-chain allowlist phases

If a mint's current phase is gated by an on-chain merkle root (allowlist), **the root alone doesn't prove membership** — you need the original address list used to build the tree, and each platform (thirdweb, Manifold, Highlight, custom Candy Guard configs) constructs it differently. Two ways to handle this:

1. **Practical (implemented)**: store the raw allowlist addresses for a mint yourself (e.g. a new `allowlists` table keyed by `mint_id`) and check membership directly — see `checkAgainstStoredAllowlist()` in both `lib/evm` and `lib/solana`. This is exact-match, not proof-based, so it works regardless of the tree construction.
2. **Exact on-chain proof**: reconstruct the specific project's merkle tree format and generate a real proof. Only worth it if you need the wallet to also be able to mint through your UI (not just check eligibility).

For now, mints in an on-chain-allowlist phase return `eligible: false` with an explanation, unless you've populated a stored allowlist.

## Setup

1. Run `supabase/schema.sql` in your Supabase project's SQL editor.
2. Copy `.env.example` to `.env.local` and fill in:
   - Supabase URL + anon key + service role key
   - Alchemy API key (EVM RPC)
   - Helius API key (Solana RPC)
   - WalletConnect project ID (for EVM wallet connect)
   - `ADMIN_SECRET` — any strong random string, used to protect the add-mint route
3. `npm install`
4. `npm run dev`

## Adding a mint (admin)

```bash
curl -X POST https://your-domain.com/api/mints/add \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example Collection",
    "chain": "ethereum",
    "contract_address": "0x...",
    "mint_type": "thirdweb_drop",
    "source": "opensea",
    "source_url": "https://opensea.io/collection/example",
    "mint_start": "2026-08-01T18:00:00Z",
    "status": "upcoming"
  }'
```

For a holder-gated mint, also pass `gate_token_address` and `gate_min_balance`.

## Next steps worth prioritizing

- Add an `allowlists` table + admin upload flow for the stored-allowlist eligibility path.
- Add a cron/background job to auto-flip `status` from `upcoming` → `live` → `ended` based on `mint_start`/`mint_end`.
- Add per-mint `mint_type` handlers for Manifold and Highlight claim conditions (currently only thirdweb-style is implemented for EVM).
- Rate-limit `/api/check-eligibility` per wallet/IP once traffic picks up — `eligibility_checks` table already logs each call for this.
