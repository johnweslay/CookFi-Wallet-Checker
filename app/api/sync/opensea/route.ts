export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";
import {
  getDrops,
  getDropDetail,
  mapOpenSeaChain,
  mapStageType,
  formatPrice,
  type OpenSeaDropSummary,
} from "../../../../lib/opensea/client";

// Triggered either by Vercel Cron (Authorization: Bearer $CRON_SECRET, set automatically
// by Vercel when this path is registered in vercel.json) or manually from /admin using
// ADMIN_SECRET — either secret is accepted.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const ok = auth === `Bearer ${process.env.CRON_SECRET}` || auth === `Bearer ${process.env.ADMIN_SECRET}`;
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const summary = { synced: 0, skipped_chain: 0, errors: [] as string[] };

  try {
    const [upcoming, featured] = await Promise.all([getDrops("upcoming", 100), getDrops("featured", 100)]);

    const seen = new Set<string>();
    const drops: OpenSeaDropSummary[] = [];
    for (const d of [...upcoming, ...featured]) {
      if (!seen.has(d.collection_slug)) {
        seen.add(d.collection_slug);
        drops.push(d);
      }
    }

    for (const drop of drops) {
      const chain = mapOpenSeaChain(drop.chain);
      if (!chain) {
        summary.skipped_chain++;
        continue;
      }

      try {
        const detail = await getDropDetail(drop.collection_slug);
        if (!detail) continue;

        const { data: mint, error: mintError } = await db
          .from("mints")
          .upsert(
            {
              name: detail.collection_name || detail.collection_slug,
              chain,
              contract_address: detail.contract_address,
              source: "opensea",
              source_url: detail.opensea_url,
              image_url: detail.image_url || null,
              mint_type: "seaport_drop",
              status: detail.is_minting ? "live" : "upcoming",
              total_supply: detail.max_supply ? Number(detail.max_supply) : null,
              total_minted: detail.total_supply ? Number(detail.total_supply) : 0,
              opensea_slug: detail.collection_slug,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "chain,contract_address" }
          )
          .select()
          .single();

        if (mintError || !mint) {
          summary.errors.push(`${drop.collection_slug}: ${mintError?.message}`);
          continue;
        }

        for (let i = 0; i < detail.stages.length; i++) {
          const stage = detail.stages[i];
          const { error: phaseError } = await db.from("mint_phases").upsert(
            {
              mint_id: mint.id,
              external_stage_id: stage.uuid,
              name: stage.label || stage.stage_type,
              requirement_type: mapStageType(stage.stage_type),
              price_display: formatPrice(stage.price, chain),
              per_wallet_limit: Number(stage.max_per_wallet) || 1,
              opens_at: stage.start_time || null,
              sort_order: i,
            },
            { onConflict: "mint_id,external_stage_id" }
          );
          if (phaseError) summary.errors.push(`${drop.collection_slug} stage ${stage.uuid}: ${phaseError.message}`);
        }

        summary.synced++;
      } catch (err: any) {
        summary.errors.push(`${drop.collection_slug}: ${err.message}`);
      }
    }

    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message, ...summary }, { status: 500 });
  }
}
