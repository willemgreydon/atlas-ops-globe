import { NextRequest, NextResponse } from "next/server";
import { runProvider } from "@/lib/core/provider";
import { liveNewsProvider } from "@/lib/providers/news";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 200) || undefined;
  // Cache per query so different searches don't clobber each other.
  const provider = liveNewsProvider(q);
  const result = await runProvider(provider, { cacheKey: `news:${q ?? "default"}` });
  return NextResponse.json({ ...result, rows: result.data });
}
