import { NextRequest, NextResponse } from "next/server";
import { listPersons, parsePage } from "@/lib/intel/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return NextResponse.json({ ...listPersons(parsePage(req.nextUrl.searchParams)), attribution: "Event Registry / Wikipedia" });
}
