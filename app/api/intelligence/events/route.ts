import { NextRequest, NextResponse } from "next/server";
import { listEvents, parseBbox, parsePage, parseSince } from "@/lib/intel/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = listEvents(parsePage(sp), {
    kind: sp.get("kind") ?? undefined,
    country: sp.get("country") ?? undefined,
    bbox: parseBbox(sp.get("bbox")),
    since: parseSince(sp.get("since")),
  });
  return NextResponse.json(result);
}
