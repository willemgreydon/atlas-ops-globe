import { NextRequest, NextResponse } from "next/server";
import { listWeather, parseBbox, parsePage } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = listWeather(parsePage(sp), {
    variable: sp.get("variable") ?? undefined,
    bbox: parseBbox(sp.get("bbox")),
  });
  return NextResponse.json({ ...attachFreshness(result, "weather", "observedAt"), provider: "openmeteo", attribution: "Open-Meteo (CC BY 4.0)" });
}
