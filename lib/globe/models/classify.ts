/**
 * Map a catalogue satellite to a model archetype (mission §85).
 *
 * TLE catalogues rarely fill `objectType`, so classification leans on the object
 * *name* (NORAD naming is remarkably consistent) with the orbit regime as a
 * fallback: a GEO-period object with no better signal is almost certainly a
 * communications platform; a bare LEO object, a smallsat.
 */
import type { SatelliteRow } from "@/stores/app-store";
import type { AircraftState } from "@/types/domain";
import type { ModelKey } from "./catalog";

const has = (s: string, ...needles: string[]) => needles.some((n) => s.includes(n));

export function classifySatellite(row: SatelliteRow): ModelKey {
  const name = (row.name ?? "").toUpperCase();
  const type = (row.objectType ?? "").toUpperCase();
  const period = row.periodMin ?? null;
  const apogee = row.apogeeKm ?? null;

  // Non-payloads first — the catalogue is full of them.
  if (has(type, "ROCKET") || has(name, "R/B", "ROCKET BODY", "AKM", "PKM")) return "sat-rocket";
  if (has(type, "DEBRIS") || has(name, "DEB", "FRAGMENT", "COOLANT", "WESTFORD NEEDLE")) return "sat-debris";

  // Crewed / large structures.
  if (has(name, "ISS", "ZARYA", "TIANGONG", "CSS (", "TIANHE", "MIR", "SPACE STATION")) return "sat-station";

  // Navigation constellations (MEO).
  if (has(name, "GPS", "NAVSTAR", "GLONASS", "GALILEO", "BEIDOU", "QZS", "IRNSS", "NAVIC")) return "sat-nav";

  // Earth observation / imaging.
  if (has(name, "SENTINEL", "LANDSAT", "WORLDVIEW", "PLANET", "DOVE", "SKYSAT", "SPOT", "PLEIADES",
    "TERRA", "AQUA", "SUOMI", "NOAA", "METOP", "GAOFEN", "ICEYE", "CAPELLA", "RADARSAT", "COSMO"))
    return "sat-eo";

  // Communications constellations & platforms.
  if (has(name, "STARLINK", "ONEWEB", "IRIDIUM", "GLOBALSTAR", "ORBCOMM", "SES", "INTELSAT",
    "INMARSAT", "EUTELSAT", "VIASAT", "TELESAT", "KUIPER", "O3B"))
    return has(name, "STARLINK", "ONEWEB", "KUIPER", "ORBCOMM") ? "sat-leo" : "sat-comms";

  // Fall back to the orbit regime.
  if (period != null) {
    if (period >= 1200 || (apogee != null && apogee > 30000)) return "sat-comms"; // GEO/HEO
    if (period >= 600) return "sat-nav"; // MEO
    if (period < 128) return "sat-leo"; // LEO
  }
  return "sat-generic";
}

/**
 * Pick an aircraft archetype from ADS-B kinematics (no type field is broadcast).
 * Speed + altitude separate the fleet well enough: a fast, high mover is a jet
 * airliner; slow and low is a light prop; very slow and low (able to hover) is a
 * rotorcraft. On-ground contacts stay airliners — the ground is mostly airports.
 */
export function classifyAircraft(a: AircraftState): ModelKey {
  const v = a.velocityMs ?? null; // m/s ground speed
  const alt = a.position?.alt ?? null; // metres
  if (!a.onGround && v != null) {
    if (v < 35 && (alt == null || alt < 1800)) return "aircraft-heli";
    if (v < 120 && (alt == null || alt < 6000)) return "aircraft-light";
  }
  return "aircraft-airliner";
}
