import { NextRequest, NextResponse } from "next/server";
import { runProvider } from "@/lib/core/provider";
import { openSkyProvider, diagnoseOpenSky } from "@/lib/providers/opensky";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// OpenSky's OAuth + worldwide states/all round-trip can run ~10s; give the
// serverless function headroom so a slow-but-successful fetch isn't killed and
// forced to mock.
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("debug") === "1") {
    return NextResponse.json(await diagnoseOpenSky());
  }
  const result = await runProvider(openSkyProvider);
  return NextResponse.json({ ...result, rows: result.data });
}
