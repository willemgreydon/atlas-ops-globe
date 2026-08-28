import { NextResponse } from "next/server";
import { mergeArrayResults, runProvider } from "@/lib/core/provider";
import { eonetProvider } from "@/lib/providers/eonet";
import { usgsProvider } from "@/lib/providers/usgs";
import { gdacsProvider } from "@/lib/providers/gdacs";

export const dynamic = "force-dynamic";

export async function GET() {
  // USGS = quakes, EONET = fires/storms/volcanoes form the reliable core that
  // sets the feed status. GDACS (floods/cyclones/droughts — the events that fill
  // Asia & Africa) is SUPPLEMENTARY: it only adds data when healthy and never
  // drags the feed to mock/cached if it hiccups (mergeArrayResults takes the
  // worst status, so folding a flaky GDACS into it would degrade everything).
  const [eonet, usgs, gdacs] = await Promise.all([
    runProvider(eonetProvider),
    runProvider(usgsProvider),
    runProvider(gdacsProvider),
  ]);
  const merged = mergeArrayResults([eonet, usgs], "eonet+usgs");
  const gdacsData = gdacs.status !== "mock" && !gdacs.error ? gdacs.data : [];
  const data = [...merged.data, ...gdacsData];
  return NextResponse.json({
    ...merged,
    data,
    rows: data,
    count: data.length,
    source: gdacsData.length ? "eonet+usgs+gdacs" : "eonet+usgs",
  });
}
