import { NextRequest } from "next/server";
import { listEvents, parsePage } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";
import { safeVault, emptyPage } from "@/lib/intel/safe-route";
import { runProvider } from "@/lib/core/provider";
import { ucdpProvider, ucdpConfigured } from "@/lib/providers/ucdp";
import type { WorldEvent } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** WorldEvent → the flat {lat,lon,...} row shape the store's mapper expects. */
function flatten(e: WorldEvent): Record<string, unknown> {
  return {
    id: e.id,
    kind: e.kind,
    title: e.title,
    summary: e.summary,
    severity: e.severity,
    occurredAt: e.occurredAt,
    lat: e.location.lat,
    lon: e.location.lon,
    countryCode: e.countryCode,
    source: e.source,
    sourceUrl: e.sourceUrl,
    confidence: e.confidence,
    tags: e.tags,
  };
}

/**
 * Conflict & unrest feed. UCDP live events (dense over Central Africa/Sahel —
 * needs UCDP_ACCESS_TOKEN) are merged OVER the ACLED vault baseline. UCDP is
 * fetched through the provider framework, so a hiccup or a missing token can
 * never 500 or fake liveness — it just contributes nothing and the layer runs
 * on the vault. The vault read is wrapped in safeVault so the Turso quota can't
 * 500 the route either.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // UCDP first (never throws; empty when unconfigured/errored).
  const ucdp = ucdpConfigured() ? await runProvider(ucdpProvider) : null;
  const ucdpRows = ucdp && ucdp.status !== "mock" && !ucdp.error ? ucdp.data.map(flatten) : [];
  const live = ucdpRows.length > 0;

  return safeVault(
    () => {
      const page = attachFreshness(
        listEvents(parsePage(sp), { kind: "conflict" }),
        "conflict",
        "occurredAt",
      );
      const rows = [...ucdpRows, ...(page.data as Record<string, unknown>[])];
      return {
        ...page,
        rows,
        data: rows,
        count: rows.length,
        // Live UCDP wins the status; otherwise let the store derive honest
        // freshness from the vault envelope (never mislabel a stale feed LIVE).
        ...(live ? { status: "live", source: "ucdp+vault" } : { source: "acled-vault" }),
      };
    },
    // Vault unavailable (quota/cold replica): still serve whatever UCDP gave us.
    {
      ...emptyPage({}, "conflict"),
      rows: ucdpRows,
      data: ucdpRows,
      count: ucdpRows.length,
      status: live ? "live" : "offline",
      source: live ? "ucdp" : "acled-vault",
    },
  );
}
