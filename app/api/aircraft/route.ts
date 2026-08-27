import { NextResponse } from "next/server";
import { getDb, isRemote, syncDb } from "@/lib/intel/db";
import { mockAircraft } from "@/lib/mock";
import type { AircraftState, DataStatus } from "@/types/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Aircraft cannot be fetched live on Vercel: OpenSky blocks datacenter egress —
 * verified in prod that both its auth and API hosts hang from the Node (AWS)
 * *and* Edge runtimes. Instead the GitHub Action ingests OpenSky from GitHub's
 * egress (which OpenSky permits) into the Turso vault's `aircraft` table; this
 * route serves that snapshot. Status is derived honestly from the newest
 * observation so the UI shows live/delayed/cached by real age, never a fake
 * "live". Falls back to mock only when the snapshot is empty or unreadable.
 */

// Pull the latest replica state before reading, throttled so warm functions
// don't hammer the Turso primary on every 15s poll.
let lastSync = 0;
function refreshReplica(): void {
  if (!isRemote()) return;
  const now = Date.now();
  if (now - lastSync < 30_000) return;
  lastSync = now;
  try {
    syncDb();
  } catch {
    /* serve whatever the local replica already has */
  }
}

export async function GET() {
  try {
    refreshReplica();
    const rows = getDb()
      .prepare(
        `SELECT id, callsign, country, lat, lon, alt, velocity, heading, on_ground, last_contact
         FROM aircraft WHERE lat IS NOT NULL AND lon IS NOT NULL
         ORDER BY last_contact DESC LIMIT 3000`,
      )
      .all() as Record<string, unknown>[];

    if (rows.length === 0) {
      const data = mockAircraft();
      return NextResponse.json({ data, rows: data, source: "mock", status: "mock", stale: true, count: data.length });
    }

    const data: AircraftState[] = rows.map((r) => ({
      id: String(r.id),
      callsign: r.callsign != null ? String(r.callsign) : undefined,
      country: r.country != null ? String(r.country) : undefined,
      position: { lat: Number(r.lat), lon: Number(r.lon), alt: r.alt != null ? Number(r.alt) : undefined },
      velocityMs: r.velocity != null ? Number(r.velocity) : undefined,
      headingDeg: r.heading != null ? Number(r.heading) : undefined,
      onGround: r.on_ground != null ? Number(r.on_ground) === 1 : undefined,
      lastContact: String(r.last_contact),
    }));

    const newest = data.reduce((m, a) => Math.max(m, Date.parse(a.lastContact) || 0), 0);
    const ageMin = (Date.now() - newest) / 60_000;
    const status: DataStatus = ageMin < 90 ? "live" : ageMin < 6 * 60 ? "delayed" : "cached";
    return NextResponse.json({
      data,
      rows: data,
      source: "vault:opensky",
      status,
      stale: status !== "live",
      count: data.length,
      fetchedAt: newest ? new Date(newest).toISOString() : undefined,
    });
  } catch (e) {
    const data = mockAircraft();
    return NextResponse.json({
      data,
      rows: data,
      source: "mock",
      status: "offline",
      stale: true,
      count: data.length,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
