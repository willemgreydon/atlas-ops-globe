import { NextResponse } from "next/server";
import { runProvider } from "@/lib/core/provider";
import { openSkyProvider } from "@/lib/providers/opensky";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// OpenSky's OAuth + worldwide states/all round-trip can run ~10s; give the
// serverless function headroom so a slow-but-successful fetch isn't killed and
// forced to mock.
export const maxDuration = 30;

export async function GET() {
  const result = await runProvider(openSkyProvider);
  return NextResponse.json({ ...result, rows: result.data });
}
