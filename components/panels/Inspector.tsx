"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { loadSgp4, subpoint } from "@/lib/sgp4-client";
import { useApp, type Airport, type AirQualityRow, type City, type PowerPlant, type Port, type Volcano, type SatelliteRow, type VesselRow, type WeatherRow } from "@/stores/app-store";
import { operatorFromCallsign } from "@/data/airlines-icao";
import StatusBadge from "@/components/common/StatusBadge";
import { safeHttpUrl } from "@/lib/safe-url";
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
    const e = app.events.rows.find((r) => r.id === sel.id) ?? app.conflict.rows.find((r) => r.id === sel.id);
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
  } else if (sel.kind === "satellite") {
    const s = app.satellites.rows.find((r) => r.id === sel.id);
    body = s ? <SatelliteView s={s} /> : <Missing kind="Satellite" />;
  } else if (sel.kind === "airport") {
    const ap = app.airports.rows.find((r) => r.id === sel.id);
    body = ap ? <AirportView a={ap} /> : <Missing kind="Airport" />;
  } else if (sel.kind === "airquality") {
    const aq = app.airquality.rows.find((r) => r.id === sel.id);
    body = aq ? <AirQualityView a={aq} /> : <Missing kind="Air quality" />;
  } else if (sel.kind === "powerplant") {
    const p = app.powerplants.rows.find((r) => r.id === sel.id);
    body = p ? <PowerPlantView p={p} /> : <Missing kind="Power plant" />;
  } else if (sel.kind === "port") {
    const p = app.ports.rows.find((r) => r.id === sel.id);
    body = p ? <PortView p={p} /> : <Missing kind="Port" />;
  } else if (sel.kind === "volcano") {
    const v = app.volcanoes.rows.find((r) => r.id === sel.id);
    body = v ? <VolcanoView v={v} /> : <Missing kind="Volcano" />;
  } else if (sel.kind === "city") {
    const c = app.cities.rows.find((r) => r.id === sel.id);
    body = c ? <CityView c={c} /> : <Missing kind="City" />;
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
      <div className="inspector-body" key={"id" in sel ? `${sel.kind}:${sel.id}` : `country:${sel.iso3}`}>
        {body}
        {/* Vault-backed kinds carry a persisted lineage keyed by their id.
            Aircraft are live/upstream (not vault) and country ids don't map 1:1
            to a vault subject, so lineage is offered only where it resolves. */}
        {"id" in sel && sel.kind !== "aircraft" && <LineageTrace subject={sel.id} />}
      </div>
    </section>
  );
}

function Missing({ kind }: { kind: string }) {
  const app = useApp();
  return (
    <div className="empty-state">
      <p className="muted-note">{kind} is no longer in the current data window — its feed has rolled forward since you selected it.</p>
      <button className="link-btn" onClick={() => app.select(null)}>Dismiss</button>
    </div>
  );
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
      {safeHttpUrl(p.sourceUrl) && (
        <div className="field">
          <label>Source</label>
          <a href={safeHttpUrl(p.sourceUrl)} target="_blank" rel="noreferrer noopener">open ↗</a>
        </div>
      )}
    </details>
  );
}

interface LineageRow {
  provider?: string;
  providerRecordId?: string;
  sourceUrl?: string;
  retrievedAt?: string;
  observedAt?: string;
  pipeline?: string;
  pipelineVersion?: string;
  confidence?: number;
}

/**
 * On-demand provenance trace for a vault-backed selection (§9, §44): "why does
 * Atlas believe this?". Lazy-fetches the normalized lineage from the vault only
 * when the operator expands it — no fetch per selection.
 */
function LineageTrace({ subject }: { subject: string }) {
  const [rows, setRows] = useState<LineageRow[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (!e.currentTarget.open || loaded) return;
    setLoaded(true);
    fetch(`/api/intelligence/provenance?subject=${encodeURIComponent(subject)}`)
      .then((r) => r.json())
      .then((j) => setRows((j.provenance as LineageRow[]) ?? []))
      .catch(() => setRows([]));
  };
  return (
    <details className="provenance lineage" onToggle={onToggle}>
      <summary>Lineage — why Atlas believes this</summary>
      {!loaded ? (
        <p className="muted-note">Expand to trace this record back to its source.</p>
      ) : rows == null ? (
        <p className="muted-note">Loading lineage…</p>
      ) : rows.length === 0 ? (
        <p className="muted-note">No lineage recorded for this record (live/upstream feed, or not yet re-synced into the vault).</p>
      ) : (
        rows.map((p, i) => (
          <div className="lineage-row" key={`${p.provider}:${p.providerRecordId}:${i}`}>
            <Field label="Provider" value={p.provider} />
            <Field label="Record ID" value={p.providerRecordId} />
            <Field label="Observed" value={p.observedAt ? since(p.observedAt) : undefined} />
            <Field label="Retrieved" value={p.retrievedAt ? since(p.retrievedAt) : undefined} />
            <Field label="Pipeline" value={p.pipeline ? `${p.pipeline}@${p.pipelineVersion ?? "?"}` : undefined} />
            {p.confidence != null && <Field label="Confidence" value={`${Math.round(p.confidence * 100)}%`} />}
            {safeHttpUrl(p.sourceUrl) && (
              <div className="field">
                <label>Source</label>
                <a href={safeHttpUrl(p.sourceUrl)} target="_blank" rel="noreferrer noopener">open ↗</a>
              </div>
            )}
          </div>
        ))
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
      {safeHttpUrl(n.url) && (
        <a className="link-btn" href={safeHttpUrl(n.url)} target="_blank" rel="noreferrer noopener">Read article ↗</a>
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

function aqiBand(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy (sensitive)";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very unhealthy";
  return "Hazardous";
}

function AirQualityView({ a }: { a: AirQualityRow }) {
  const app = useApp();
  return (
    <>
      <div className="entity-title">{a.place} · AQI {a.aqi}</div>
      <div className="entity-sub">Air quality · {aqiBand(a.aqi)}</div>
      <div className="field-grid">
        <Field label="US AQI" value={String(a.aqi)} />
        <Field label="PM2.5" value={a.pm25 != null ? `${Math.round(a.pm25)} µg/m³` : undefined} />
        <Field label="Country" value={a.country} />
        <Field label="Observed" value={a.observedAt ? since(a.observedAt) : undefined} />
        <Field label="Position" value={coord(a.lat, a.lon)} />
      </div>
      <button className="link-btn" onClick={() => app.requestFlyTo(a.lat, a.lon)}>Focus on globe</button>
      <p className="muted-note">Open-Meteo · CC BY 4.0</p>
    </>
  );
}

function AirportView({ a }: { a: Airport }) {
  const app = useApp();
  return (
    <>
      <div className="entity-title">{a.name}</div>
      <div className="entity-sub">Airport{a.large ? " · major hub" : ""}</div>
      <div className="field-grid">
        <Field label="ICAO" value={a.id} />
        <Field label="IATA" value={a.iata} />
        <Field label="Country" value={a.country} />
        <Field label="Scheduled" value={a.scheduled ? "yes" : "no"} />
        <Field label="Position" value={coord(a.lat, a.lon)} />
      </div>
      <button className="link-btn" onClick={() => app.requestFlyTo(a.lat, a.lon)}>Focus on globe</button>
      <p className="muted-note">OurAirports · public domain</p>
    </>
  );
}

function PowerPlantView({ p }: { p: PowerPlant }) {
  const app = useApp();
  return (
    <>
      <div className="entity-title">{p.name}</div>
      <div className="entity-sub">Power plant · {p.fuel}</div>
      <div className="field-grid">
        <Field label="Fuel" value={p.fuel} />
        <Field label="Capacity" value={`${p.mw.toLocaleString()} MW`} />
        <Field label="Country" value={p.country} />
        <Field label="Position" value={coord(p.lat, p.lon)} />
      </div>
      <button className="link-btn" onClick={() => app.requestFlyTo(p.lat, p.lon)}>Focus on globe</button>
      <p className="muted-note">WRI Global Power Plant Database · CC BY 4.0</p>
    </>
  );
}

function PortView({ p }: { p: Port }) {
  const app = useApp();
  const size = p.size ? { xs: "very small", s: "small", m: "medium", l: "large" }[p.size] : undefined;
  return (
    <>
      <div className="entity-title">{p.name}</div>
      <div className="entity-sub">Port{size ? ` · ${size}` : ""}</div>
      <div className="field-grid">
        <Field label="Country" value={p.country} />
        <Field label="Harbor size" value={size} />
        <Field label="Harbor type" value={p.type} />
        <Field label="Position" value={coord(p.lat, p.lon)} />
      </div>
      <button className="link-btn" onClick={() => app.requestFlyTo(p.lat, p.lon)}>Focus on globe</button>
      <p className="muted-note">NGA World Port Index · public domain</p>
    </>
  );
}

function VolcanoView({ v }: { v: Volcano }) {
  const app = useApp();
  return (
    <>
      <div className="entity-title">{v.name}</div>
      <div className="entity-sub">Volcano{v.type ? ` · ${v.type}` : ""}</div>
      <div className="field-grid">
        <Field label="Type" value={v.type} />
        <Field label="Elevation" value={v.elevation != null ? `${v.elevation.toLocaleString()} m` : undefined} />
        <Field label="Last eruption" value={v.lastEruption != null ? String(v.lastEruption) : undefined} />
        <Field label="Country" value={v.country} />
        <Field label="Position" value={coord(v.lat, v.lon)} />
      </div>
      <button className="link-btn" onClick={() => app.requestFlyTo(v.lat, v.lon)}>Focus on globe</button>
      <p className="muted-note">Smithsonian Global Volcanism Program</p>
    </>
  );
}

function CityView({ c }: { c: City }) {
  const app = useApp();
  return (
    <>
      <div className="entity-title">{c.name}</div>
      <div className="entity-sub">City{c.country ? ` · ${c.country}` : ""}</div>
      <div className="field-grid">
        <Field label="Population" value={c.pop ? c.pop.toLocaleString() : undefined} />
        <Field label="Country" value={c.country} />
        <Field label="Position" value={coord(c.lat, c.lon)} />
      </div>
      <button className="link-btn" onClick={() => app.requestFlyTo(c.lat, c.lon)}>Focus on globe</button>
      <p className="muted-note">GeoNames · CC BY 4.0</p>
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

function SatelliteView({ s }: { s: SatelliteRow }) {
  const app = useApp();
  const [sub, setSub] = useState<{ lat: number; lon: number; altKm: number } | null>(null);
  useEffect(() => {
    let live = true;
    if (s.tle1 && s.tle2) {
      loadSgp4().then((sat) => { if (live) setSub(subpoint(sat, s.tle1!, s.tle2!)); });
    }
    return () => { live = false; };
  }, [s.tle1, s.tle2]);
  const regime = s.periodMin == null ? "—" : s.periodMin < 128 ? "LEO" : s.periodMin < 800 ? "MEO" : "GEO/HEO";
  return (
    <>
      <div className="entity-title">{s.name}</div>
      <div className="entity-sub">Satellite · {s.objectType ?? "object"} · {s.source ?? "catalogue"}</div>
      <div className="field-grid">
        <Field label="NORAD" value={s.norad} />
        <Field label="Country" value={s.country} />
        <Field label="Orbit" value={regime} />
        <Field label="Inclination" value={s.inclinationDeg != null ? `${s.inclinationDeg}°` : "—"} />
        <Field label="Period" value={s.periodMin != null ? `${s.periodMin} min` : "—"} />
        <Field label="Apogee" value={s.apogeeKm != null ? `${s.apogeeKm} km` : "—"} />
        <Field label="Perigee" value={s.perigeeKm != null ? `${s.perigeeKm} km` : "—"} />
        <Field label="Element epoch" value={s.epoch ? since(s.epoch) : "—"} />
        {sub && <Field label="Sub-point" value={coord(sub.lat, sub.lon)} />}
        {sub && <Field label="Altitude" value={`${Math.round(sub.altKm)} km`} />}
      </div>
      {sub && <button className="link-btn" onClick={() => app.requestFlyTo(sub.lat, sub.lon)}>Focus on globe</button>}
      <p className="muted-note">Position propagated live via SGP4 from the current TLE.</p>
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
      {loading && (
        <div className="skel-wrap" aria-label="Loading country intelligence" aria-busy="true">
          <div className="skeleton skel-line" style={{ width: "60%" }} />
          <div className="skel-grid">
            <div className="skeleton skel-box" />
            <div className="skeleton skel-box" />
            <div className="skeleton skel-box" />
            <div className="skeleton skel-box" />
          </div>
          <div className="skeleton skel-line" style={{ width: "80%" }} />
          <div className="skeleton skel-line" style={{ width: "45%" }} />
        </div>
      )}
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
