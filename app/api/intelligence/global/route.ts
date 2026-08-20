import { NextResponse } from "next/server";
import { buildGlobalSnapshot } from "@/lib/intel/global";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(buildGlobalSnapshot());
}
