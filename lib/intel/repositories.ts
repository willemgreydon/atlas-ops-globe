import type { DatabaseSync } from "node:sqlite";
import { getDb } from "./db";
import type {
  VaultCountry, VaultEconomicObs, VaultEntity, VaultEvent, VaultMarketObs, VaultNews,
  VaultProvenance, VaultRelationship, VaultSpaceObject, VaultVessel, VaultVulnerability,
  VaultWeatherObs,
} from "./schemas";

/**
 * Repository layer. All vault writes flow through here so provenance, FTS
 * indexing and JSON (de)serialization stay consistent. Reads used by the CLI
 * and API live here too. Functions default to the process DB but accept an
 * explicit handle for tests.
 */
const J = (v: unknown) => JSON.stringify(v ?? null);
const now = () => new Date().toISOString();

function insertProvenance(db: DatabaseSync, subjectId: string, records: VaultProvenance[]): void {
  if (!records?.length) return;
  db.prepare("DELETE FROM provenance WHERE subject_id = ?").run(subjectId);
  const stmt = db.prepare(
    `INSERT INTO provenance
     (subject_id, provider, dataset, provider_record_id, source_url, observed_at,
      published_at, retrieved_at, license, attribution, raw_path, raw_hash,
      pipeline, pipeline_version, confidence)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const p of records) {
    stmt.run(
      subjectId, p.provider, p.dataset ?? null, p.providerRecordId ?? null, p.sourceUrl ?? null,
      p.observedAt ?? null, p.publishedAt ?? null, p.retrievedAt, p.license ?? null,
      p.attribution ?? null, p.rawPath ?? null, p.rawHash ?? null,
      p.transformation?.pipeline ?? null, p.transformation?.version ?? null, p.confidence ?? null,
    );
  }
}

// --------------------------------------------------------------------------
// Countries
// --------------------------------------------------------------------------
export function upsertCountry(c: VaultCountry, db = getDb()): void {
  db.prepare(
    `INSERT INTO countries (iso2, iso3, name, region, capital, lat, lon, data, provenance, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(iso2) DO UPDATE SET iso3=excluded.iso3, name=excluded.name, region=excluded.region,
       capital=excluded.capital, lat=excluded.lat, lon=excluded.lon, data=excluded.data,
       provenance=excluded.provenance, updated_at=excluded.updated_at`,
  ).run(c.iso2, c.iso3, c.name, c.region ?? null, c.capital ?? null, c.lat ?? null, c.lon ?? null,
    J(c.data), J(c.provenance), now());
  upsertEntity({ id: `country:${c.iso2}`, type: "Country", name: c.name, countryCode: c.iso2,
    lat: c.lat, lon: c.lon, data: {}, provenance: c.provenance }, db);
}

// --------------------------------------------------------------------------
// Generic entities & relationships
// --------------------------------------------------------------------------
export function upsertEntity(e: VaultEntity, db = getDb()): void {
  db.prepare(
    `INSERT INTO entities (id, type, name, country_code, lat, lon, data, quality, first_seen_at, last_seen_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET type=excluded.type, name=excluded.name,
       country_code=excluded.country_code, lat=excluded.lat, lon=excluded.lon,
       data=excluded.data, quality=excluded.quality, last_seen_at=excluded.last_seen_at`,
  ).run(e.id, e.type, e.name, e.countryCode ?? null, e.lat ?? null, e.lon ?? null,
    J(e.data), J(e.quality ?? null), now(), now());
  syncFts(db, "fts_entities", e.id, e.name, "");
  if (e.provenance?.length) insertProvenance(db, e.id, e.provenance);
}

export function upsertRelationship(r: VaultRelationship, db = getDb()): void {
  db.prepare(
    `INSERT INTO relationships (id, from_id, type, to_id, basis, valid_from, valid_to, confidence, provenance, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET basis=excluded.basis, valid_to=excluded.valid_to,
       confidence=excluded.confidence, provenance=excluded.provenance`,
  ).run(r.id, r.from, r.type, r.to, r.basis, r.validFrom ?? null, r.validTo ?? null,
    r.confidence, J(r.provenance), now());
}

// --------------------------------------------------------------------------
// Events
// --------------------------------------------------------------------------
export function upsertEvent(e: VaultEvent, db = getDb()): void {
  db.prepare(
    `INSERT INTO events (id, kind, subtype, title, summary, severity, occurred_at, published_at,
       lat, lon, country_code, source, source_url, confidence, tags, provenance, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, summary=excluded.summary,
       severity=excluded.severity, occurred_at=excluded.occurred_at, lat=excluded.lat, lon=excluded.lon,
       country_code=excluded.country_code, confidence=excluded.confidence, tags=excluded.tags,
       provenance=excluded.provenance, updated_at=excluded.updated_at`,
  ).run(e.id, e.kind, e.subtype ?? null, e.title, e.summary ?? null, e.severity, e.occurredAt,
    e.publishedAt ?? null, e.lat ?? null, e.lon ?? null, e.countryCode ?? null, e.source,
    e.sourceUrl ?? null, e.confidence ?? null, J(e.tags), J(e.provenance), now());
  syncFts(db, "fts_events", e.id, e.title, `${e.summary ?? ""} ${(e.tags ?? []).join(" ")}`);
  if (e.provenance?.length) insertProvenance(db, e.id, e.provenance);
}

// --------------------------------------------------------------------------
// News
// --------------------------------------------------------------------------
export function upsertNews(n: VaultNews, db = getDb()): void {
  db.prepare(
    `INSERT INTO news_articles (id, title, url, source, publisher, published_at, language,
       country_code, lat, lon, persons, organizations, themes, story_id, provenance, fetched_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, published_at=excluded.published_at,
       country_code=excluded.country_code, persons=excluded.persons,
       organizations=excluded.organizations, themes=excluded.themes, story_id=excluded.story_id`,
  ).run(n.id, n.title, n.url ?? null, n.source, n.publisher ?? null, n.publishedAt, n.language ?? null,
    n.countryCode ?? null, n.lat ?? null, n.lon ?? null, J(n.persons), J(n.organizations),
    J(n.themes), n.storyId ?? null, J(n.provenance), now());
  syncFts(db, "fts_news", n.id, n.title, [...n.persons, ...n.organizations, ...n.themes].join(" "));
  if (n.provenance?.length) insertProvenance(db, n.id, n.provenance);
}

// --------------------------------------------------------------------------
// Cyber
// --------------------------------------------------------------------------
export function upsertVulnerability(v: VaultVulnerability, db = getDb()): void {
  db.prepare(
    `INSERT INTO vulnerabilities (id, title, cvss, epss, cwe, vendor, products, kev, kev_date_added,
       published_at, updated_at, refs, source, provenance)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, cvss=excluded.cvss, epss=excluded.epss,
       cwe=excluded.cwe, vendor=excluded.vendor, products=excluded.products, kev=excluded.kev,
       kev_date_added=excluded.kev_date_added, updated_at=excluded.updated_at,
       refs=excluded.refs, provenance=excluded.provenance`,
  ).run(v.id, v.title ?? null, v.cvss ?? null, v.epss ?? null, J(v.cwe), v.vendor ?? null,
    J(v.products), v.kev ? 1 : 0, v.kevDateAdded ?? null, v.publishedAt ?? null,
    v.updatedAt ?? now(), J(v.references), v.source, J(v.provenance));
  if (v.provenance?.length) insertProvenance(db, v.id, v.provenance);
}

// --------------------------------------------------------------------------
// Space
// --------------------------------------------------------------------------
export function upsertSpaceObject(s: VaultSpaceObject, db = getDb()): void {
  db.prepare(
    `INSERT INTO space_objects (id, norad, cospar, name, operator, country, object_type, launch_date,
       tle_line1, tle_line2, epoch, inclination_deg, period_min, apogee_km, perigee_km, source, provenance, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, tle_line1=excluded.tle_line1,
       tle_line2=excluded.tle_line2, epoch=excluded.epoch, inclination_deg=excluded.inclination_deg,
       period_min=excluded.period_min, apogee_km=excluded.apogee_km, perigee_km=excluded.perigee_km,
       provenance=excluded.provenance, updated_at=excluded.updated_at`,
  ).run(s.id, s.norad, s.cospar ?? null, s.name, s.operator ?? null, s.country ?? null,
    s.objectType ?? null, s.launchDate ?? null, s.tleLine1 ?? null, s.tleLine2 ?? null,
    s.epoch ?? null, s.inclinationDeg ?? null, s.periodMin ?? null, s.apogeeKm ?? null,
    s.perigeeKm ?? null, s.source, J(s.provenance), now());
}

// --------------------------------------------------------------------------
// Economics
// --------------------------------------------------------------------------
export function upsertEconomicObs(o: VaultEconomicObs, db = getDb()): void {
  db.prepare(
    `INSERT INTO economic_observations (id, country_code, indicator, label, unit, frequency, period, value, provider, provenance)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET value=excluded.value, provenance=excluded.provenance`,
  ).run(o.id, o.countryCode, o.indicator, o.label, o.unit ?? null, o.frequency ?? null,
    o.period, o.value ?? null, o.provider, J(o.provenance));
}

// --------------------------------------------------------------------------
// Maritime
// --------------------------------------------------------------------------
export function upsertVessel(v: VaultVessel, db = getDb()): void {
  db.prepare(
    `INSERT INTO vessels (id, imo, mmsi, name, vessel_type, flag, lat, lon, speed, course, nav_status, destination, eta, last_contact, provenance, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, vessel_type=excluded.vessel_type, flag=excluded.flag,
       lat=excluded.lat, lon=excluded.lon, speed=excluded.speed, course=excluded.course,
       nav_status=excluded.nav_status, destination=excluded.destination, eta=excluded.eta,
       last_contact=excluded.last_contact, provenance=excluded.provenance, updated_at=excluded.updated_at`,
  ).run(v.id, v.imo ?? null, v.mmsi ?? null, v.name ?? null, v.vesselType ?? null, v.flag ?? null,
    v.lat, v.lon, v.speedKn ?? null, v.courseDeg ?? null, v.navigationStatus ?? null,
    v.destination ?? null, v.eta ?? null, v.lastContact, J(v.provenance), now());
  if (v.provenance?.length) insertProvenance(db, v.id, v.provenance);
}

// --------------------------------------------------------------------------
// Weather
// --------------------------------------------------------------------------
export function upsertWeatherObs(o: VaultWeatherObs, db = getDb()): void {
  db.prepare(
    `INSERT INTO weather_observations (id, lat, lon, place, country_code, observed_at, variable, value, unit, provider, provenance)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET observed_at=excluded.observed_at, value=excluded.value,
       unit=excluded.unit, provenance=excluded.provenance`,
  ).run(o.id, o.lat, o.lon, o.place ?? null, o.countryCode ?? null, o.observedAt, o.variable,
    o.value ?? null, o.unit ?? null, o.provider, J(o.provenance));
}

// --------------------------------------------------------------------------
// Markets
// --------------------------------------------------------------------------
export function upsertMarketObs(o: VaultMarketObs, db = getDb()): void {
  db.prepare(
    `INSERT INTO market_observations (id, symbol, name, asset_class, ts, value, change, change_pct, currency, latency_class, provider, provenance)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET ts=excluded.ts, value=excluded.value, change=excluded.change,
       change_pct=excluded.change_pct, latency_class=excluded.latency_class, provenance=excluded.provenance`,
  ).run(o.id, o.symbol, o.name ?? null, o.assetClass, o.ts, o.price ?? null, o.change ?? null,
    o.changePct ?? null, o.currency ?? null, o.latencyClass, o.provider, J(o.provenance));
}

// --------------------------------------------------------------------------
// FTS helper
// --------------------------------------------------------------------------
function syncFts(db: DatabaseSync, table: string, id: string, a: string, b: string): void {
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO ${table} (id, ${table === "fts_entities" ? "name, aliases" : "title, body"}) VALUES (?,?,?)`)
    .run(id, a, b);
}

// --------------------------------------------------------------------------
// Reads / stats
// --------------------------------------------------------------------------
export function count(table: string, where?: string, params: unknown[] = [], db = getDb()): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}${where ? ` WHERE ${where}` : ""}`)
    .get(...(params as never[])) as { n: number };
  return row.n;
}

export function tableCounts(db = getDb()): Record<string, number> {
  const tables = [
    "countries", "entities", "relationships", "events", "news_articles", "news_stories",
    "persons", "organizations", "economic_observations", "vulnerabilities", "space_objects",
    "aircraft", "airports", "ports", "vessels", "sanctions", "market_observations",
    "weather_observations", "provenance",
  ];
  const out: Record<string, number> = {};
  for (const t of tables) out[t] = count(t, undefined, [], db);
  return out;
}
