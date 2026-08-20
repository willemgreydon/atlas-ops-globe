import { NextResponse } from "next/server";
import { runProvider } from "@/lib/core/provider";
import { openSkyProvider } from "@/lib/providers/opensky";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await runProvider(openSkyProvider);
  return NextResponse.json({ ...result, rows: result.data });
}
