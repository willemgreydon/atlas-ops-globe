import { NextResponse } from "next/server";
import { mergeArrayResults, runProvider } from "@/lib/core/provider";
import { eonetProvider } from "@/lib/providers/eonet";
import { usgsProvider } from "@/lib/providers/usgs";
import { gdacsProvider } from "@/lib/providers/gdacs";

export const dynamic = "force-dynamic";

export async function GET() {
  // USGS = quakes, EONET = fires/storms/volcanoes, GDACS = floods/cyclones/droughts
  // (the events that fill Asia & Africa). Each degrades independently.
  const [eonet, usgs, gdacs] = await Promise.all([
    runProvider(eonetProvider),
    runProvider(usgsProvider),
    runProvider(gdacsProvider),
  ]);
  const merged = mergeArrayResults([eonet, usgs, gdacs], "eonet+usgs+gdacs");
  return NextResponse.json({ ...merged, rows: merged.data });
}
