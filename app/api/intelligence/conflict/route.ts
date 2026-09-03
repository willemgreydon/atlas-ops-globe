import { NextRequest } from "next/server";
import { listEvents, parsePage } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";
import { safeVault, emptyPage } from "@/lib/intel/safe-route";
import { runProvider } from "@/lib/core/provider";
import { ucdpProvider, ucdpConfigured } from "@/lib/providers/ucdp";
import { gdeltConflictProvider } from "@/lib/providers/gdelt-conflict";
import type { ProviderResult, WorldEvent } from "@/types/domain";

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

/** Live rows from a provider result, or [] when unconfigured/errored/mock. */
const liveRows = (r: ProviderResult<WorldEvent[]> | null): Record<string, unknown>[] =>
  r && r.status !== "mock" && !r.error ? r.data.map(flatten) : [];

/**
 * Conflict & unrest feed, merged from three sources, best → baseline:
 *  1. UCDP  — curated, fatality-verified events (needs UCDP_ACCESS_TOKEN).
 *  2. GDELT — keyless, media-derived conflict reporting (dense over Central
 *     Africa/Sahel), the always-on baseline so the layer works with no token.
 *  3. ACLED vault — the persisted baseline.
 *
 * Every upstream is fetched through the provider framework, so a hiccup or a
 * missing token can never 500 or fake liveness — it just contributes nothing.
 * The vault read is wrapped in safeVault so the Turso quota can't 500 the route.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // Live sources first — both keyless-safe, neither throws.
  const [ucdp, gdelt] = await Promise.all([
    ucdpConfigured() ? runProvider(ucdpProvider) : Promise.resolve(null),
    runProvider(gdeltConflictProvider),
  ]);
  const ucdpRows = liveRows(ucdp);
  const gdeltRows = liveRows(gdelt);
  const liveRowsAll = [...ucdpRows, ...gdeltRows];
  const live = liveRowsAll.length > 0;
  const liveSource = [ucdpRows.length ? "ucdp" : "", gdeltRows.length ? "gdelt" : ""].filter(Boolean).join("+");

  return safeVault(
    () => {
      const page = attachFreshness(
        listEvents(parsePage(sp), { kind: "conflict" }),
        "conflict",
        "occurredAt",
      );
      const rows = [...liveRowsAll, ...(page.data as Record<string, unknown>[])];
      return {
        ...page,
        rows,
        data: rows,
        count: rows.length,
        // Live upstream wins the status; otherwise let the store derive honest
        // freshness from the vault envelope (never mislabel a stale feed LIVE).
        ...(live ? { status: "live", source: `${liveSource}+vault` } : { source: "acled-vault" }),
      };
    },
    // Vault unavailable (quota/cold replica): still serve the live rows.
    {
      ...emptyPage({}, "conflict"),
      rows: liveRowsAll,
      data: liveRowsAll,
      count: liveRowsAll.length,
      status: live ? "live" : "offline",
      source: live ? liveSource : "acled-vault",
    },
  );
}
