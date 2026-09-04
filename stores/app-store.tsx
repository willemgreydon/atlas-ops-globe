"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AircraftState, DataStatus, NewsItem, WorldEvent } from "@/types/domain";
import { LAYERS, type LayerId } from "@/lib/config/layers";
import { MODE_BY_ID, type ModeId } from "@/lib/config/modes";
import { type GlobeQuality, autoDetectQuality } from "@/lib/globe/quality";
import type { AtmospherePreset, LightingMode } from "@/lib/globe/scene";
import { type TerrainMode, ionTokenPresent } from "@/lib/globe/terrain-config";

export type Selection =
  | { kind: "aircraft"; id: string }
  | { kind: "event"; id: string }
  | { kind: "news"; id: string }
  | { kind: "vessel"; id: string }
  | { kind: "weather"; id: string }
  | { kind: "satellite"; id: string }
  | { kind: "airport"; id: string }
  | { kind: "airquality"; id: string }
  | { kind: "powerplant"; id: string }
  | { kind: "port"; id: string }
  | { kind: "volcano"; id: string }
  | { kind: "city"; id: string }
  | { kind: "country"; iso3: string; name?: string }
  | null;

/** Airport point from the static OurAirports dataset (/data/airports.json). */
export interface Airport {
  id: string; // ICAO / ident
  name: string;
  lat: number;
  lon: number;
  iata?: string;
  country?: string;
  large?: boolean;
  scheduled?: boolean;
}

/** Power plant from the static WRI Global Power Plant DB (/data/powerplants.json). */
export interface PowerPlant {
  id: string;
  name: string;
  lat: number;
  lon: number;
  fuel: string; // coal | gas | oil | nuclear | hydro | wind | solar | geothermal | biomass | other
  mw: number;
  country?: string;
}

/** Port from the static NGA World Port Index (/data/ports.json). */
export interface Port {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country?: string;
  size?: string; // xs | s | m | l
  type?: string;
}

/** Volcano from the static Smithsonian GVP Holocene list (/data/volcanoes.json). */
export interface Volcano {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type?: string;
  elevation?: number;
  country?: string;
  lastEruption?: number;
}

/** City from the static GeoNames gazetteer (/data/cities.json). */
export interface City {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country?: string;
  pop: number;
}

/** Which top-level view is shown: the 3D globe, or the analytics dashboard. */
export type ViewId = "globe" | "dashboard";

/** One country's cross-domain composite scores (from /api/intelligence/dashboard). */
export interface DashScore {
  iso2: string; name: string; region?: string;
  risk: number; opportunity: number; momentum: number; stability: number;
  conflict: number; disaster: number; severeEvents: number; news: number;
  reachPop: number; cities: number; space: number;
  factors: { conflict: number; disaster: number; severity: number; attention: number; reach: number; economy: number };
}

/** One ranked, persona-framed insight from the analytics engine. */
export interface DashInsight {
  id: string;
  persona: "political" | "finance" | "marketing";
  kind: "risk" | "opportunity" | "synergy" | "signal";
  title: string;
  detail: string;
  score: number;
  metrics: { label: string; value: string }[];
}

/** Full analytics payload backing the observability dashboard. */
export interface DashPayload {
  generatedAt: string;
  degraded?: boolean;
  status?: string;
  source?: string;
  coverage?: { conflictCountries: number; hazardOnly: boolean; countriesWithEvents: number };
  counts: Record<string, number>;
  scores: DashScore[];
  entities: {
    persons: { name: string; mentions: number }[];
    organizations: { name: string; mentions: number; country?: string }[];
    connected: { name: string; degree?: number }[];
  };
  graph?: {
    nodes: { id: string; name: string; kind: string; degree: number; country?: string }[];
    edges: { a: number; b: number; type: string; w?: number }[];
  };
  cyber: { total: number; kev: number; topVendors: { vendor: string; count: number }[] };
  sanctions: { total: number; topAuthorities: { authority: string; count: number }[] };
  spacePowers: { country: string; count: number }[];
  correlations: { label: string; r: number }[];
  insights: DashInsight[];
  markets: { symbol: string; name: string; changePct: number; assetClass: string }[];
}

/** Air-quality point (Open-Meteo, US AQI) sampled at a world city. */
export interface AirQualityRow {
  id: string;
  place: string;
  country: string;
  lat: number;
  lon: number;
  aqi: number;
  pm25: number | null;
  observedAt: string;
}

/** Which HUD sheet is docked open on a phone (null = none, globe fully visible). */
export type MobileDock = "layers" | "intel" | null;

/** Satellite catalogue row (with SGP4 TLE) from /api/intelligence/space. */
export interface SatelliteRow {
  id: string;
  norad: string;
  name: string;
  country?: string;
  objectType?: string;
  operator?: string;
  inclinationDeg?: number | null;
  periodMin?: number | null;
  apogeeKm?: number | null;
  perigeeKm?: number | null;
  epoch?: string;
  tle1?: string;
  tle2?: string;
  source?: string;
}

/** Weather observation point (temperature) from /api/intelligence/weather. */
export interface WeatherRow {
  id: string;
  lat: number;
  lon: number;
  place?: string;
  countryCode?: string;
  value: number | null;
  unit?: string;
  observedAt?: string;
}

/** Vessel row as returned by /api/intelligence/maritime (vault-backed). */
export interface VesselRow {
  id: string;
  imo?: string;
  mmsi?: string;
  name?: string;
  vesselType?: string;
  flag?: string;
  lat: number;
  lon: number;
  speedKn?: number | null;
  courseDeg?: number | null;
  navigationStatus?: string;
  destination?: string;
  eta?: string;
  lastContact: string;
}

/** Market quote from /api/intelligence/markets (Finnhub). */
export interface MarketRow {
  id: string;
  symbol: string;
  name?: string;
  assetClass: string;
  price: number | null;
  change?: number | null;
  changePct?: number | null;
  currency?: string;
  latencyClass: string;
  ts: string;
  provider: string;
}

/** Aggregated vault snapshot from /api/intelligence/global. */
export interface VaultSnapshot {
  generatedAt: string;
  activeDisasters: number;
  earthquakes24h: number;
  counts: Record<string, number>;
  criticalAlerts: { id: string; title: string; severity: string; occurredAt: string }[];
  majorStories: { id: string; title: string; articleCount: number }[];
}

/** Liveness metadata carried on every feed so the UI never mislabels data. */
export interface FeedMeta {
  status: DataStatus;
  source: string;
  cached: boolean;
  stale: boolean;
  fetchedAt: string;
  error?: string;
  count: number;
}

interface Feed<T> {
  rows: T[];
  meta: FeedMeta | null;
  loading: boolean;
}

interface AppState {
  mode: ModeId;
  setMode: (m: ModeId) => void;
  layers: Record<LayerId, boolean>;
  toggleLayer: (id: LayerId) => void;
  selection: Selection;
  select: (s: Selection) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  /**
   * Which HUD panel is docked open on a phone-sized viewport. On desktop the
   * panels are always visible and this is inert; on mobile they collapse to
   * on-demand bottom sheets so the globe is never occluded (null = all closed).
   */
  dock: MobileDock;
  setDock: (d: MobileDock) => void;
  /** Top-level view: the 3D globe or the analytics dashboard. */
  view: ViewId;
  setView: (v: ViewId) => void;
  /** Cross-domain observability analytics (loaded when the dashboard is open). */
  dashboard: { data: DashPayload | null; loading: boolean; error?: string };
  aircraft: Feed<AircraftState>;
  events: Feed<WorldEvent>;
  news: Feed<NewsItem>;
  /** Vessels from the intelligence vault (MarineTraffic; OFFLINE without a key). */
  vessels: Feed<VesselRow>;
  /** Weather observation points from the vault (Open-Meteo). */
  weather: Feed<WeatherRow>;
  /** Market quotes from the vault (Finnhub); drives the ticker. */
  markets: Feed<MarketRow>;
  /** Conflict/unrest events from the vault (ACLED). */
  conflict: Feed<WorldEvent>;
  /** Airports (static OurAirports set); lazily loaded when the layer is enabled. */
  airports: Feed<Airport>;
  /** Power plants (static WRI DB); dense over China/Russia/Australia. */
  powerplants: Feed<PowerPlant>;
  /** Ports & harbors (static NGA World Port Index). */
  ports: Feed<Port>;
  /** Volcanoes (static Smithsonian GVP Holocene list). */
  volcanoes: Feed<Volcano>;
  /** World cities (static GeoNames gazetteer); default-on so no region is blank. */
  cities: Feed<City>;
  /** Air-quality points (Open-Meteo US AQI) at world cities. */
  airquality: Feed<AirQualityRow>;
  /** Satellite catalogue (with TLEs) from the vault; propagated on the globe. */
  satellites: Feed<SatelliteRow>;
  /** Aggregated vault snapshot (SQLite-backed), or null while loading. */
  vault: VaultSnapshot | null;
  /** Fly-to request consumed by the globe; bumped on each navigation. */
  flyTo: { lat: number; lon: number; nonce: number } | null;
  requestFlyTo: (lat: number, lon: number) => void;
  /** Render-quality ceiling; the performance governor may render below it. */
  quality: GlobeQuality;
  setQuality: (q: GlobeQuality) => void;
  /** Let the performance governor auto-adjust quality (mission §4). */
  autoQuality: boolean;
  setAutoQuality: (v: boolean) => void;
  /** Atmosphere character preset (mission §7). */
  atmosphere: AtmospherePreset;
  setAtmosphere: (a: AtmospherePreset) => void;
  /** Globe lighting model (mission §6). */
  lighting: LightingMode;
  setLighting: (l: LightingMode) => void;
  /** Celestial environment: starfield, sun, moon, bloom + lens flare (§8). */
  environment: boolean;
  setEnvironment: (v: boolean) => void;
  /** Disaster/alert shockwave ripples (§34 §37). */
  effects: boolean;
  setEffects: (v: boolean) => void;
  /** Motion trail behind the selected moving entity (§22 §25). */
  trails: boolean;
  setTrails: (v: boolean) => void;
  /** Surface mode: ellipsoid, ion World Terrain, or Google photorealistic (§9). */
  terrain: TerrainMode;
  setTerrain: (m: TerrainMode) => void;
}

const AppContext = createContext<AppState | null>(null);

const POLL_MS = { aircraft: 15_000, events: 60_000, news: 120_000, vessels: 30_000, weather: 600_000, markets: 30_000, conflict: 120_000, satellites: 1_800_000, vault: 60_000 } as const;

/** Map a flat vault event row ({lat,lon,...}) to a WorldEvent ({location}). */
function vaultEventToWorld(r: Record<string, unknown>): WorldEvent {
  return {
    id: String(r.id),
    kind: (r.kind as WorldEvent["kind"]) ?? "conflict",
    title: String(r.title ?? ""),
    summary: (r.summary as string) ?? undefined,
    severity: (r.severity as WorldEvent["severity"]) ?? "watch",
    occurredAt: String(r.occurredAt ?? new Date().toISOString()),
    location: { lat: Number(r.lat), lon: Number(r.lon) },
    countryCode: (r.countryCode as string) ?? undefined,
    source: String(r.source ?? "ACLED"),
    sourceUrl: (r.sourceUrl as string) ?? undefined,
    confidence: (r.confidence as number) ?? undefined,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
  };
}

function defaultLayerVisibility(mode: ModeId): Record<LayerId, boolean> {
  const on = new Set(MODE_BY_ID[mode].defaultLayers);
  return Object.fromEntries(LAYERS.map((l) => [l.id, on.has(l.id)])) as Record<LayerId, boolean>;
}

/** Vault freshness state → honest {@link DataStatus}. Replaces the old blanket
 *  "vault ⇒ live" so a stale/aging feed is never shown as LIVE (audit P0-1). */
const FRESHNESS_STATUS: Record<string, { status: DataStatus; stale: boolean }> = {
  fresh: { status: "live", stale: false },
  aging: { status: "delayed", stale: false },
  stale: { status: "cached", stale: true },
  unknown: { status: "offline", stale: false },
};

async function fetchFeed<T>(url: string, map?: (raw: Record<string, unknown>) => T): Promise<{ rows: T[]; meta: FeedMeta }> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  // Live-provider routes return { rows, status, ... }; vault routes return
  // { data, page, freshness? }. Handle both shapes uniformly.
  const raw: Record<string, unknown>[] = json.rows ?? json.data ?? [];
  const rows: T[] = map ? raw.map(map) : (raw as T[]);
  const fresh = json.freshness as { state?: string; latestObservedAt?: string | null } | undefined;
  const derived = fresh ? FRESHNESS_STATUS[fresh.state ?? "unknown"] : undefined;
  const meta: FeedMeta = {
    // Explicit provider status (live-fetch routes) wins; otherwise derive from
    // data freshness; only then fall back to the legacy shape heuristic.
    status: json.status ?? derived?.status ?? (json.data !== undefined ? "live" : "offline"),
    source: json.source ?? json.provider ?? "vault",
    cached: !!json.cached,
    stale: !!json.stale || !!derived?.stale,
    fetchedAt: json.fetchedAt ?? new Date().toISOString(),
    error: json.error,
    count: json.count ?? json.page?.count ?? rows.length,
  };
  return { rows, meta };
}

/**
 * Run `load` now (if the tab is visible) then on an interval, pausing entirely
 * while the tab is hidden and refetching once on return to the foreground.
 * Audit P2-1: a backgrounded tab must not keep polling upstream feeds and
 * burning provider rate limits. Returns a cleanup that stops the timer and
 * detaches the visibility listener.
 */
function pollWhileVisible(load: () => void, intervalMs: number): () => void {
  const hidden = () => typeof document !== "undefined" && document.hidden;
  let timer: ReturnType<typeof setInterval> | undefined;
  const start = () => { if (timer === undefined) { load(); timer = setInterval(load, intervalMs); } };
  const stop = () => { if (timer !== undefined) { clearInterval(timer); timer = undefined; } };
  const onVisibility = () => { if (hidden()) stop(); else start(); };
  if (!hidden()) start();
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
  return () => {
    stop();
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
  };
}

/** Poll the aggregated vault snapshot (cheap, local SQLite). */
function useVaultSnapshot(): VaultSnapshot | null {
  const [snap, setSnap] = useState<VaultSnapshot | null>(null);
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch("/api/intelligence/global", { cache: "no-store" });
        const json = (await res.json()) as VaultSnapshot;
        if (live) setSnap(json);
      } catch {
        /* vault not populated yet — leave null, UI shows a hint */
      }
    };
    const stop = pollWhileVisible(() => { void load(); }, POLL_MS.vault);
    return () => { live = false; stop(); };
  }, []);
  return snap;
}

function useFeed<T>(url: string, intervalMs: number, active: boolean, map?: (raw: Record<string, unknown>) => T): Feed<T> {
  const [state, setState] = useState<Feed<T>>({ rows: [], meta: null, loading: true });
  useEffect(() => {
    if (!active) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    let live = true;
    const load = async () => {
      try {
        const { rows, meta } = await fetchFeed<T>(url, map);
        if (live) setState({ rows, meta, loading: false });
      } catch (err) {
        if (live)
          setState((s) => ({
            ...s,
            loading: false,
            meta: {
              status: "offline",
              source: "client",
              cached: false,
              stale: true,
              fetchedAt: new Date().toISOString(),
              error: err instanceof Error ? err.message : String(err),
              count: s.rows.length,
            },
          }));
      }
    };
    const stop = pollWhileVisible(() => { void load(); }, intervalMs);
    return () => {
      live = false;
      stop();
    };
    // `map` is always a stable module-level fn (or undefined) at every call
    // site, so including it never re-subscribes — but it guards future callers.
  }, [url, intervalMs, active, map]);
  return state;
}

/** A static public-domain dataset shipped from /public/data — fetched once,
 *  lazily, the first time its layer is enabled (immutable-cached). Shared by
 *  airports, power plants, ports and volcanoes. */
function useStaticJson<T>(url: string, source: string, active: boolean): Feed<T> {
  const [state, setState] = useState<Feed<T>>({ rows: [], meta: null, loading: false });
  const loaded = useRef(false);
  useEffect(() => {
    if (!active || loaded.current) return;
    loaded.current = true;
    setState((s) => ({ ...s, loading: true }));
    fetch(url)
      .then((r) => r.json())
      .then((rows: T[]) => {
        const meta: FeedMeta = { status: "live", source, cached: true, stale: false, fetchedAt: new Date().toISOString(), count: rows.length };
        setState({ rows, meta, loading: false });
      })
      .catch((err) => {
        setState({ rows: [], loading: false, meta: { status: "offline", source, cached: false, stale: true, fetchedAt: new Date().toISOString(), error: String(err), count: 0 } });
      });
  }, [active, url, source]); // url/source are stable per call site; the `loaded` ref still loads once
  return state;
}

/** Analytics dashboard payload — fetched when the dashboard view is open, then
 *  refreshed on a slow cadence (the server caches for 5 min to bound reads). */
function useDashboard(active: boolean): { data: DashPayload | null; loading: boolean; error?: string } {
  const [state, setState] = useState<{ data: DashPayload | null; loading: boolean; error?: string }>({ data: null, loading: false });
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const load = () => {
      setState((s) => ({ ...s, loading: true }));
      fetch("/api/intelligence/dashboard", { cache: "no-store" })
        .then((r) => r.json())
        .then((data: DashPayload) => { if (!cancelled) setState({ data, loading: false }); })
        .catch((err) => { if (!cancelled) setState((s) => ({ data: s.data, loading: false, error: String(err) })); });
    };
    const stop = pollWhileVisible(load, 5 * 60_000);
    return () => { cancelled = true; stop(); };
  }, [active]);
  return state;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ModeId>("global");
  const [view, setView] = useState<ViewId>("globe");
  const [layers, setLayers] = useState<Record<LayerId, boolean>>(() => defaultLayerVisibility("global"));
  const [selection, setSelection] = useState<Selection>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dock, setDock] = useState<MobileDock>(null);
  const [flyTo, setFlyTo] = useState<AppState["flyTo"]>(null);
  const nonce = useRef(0);
  // Start from a fixed default so SSR and the first client render agree; the
  // navigator-based auto-detect (which is absent server-side) runs on mount
  // below, avoiding a hydration mismatch on the quality control.
  const [quality, setQuality] = useState<GlobeQuality>("high");
  const [autoQuality, setAutoQuality] = useState(true);
  const [atmosphere, setAtmosphere] = useState<AtmospherePreset>("natural");
  const [lighting, setLighting] = useState<LightingMode>("realtime-sun");
  const [environment, setEnvironment] = useState(true);
  const [effects, setEffects] = useState(true);
  const [trails, setTrails] = useState(true);
  // With a token, default to real relief for an immediate payoff; without one,
  // stay on the ellipsoid (the controller enforces this too).
  const [terrain, setTerrain] = useState<TerrainMode>(() => (ionTokenPresent() ? "world" : "ellipsoid"));

  // Pick a hardware-appropriate starting quality once mounted on the client.
  useEffect(() => { setQuality(autoDetectQuality()); }, []);

  const setMode = useCallback((m: ModeId) => {
    setModeState(m);
    setLayers(defaultLayerVisibility(m));
  }, []);

  const toggleLayer = useCallback((id: LayerId) => {
    setLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const requestFlyTo = useCallback((lat: number, lon: number) => {
    nonce.current += 1;
    setFlyTo({ lat, lon, nonce: nonce.current });
  }, []);

  // Selecting an object reveals its detail sheet on mobile (the inspector lives
  // in the intel dock); deselecting closes it. Inert on desktop, where the
  // panels are always shown.
  const select = useCallback((s: Selection) => {
    setSelection(s);
    setDock(s ? "intel" : null);
  }, []);

  // Only poll a feed when its layer is enabled — respects rate limits.
  const aircraft = useFeed<AircraftState>("/api/aircraft", POLL_MS.aircraft, layers.aircraft);
  const events = useFeed<WorldEvent>("/api/events", POLL_MS.events, layers.earthquakes || layers.naturalEvents);
  const news = useFeed<NewsItem>("/api/news", POLL_MS.news, layers.news);
  // Vault-backed vessels (MarineTraffic via the intelligence API).
  const vessels = useFeed<VesselRow>("/api/intelligence/maritime?limit=500", POLL_MS.vessels, layers.maritime);
  const weather = useFeed<WeatherRow>("/api/intelligence/weather?limit=200", POLL_MS.weather, layers.weather);
  // Markets drive the always-visible ticker, so poll regardless of layers.
  const markets = useFeed<MarketRow>("/api/intelligence/markets?limit=20", POLL_MS.markets, true);
  // Conflict/unrest — UCDP live (dense over Central Africa/Sahel; needs
  // UCDP_ACCESS_TOKEN) merged with the ACLED vault baseline; WorldEvent shape.
  const conflict = useFeed<WorldEvent>("/api/intelligence/conflict?limit=500", POLL_MS.conflict, layers.conflict, vaultEventToWorld);
  // Satellite catalogue with TLEs — propagated client-side via SGP4.
  const satellites = useFeed<SatelliteRow>("/api/intelligence/space?limit=900", POLL_MS.satellites, layers.space);
  const airports = useStaticJson<Airport>("/data/airports.json", "OurAirports", layers.airports);
  const powerplants = useStaticJson<PowerPlant>("/data/powerplants.json", "WRI Global Power Plant DB", layers.powerplants);
  const ports = useStaticJson<Port>("/data/ports.json", "NGA World Port Index", layers.ports);
  const volcanoes = useStaticJson<Volcano>("/data/volcanoes.json", "Smithsonian GVP", layers.volcanoes);
  const cities = useStaticJson<City>("/data/cities.json", "GeoNames", layers.cities);
  const airquality = useFeed<AirQualityRow>("/api/intelligence/airquality", POLL_MS.satellites, layers.airquality);
  const vault = useVaultSnapshot();
  const dashboard = useDashboard(view === "dashboard");

  const value = useMemo<AppState>(
    () => ({
      mode,
      setMode,
      view,
      setView,
      dashboard,
      layers,
      toggleLayer,
      selection,
      select,
      searchOpen,
      setSearchOpen,
      dock,
      setDock,
      aircraft,
      events,
      news,
      vessels,
      weather,
      markets,
      conflict,
      satellites,
      airports,
      powerplants,
      ports,
      volcanoes,
      cities,
      airquality,
      vault,
      flyTo,
      requestFlyTo,
      quality,
      setQuality,
      autoQuality,
      setAutoQuality,
      atmosphere,
      setAtmosphere,
      lighting,
      setLighting,
      environment,
      setEnvironment,
      effects,
      setEffects,
      trails,
      setTrails,
      terrain,
      setTerrain,
    }),
    [mode, setMode, view, dashboard, layers, toggleLayer, selection, select, searchOpen, dock, aircraft, events, news, vessels, weather, markets, conflict, satellites, airports, powerplants, ports, volcanoes, cities, airquality, vault, flyTo, requestFlyTo, quality, autoQuality, atmosphere, lighting, environment, effects, trails, terrain],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
