import { NextResponse } from "next/server";
import { getDb, isRemote, syncDb } from "@/lib/intel/db";
import { fetchAdsbLolStates } from "@/lib/providers/adsblol";
import { cachedFetch } from "@/lib/intel/live";
import { mockAircraft } from "@/lib/mock";
import type { AircraftState, DataStatus } from "@/types/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Hybrid aircraft feed.
 *
 *  - Real-time overlay: adsb.lol, tiled and fetched live from Vercel (it permits
 *    datacenter egress; OpenSky does not). This is genuine real-time data over
 *    the community receiver footprint (dense over N. America / Europe).
 *  - Global baseline: the OpenSky snapshot in the Turso `aircraft` table, written
 *    hourly by the GitHub Action (OpenSky is reachable from GitHub runners). It
 *    fills the regions/oceans adsb.lol tiles don't cover.
 *
 * The two are merged by ICAO id, preferring the fresher (live) sighting. Status
 * is derived honestly from the newest observation, and every marker carries its
 * own `lastContact` so a baseline plane never masquerades as real-time. Falls
 * back to baseline-only, then mock, as each source degrades.
 */

const LIVE_TTL_MS = 12_000; // aligns with the client's 15s poll; coalesces upstream tile fetches
const MAX = 3000;

// Pull the latest replica state before reading the baseline, throttled so warm
// functions don't hammer the Turso primary on every poll.
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

function readBaseline(): AircraftState[] {
  const rows = getDb()
    .prepare(
      `SELECT id, callsign, country, lat, lon, alt, velocity, heading, on_ground, last_contact
       FROM aircraft WHERE lat IS NOT NULL AND lon IS NOT NULL
       ORDER BY last_contact DESC LIMIT ${MAX}`,
    )
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    callsign: r.callsign != null ? String(r.callsign) : undefined,
    country: r.country != null ? String(r.country) : undefined,
    position: { lat: Number(r.lat), lon: Number(r.lon), alt: r.alt != null ? Number(r.alt) : undefined },
    velocityMs: r.velocity != null ? Number(r.velocity) : undefined,
    headingDeg: r.heading != null ? Number(r.heading) : undefined,
    onGround: r.on_ground != null ? Number(r.on_ground) === 1 : undefined,
    lastContact: String(r.last_contact),
  }));
}

/** Merge live over baseline by id, preferring the fresher sighting; newest first. */
function merge(live: AircraftState[], baseline: AircraftState[]): AircraftState[] {
  const byId = new Map<string, AircraftState>();
  for (const a of baseline) byId.set(a.id, a);
  for (const a of live) {
    const prev = byId.get(a.id);
    if (!prev || a.lastContact > prev.lastContact) byId.set(a.id, prev ? { ...prev, ...a } : a);
  }
  return [...byId.values()]
    .sort((a, b) => (a.lastContact < b.lastContact ? 1 : -1))
    .slice(0, MAX);
}

function statusFor(data: AircraftState[]): DataStatus {
  const newest = data.reduce((m, a) => Math.max(m, Date.parse(a.lastContact) || 0), 0);
  const ageMin = (Date.now() - newest) / 60_000;
  return ageMin < 90 ? "live" : ageMin < 6 * 60 ? "delayed" : "cached";
}

export async function GET() {
  let live: AircraftState[] = [];
  let liveError: string | undefined;
  try {
    live = await cachedFetch("aircraft:adsblol", LIVE_TTL_MS, () => fetchAdsbLolStates());
  } catch (e) {
    liveError = e instanceof Error ? e.message : String(e);
  }

  let baseline: AircraftState[] = [];
  try {
    refreshReplica();
    baseline = readBaseline();
  } catch {
    /* vault unreadable — rely on the live overlay alone */
  }

  const data = merge(live, baseline);
  if (data.length === 0) {
    const mock = mockAircraft();
    return NextResponse.json({ data: mock, rows: mock, source: "mock", status: "mock", stale: true, count: mock.length, error: liveError });
  }

  const newest = data.reduce((m, a) => Math.max(m, Date.parse(a.lastContact) || 0), 0);
  const source = live.length > 0 ? (baseline.length > 0 ? "adsb.lol+vault" : "adsb.lol") : "vault:opensky";
  const status = statusFor(data);
  return NextResponse.json({
    data,
    rows: data,
    source,
    status,
    stale: status !== "live",
    count: data.length,
    liveCount: live.length,
    baselineCount: baseline.length,
    fetchedAt: newest ? new Date(newest).toISOString() : undefined,
  });
}
