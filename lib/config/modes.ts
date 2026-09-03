import type { LayerId } from "./layers";

/**
 * Operational modes. A mode is a curated starting point: it sets which layers
 * are visible by default and what the legend/sidebar emphasise. Users can
 * override layer visibility afterward (build their own combination).
 */
export type ModeId =
  | "global"
  | "aviation"
  | "disasters"
  | "news"
  | "maritime"
  | "cyber"
  | "space";

export interface ModeDef {
  id: ModeId;
  label: string;
  defaultLayers: LayerId[];
  /** True when at least one active layer backs this mode. */
  operational: boolean;
  blurb: string;
}

export const MODES: ModeDef[] = [
  { id: "global", label: "Global", operational: true, defaultLayers: ["countries", "cities", "aircraft", "earthquakes", "naturalEvents", "news"], blurb: "All active intelligence layers fused on one surface." },
  { id: "aviation", label: "Aviation", operational: true, defaultLayers: ["countries", "aircraft"], blurb: "Live ADS-B aircraft positions from OpenSky." },
  { id: "disasters", label: "Disasters", operational: true, defaultLayers: ["countries", "earthquakes", "naturalEvents", "volcanoes"], blurb: "Earthquakes (USGS), natural events (NASA EONET) and volcanoes (Smithsonian GVP)." },
  { id: "news", label: "News", operational: true, defaultLayers: ["countries", "news"], blurb: "Global news discovery via GDELT." },
  { id: "maritime", label: "Maritime", operational: true, defaultLayers: ["countries", "maritime"], blurb: "AIS vessel tracking (MarineTraffic) — needs an API key; offline until set." },
  { id: "cyber", label: "Cyber", operational: false, defaultLayers: ["countries", "cyber"], blurb: "Exploited vulnerabilities — CISA KEV/NVD (no globe layer yet)." },
  { id: "space", label: "Space", operational: true, defaultLayers: ["countries", "space"], blurb: "Live satellites & orbits — CelesTrak TLEs propagated with SGP4." },
];

export const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<ModeId, ModeDef>;
