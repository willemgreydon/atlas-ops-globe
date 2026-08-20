"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useApp } from "@/stores/app-store";
import StatusBadge from "@/components/common/StatusBadge";
import type { AircraftState, CountryProfile, DataStatus, NewsItem, Provenance, WorldEvent } from "@/types/domain";

export default function Inspector() {
  const app = useApp();
  const sel = app.selection;
  if (!sel) return null;

  let body: React.ReactNode = null;
  if (sel.kind === "aircraft") {
    const a = app.aircraft.rows.find((r) => r.id === sel.id);
    body = a ? <AircraftView a={a} /> : <Missing kind="Aircraft" />;
  } else if (sel.kind === "event") {
    const e = app.events.rows.find((r) => r.id === sel.id);
    body = e ? <EventView e={e} /> : <Missing kind="Event" />;
  } else if (sel.kind === "news") {
    const n = app.news.rows.find((r) => r.id === sel.id);
    body = n ? <NewsView n={n} /> : <Missing kind="News" />;
  } else if (sel.kind === "country") {
    body = <CountryView iso3={sel.iso3} name={sel.name} />;
  }

  return (
    <section className="panel inspector" aria-label="Inspector">
      <div className="inspector-head">
        <h3>Inspector</h3>
        <button className="icon-btn" onClick={() => app.select(null)} aria-label="Close inspector">
          <X size={14} />
        </button>
      </div>
      <div className="inspector-body">{body}</div>
    </section>
  );
}

function Missing({ kind }: { kind: string }) {
  return <p className="muted-note">{kind} no longer in the current data window.</p>;
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="field">
      <label>{label}</label>
      <span>{value}</span>
    </div>
  );
}

function coord(lat: number, lon: number) {
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}

function since(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return `${Math.round(s)}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function ProvenanceBlock({ p }: { p?: Provenance }) {
  if (!p) return null;
  return (
    <details className="provenance" open>
      <summary>Provenance</summary>
      <Field label="Provider" value={p.provider} />
      <Field label="Record ID" value={p.providerRecordId} />
      <Field label="Observed" value={p.observedAt ? since(p.observedAt) : undefined} />
      <Field label="Retrieved" value={since(p.retrievedAt)} />
      {p.confidence != null && <Field label="Confidence" value={`${Math.round(p.confidence * 100)}%`} />}
      <Field label="Transform" value={p.transformationVersion} />
      {p.sourceUrl && (
        <div className="field">
          <label>Source</label>
          <a href={p.sourceUrl} target="_blank" rel="noreferrer noopener">open ↗</a>
        </div>
      )}
    </details>
  );
}

function AircraftView({ a }: { a: AircraftState }) {
  const app = useApp();
  return (
    <>
      <div className="entity-title">{a.callsign ?? a.id.replace("aircraft:", "").toUpperCase()}</div>
      <div className="entity-sub">Aircraft · ADS-B</div>
      <div className="field-grid">
        <Field label="Origin country" value={a.country} />
        <Field label="Altitude" value={a.position.alt != null ? `${Math.round(a.position.alt)} m` : "—"} />
        <Field label="Ground speed" value={a.velocityMs != null ? `${Math.round(a.velocityMs)} m/s` : "—"} />
        <Field label="Heading" value={a.headingDeg != null ? `${Math.round(a.headingDeg)}°` : "—"} />
        <Field label="Vertical rate" value={a.verticalRateMs != null ? `${a.verticalRateMs.toFixed(1)} m/s` : "—"} />
        <Field label="On ground" value={a.onGround == null ? "—" : a.onGround ? "yes" : "no"} />
        <Field label="Position" value={coord(a.position.lat, a.position.lon)} />
        <Field label="Last contact" value={since(a.lastContact)} />
      </div>
      <button className="link-btn" onClick={() => app.requestFlyTo(a.position.lat, a.position.lon)}>Focus on globe</button>
      <ProvenanceBlock p={a.provenance} />
    </>
  );
}

function EventView({ e }: { e: WorldEvent }) {
  const app = useApp();
  return (
    <>
      <div className="entity-title">{e.title}</div>
      <div className="entity-sub">{e.kind} · <span className={`sev sev-${e.severity}`}>{e.severity}</span></div>
      {e.summary && <p className="entity-summary">{e.summary}</p>}
      <div className="field-grid">
        <Field label="Occurred" value={since(e.occurredAt)} />
        <Field label="Country" value={e.countryCode} />
        <Field label="Position" value={coord(e.location.lat, e.location.lon)} />
        {e.confidence != null && <Field label="Confidence" value={`${Math.round(e.confidence * 100)}%`} />}
      </div>
      {e.tags && e.tags.length > 0 && (
        <div className="tags">{e.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
      )}
      <button className="link-btn" onClick={() => app.requestFlyTo(e.location.lat, e.location.lon)}>Focus on globe</button>
      <ProvenanceBlock p={e.provenance} />
    </>
  );
}

function NewsView({ n }: { n: NewsItem }) {
  return (
    <>
      <div className="entity-title">{n.title}</div>
      <div className="entity-sub">News · {n.source}</div>
      <div className="field-grid">
        <Field label="Published" value={since(n.publishedAt)} />
        <Field label="Country" value={n.countryCode} />
      </div>
      {n.url && (
        <a className="link-btn" href={n.url} target="_blank" rel="noreferrer noopener">Read article ↗</a>
      )}
      <ProvenanceBlock p={n.provenance} />
    </>
  );
}

function CountryView({ iso3, name }: { iso3: string; name?: string }) {
  const app = useApp();
  const [profile, setProfile] = useState<CountryProfile | null>(null);
  const [status, setStatus] = useState<DataStatus>("live");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetch(`/api/country?iso=${encodeURIComponent(iso3)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!live) return;
        setProfile(j.data ?? null);
        setStatus(j.status ?? "live");
        setError(j.error);
        setLoading(false);
      })
      .catch((err) => {
        if (!live) return;
        setError(String(err));
        setLoading(false);
      });
    return () => { live = false; };
  }, [iso3]);

  return (
    <>
      <div className="entity-title">{profile?.name ?? name ?? iso3}</div>
      <div className="entity-sub">
        Country · {iso3} <StatusBadge status={status} />
      </div>
      {loading && <p className="muted-note">Loading indicators…</p>}
      {error && <p className="muted-note">Source degraded: {error}</p>}
      {profile && (
        <>
          <div className="field-grid">
            <Field label="Region" value={profile.region} />
            <Field label="Capital" value={profile.capital} />
          </div>
          <div className="metric-grid">
            {profile.indicators.map((i) => (
              <div className="metric" key={i.code}>
                <label>{i.label}{i.year ? ` · ${i.year}` : ""}</label>
                <b>{i.value == null ? "—" : formatIndicator(i.value, i.unit)}</b>
              </div>
            ))}
          </div>
        </>
      )}
      {profile?.location && (
        <button className="link-btn" onClick={() => app.requestFlyTo(profile.location!.lat, profile.location!.lon)}>Focus on globe</button>
      )}
      <ProvenanceBlock p={profile?.provenance} />
    </>
  );
}

function formatIndicator(value: number, unit?: string): string {
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "US$") {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toFixed(0)}`;
  }
  return value.toLocaleString();
}
