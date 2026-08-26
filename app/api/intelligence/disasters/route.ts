import { NextRequest, NextResponse } from "next/server";
import { listEvents, parseBbox, parsePage, parseSince } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = listEvents(parsePage(sp), {
    kind: "disaster",
    country: sp.get("country") ?? undefined,
    bbox: parseBbox(sp.get("bbox")),
    since: parseSince(sp.get("since")),
  });
  return NextResponse.json(attachFreshness(result, "disaster", "occurredAt"));
}
