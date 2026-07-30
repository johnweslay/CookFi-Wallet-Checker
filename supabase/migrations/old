-- Migration: add Robinhood Chain and Arc (testnet) as supported chains.
-- Run this in the Supabase SQL Editor — safe to run once on a database that
-- already has the original schema.sql applied.

alter table mints drop constraint if exists mints_chain_check;
alter table mints add constraint mints_chain_check
  check (chain in ('ethereum', 'polygon', 'base', 'arbitrum', 'robinhood', 'arc', 'solana'));
