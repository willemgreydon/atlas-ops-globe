import { NextRequest, NextResponse } from "next/server";
import { listSanctions, parsePage } from "@/lib/intel/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = listSanctions(parsePage(sp), { q: sp.get("q") ?? undefined, type: sp.get("type") ?? undefined });
  return NextResponse.json({ ...result, attribution: "U.S. Treasury OFAC (SDN)" });
}
