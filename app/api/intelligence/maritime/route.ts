import { NextRequest, NextResponse } from "next/server";
import { listVessels, parseBbox, parsePage } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = listVessels(parsePage(sp), { bbox: parseBbox(sp.get("bbox")) });
  // Honest liveness from the newest AIS contact's age (audit P0-1). With no key
  // there are no vessels → freshness "unknown" → OFFLINE, as before.
  return NextResponse.json({ ...attachFreshness(result, "vessels", "lastContact"), provider: "marinetraffic", attribution: "MarineTraffic" });
}
