"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useApp } from "@/stores/app-store";
import { MODES } from "@/lib/config/modes";
import StatusBadge from "@/components/common/StatusBadge";
import type { DataStatus } from "@/types/domain";

function useUtcClock(): string {
  const [t, setT] = useState<string>("--:--:--");
  useEffect(() => {
    const tick = () => setT(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

/** Worst (least trustworthy) status across active feeds, for the header summary. */
function overallStatus(...statuses: (DataStatus | undefined)[]): DataStatus {
  const rank: DataStatus[] = ["live", "delayed", "cached", "mock", "offline"];
  return statuses.filter(Boolean).reduce<DataStatus>(
    (acc, s) => (rank.indexOf(s!) > rank.indexOf(acc) ? s! : acc),
    "live",
  );
}

export default function TopBar() {
  const app = useApp();
  const clock = useUtcClock();
  // Every active feed counts toward the header summary — not just aircraft/
  // events/news (audit P3-2), so the badge can never read LIVE while an active
  // conflict/maritime/weather feed is offline. Each is gated on its layer.
  const active = [
    app.layers.aircraft ? app.aircraft.meta?.status : undefined,
    app.layers.earthquakes || app.layers.naturalEvents ? app.events.meta?.status : undefined,
    app.layers.news ? app.news.meta?.status : undefined,
    app.layers.maritime ? app.vessels.meta?.status : undefined,
    app.layers.weather ? app.weather.meta?.status : undefined,
    app.layers.conflict ? app.conflict.meta?.status : undefined,
    app.layers.space ? app.satellites.meta?.status : undefined,
    app.markets.meta?.status, // markets always poll (ticker)
  ];
  const status = overallStatus(...active);

  return (
    <header className="topbar">
      <div className="brand">ATLAS<span>/</span>OPS</div>
      <nav className="nav" aria-label="Operational modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={app.mode === m.id ? "active" : ""}
            onClick={() => app.setMode(m.id)}
            title={m.blurb}
            aria-pressed={app.mode === m.id}
          >
            {m.label}
            {!m.operational && <i className="mode-planned" title="Provider integration planned" />}
          </button>
        ))}
      </nav>
      <div className="topbar-right">
        <div className="view-toggle" role="group" aria-label="View">
          <button className={app.view === "globe" ? "active" : ""} onClick={() => app.setView("globe")} aria-pressed={app.view === "globe"}>Globe</button>
          <button className={app.view === "dashboard" ? "active" : ""} onClick={() => app.setView("dashboard")} aria-pressed={app.view === "dashboard"}>Observatory</button>
        </div>
        <button className="search-trigger" onClick={() => app.setSearchOpen(true)} aria-label="Search (Cmd+K)">
          <Search size={13} /> Search
          <kbd>⌘K</kbd>
        </button>
        <StatusBadge status={status} title="Overall feed status" />
        <span className="utc" title="Coordinated Universal Time">UTC {clock}</span>
      </div>
    </header>
  );
}
