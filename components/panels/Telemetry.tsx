"use client";
import { useApp } from "@/stores/app-store";
import { MODE_BY_ID } from "@/lib/config/modes";
import StatusBadge from "@/components/common/StatusBadge";
import type { FeedMeta } from "@/stores/app-store";

function Row({ label, meta, on }: { label: string; meta: FeedMeta | null; on: boolean }) {
  return (
    <div className="tele-row">
      <span className="tele-label">{label}</span>
      <span className="tele-val">
        {!on ? <span className="muted-note">off</span> : meta ? meta.count.toLocaleString() : "…"}
      </span>
      {on && meta && <StatusBadge status={meta.status} title={meta.error ?? `source: ${meta.source}`} />}
    </div>
  );
}

export default function Telemetry() {
  const app = useApp();
  const mode = MODE_BY_ID[app.mode];
  return (
    <section className="panel telemetry" aria-label="Telemetry">
      <div className="panel-head">
        <h3>Telemetry</h3>
        <span className="mode-chip">{mode.label}</span>
      </div>
      <div className="tele-list">
        <Row label="Aircraft" meta={app.aircraft.meta} on={app.layers.aircraft} />
        <Row label="Events" meta={app.events.meta} on={app.layers.earthquakes || app.layers.naturalEvents} />
        <Row label="News" meta={app.news.meta} on={app.layers.news} />
      </div>
      <p className="tele-blurb">{mode.blurb}</p>
    </section>
  );
}
