-- Migration: allow safe upsert for auto-synced mints (avoid duplicate rows
-- when the same collection is synced repeatedly).

create unique index if not exists idx_mints_chain_contract
  on mints (chain, contract_address);
