/**
 * Lazy client-side SGP4. `satellite.js` is an ESM-only package that wedges the
 * Turbopack production build when statically imported into the main client
 * graph, so we load it dynamically (code-split) at runtime and cache the module.
 */
type Sat = typeof import("satellite.js");

let modPromise: Promise<Sat> | null = null;

export function loadSgp4(): Promise<Sat> {
  if (!modPromise) modPromise = import("satellite.js");
  return modPromise;
}

/** Current geodetic sub-point for a TLE (needs a loaded satellite.js module). */
export function subpoint(
  sat: Sat,
  tle1: string,
  tle2: string,
  at: Date = new Date(),
): { lat: number; lon: number; altKm: number } | null {
  try {
    const rec = sat.twoline2satrec(tle1, tle2);
    if (rec.error) return null;
    const pv = sat.propagate(rec, at);
    if (!pv || typeof pv.position === "boolean" || !pv.position) return null;
    const geo = sat.eciToGeodetic(pv.position, sat.gstime(at));
    return { lat: sat.degreesLat(geo.latitude), lon: sat.degreesLong(geo.longitude), altKm: geo.height };
  } catch {
    return null;
  }
}
