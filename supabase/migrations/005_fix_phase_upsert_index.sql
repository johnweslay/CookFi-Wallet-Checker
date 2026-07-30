-- Migration: fix the mint_phases unique index so upsert's ON CONFLICT can match it.
-- The original partial index (WHERE external_stage_id IS NOT NULL) from 004 is never
-- matched by Supabase's generated `ON CONFLICT (mint_id, external_stage_id)` clause,
-- since Postgres requires the ON CONFLICT target to reference the index's predicate too
-- when it's partial. A plain unique index avoids the issue entirely — NULLs never
-- collide with each other in a unique index, so manually-added phases
-- (external_stage_id = null) still coexist freely.

drop index if exists idx_phases_external;
create unique index if not exists idx_phases_external on mint_phases (mint_id, external_stage_id);
