import type { GeoBounds } from "@/types/domain";

/**
 * Strategic maritime chokepoints as reusable geofences (bounding boxes,
 * GeoJSON order west/south/east/north). Used to scope AIS vessel queries and
 * to compute transit/congestion metrics generically.
 */
export interface Chokepoint {
  id: string;
  name: string;
  bounds: GeoBounds;
}

export const CHOKEPOINTS: Chokepoint[] = [
  { id: "hormuz", name: "Strait of Hormuz", bounds: { west: 55.0, south: 25.5, east: 57.2, north: 27.1 } },
  { id: "bab-el-mandeb", name: "Bab el-Mandeb", bounds: { west: 43.0, south: 12.3, east: 43.7, north: 13.8 } },
  { id: "suez", name: "Suez Canal", bounds: { west: 32.2, south: 29.9, east: 32.6, north: 31.3 } },
  { id: "bosporus", name: "Bosporus", bounds: { west: 28.9, south: 40.9, east: 29.2, north: 41.3 } },
  { id: "panama", name: "Panama Canal", bounds: { west: -80.0, south: 8.9, east: -79.5, north: 9.4 } },
  { id: "malacca", name: "Strait of Malacca", bounds: { west: 100.0, south: 1.0, east: 104.0, north: 4.0 } },
  { id: "gibraltar", name: "Strait of Gibraltar", bounds: { west: -5.9, south: 35.8, east: -5.2, north: 36.2 } },
  { id: "danish-straits", name: "Danish Straits", bounds: { west: 10.5, south: 54.5, east: 13.0, north: 56.5 } },
  { id: "english-channel", name: "English Channel (Dover)", bounds: { west: 0.9, south: 50.6, east: 1.9, north: 51.2 } },
];

export function chokepointById(id: string): Chokepoint | undefined {
  return CHOKEPOINTS.find((c) => c.id === id);
}
