import { NextRequest, NextResponse } from "next/server";
import { listMarkets, parsePage } from "@/lib/intel/queries";
import { finnhubConfigured } from "@/lib/intel/providers/finnhub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const result = listMarkets(parsePage(req.nextUrl.searchParams));
  return NextResponse.json({
    ...result,
    provider: "finnhub",
    status: finnhubConfigured() ? "live" : "offline",
    attribution: "Finnhub",
  });
}
