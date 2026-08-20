import type { AircraftState, NewsItem, WorldEvent, CountryProfile } from "@/types/domain";

/**
 * Demo fallbacks. Returned only when a live source fails *and* no cache exists,
 * and always surfaced through the UI as MOCK — never presented as live. Exposed
 * as functions so timestamps are current at call time.
 */
const now = () => new Date().toISOString();

export function mockAircraft(): AircraftState[] {
  return [
    { id: "aircraft:mock-a1", callsign: "AUA601", country: "Austria", position: { lat: 48.3, lon: 14.1, alt: 10300 }, velocityMs: 230, headingDeg: 72, lastContact: now() },
    { id: "aircraft:mock-a2", callsign: "DLH712", country: "Germany", position: { lat: 42.4, lon: 28.7, alt: 11200 }, velocityMs: 245, headingDeg: 118, lastContact: now() },
    { id: "aircraft:mock-a3", callsign: "QTR91", country: "Qatar", position: { lat: 25.7, lon: 55.3, alt: 9800 }, velocityMs: 238, headingDeg: 292, lastContact: now() },
  ];
}

export function mockEvents(): WorldEvent[] {
  return [
    { id: "event:mock-e1", kind: "disaster", title: "M5.2 earthquake (demo)", summary: "Demo hazard marker with confidence score.", severity: "warning", occurredAt: now(), location: { lat: 37.1, lon: 36.7 }, countryCode: "TR", source: "demo", confidence: 0.88, tags: ["earthquake"] },
    { id: "event:mock-e2", kind: "disaster", title: "Wildfire observation (demo)", severity: "watch", occurredAt: now(), location: { lat: 34.1, lon: -118.2 }, countryCode: "US", source: "demo", confidence: 0.8, tags: ["wildfire"] },
  ];
}

export function mockNews(): NewsItem[] {
  return [
    { id: "news:mock-n1", title: "Regional leaders meet amid new security talks (demo)", source: "Demo Wire", publishedAt: now(), countryCode: "TR", themes: ["diplomacy", "security"], location: { lat: 39.9, lon: 32.8 } },
    { id: "news:mock-n2", title: "Markets watch shipping through strategic chokepoint (demo)", source: "Demo Markets", publishedAt: now(), countryCode: "OM", themes: ["shipping", "energy"], location: { lat: 26.5, lon: 56.3 } },
  ];
}

export function mockCountry(iso3: string): CountryProfile {
  return {
    iso3,
    name: iso3,
    indicators: [
      { code: "SP.POP.TOTL", label: "Population", value: null },
      { code: "NY.GDP.MKTP.CD", label: "GDP (US$)", value: null },
    ],
  };
}
