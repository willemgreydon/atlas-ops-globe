import { NextRequest, NextResponse } from "next/server";
import { listCountries, parsePage } from "@/lib/intel/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return NextResponse.json(listCountries(parsePage(req.nextUrl.searchParams)));
}
