import { NextRequest, NextResponse } from "next/server";
import { runProvider } from "@/lib/core/provider";
import { openSkyProvider, diagnoseOpenSky } from "@/lib/providers/opensky";

export const dynamic = "force-dynamic";
// OpenSky drops Vercel's Node (AWS us-east-1) serverless egress — both its auth
// and API hosts hang until timeout. The Edge runtime egresses from a different
// network, which OpenSky does not block. This route only uses fetch + in-memory
// cache, so it's Edge-safe.
export const runtime = "edge";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("debug") === "1") {
    return NextResponse.json(await diagnoseOpenSky());
  }
  const result = await runProvider(openSkyProvider);
  return NextResponse.json({ ...result, rows: result.data });
}
