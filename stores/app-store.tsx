"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AircraftState, DataStatus, NewsItem, WorldEvent } from "@/types/domain";
import { LAYERS, type LayerId } from "@/lib/config/layers";
import { MODE_BY_ID, type ModeId } from "@/lib/config/modes";

export type Selection =
  | { kind: "aircraft"; id: string }
  | { kind: "event"; id: string }
  | { kind: "news"; id: string }
  | { kind: "vessel"; id: string }
  | { kind: "weather"; id: string }
  | { kind: "satellite"; id: string }
  | { kind: "country"; iso3: string; name?: string }
  | null;

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
  /** Satellite catalogue (with TLEs) from the vault; propagated on the globe. */
  satellites: Feed<SatelliteRow>;
  /** Aggregated vault snapshot (SQLite-backed), or null while loading. */
  vault: VaultSnapshot | null;
  /** Fly-to request consumed by the globe; bumped on each navigation. */
  flyTo: { lat: number; lon: number; nonce: number } | null;
  requestFlyTo: (lat: number, lon: number) => void;
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

async function fetchFeed<T>(url: string, map?: (raw: Record<string, unknown>) => T): Promise<{ rows: T[]; meta: FeedMeta }> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  // Live-provider routes return { rows, status, ... }; vault routes return
  // { data, page, status?, provider? }. Handle both shapes uniformly.
  const raw: Record<string, unknown>[] = json.rows ?? json.data ?? [];
  const rows: T[] = map ? raw.map(map) : (raw as T[]);
  const meta: FeedMeta = {
    status: json.status ?? (json.data !== undefined ? "live" : "offline"),
    source: json.source ?? json.provider ?? "vault",
    cached: !!json.cached,
    stale: !!json.stale,
    fetchedAt: json.fetchedAt ?? new Date().toISOString(),
    error: json.error,
    count: json.count ?? json.page?.count ?? rows.length,
  };
  return { rows, meta };
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
    load();
    const t = setInterval(load, POLL_MS.vault);
    return () => { live = false; clearInterval(t); };
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
    load();
    const t = setInterval(load, intervalMs);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [url, intervalMs, active]);
  return state;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ModeId>("global");
  const [layers, setLayers] = useState<Record<LayerId, boolean>>(() => defaultLayerVisibility("global"));
  const [selection, setSelection] = useState<Selection>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [flyTo, setFlyTo] = useState<AppState["flyTo"]>(null);
  const nonce = useRef(0);

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

  const select = useCallback((s: Selection) => setSelection(s), []);

  // Only poll a feed when its layer is enabled — respects rate limits.
  const aircraft = useFeed<AircraftState>("/api/aircraft", POLL_MS.aircraft, layers.aircraft);
  const events = useFeed<WorldEvent>("/api/events", POLL_MS.events, layers.earthquakes || layers.naturalEvents);
  const news = useFeed<NewsItem>("/api/news", POLL_MS.news, layers.news);
  // Vault-backed vessels (MarineTraffic via the intelligence API).
  const vessels = useFeed<VesselRow>("/api/intelligence/maritime?limit=500", POLL_MS.vessels, layers.maritime);
  const weather = useFeed<WeatherRow>("/api/intelligence/weather?limit=200", POLL_MS.weather, layers.weather);
  // Markets drive the always-visible ticker, so poll regardless of layers.
  const markets = useFeed<MarketRow>("/api/intelligence/markets?limit=20", POLL_MS.markets, true);
  // Conflict/unrest (ACLED) from the vault; mapped to WorldEvent for the globe.
  const conflict = useFeed<WorldEvent>("/api/intelligence/events?kind=conflict&limit=500", POLL_MS.conflict, layers.conflict, vaultEventToWorld);
  // Satellite catalogue with TLEs — propagated client-side via SGP4.
  const satellites = useFeed<SatelliteRow>("/api/intelligence/space?limit=900", POLL_MS.satellites, layers.space);
  const vault = useVaultSnapshot();

  const value = useMemo<AppState>(
    () => ({
      mode,
      setMode,
      layers,
      toggleLayer,
      selection,
      select,
      searchOpen,
      setSearchOpen,
      aircraft,
      events,
      news,
      vessels,
      weather,
      markets,
      conflict,
      satellites,
      vault,
      flyTo,
      requestFlyTo,
    }),
    [mode, setMode, layers, toggleLayer, selection, select, searchOpen, aircraft, events, news, vessels, weather, markets, conflict, satellites, vault, flyTo, requestFlyTo],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
