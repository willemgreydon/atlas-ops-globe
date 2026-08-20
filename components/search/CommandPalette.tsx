"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useApp } from "@/stores/app-store";
import { countryCentroids } from "@/data/country-centroids";
import type { GeoPoint } from "@/types/domain";

interface Result {
  id: string;
  kind: "country" | "event" | "news" | "aircraft";
  label: string;
  sub: string;
  point?: GeoPoint;
  onPick: () => void;
}

/**
 * Universal ⌘K / Ctrl+K command palette. Searches countries, live events, news
 * and aircraft; picking a result selects it and flies the globe to it.
 */
export default function CommandPalette() {
  const app = useApp();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        app.setSearchOpen(true);
      }
      if (e.key === "Escape") app.setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [app]);

  useEffect(() => {
    if (app.searchOpen) {
      setQ("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [app.searchOpen]);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out: Result[] = [];

    for (const c of countryCentroids) {
      if (c.name.toLowerCase().includes(term) || c.iso3.toLowerCase() === term || c.iso2.toLowerCase() === term) {
        out.push({
          id: `country:${c.iso3}`,
          kind: "country",
          label: c.name,
          sub: `Country · ${c.iso3}`,
          point: c.point,
          onPick: () => {
            app.select({ kind: "country", iso3: c.iso3, name: c.name });
            app.requestFlyTo(c.point.lat, c.point.lon);
          },
        });
      }
    }
    for (const e of app.events.rows) {
      if (e.title.toLowerCase().includes(term)) {
        out.push({
          id: e.id, kind: "event", label: e.title, sub: `Event · ${e.severity}`, point: e.location,
          onPick: () => { app.select({ kind: "event", id: e.id }); app.requestFlyTo(e.location.lat, e.location.lon); },
        });
      }
    }
    for (const n of app.news.rows) {
      if (n.title.toLowerCase().includes(term)) {
        out.push({
          id: n.id, kind: "news", label: n.title, sub: `News · ${n.source}`, point: n.location,
          onPick: () => { app.select({ kind: "news", id: n.id }); if (n.location) app.requestFlyTo(n.location.lat, n.location.lon); },
        });
      }
    }
    for (const a of app.aircraft.rows) {
      if (a.callsign?.toLowerCase().includes(term)) {
        out.push({
          id: a.id, kind: "aircraft", label: a.callsign!, sub: `Aircraft · ${a.country ?? "?"}`, point: a.position,
          onPick: () => { app.select({ kind: "aircraft", id: a.id }); app.requestFlyTo(a.position.lat, a.position.lon); },
        });
      }
    }
    return out.slice(0, 40);
  }, [q, app]);

  if (!app.searchOpen) return null;

  const pick = (r?: Result) => {
    if (!r) return;
    r.onPick();
    app.setSearchOpen(false);
  };

  return (
    <div className="palette-overlay" onMouseDown={() => app.setSearchOpen(false)}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
        <div className="palette-input">
          <Search size={16} />
          <input
            ref={inputRef}
            value={q}
            placeholder="Search countries, events, news, aircraft…"
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); pick(results[cursor]); }
            }}
          />
          <kbd>ESC</kbd>
        </div>
        <div className="palette-results">
          {q && results.length === 0 && <div className="palette-empty">No matches in the current data window.</div>}
          {results.map((r, i) => (
            <button
              key={`${r.kind}:${r.id}`}
              className={`palette-item ${i === cursor ? "active" : ""}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(r)}
            >
              <span className={`palette-kind kind-${r.kind}`}>{r.kind}</span>
              <span className="palette-label">{r.label}</span>
              <span className="palette-sub">{r.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
