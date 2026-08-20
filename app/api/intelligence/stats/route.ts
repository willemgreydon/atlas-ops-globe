import { NextResponse } from "next/server";
import { tableCounts } from "@/lib/intel/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ generatedAt: new Date().toISOString(), counts: tableCounts() });
}
