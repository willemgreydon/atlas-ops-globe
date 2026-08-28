import { NextRequest } from "next/server";
import { listVessels, parseBbox, parsePage } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";
import { emptyPage, safeVault } from "@/lib/intel/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  // Honest liveness from the newest AIS contact's age (audit P0-1). With no key
  // there are no vessels → freshness "unknown" → OFFLINE, as before.
  return safeVault(
    () => ({ ...attachFreshness(listVessels(parsePage(sp), { bbox: parseBbox(sp.get("bbox")) }), "vessels", "lastContact"), provider: "marinetraffic", attribution: "MarineTraffic" }),
    emptyPage({ provider: "marinetraffic", attribution: "MarineTraffic" }, "vessels"),
  );
}
