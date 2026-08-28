import { NextRequest, NextResponse } from "next/server";
import { listVessels, parseBbox, parsePage } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";
import { emptyPage, safeVault } from "@/lib/intel/safe-route";
import { cachedFetch } from "@/lib/intel/live";
import { aisConfigured, fetchAisSnapshot } from "@/lib/providers/aisstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15; // the AIS collection holds the socket ~5s

/**
 * Live vessels from AISStream (real-time global AIS, reachable from Vercel) when
 * AISSTREAM_API_KEY is set — this replaces the empty MarineTraffic vault path and
 * fills the Maritime layer worldwide. Falls back to the vault otherwise. The
 * short-lived WebSocket snapshot is coalesced to one collection per TTL window.
 */
const TTL_MS = 30_000;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (aisConfigured()) {
    try {
      const vessels = await cachedFetch("vessels:ais", TTL_MS, () => fetchAisSnapshot());
      const rows = vessels as unknown as Record<string, unknown>[];
      const result = { data: rows, page: { limit: rows.length, offset: 0, count: rows.length, nextOffset: null } };
      return NextResponse.json({ ...attachFreshness(result, "vessels", "lastContact"), provider: "aisstream", attribution: "AISStream.io" });
    } catch (e) {
      return NextResponse.json({ ...emptyPage({ provider: "aisstream", attribution: "AISStream.io" }, "vessels"), error: e instanceof Error ? e.message : String(e) });
    }
  }
  // No AIS key → honest vault read (empty/OFFLINE without MarineTraffic data).
  return safeVault(
    () => ({ ...attachFreshness(listVessels(parsePage(sp), { bbox: parseBbox(sp.get("bbox")) }), "vessels", "lastContact"), provider: "marinetraffic", attribution: "MarineTraffic" }),
    emptyPage({ provider: "marinetraffic", attribution: "MarineTraffic" }, "vessels"),
  );
}
