import { NextResponse } from "next/server";
import { mergeArrayResults, runProvider } from "@/lib/core/provider";
import { eonetProvider } from "@/lib/providers/eonet";
import { usgsProvider } from "@/lib/providers/usgs";

export const dynamic = "force-dynamic";

export async function GET() {
  const [eonet, usgs] = await Promise.all([runProvider(eonetProvider), runProvider(usgsProvider)]);
  const merged = mergeArrayResults([eonet, usgs], "eonet+usgs");
  return NextResponse.json({ ...merged, rows: merged.data });
}
