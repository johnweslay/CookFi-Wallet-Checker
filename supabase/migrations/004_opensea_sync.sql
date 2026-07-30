-- Migration: support OpenSea sync (upsert-safe mints + phases)

alter table mints add column if not exists opensea_slug text;
alter table mints add column if not exists synced_at timestamptz;

-- One row per (chain, contract) so re-syncing updates instead of duplicating.
create unique index if not exists idx_mints_chain_contract on mints (chain, contract_address);

alter table mint_phases add column if not exists external_stage_id text;

-- One row per (mint, external stage) — only applies to synced phases;
-- manually admin-added phases have external_stage_id = null and aren't constrained by this.
create unique index if not exists idx_phases_external
  on mint_phases (mint_id, external_stage_id)
  where external_stage_id is not null;
