import type { EventKind } from "@/types/domain";

/**
 * Layer catalogue. A layer is a toggleable visualization backed by one data
 * feed. `status: "planned"` layers render as disabled controls (no fake
 * functionality) until their provider is wired.
 */
export type LayerId =
  | "countries"
  | "aircraft"
  | "earthquakes"
  | "naturalEvents"
  | "news"
  | "maritime"
  | "conflict"
  | "cyber"
  | "weather"
  | "markets"
  | "space"
  | "sanctions";

export interface LayerDef {
  id: LayerId;
  label: string;
  color: string;
  status: "active" | "planned";
  /** Which data feed drives this layer, for the fetch scheduler. */
  feed?: "aircraft" | "events" | "news" | "countries" | "vessels" | "weather" | "satellites";
  /** For event-driven layers, which event kinds/tags belong to this layer. */
  eventKinds?: EventKind[];
  providerNote?: string;
}

export const LAYERS: LayerDef[] = [
  { id: "countries", label: "Country borders", color: "#8aa0b6", status: "active", feed: "countries" },
  { id: "aircraft", label: "Aircraft / ADS-B", color: "#65f6c7", status: "active", feed: "aircraft", providerNote: "OpenSky Network" },
  { id: "earthquakes", label: "Earthquakes", color: "#ffae45", status: "active", feed: "events", eventKinds: ["disaster"], providerNote: "USGS" },
  { id: "naturalEvents", label: "Natural events", color: "#ff8a5b", status: "active", feed: "events", eventKinds: ["disaster"], providerNote: "NASA EONET" },
  { id: "news", label: "News & entities", color: "#54c7ff", status: "active", feed: "news", providerNote: "GDELT" },
  { id: "maritime", label: "Maritime / AIS", color: "#4fd6d1", status: "active", feed: "vessels", providerNote: "MarineTraffic vault (needs API key)" },
  { id: "conflict", label: "Conflict & unrest", color: "#ff5a62", status: "active", feed: "events", providerNote: "ACLED (needs myACLED login)" },
  { id: "cyber", label: "Cyber exposure", color: "#b18cff", status: "planned", providerNote: "CISA KEV / NVD (planned)" },
  { id: "weather", label: "Weather (cities)", color: "#9ad7ff", status: "active", feed: "weather", providerNote: "Open-Meteo current conditions" },
  { id: "markets", label: "Markets", color: "#ffd166", status: "planned", providerNote: "Market feed (planned)" },
  { id: "space", label: "Satellites", color: "#c0c8d4", status: "active", feed: "satellites", providerNote: "Space-Track / CelesTrak · SGP4" },
  { id: "sanctions", label: "Sanctions", color: "#ff9db1", status: "planned", providerNote: "OFAC/EU (planned)" },
];

export const LAYER_BY_ID = Object.fromEntries(LAYERS.map((l) => [l.id, l])) as Record<LayerId, LayerDef>;
