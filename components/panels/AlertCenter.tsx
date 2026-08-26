"use client";
import { useMemo, useState } from "react";
import { useApp } from "@/stores/app-store";
import { deriveAlerts } from "@/lib/alerts";

type Filter = "all" | "critical" | "warning";

export default function AlertCenter() {
  const app = useApp();
  const alerts = useMemo(() => deriveAlerts(app.events.rows), [app.events.rows]);
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => ({
    all: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
  }), [alerts]);

  const shown = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);

  return (
    <section className="panel alert-center" aria-label="Alert center">
      <div className="panel-head">
        <h3>Alert Center</h3>
        <span className="count-pill">{alerts.length}</span>
      </div>
      {alerts.length > 0 && (
        <div className="chip-row" role="group" aria-label="Filter alerts by severity">
          {(["all", "critical", "warning"] as Filter[]).map((f) => (
            <button key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)} aria-pressed={filter === f}>
              {f}<span className="chip-n">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}
      <div className="alert-list">
        {alerts.length === 0 && <p className="muted-note">No active warning/critical alerts.</p>}
        {alerts.length > 0 && shown.length === 0 && <p className="muted-note">No {filter} alerts right now.</p>}
        {shown.map((a) => (
          <button
            key={a.id}
            className={`alert sev-${a.severity}`}
            onClick={() => {
              if (a.relatedEventId) app.select({ kind: "event", id: a.relatedEventId });
              if (a.location) app.requestFlyTo(a.location.lat, a.location.lon);
            }}
          >
            <div className="alert-top">
              <span className={`sev-tag sev-${a.severity}`}>{a.severity.toUpperCase()}</span>
              <span className="alert-meta">
                {a.category}
                {a.confidence != null ? ` · ${Math.round(a.confidence * 100)}%` : ""}
              </span>
            </div>
            <strong>{a.title}</strong>
            <small>{a.source} · {new Date(a.createdAt).toLocaleTimeString()}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
