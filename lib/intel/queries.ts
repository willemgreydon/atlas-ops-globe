import { getDb } from "./db";

/**
 * Read/query layer for the intelligence API. Every list is paginated and every
 * filter is bounded — the vault is never loaded into memory. Rows are shaped
 * into JSON-friendly objects with their JSON columns parsed.
 */
export interface PageParams {
  limit: number;
  offset: number;
}

export interface Page<T> {
  data: T[];
  page: { limit: number; offset: number; count: number; nextOffset: number | null };
}

/** Clamp pagination to safe bounds. */
export function parsePage(sp: URLSearchParams): PageParams {
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 100), 1), 500);
  const offset = Math.max(Number(sp.get("cursor") ?? sp.get("offset") ?? 0), 0);
  return { limit, offset };
}

/** Parse & validate a `bbox=west,south,east,north` param. */
export function parseBbox(v: string | null): [number, number, number, number] | null {
  if (!v) return null;
  const parts = v.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [w, s, e, n] = parts;
  const lonOk = (x: number) => x >= -180 && x <= 180;
  const latOk = (y: number) => y >= -90 && y <= 90;
  if (!lonOk(w) || !lonOk(e) || !latOk(s) || !latOk(n)) return null;
  return [w, s, e, n];
}

/** Convert `since=24h|7d|60m` to an ISO timestamp, or null. */
export function parseSince(v: string | null): string | null {
  if (!v) return null;
  const m = /^(\d+)([mhd])$/.exec(v.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const ms = m[2] === "m" ? n * 60_000 : m[2] === "h" ? n * 3_600_000 : n * 86_400_000;
  return new Date(Date.now() - ms).toISOString();
}

const parseJson = <T>(v: unknown, fallback: T): T => {
  if (typeof v !== "string") return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
};

function page<T>(data: T[], p: PageParams): Page<T> {
  return { data, page: { ...p, count: data.length, nextOffset: data.length === p.limit ? p.offset + p.limit : null } };
}

interface Filters { kind?: string; country?: string; bbox?: [number, number, number, number] | null; since?: string | null; }

export function listEvents(p: PageParams, f: Filters = {}): Page<Record<string, unknown>> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.kind) { where.push("kind = ?"); args.push(f.kind); }
  if (f.country) { where.push("country_code = ?"); args.push(f.country.toUpperCase()); }
  if (f.since) { where.push("occurred_at >= ?"); args.push(f.since); }
  if (f.bbox) { where.push("lon BETWEEN ? AND ? AND lat BETWEEN ? AND ?"); args.push(f.bbox[0], f.bbox[2], f.bbox[1], f.bbox[3]); }
  const sql = `SELECT id, kind, subtype, title, summary, severity, occurred_at AS occurredAt, lat, lon,
      country_code AS countryCode, source, source_url AS sourceUrl, confidence, tags
    FROM events ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY occurred_at DESC LIMIT ? OFFSET ?`;
  const rows = getDb().prepare(sql).all(...(args as never[]), p.limit, p.offset) as Record<string, unknown>[];
  for (const r of rows) r.tags = parseJson(r.tags, []);
  return page(rows, p);
}

export function listNews(p: PageParams, f: Filters = {}): Page<Record<string, unknown>> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.country) { where.push("country_code = ?"); args.push(f.country.toUpperCase()); }
  if (f.since) { where.push("published_at >= ?"); args.push(f.since); }
  const sql = `SELECT id, title, url, source, publisher, published_at AS publishedAt, country_code AS countryCode,
      story_id AS storyId FROM news_articles ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY published_at DESC LIMIT ? OFFSET ?`;
  const rows = getDb().prepare(sql).all(...(args as never[]), p.limit, p.offset) as Record<string, unknown>[];
  return page(rows, p);
}

export function listVulnerabilities(p: PageParams, opts: { kevOnly?: boolean; since?: string | null } = {}): Page<Record<string, unknown>> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.kevOnly) where.push("kev = 1");
  if (opts.since) { where.push("published_at >= ?"); args.push(opts.since); }
  const sql = `SELECT id, title, cvss, epss, vendor, kev, kev_date_added AS kevDateAdded,
      published_at AS publishedAt, cwe, source FROM vulnerabilities
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY (kev_date_added IS NULL), kev_date_added DESC, published_at DESC LIMIT ? OFFSET ?`;
  const rows = getDb().prepare(sql).all(...(args as never[]), p.limit, p.offset) as Record<string, unknown>[];
  for (const r of rows) { r.cwe = parseJson(r.cwe, []); r.kev = r.kev === 1; }
  return page(rows, p);
}

export function listSpace(p: PageParams): Page<Record<string, unknown>> {
  const rows = getDb().prepare(
    `SELECT id, norad, cospar, name, object_type AS objectType, inclination_deg AS inclinationDeg,
       period_min AS periodMin, apogee_km AS apogeeKm, perigee_km AS perigeeKm, epoch, source
     FROM space_objects ORDER BY norad LIMIT ? OFFSET ?`,
  ).all(p.limit, p.offset) as Record<string, unknown>[];
  return page(rows, p);
}

export function listCountries(p: PageParams): Page<Record<string, unknown>> {
  const rows = getDb().prepare(
    "SELECT iso2, iso3, name, region, capital, lat, lon FROM countries ORDER BY name LIMIT ? OFFSET ?",
  ).all(p.limit, p.offset) as Record<string, unknown>[];
  return page(rows, p);
}

export function listVessels(p: PageParams, f: { bbox?: [number, number, number, number] | null } = {}): Page<Record<string, unknown>> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.bbox) { where.push("lon BETWEEN ? AND ? AND lat BETWEEN ? AND ?"); args.push(f.bbox[0], f.bbox[2], f.bbox[1], f.bbox[3]); }
  const sql = `SELECT id, imo, mmsi, name, vessel_type AS vesselType, flag, lat, lon, speed AS speedKn,
      course AS courseDeg, nav_status AS navigationStatus, destination, eta, last_contact AS lastContact
    FROM vessels ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY last_contact DESC LIMIT ? OFFSET ?`;
  const rows = getDb().prepare(sql).all(...(args as never[]), p.limit, p.offset) as Record<string, unknown>[];
  return page(rows, p);
}

export function getCountryProfile(code: string): Record<string, unknown> | null {
  const db = getDb();
  const iso = code.toUpperCase();
  const country = db.prepare(
    "SELECT iso2, iso3, name, region, capital, lat, lon FROM countries WHERE iso2 = ? OR iso3 = ?",
  ).get(iso, iso) as Record<string, unknown> | undefined;
  if (!country) return null;
  const iso2 = country.iso2 as string;
  const indicators = db.prepare(
    "SELECT indicator, label, unit, period, value FROM economic_observations WHERE country_code = ? ORDER BY indicator, period DESC",
  ).all(iso2);
  const events = db.prepare(
    "SELECT id, title, severity, occurred_at AS occurredAt FROM events WHERE country_code = ? ORDER BY occurred_at DESC LIMIT 10",
  ).all(iso2);
  const news = db.prepare(
    "SELECT id, title, source, published_at AS publishedAt FROM news_articles WHERE country_code = ? ORDER BY published_at DESC LIMIT 10",
  ).all(iso2);
  return { ...country, indicators, current: { events, news } };
}

export function fullTextSearch(table: "fts_news" | "fts_events", query: string, limit = 25): Record<string, unknown>[] {
  // FTS5 MATCH; sanitize to a prefix-safe token query.
  const safe = query.replace(/["']/g, " ").trim();
  if (!safe) return [];
  return getDb().prepare(`SELECT id, title FROM ${table} WHERE ${table} MATCH ? LIMIT ?`).all(`${safe}*`, limit) as Record<string, unknown>[];
}
