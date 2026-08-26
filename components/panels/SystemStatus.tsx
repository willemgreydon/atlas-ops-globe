"use client";
import { useEffect, useState } from "react";
import { useApp, type FeedMeta } from "@/stores/app-store";
import StatusBadge from "@/components/common/StatusBadge";
import type { DataStatus } from "@/types/domain";

/** Compact relative age: "12s", "4m", "2h", "3d". */
function ago(iso: string | undefined, now: number): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** Worst (least trustworthy) status across active feeds. */
function worst(...s: (DataStatus | undefined)[]): DataStatus {
  const rank: DataStatus[] = ["live", "delayed", "cached", "mock", "offline"];
  return s.filter(Boolean).reduce<DataStatus>((a, x) => (rank.indexOf(x!) > rank.indexOf(a) ? x! : a), "live");
}

interface Line {
  label: string;
  on: boolean;
  meta: FeedMeta | null;
  count: number;
  loading: boolean;
}

export default function SystemStatus() {
  const app = useApp();
  // Re-render every 3s so relative ages stay honest without touching the store.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(t);
  }, []);

  const lines: Line[] = [
    { label: "Aircraft", on: app.layers.aircraft, meta: app.aircraft.meta, count: app.aircraft.rows.length, loading: app.aircraft.loading },
    { label: "Events", on: app.layers.earthquakes || app.layers.naturalEvents, meta: app.events.meta, count: app.events.rows.length, loading: app.events.loading },
    { label: "News", on: app.layers.news, meta: app.news.meta, count: app.news.rows.length, loading: app.news.loading },
    { label: "Vessels", on: app.layers.maritime, meta: app.vessels.meta, count: app.vessels.rows.length, loading: app.vessels.loading },
    { label: "Weather", on: app.layers.weather, meta: app.weather.meta, count: app.weather.rows.length, loading: app.weather.loading },
    { label: "Conflict", on: app.layers.conflict, meta: app.conflict.meta, count: app.conflict.rows.length, loading: app.conflict.loading },
    { label: "Satellites", on: app.layers.space, meta: app.satellites.meta, count: app.satellites.rows.length, loading: app.satellites.loading },
    { label: "Markets", on: true, meta: app.markets.meta, count: app.markets.rows.length, loading: app.markets.loading },
  ];

  const overall = worst(...lines.filter((l) => l.on).map((l) => l.meta?.status));

  return (
    <section className="panel sysstat" aria-label="System status">
      <div className="panel-head">
        <h3>System Status</h3>
        <StatusBadge status={overall} title="Worst active-feed status" />
      </div>
      <div className="sys-list">
        {lines.map((l) => (
          <div className={`sys-row ${l.on ? "" : "off"}`} key={l.label}>
            <span className={`feed-dot feed-${l.on ? l.meta?.status ?? "offline" : "offline"}`} />
            <span className="sys-name">{l.label}</span>
            {l.on ? (
              <>
                <span className="sys-count">{l.loading && !l.meta ? "…" : l.count}</span>
                <span className="sys-ago" title={l.meta?.source ? `source: ${l.meta.source}` : undefined}>
                  {l.meta ? ago(l.meta.fetchedAt, now) : "—"}
                </span>
              </>
            ) : (
              <span className="sys-ago">off</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
