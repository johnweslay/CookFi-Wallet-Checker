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

## Automatic discovery: OpenSea sync

`/api/sync/opensea` pulls upcoming + featured drops from OpenSea's native Drops API (`GET /v2/drops` and `GET /v2/drops/{slug}`) and upserts them into `mints`/`mint_phases`. This replaces manual admin entry for anything that launches on OpenSea.

**Getting an API key without qualifying for a full one**: OpenSea's dashboard "Create key" flow requires a collection with real trading volume, which most people building a tool like this won't have. Skip it — use the **instant free-tier key** instead (OpenSea's own docs describe it as "no signup, no wallet, no human needed"), which just requires a `POST` to `https://api.opensea.io/api/v2/auth/keys`. Since that's a POST-only endpoint you can't just visit in a browser, and this project assumes no terminal access, there's a helper: tap **"Get OpenSea instant key"** on `/admin` — it calls `/api/admin/opensea-key`, which does the POST server-side and shows you the key to copy into `OPENSEA_API_KEY`. This key expires in 30 days; when it does, tap the same button again for a new one (or pursue a full key later once you have qualifying volume).

**Schedule**: runs once a day via Vercel Cron (`vercel.json`, `0 6 * * *` UTC) — that's the maximum frequency Vercel's Hobby plan allows; Pro unlocks per-minute schedules if you need it tighter. In between, hit **"Sync from OpenSea now"** on `/admin` for an on-demand refresh (protected by `ADMIN_SECRET`, same as the cron path is by `CRON_SECRET`).

**Chain coverage**: only chains this app already supports are synced (`ethereum`, `polygon`, `base`, `arbitrum`, `solana`) — everything else OpenSea covers (zora, blast, sei, etc.) is skipped. Robinhood Chain and Arc aren't in OpenSea's chain list yet, so those still need manual entry via `/admin`.

**Known limitations of the synced data:**
- **Gated-phase eligibility can't be auto-derived.** OpenSea's Drops API returns stage metadata (name, price, per-wallet limit, timing) but not the actual allowlist — checking a specific wallet against a gated phase is handled through OpenSea's own wallet-authenticated flow, which this app doesn't proxy. Synced phases that aren't `public_sale` are stored as `requirement_type: 'allowlist'` with an empty list, so they'll show "not eligible" until you upload real addresses for that phase (see below) — same limitation as manually-added allowlist phases.
- **Per-phase minted counts aren't available** — OpenSea gives total minted for the whole collection, not per-stage, so `phase_minted` stays 0 for synced phases. `total_minted`/`total_supply` at the mint level ARE live from OpenSea, just not the per-phase breakdown.
- **Prices are approximate** — OpenSea returns price in wei plus a currency contract address; this app assumes the chain's native token (ETH/MATIC/SOL) rather than resolving arbitrary ERC-20 symbols. Good enough for display, not for anything transactional.
- Mints synced this way get `source: 'opensea'` and an `opensea_slug` — re-syncing updates the same row (matched by `chain` + `contract_address`) rather than duplicating it.

## Setup

1. Run `supabase/schema.sql`, then each file in `supabase/migrations/` **in order** (001 → 002 → 003 → 004) in your Supabase project's SQL editor. Migration 003 adds `mint_phases`/`phase_allowlist`; migration 004 adds the columns/constraints the OpenSea sync needs to upsert safely.
2. Copy `.env.example` to `.env.local` and fill in:
   - Supabase URL + anon key + service role key
   - Alchemy API key (EVM RPC)
   - Helius API key (Solana RPC)
   - OpenSea API key (see `.env.example` for how to get an instant one)
   - `CRON_SECRET` — any strong random string, protects the sync route from the cron side
   - `ADMIN_SECRET` — any strong random string, protects the add-mint/allowlist/manual-sync routes
3. `npm install`
4. `npm run dev`

## Multi-phase drops

Each mint can have any number of phases (Team, OG, GTD, FCFS, Public, or custom names), each with its own price, per-wallet limit, open time, supply, and eligibility rule:

- **public** — open to everyone once `opens_at` passes.
- **team** — internal allocation, always reported not-eligible for wallet checks (there's nothing to check).
- **holder_gate** — wallet must hold ≥N of a given token/collection. Checked live on-chain.
- **allowlist** — wallet must be in a stored address list for that phase. Checked exact-match against `phase_allowlist` (see the on-chain-allowlist limitation note above — this is populated by you, not derived from a contract's merkle root).

Hitting "Check" on a drop card runs the wallet against **every phase at once** and shows a per-phase eligible/not-eligible badge — that's the one-click behavior.

### Adding a mint with phases (admin)

Use the `/admin` page (see below) — it has a repeatable "Phases" section. Under the hood it posts to `/api/mints/add` with a `phases` array; each phase becomes a row in `mint_phases`.

### Uploading an allowlist for a phase

After creating a mint with an `allowlist`-type phase, note its phase ID (visible in Supabase's Table Editor → `mint_phases`), then:

```bash
curl -X POST https://your-domain.com/api/phases/allowlist \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"phaseId": "the-phase-uuid", "addresses": ["0xabc...", "0xdef..."]}'
```

If you don't have terminal access, let me know and I'll add an allowlist upload box to `/admin` next.

### Known limitation: live minted counts

`total_minted` (mint-level) and `phase_minted` (per-phase) are **admin-entered fields right now, not live on-chain reads** — the screenshot-style "2/11 minted" figures update only when you update them via `/admin` or directly in Supabase. Making these live requires reading each phase's claimed-supply from its specific guard/claim-condition on-chain, which is contract-standard-specific (thirdweb vs Manifold vs Highlight vs Candy Guard groups) — a reasonable next step once you know which standards your tracked mints actually use.

## Admin page

`/admin` — form UI to add a mint plus its phases in one submission. No login beyond the shared secret; don't link to it publicly.

## Adding a mint (admin, no phases — legacy path)

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
