"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AircraftState, DataStatus, NewsItem, WorldEvent } from "@/types/domain";
import { LAYERS, type LayerId } from "@/lib/config/layers";
import { MODE_BY_ID, type ModeId } from "@/lib/config/modes";

export type Selection =
  | { kind: "aircraft"; id: string }
  | { kind: "event"; id: string }
  | { kind: "news"; id: string }
  | { kind: "country"; iso3: string; name?: string }
  | null;

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
  /** Fly-to request consumed by the globe; bumped on each navigation. */
  flyTo: { lat: number; lon: number; nonce: number } | null;
  requestFlyTo: (lat: number, lon: number) => void;
}

const AppContext = createContext<AppState | null>(null);

const POLL_MS = { aircraft: 15_000, events: 60_000, news: 120_000 } as const;

function defaultLayerVisibility(mode: ModeId): Record<LayerId, boolean> {
  const on = new Set(MODE_BY_ID[mode].defaultLayers);
  return Object.fromEntries(LAYERS.map((l) => [l.id, on.has(l.id)])) as Record<LayerId, boolean>;
}

async function fetchFeed<T>(url: string): Promise<{ rows: T[]; meta: FeedMeta }> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  const rows: T[] = json.rows ?? [];
  const meta: FeedMeta = {
    status: json.status ?? "offline",
    source: json.source ?? "unknown",
    cached: !!json.cached,
    stale: !!json.stale,
    fetchedAt: json.fetchedAt ?? new Date().toISOString(),
    error: json.error,
    count: json.count ?? rows.length,
  };
  return { rows, meta };
}

function useFeed<T>(url: string, intervalMs: number, active: boolean): Feed<T> {
  const [state, setState] = useState<Feed<T>>({ rows: [], meta: null, loading: true });
  useEffect(() => {
    if (!active) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    let live = true;
    const load = async () => {
      try {
        const { rows, meta } = await fetchFeed<T>(url);
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
      flyTo,
      requestFlyTo,
    }),
    [mode, setMode, layers, toggleLayer, selection, select, searchOpen, aircraft, events, news, flyTo, requestFlyTo],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
