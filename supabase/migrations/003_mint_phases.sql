-- Migration: multi-phase mints (Team / OG / GTD / FCFS / Public, etc)
-- Run this in the Supabase SQL Editor after 002_add_robinhood_arc.sql

-- Extra display/metadata fields on mints
alter table mints add column if not exists website_url text;
alter table mints add column if not exists twitter_url text;
alter table mints add column if not exists image_url text;
alter table mints add column if not exists total_supply integer;
alter table mints add column if not exists total_minted integer default 0; -- admin-updated for now; see README

create table if not exists mint_phases (
  id uuid primary key default gen_random_uuid(),
  mint_id uuid not null references mints (id) on delete cascade,
  name text not null,                    -- 'Team', 'OG', 'GTD Phase', 'FCFS Phase', 'Public', etc.
  requirement_type text not null check (
    requirement_type in ('public', 'allowlist', 'holder_gate', 'team')
  ),
  price_display text default 'Free',     -- display string, e.g. "0.001 ETH" or "Free"
  per_wallet_limit integer default 1,
  opens_at timestamptz,
  phase_supply integer,                  -- max mintable in this phase, if known
  phase_minted integer default 0,        -- admin-updated for now; see README
  gate_token_address text,               -- for requirement_type = 'holder_gate'
  gate_min_balance numeric default 1,
  sort_order integer default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_phases_mint on mint_phases (mint_id);

-- Stored allowlists for phases where requirement_type = 'allowlist'.
-- Exact-match membership check — see README for why this is used instead of
-- reconstructing on-chain merkle proofs.
create table if not exists phase_allowlist (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references mint_phases (id) on delete cascade,
  wallet_address text not null
);

create index if not exists idx_allowlist_phase on phase_allowlist (phase_id);
create unique index if not exists idx_allowlist_unique on phase_allowlist (phase_id, wallet_address);

alter table mint_phases enable row level security;
create policy "Public can read phases" on mint_phases for select using (true);

alter table phase_allowlist enable row level security;
-- Allowlist addresses are NOT publicly readable (avoids leaking the full list) —
-- membership is checked server-side only, via the service role in the eligibility route.
create policy "No public read on allowlist" on phase_allowlist for select using (false);
