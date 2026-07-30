-- NFT Eligibility Checker — core schema
-- Run this in the Supabase SQL editor for your project.

create table if not exists mints (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chain text not null check (chain in ('ethereum', 'polygon', 'base', 'arbitrum', 'robinhood', 'arc', 'solana')),
  contract_address text not null,          -- EVM contract address, or Solana Candy Machine ID
  source text,                              -- 'opensea', 'launchmynft', 'magiceden', 'manual'
  source_url text,
  mint_type text not null default 'unknown' check (
    mint_type in ('thirdweb_drop', 'manifold', 'highlight', 'candy_machine_v3', 'seaport_drop', 'unknown')
  ),
  -- Holder-gate config: if this mint requires holding another NFT/token to be eligible
  gate_token_address text,                  -- collection/token contract required for holder-gate checks
  gate_min_balance numeric default 1,
  mint_start timestamptz,
  mint_end timestamptz,
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'ended')),
  created_at timestamptz not null default now()
);

create index if not exists idx_mints_status on mints (status);
create index if not exists idx_mints_chain on mints (chain);

-- Optional: log each eligibility check for analytics / rate-limiting
create table if not exists eligibility_checks (
  id uuid primary key default gen_random_uuid(),
  mint_id uuid references mints (id) on delete cascade,
  wallet_address text not null,
  chain text not null,
  eligible boolean not null,
  reason text,
  checked_at timestamptz not null default now()
);

create index if not exists idx_checks_mint on eligibility_checks (mint_id);
create index if not exists idx_checks_wallet on eligibility_checks (wallet_address);

-- Row Level Security: mints are public-read; writes go through the service role only (admin API route)
alter table mints enable row level security;
create policy "Public can read mints" on mints for select using (true);

alter table eligibility_checks enable row level security;
create policy "Public can read own checks" on eligibility_checks for select using (true);
create policy "Public can insert checks" on eligibility_checks for insert with check (true);
