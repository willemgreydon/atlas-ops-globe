"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useApp, type VesselRow, type WeatherRow } from "@/stores/app-store";
import { operatorFromCallsign } from "@/data/airlines-icao";
import StatusBadge from "@/components/common/StatusBadge";
import type { AircraftState, DataStatus, NewsItem, Provenance, WorldEvent } from "@/types/domain";

interface VaultCountry {
  iso2: string;
  iso3: string;
  name: string;
  region?: string;
  capital?: string;
  lat?: number;
  lon?: number;
  indicators: { indicator: string; label: string; unit?: string; period?: string; value: number | null }[];
  current: {
    events: { id: string; title: string; severity: string; occurredAt: string }[];
    news: { id: string; title: string; source: string; publishedAt: string }[];
  };
}

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
  } else if (sel.kind === "vessel") {
    const v = app.vessels.rows.find((r) => r.id === sel.id);
    body = v ? <VesselView v={v} /> : <Missing kind="Vessel" />;
  } else if (sel.kind === "weather") {
    const w = app.weather.rows.find((r) => r.id === sel.id);
    body = w ? <WeatherView w={w} /> : <Missing kind="Weather" />;
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
  const operator = operatorFromCallsign(a.callsign);
  const icao24 = a.id.replace("aircraft:", "").toUpperCase();
  const climb = a.verticalRateMs;
  const vs = climb == null ? "—" : `${climb > 0.3 ? "▲ climbing" : climb < -0.3 ? "▼ descending" : "level"} ${Math.abs(Math.round(climb * 196.85))} ft/min`;
  return (
    <>
      <div className="entity-title">{a.callsign ?? icao24}</div>
      <div className="entity-sub">Aircraft · ADS-B{operator ? ` · ${operator}` : ""}</div>
      <div className="field-grid">
        <Field label="Operator" value={operator} />
        <Field label="ICAO24" value={icao24.toLowerCase()} />
        <Field label="Origin country" value={a.country} />
        <Field label="Altitude" value={a.position.alt != null ? `${Math.round(a.position.alt)} m · FL${Math.round((a.position.alt * 3.281) / 100)}` : "—"} />
        <Field label="Ground speed" value={a.velocityMs != null ? `${Math.round(a.velocityMs * 1.944)} kn` : "—"} />
        <Field label="Heading" value={a.headingDeg != null ? `${Math.round(a.headingDeg)}°` : "—"} />
        <Field label="Vertical rate" value={vs} />
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

function VesselView({ v }: { v: VesselRow }) {
  const app = useApp();
  return (
    <>
      <div className="entity-title">{v.name ?? v.mmsi ?? v.imo ?? "Vessel"}</div>
      <div className="entity-sub">Vessel · {v.vesselType ?? "AIS"} · MarineTraffic</div>
      <div className="field-grid">
        <Field label="IMO" value={v.imo} />
        <Field label="MMSI" value={v.mmsi} />
        <Field label="Flag" value={v.flag} />
        <Field label="Speed" value={v.speedKn != null ? `${v.speedKn.toFixed(1)} kn` : "—"} />
        <Field label="Course" value={v.courseDeg != null ? `${Math.round(v.courseDeg)}°` : "—"} />
        <Field label="Nav status" value={v.navigationStatus} />
        <Field label="Destination" value={v.destination} />
        <Field label="Position" value={coord(v.lat, v.lon)} />
        <Field label="Last contact" value={since(v.lastContact)} />
      </div>
      <button className="link-btn" onClick={() => app.requestFlyTo(v.lat, v.lon)}>Focus on globe</button>
    </>
  );
}

function WeatherView({ w }: { w: WeatherRow }) {
  const app = useApp();
  return (
    <>
      <div className="entity-title">{w.place ?? "Weather"}{w.value != null ? ` · ${Math.round(w.value)}${w.unit ?? "°"}` : ""}</div>
      <div className="entity-sub">Weather · Open-Meteo</div>
      <div className="field-grid">
        <Field label="Temperature" value={w.value != null ? `${w.value}${w.unit ?? "°C"}` : "—"} />
        <Field label="Country" value={w.countryCode} />
        <Field label="Observed" value={w.observedAt ? since(`${w.observedAt}Z`) : undefined} />
        <Field label="Position" value={coord(w.lat, w.lon)} />
      </div>
      <button className="link-btn" onClick={() => app.requestFlyTo(w.lat, w.lon)}>Focus on globe</button>
      <p className="muted-note">Current conditions · CC BY 4.0 Open-Meteo</p>
    </>
  );
}

function CountryView({ iso3, name }: { iso3: string; name?: string }) {
  const app = useApp();
  const [profile, setProfile] = useState<VaultCountry | null>(null);
  const [status, setStatus] = useState<DataStatus>("live");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let live = true;
    setLoading(true);
    // Prefer the vault country profile (indicators + recent events + news);
    // fall back to the live World Bank route if the vault isn't populated.
    (async () => {
      try {
        const res = await fetch(`/api/intelligence/countries/${encodeURIComponent(iso3)}`, { cache: "no-store" });
        if (res.ok) {
          const j = (await res.json()) as VaultCountry;
          if (live) { setProfile(j); setStatus("live"); setLoading(false); }
          return;
        }
        const fb = await (await fetch(`/api/country?iso=${encodeURIComponent(iso3)}`, { cache: "no-store" })).json();
        if (!live) return;
        const d = fb.data;
        setProfile(d ? {
          iso2: d.iso2 ?? "", iso3: d.iso3 ?? iso3, name: d.name ?? name ?? iso3, region: d.region, capital: d.capital,
          indicators: (d.indicators ?? []).map((i: { code: string; label: string; unit?: string; year?: string; value: number | null }) => ({ indicator: i.code, label: i.label, unit: i.unit, period: i.year, value: i.value })),
          current: { events: [], news: [] },
        } : null);
        setStatus(fb.status ?? "live");
        setError(fb.error);
        setLoading(false);
      } catch (err) {
        if (live) { setError(String(err)); setLoading(false); }
      }
    })();
    return () => { live = false; };
  }, [iso3, name]);

  return (
    <>
      <div className="entity-title">{profile?.name ?? name ?? iso3}</div>
      <div className="entity-sub">
        Country · {iso3} <StatusBadge status={status} /> <span className="src-chip">VAULT</span>
      </div>
      {loading && <p className="muted-note">Loading country intelligence…</p>}
      {error && <p className="muted-note">Source degraded: {error}</p>}
      {profile && (
        <>
          <div className="field-grid">
            <Field label="Region" value={profile.region} />
            <Field label="Capital" value={profile.capital} />
          </div>
          <div className="metric-grid">
            {profile.indicators.map((i) => (
              <div className="metric" key={i.indicator}>
                <label>{i.label}{i.period ? ` · ${i.period}` : ""}</label>
                <b>{i.value == null ? "—" : formatIndicator(i.value, i.unit)}</b>
              </div>
            ))}
          </div>
          {profile.current.events.length > 0 && (
            <div className="mini-section">
              <h4>Recent events</h4>
              {profile.current.events.slice(0, 5).map((e) => (
                <button key={e.id} className="mini-row" onClick={() => app.select({ kind: "event", id: e.id })}>
                  <span className={`sev-dot sev-${e.severity}`} />{e.title}
                </button>
              ))}
            </div>
          )}
          {profile.current.news.length > 0 && (
            <div className="mini-section">
              <h4>Recent news</h4>
              {profile.current.news.slice(0, 5).map((n) => (
                <div key={n.id} className="mini-row static"><span className="mini-src">{n.source}</span>{n.title}</div>
              ))}
            </div>
          )}
        </>
      )}
      {profile?.lat != null && profile?.lon != null && (
        <button className="link-btn" onClick={() => app.requestFlyTo(profile.lat!, profile.lon!)}>Focus on globe</button>
      )}
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
