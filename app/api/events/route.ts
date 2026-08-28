import { NextResponse } from "next/server";
import { mergeArrayResults, runProvider } from "@/lib/core/provider";
import { eonetProvider } from "@/lib/providers/eonet";
import { usgsProvider } from "@/lib/providers/usgs";
import { gdacsProvider } from "@/lib/providers/gdacs";
import { firmsProvider, firmsConfigured } from "@/lib/providers/firms";
import { emscProvider } from "@/lib/providers/emsc";
import type { WorldEvent } from "@/types/domain";

export const dynamic = "force-dynamic";

/** Drop EMSC quakes that USGS already reports (same event, ~same place & time). */
function dedupeAgainstUsgs(emsc: WorldEvent[], usgs: WorldEvent[]): WorldEvent[] {
  return emsc.filter((e) => {
    const t = Date.parse(e.occurredAt);
    return !usgs.some(
      (u) =>
        Math.abs(u.location.lat - e.location.lat) < 0.7 &&
        Math.abs(u.location.lon - e.location.lon) < 0.7 &&
        Math.abs(Date.parse(u.occurredAt) - t) < 15 * 60_000,
    );
  });
}

export async function GET() {
  // USGS = quakes, EONET = fires/storms/volcanoes form the reliable core that
  // sets the feed status. EMSC (denser Euro-Med/Middle-East quakes), GDACS
  // (floods/cyclones/droughts) and FIRMS (dense active fires over Africa/Siberia/
  // China/Australia) are SUPPLEMENTARY: they only add data when healthy and never
  // drag the feed to mock/cached if they hiccup (mergeArrayResults takes the
  // worst status). FIRMS needs FIRMS_MAP_KEY.
  const [eonet, usgs, gdacs, firms, emsc] = await Promise.all([
    runProvider(eonetProvider),
    runProvider(usgsProvider),
    runProvider(gdacsProvider),
    firmsConfigured() ? runProvider(firmsProvider) : Promise.resolve(null),
    runProvider(emscProvider),
  ]);
  const merged = mergeArrayResults([eonet, usgs], "eonet+usgs");
  const extra = (r: typeof gdacs | null) => (r && r.status !== "mock" && !r.error ? r.data : []);
  const gdacsData = extra(gdacs);
  const firmsData = extra(firms);
  const emscData = dedupeAgainstUsgs(extra(emsc), usgs.data);
  const data = [...merged.data, ...emscData, ...gdacsData, ...firmsData];
  const source = ["eonet+usgs", emscData.length ? "emsc" : "", gdacsData.length ? "gdacs" : "", firmsData.length ? "firms" : ""].filter(Boolean).join("+");
  return NextResponse.json({ ...merged, data, rows: data, count: data.length, source });
}
