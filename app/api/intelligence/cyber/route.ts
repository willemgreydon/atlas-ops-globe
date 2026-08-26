import { NextRequest, NextResponse } from "next/server";
import { listVulnerabilities, parsePage, parseSince } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = listVulnerabilities(parsePage(sp), {
    kevOnly: sp.get("kev") === "1" || sp.get("kev") === "true",
    since: parseSince(sp.get("since")),
  });
  return NextResponse.json({ ...attachFreshness(result, "cyber", "publishedAt"), attribution: "CISA KEV / NVD" });
}
