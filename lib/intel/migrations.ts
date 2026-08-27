import type { Db } from "./db";

/**
 * Versioned, forward-only migrations. Each runs once inside a transaction and
 * is recorded in `_migrations`. Add new migrations by appending — never edit an
 * applied one.
 */
interface Migration {
  id: number;
  name: string;
  up: string;
}

const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "core-schema",
    up: `
    CREATE TABLE sources (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, domains TEXT NOT NULL, type TEXT,
      base_url TEXT, auth TEXT, license TEXT, commercial_use TEXT, redistribution TEXT,
      attribution TEXT, enabled INTEGER DEFAULT 1, status TEXT, config TEXT
    );

    CREATE TABLE provenance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id TEXT NOT NULL, provider TEXT NOT NULL, dataset TEXT,
      provider_record_id TEXT, source_url TEXT, observed_at TEXT, published_at TEXT,
      retrieved_at TEXT NOT NULL, license TEXT, attribution TEXT, raw_path TEXT,
      raw_hash TEXT, pipeline TEXT, pipeline_version TEXT, confidence REAL
    );
    CREATE INDEX idx_prov_subject ON provenance(subject_id);

    CREATE TABLE entities (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT, country_code TEXT,
      lat REAL, lon REAL, data TEXT, quality TEXT,
      first_seen_at TEXT, last_seen_at TEXT
    );
    CREATE INDEX idx_entities_type ON entities(type);
    CREATE INDEX idx_entities_country ON entities(country_code);

    CREATE TABLE relationships (
      id TEXT PRIMARY KEY, from_id TEXT NOT NULL, type TEXT NOT NULL, to_id TEXT NOT NULL,
      basis TEXT, valid_from TEXT, valid_to TEXT, confidence REAL DEFAULT 0.5,
      provenance TEXT, created_at TEXT
    );
    CREATE INDEX idx_rel_from ON relationships(from_id);
    CREATE INDEX idx_rel_to ON relationships(to_id);
    CREATE INDEX idx_rel_type ON relationships(type);

    CREATE TABLE countries (
      iso2 TEXT PRIMARY KEY, iso3 TEXT, name TEXT, region TEXT, capital TEXT,
      lat REAL, lon REAL, data TEXT, provenance TEXT, updated_at TEXT
    );

    CREATE TABLE events (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, subtype TEXT, title TEXT, summary TEXT,
      severity TEXT, occurred_at TEXT, published_at TEXT, lat REAL, lon REAL,
      country_code TEXT, source TEXT, source_url TEXT, confidence REAL,
      tags TEXT, provenance TEXT, updated_at TEXT
    );
    CREATE INDEX idx_events_kind ON events(kind);
    CREATE INDEX idx_events_occurred ON events(occurred_at);
    CREATE INDEX idx_events_country ON events(country_code);

    CREATE TABLE news_articles (
      id TEXT PRIMARY KEY, title TEXT, url TEXT, source TEXT, publisher TEXT,
      published_at TEXT, language TEXT, country_code TEXT, lat REAL, lon REAL,
      persons TEXT, organizations TEXT, themes TEXT, story_id TEXT,
      provenance TEXT, fetched_at TEXT
    );
    CREATE INDEX idx_news_published ON news_articles(published_at);
    CREATE INDEX idx_news_country ON news_articles(country_code);
    CREATE INDEX idx_news_story ON news_articles(story_id);

    CREATE TABLE news_stories (
      id TEXT PRIMARY KEY, title TEXT, first_seen TEXT, last_seen TEXT,
      article_count INTEGER, countries TEXT, persons TEXT, organizations TEXT,
      source_diversity INTEGER, updated_at TEXT
    );

    CREATE TABLE persons (
      id TEXT PRIMARY KEY, canonical_name TEXT, aliases TEXT, wikidata_id TEXT,
      roles TEXT, organizations TEXT, countries TEXT, data TEXT,
      mention_count INTEGER DEFAULT 0, provenance TEXT, updated_at TEXT
    );

    CREATE TABLE organizations (
      id TEXT PRIMARY KEY, canonical_name TEXT, aliases TEXT, wikidata_id TEXT, lei TEXT,
      country_code TEXT, data TEXT, mention_count INTEGER DEFAULT 0,
      provenance TEXT, updated_at TEXT
    );

    CREATE TABLE economic_observations (
      id TEXT PRIMARY KEY, country_code TEXT, indicator TEXT, label TEXT, unit TEXT,
      frequency TEXT, period TEXT, value REAL, provider TEXT, provenance TEXT
    );
    CREATE INDEX idx_econ_country ON economic_observations(country_code);
    CREATE INDEX idx_econ_indicator ON economic_observations(indicator);

    CREATE TABLE vulnerabilities (
      id TEXT PRIMARY KEY, title TEXT, cvss REAL, epss REAL, cwe TEXT, vendor TEXT,
      products TEXT, kev INTEGER DEFAULT 0, kev_date_added TEXT, published_at TEXT,
      updated_at TEXT, refs TEXT, source TEXT, provenance TEXT
    );
    CREATE INDEX idx_vuln_kev ON vulnerabilities(kev);
    CREATE INDEX idx_vuln_published ON vulnerabilities(published_at);

    CREATE TABLE space_objects (
      id TEXT PRIMARY KEY, norad TEXT, cospar TEXT, name TEXT, operator TEXT,
      country TEXT, object_type TEXT, launch_date TEXT, tle_line1 TEXT, tle_line2 TEXT,
      epoch TEXT, inclination_deg REAL, period_min REAL, apogee_km REAL, perigee_km REAL,
      source TEXT, provenance TEXT, updated_at TEXT
    );
    CREATE INDEX idx_space_type ON space_objects(object_type);

    -- Reference / high-volume tables (schema present; populated as sources are wired)
    CREATE TABLE aircraft (
      id TEXT PRIMARY KEY, icao24 TEXT, callsign TEXT, country TEXT, lat REAL, lon REAL,
      alt REAL, velocity REAL, heading REAL, on_ground INTEGER, last_contact TEXT,
      provenance TEXT, updated_at TEXT
    );
    CREATE TABLE airports (
      id TEXT PRIMARY KEY, icao TEXT, iata TEXT, name TEXT, country_code TEXT,
      lat REAL, lon REAL, type TEXT, data TEXT, provenance TEXT
    );
    CREATE TABLE ports (
      id TEXT PRIMARY KEY, unlocode TEXT, name TEXT, country_code TEXT,
      lat REAL, lon REAL, data TEXT, provenance TEXT
    );
    CREATE TABLE vessels (
      id TEXT PRIMARY KEY, imo TEXT, mmsi TEXT, name TEXT, vessel_type TEXT, flag TEXT,
      lat REAL, lon REAL, speed REAL, course REAL, nav_status TEXT, destination TEXT,
      eta TEXT, last_contact TEXT, provenance TEXT, updated_at TEXT
    );
    CREATE TABLE market_observations (
      id TEXT PRIMARY KEY, symbol TEXT, asset_class TEXT, ts TEXT, value REAL,
      currency TEXT, latency_class TEXT, provider TEXT, provenance TEXT
    );
    CREATE TABLE weather_observations (
      id TEXT PRIMARY KEY, lat REAL, lon REAL, observed_at TEXT, variable TEXT,
      value REAL, unit TEXT, provider TEXT, provenance TEXT
    );
    CREATE TABLE sanctions (
      id TEXT PRIMARY KEY, subject_type TEXT, subject_id TEXT, name TEXT, aliases TEXT,
      program TEXT, authority TEXT, jurisdiction TEXT, listed_at TEXT, updated_at TEXT,
      identifiers TEXT, source TEXT, provenance TEXT
    );
    CREATE TABLE change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id TEXT, field TEXT,
      previous TEXT, next TEXT, detected_at TEXT, sources TEXT
    );
    CREATE INDEX idx_change_subject ON change_log(subject_id);
    `,
  },
  {
    id: 2,
    name: "fts",
    up: `
    CREATE VIRTUAL TABLE fts_news USING fts5(id UNINDEXED, title, body);
    CREATE VIRTUAL TABLE fts_events USING fts5(id UNINDEXED, title, body);
    CREATE VIRTUAL TABLE fts_entities USING fts5(id UNINDEXED, name, aliases);
    `,
  },
  {
    id: 3,
    name: "weather-place",
    up: `
    ALTER TABLE weather_observations ADD COLUMN place TEXT;
    ALTER TABLE weather_observations ADD COLUMN country_code TEXT;
    CREATE INDEX idx_weather_variable ON weather_observations(variable);
    `,
  },
  {
    id: 4,
    name: "market-fields",
    up: `
    ALTER TABLE market_observations ADD COLUMN name TEXT;
    ALTER TABLE market_observations ADD COLUMN change REAL;
    ALTER TABLE market_observations ADD COLUMN change_pct REAL;
    CREATE INDEX idx_market_class ON market_observations(asset_class);
    `,
  },
];

export function runMigrations(db: Db): number {
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at TEXT);");
  const applied = new Set(
    (db.prepare("SELECT id FROM _migrations").all() as { id: number }[]).map((r) => r.id),
  );
  let count = 0;
  const record = db.prepare("INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)");
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    db.exec("BEGIN");
    try {
      db.exec(m.up);
      record.run(m.id, m.name, new Date().toISOString());
      db.exec("COMMIT");
      count++;
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(`migration ${m.id} (${m.name}) failed: ${(err as Error).message}`);
    }
  }
  return count;
}

export const LATEST_MIGRATION = MIGRATIONS[MIGRATIONS.length - 1].id;
