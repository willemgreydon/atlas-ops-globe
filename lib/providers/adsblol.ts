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

/** Tile centres over dense/high-interest regions. Each pulls a 250 nm disc.
 *  ADS-B is receiver-driven, so coverage over Russia/China/Africa is limited to
 *  major hubs (and China filters ADS-B), but these tiles capture what exists. */
// ~20 tiles — the ceiling adsb.lol tolerates in one burst before rate-limiting
// (the throttle below also helps). Weighted toward the previously-sparse regions;
// interior tiles with essentially no receivers (Siberia, Chinese interior) are
// omitted — they'd just burn a request. The OpenSky vault baseline still fills
// oceans/remote areas.
export const ADSB_TILES: Array<[lat: number, lon: number]> = [
  [40, -80], // US NE
  [33, -97], // US S-central
  [37, -119], // US W
  [54, -2], // UK / N Sea
  [48, 6], // Europe W
  [41, 15], // Mediterranean
  [55, 37], // Moscow / W Russia
  [60, 30], // St Petersburg
  [25, 51], // Gulf
  [41, 29], // Istanbul
  [22, 78], // India
  [40, 116], // Beijing
  [31, 121], // Shanghai
  [23, 113], // Guangzhou / Hong Kong
  [35, 139], // Japan / Korea
  [13, 100], // SE Asia (Bangkok)
  [30, 31], // Cairo
  [6, 3], // W Africa (Lagos)
  [-26, 28], // Johannesburg
  [-33, 151], // SE Australia
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
const CONCURRENCY = 5; // adsb.lol is a community service — fetch tiles politely

export async function fetchAdsbLolStates(tiles: Array<[number, number]> = ADSB_TILES): Promise<AircraftState[]> {
  const byId = new Map<string, AircraftState>();
  let anyOk = false;

  const ingest = (resp: AdsbResponse) => {
    anyOk = true;
    const now = typeof resp.now === "number" ? resp.now : Date.now();
    for (const a of resp.ac ?? []) {
      const s = toState(a, now);
      if (!s) continue;
      // Prefer the freshest sighting when a plane appears in overlapping tiles.
      const prev = byId.get(s.id);
      if (!prev || s.lastContact > prev.lastContact) byId.set(s.id, s);
    }
  };

  // Bounded concurrency: firing all ~30 tiles at once trips adsb.lol's rate limit
  // and collapses coverage, so run a small pool of workers over the tile queue.
  let next = 0;
  const worker = async () => {
    while (next < tiles.length) {
      const [lat, lon] = tiles[next++];
      try {
        ingest(await fetchJson<AdsbResponse>(tileUrl(lat, lon), { timeoutMs: 10_000 }));
      } catch {
        /* individual tile failure is tolerated */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tiles.length) }, worker));

  if (!anyOk) throw new Error("all adsb.lol tiles failed");
  return [...byId.values()];
}
