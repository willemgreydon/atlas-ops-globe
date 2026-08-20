"use client";
import { useMemo } from "react";
import { useApp } from "@/stores/app-store";
import { deriveAlerts } from "@/lib/alerts";

export default function AlertCenter() {
  const app = useApp();
  const alerts = useMemo(() => deriveAlerts(app.events.rows), [app.events.rows]);

  return (
    <section className="panel alert-center" aria-label="Alert center">
      <div className="panel-head">
        <h3>Alert Center</h3>
        <span className="count-pill">{alerts.length}</span>
      </div>
      <div className="alert-list">
        {alerts.length === 0 && <p className="muted-note">No active warning/critical alerts.</p>}
        {alerts.map((a) => (
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
