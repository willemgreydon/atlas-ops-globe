import type { GeoPoint } from "@/types/domain";

/**
 * Curated sample of major world cities used as weather observation points.
 * A deliberately bounded set (not every settlement) — enough for global
 * situational awareness without abusing free weather APIs. Extend as needed.
 */
export interface City {
  name: string;
  iso2: string;
  point: GeoPoint;
}

export const MAJOR_CITIES: City[] = [
  { name: "New York", iso2: "US", point: { lat: 40.71, lon: -74.01 } },
  { name: "Los Angeles", iso2: "US", point: { lat: 34.05, lon: -118.24 } },
  { name: "Chicago", iso2: "US", point: { lat: 41.88, lon: -87.63 } },
  { name: "Toronto", iso2: "CA", point: { lat: 43.65, lon: -79.38 } },
  { name: "Mexico City", iso2: "MX", point: { lat: 19.43, lon: -99.13 } },
  { name: "São Paulo", iso2: "BR", point: { lat: -23.55, lon: -46.63 } },
  { name: "Buenos Aires", iso2: "AR", point: { lat: -34.6, lon: -58.38 } },
  { name: "London", iso2: "GB", point: { lat: 51.51, lon: -0.13 } },
  { name: "Paris", iso2: "FR", point: { lat: 48.85, lon: 2.35 } },
  { name: "Berlin", iso2: "DE", point: { lat: 52.52, lon: 13.4 } },
  { name: "Madrid", iso2: "ES", point: { lat: 40.42, lon: -3.7 } },
  { name: "Rome", iso2: "IT", point: { lat: 41.9, lon: 12.5 } },
  { name: "Vienna", iso2: "AT", point: { lat: 48.21, lon: 16.37 } },
  { name: "Kyiv", iso2: "UA", point: { lat: 50.45, lon: 30.52 } },
  { name: "Moscow", iso2: "RU", point: { lat: 55.76, lon: 37.62 } },
  { name: "Istanbul", iso2: "TR", point: { lat: 41.01, lon: 28.98 } },
  { name: "Cairo", iso2: "EG", point: { lat: 30.04, lon: 31.24 } },
  { name: "Lagos", iso2: "NG", point: { lat: 6.52, lon: 3.38 } },
  { name: "Nairobi", iso2: "KE", point: { lat: -1.29, lon: 36.82 } },
  { name: "Johannesburg", iso2: "ZA", point: { lat: -26.2, lon: 28.05 } },
  { name: "Dubai", iso2: "AE", point: { lat: 25.2, lon: 55.27 } },
  { name: "Riyadh", iso2: "SA", point: { lat: 24.71, lon: 46.68 } },
  { name: "Tehran", iso2: "IR", point: { lat: 35.69, lon: 51.39 } },
  { name: "Delhi", iso2: "IN", point: { lat: 28.61, lon: 77.21 } },
  { name: "Mumbai", iso2: "IN", point: { lat: 19.08, lon: 72.88 } },
  { name: "Karachi", iso2: "PK", point: { lat: 24.86, lon: 67.0 } },
  { name: "Dhaka", iso2: "BD", point: { lat: 23.81, lon: 90.41 } },
  { name: "Bangkok", iso2: "TH", point: { lat: 13.76, lon: 100.5 } },
  { name: "Singapore", iso2: "SG", point: { lat: 1.35, lon: 103.82 } },
  { name: "Jakarta", iso2: "ID", point: { lat: -6.21, lon: 106.85 } },
  { name: "Beijing", iso2: "CN", point: { lat: 39.9, lon: 116.41 } },
  { name: "Shanghai", iso2: "CN", point: { lat: 31.23, lon: 121.47 } },
  { name: "Hong Kong", iso2: "HK", point: { lat: 22.32, lon: 114.17 } },
  { name: "Tokyo", iso2: "JP", point: { lat: 35.68, lon: 139.69 } },
  { name: "Seoul", iso2: "KR", point: { lat: 37.57, lon: 126.98 } },
  { name: "Sydney", iso2: "AU", point: { lat: -33.87, lon: 151.21 } },
];
