import { NextRequest, NextResponse } from "next/server";
import { listMarkets, parsePage } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const result = listMarkets(parsePage(req.nextUrl.searchParams));
  // Liveness now derives from the newest quote's age, not credential presence
  // (audit P0-1): a configured-but-unsynced feed no longer reads as live.
  return NextResponse.json({ ...attachFreshness(result, "markets", "ts"), provider: "finnhub", attribution: "Finnhub" });
}
