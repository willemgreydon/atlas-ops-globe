import { fetchJson } from "@/lib/fetch-json";
import { isValidPoint } from "@/lib/core/geo";
import type { AircraftState } from "@/types/domain";

/**
 * adsb.lol — community ADS-B aggregator with an open REST API reachable directly
 * from Vercel (unlike OpenSky, which blocks datacenter egress). It exposes a
 * point+radius query capped at 250 nm, so global-ish coverage is assembled from
 * a fixed set of tiles over the world's densest traffic regions. Coverage is the
 * community receiver footprint: excellent over N. America / Europe, thinner over
 * Russia / China / Africa / open ocean — which is exactly why the aircraft route
 * still merges an OpenSky vault snapshot underneath as a global baseline.
 *
 * The same API shape is served by adsb.fi and airplanes.live; adsb.lol is the
 * primary. No key required; be courteous (few tiles, cached upstream).
 */

const KNOTS_TO_MS = 0.514444;
const FEET_TO_M = 0.3048;
const RADIUS_NM = 250;

/** Tile centres over dense/high-interest regions. Each pulls a 250 nm disc. */
export const ADSB_TILES: Array<[lat: number, lon: number]> = [
  [40, -80], // US NE
  [33, -97], // US S-central
  [37, -119], // US W
  [49, -100], // Canada prairies
  [54, -2], // UK / N Sea
  [48, 6], // Europe W
  [50, 16], // Europe central
  [41, 15], // Mediterranean
  [55, 37], // Moscow / W Russia
  [25, 51], // Gulf
  [22, 78], // India
  [31, 116], // E China
  [35, 139], // Japan / Korea
  [13, 100], // SE Asia
  [-33, 151], // SE Australia
  [-26, 28], // S Africa
  [6, 3], // W Africa (Lagos)
  [-23, -46], // Brazil SE
];

interface AdsbAircraft {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | "ground";
  gs?: number;
  track?: number;
  baro_rate?: number;
  seen_pos?: number;
}
interface AdsbResponse {
  ac?: AdsbAircraft[];
  now?: number;
}

function tileUrl(lat: number, lon: number): string {
  return `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${RADIUS_NM}`;
}

function toState(a: AdsbAircraft, nowMs: number): AircraftState | null {
  if (typeof a.lat !== "number" || typeof a.lon !== "number" || !a.hex) return null;
  const onGround = a.alt_baro === "ground";
  const altFt = typeof a.alt_baro === "number" ? a.alt_baro : undefined;
  const point = { lat: a.lat, lon: a.lon, alt: altFt != null ? altFt * FEET_TO_M : undefined };
  if (!isValidPoint(point)) return null;
  const lastMs = nowMs - (typeof a.seen_pos === "number" ? a.seen_pos * 1000 : 0);
  return {
    id: `aircraft:${a.hex.trim().toLowerCase()}`,
    callsign: a.flight?.trim() || undefined,
    position: point,
    velocityMs: typeof a.gs === "number" ? a.gs * KNOTS_TO_MS : undefined,
    headingDeg: typeof a.track === "number" ? a.track : undefined,
    verticalRateMs: typeof a.baro_rate === "number" ? (a.baro_rate * FEET_TO_M) / 60 : undefined,
    onGround,
    lastContact: new Date(lastMs).toISOString(),
  };
}

/**
 * Fetch the current real-time aircraft picture across all tiles, de-duplicated
 * by ICAO hex. Individual tile failures are tolerated — we return whatever the
 * reachable tiles gave us (empty array only if every tile failed).
 */
export async function fetchAdsbLolStates(tiles: Array<[number, number]> = ADSB_TILES): Promise<AircraftState[]> {
  const results = await Promise.allSettled(
    tiles.map(([lat, lon]) => fetchJson<AdsbResponse>(tileUrl(lat, lon), { timeoutMs: 10_000 })),
  );
  const byId = new Map<string, AircraftState>();
  let anyOk = false;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    anyOk = true;
    const now = typeof r.value.now === "number" ? r.value.now : Date.now();
    for (const a of r.value.ac ?? []) {
      const s = toState(a, now);
      if (!s) continue;
      // Prefer the freshest sighting when a plane appears in overlapping tiles.
      const prev = byId.get(s.id);
      if (!prev || s.lastContact > prev.lastContact) byId.set(s.id, s);
    }
  }
  if (!anyOk) throw new Error("all adsb.lol tiles failed");
  return [...byId.values()];
}
