import { NextRequest, NextResponse } from "next/server";
import { runProvider } from "@/lib/core/provider";
import { gdeltProvider } from "@/lib/providers/gdelt";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 200) || undefined;
  // Cache per query so different searches don't clobber each other.
  const provider = gdeltProvider(q);
  const result = await runProvider(provider, { cacheKey: `gdelt:${q ?? "default"}` });
  return NextResponse.json({ ...result, rows: result.data });
}
