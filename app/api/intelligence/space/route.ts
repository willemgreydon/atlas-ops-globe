import { NextRequest, NextResponse } from "next/server";
import { listSpace, parsePage } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const result = listSpace(parsePage(req.nextUrl.searchParams));
  // Freshness is keyed on TLE epoch age — an old TLE must not read as live (§19).
  return NextResponse.json({ ...attachFreshness(result, "space", "epoch"), attribution: "CelesTrak" });
}
