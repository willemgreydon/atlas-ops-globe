import { NextRequest, NextResponse } from "next/server";
import { listNews, parsePage, parseSince } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = listNews(parsePage(sp), {
    country: sp.get("country") ?? undefined,
    since: parseSince(sp.get("since")),
  });
  return NextResponse.json({ ...attachFreshness(result, "news", "publishedAt"), attribution: "The GDELT Project" });
}
