import { NextRequest, NextResponse } from "next/server";
import { listVessels, parseBbox, parsePage } from "@/lib/intel/queries";
import { marineTrafficConfigured } from "@/lib/intel/providers/marinetraffic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = listVessels(parsePage(sp), { bbox: parseBbox(sp.get("bbox")) });
  return NextResponse.json({
    ...result,
    // Honest liveness: the maritime feed is OFFLINE until a credential is set.
    provider: "marinetraffic",
    status: marineTrafficConfigured() ? "live" : "offline",
    attribution: "MarineTraffic",
  });
}
