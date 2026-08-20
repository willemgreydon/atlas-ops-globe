import type { GeoBounds, GeoPoint, Position } from "@/types/domain";

/**
 * Geospatial helpers. The project uses named-field {@link GeoPoint} objects
 * internally (unambiguous), and converts to GeoJSON [lon, lat] tuples only at
 * serialization boundaries.
 */

/** Convert a GeoPoint to a GeoJSON [lon, lat(, alt)] position tuple. */
export function toPosition(p: GeoPoint): Position {
  return p.alt == null ? [p.lon, p.lat] : [p.lon, p.lat, p.alt];
}

/** Build a GeoPoint from a GeoJSON [lon, lat(, alt)] position tuple. */
export function fromPosition(pos: Position): GeoPoint {
  return { lon: pos[0], lat: pos[1], alt: pos[2] };
}

export function isValidLat(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLon(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

export function isValidPoint(p: GeoPoint | undefined | null): p is GeoPoint {
  return !!p && isValidLat(p.lat) && isValidLon(p.lon);
}

export function inBounds(p: GeoPoint, b: GeoBounds): boolean {
  const lonOk =
    b.west <= b.east
      ? p.lon >= b.west && p.lon <= b.east
      : p.lon >= b.west || p.lon <= b.east; // antimeridian-crossing window
  return lonOk && p.lat >= b.south && p.lat <= b.north;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
