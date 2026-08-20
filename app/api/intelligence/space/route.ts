import { NextRequest, NextResponse } from "next/server";
import { listSpace, parsePage } from "@/lib/intel/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const result = listSpace(parsePage(req.nextUrl.searchParams));
  return NextResponse.json({ ...result, attribution: "CelesTrak" });
}
