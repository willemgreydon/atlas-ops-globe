import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hashPayload } from "@/lib/fetch-json";
import { makeProvenance } from "@/lib/core/provenance";
import { scoreConfidence } from "@/lib/core/confidence";
import { isValidPoint } from "@/lib/core/geo";
import { resolveCountry } from "@/lib/intel/resolve";
import type { Severity, WorldEvent } from "@/types/domain";

/**
 * GDELT 2.0 Event Database — the *structured*, CAMEO-coded, geocoded conflict
 * record, pulled from the raw data CDN (data.gdeltproject.org), NOT the DOC API.
 *
 * Why this instead of the DOC search API: the DOC API (api.gdeltproject.org)
 * firewall-drops datacenter egress — it times out from both Vercel and GitHub
 * Actions (like OpenSky), so it can never feed the vault from CI. The raw data
 * host is a static file CDN that IS reachable from datacenters, which makes this
 * a durable, keyless conflict source the 3h vault sync can rely on.
 *
 * Every 15 minutes GDELT publishes an `export.CSV.zip` of ~1-2k geolocated
 * events with CAMEO codes. We keep the conflict quadrants — QuadClass 3 (verbal
 * conflict) and 4 (material conflict: assault, fight, mass violence) — and map
 * each to a conflict `WorldEvent` positioned by its ActionGeo lat/lon (the
 * ingestor resolves the country from the point). Media-derived and coarse, but
 * curated far better than a keyword news search, and globally dense including
 * the Sahel / Central-Africa belt.
 *
 * Unzip uses the system `unzip -p` (present on CI + dev, per build-cities.mjs);
 * this runs in the vault ingest, not Vercel serverless.
 */
const BASE = "https://data.gdeltproject.org/gdeltv2";
const RELIABILITY = 0.6; // structured CAMEO events — a notch above DOC media search

/** 0-indexed columns we read from the 61-field GDELT 2.0 Event row. */
const C = {
  id: 0, root: 28, quad: 29, goldstein: 30, nmentions: 31, narticles: 33,
  geoFull: 52, lat: 56, lon: 57, dateAdded: 59, url: 60,
} as const;

/** CAMEO EventRootCode → human label for a readable title. */
const ROOT_LABEL: Record<number, string> = {
  14: "Protest", 15: "Force posture", 16: "Reduced relations", 17: "Coercion",
  18: "Assault", 19: "Armed clash", 20: "Mass violence",
};

function severityFor(root: number, quad: number, narticles: number): Severity {
  // GoldsteinScale is fixed per CAMEO type (every "fight" is ~-10), so it can't
  // rank intensity; media prominence (NumArticles) is the better signal — a
  // widely-reported incident is the bigger event. Reserve critical for mass
  // violence or *heavily* reported actual violence (assault/armed clash) so the
  // top band stays meaningful — a lone wire report of a scuffle shouldn't be
  // "critical". Material-conflict coercion (root 17) tops out at warning.
  if (root === 20) return "critical";                          // mass / unconventional violence
  if (quad === 4) return root >= 18 && narticles >= 50 ? "critical" : "warning";
  return "watch";                                              // verbal conflict (QuadClass 3)
}

/** GDELT `YYYYMMDDHHMMSS` → ISO-8601 (UTC). */
function isoFromStamp(s: string): string {
  if (!/^\d{14}$/.test(s)) return new Date().toISOString();
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
}

/**
 * Pure tab-delimited export → conflict `WorldEvent[]`. Extracted from the fetch
 * so the CAMEO filtering + mapping is unit-tested without a network round-trip.
 */
export function parseGdeltEvents(csv: string): WorldEvent[] {
  const out: WorldEvent[] = [];
  for (const line of csv.split("\n")) {
    if (!line) continue;
    const f = line.split("\t");
    if (f.length < 61) continue;
    const quad = Number(f[C.quad]);
    if (quad !== 3 && quad !== 4) continue; // conflict quadrants only
    // GDELT leaves ActionGeo lat/lon empty when an event has no location; guard
    // explicitly since Number("") is 0, which would otherwise plot at 0,0.
    if (!f[C.lat] || !f[C.lon]) continue;
    const location = { lat: Number(f[C.lat]), lon: Number(f[C.lon]) };
    if (!isValidPoint(location)) continue;
    const root = Number(f[C.root]) || 0;
    const narts = Math.max(1, Number(f[C.narticles]) || 1);
    const id = f[C.id];
    const occurredAt = isoFromStamp(f[C.dateAdded]);
    const place = (f[C.geoFull] || "").trim();
    const placeShort = place ? place.split(",")[0] : "";
    const country = place ? place.split(",").pop()!.trim() : "";
    // Resolve the country from GDELT's OWN ActionGeo name (authoritative), not by
    // nearest-centroid on lat/lon — the latter snaps coastal/peripheral points of
    // big countries onto tiny neighbours (a Miami event lands ~300 km from the
    // Bahamas centroid but ~2000 km from the US centroid in Kansas → "Bahamas").
    const countryCode = resolveCountry(country)?.iso2 || undefined;
    const url = f[C.url] || "";
    const label = ROOT_LABEL[root] ?? "Conflict event";
    const confidence = scoreConfidence({ sourceCount: narts, providerReliability: RELIABILITY, geoPrecision: 0.7 }).score;
    out.push({
      id: `event:gdelt-ev:${id}`,
      kind: "conflict",
      title: placeShort ? `${label} · ${placeShort}` : label,
      summary: `${narts} report${narts === 1 ? "" : "s"} · CAMEO ${root}${country ? ` · ${country}` : ""}`,
      severity: severityFor(root, quad, narts),
      occurredAt,
      location,
      countryCode,
      source: "GDELT",
      sourceUrl: url,
      confidence,
      tags: ["conflict", "gdelt-events", ...(country ? [country] : [])],
      provenance: makeProvenance({
        provider: "gdelt-events",
        providerRecordId: id,
        sourceUrl: url,
        observedAt: occurredAt,
        confidence,
        rawObjectHash: hashPayload(f),
      }),
    });
  }
  return out;
}

/** The latest `n` 15-minute file stamps, newest first (`YYYYMMDDHHMMSS`). */
function stampsBack(latest: string, n: number): string[] {
  const base = Date.UTC(
    +latest.slice(0, 4), +latest.slice(4, 6) - 1, +latest.slice(6, 8),
    +latest.slice(8, 10), +latest.slice(10, 12), 0,
  );
  const p = (x: number) => String(x).padStart(2, "0");
  return Array.from({ length: n }, (_, i) => {
    const t = new Date(base - i * 15 * 60_000);
    return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}${p(t.getUTCHours())}${p(t.getUTCMinutes())}00`;
  });
}

/** Download one `export.CSV.zip` and return its single member as text. */
async function fetchExportCsv(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`gdelt-events ${res.status}`);
  const zipPath = join(tmpdir(), `gdelt-ev-${hashPayload(url)}.zip`);
  writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  try {
    return execFileSync("unzip", ["-p", zipPath], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");
  } finally {
    rmSync(zipPath, { force: true });
  }
}

/**
 * Fetch conflict events from the latest `windows` 15-minute GDELT exports
 * (default 8 ≈ the last 2 hours), deduped by global event id. More windows →
 * broader country coverage; each file is ~90 KB so this stays cheap.
 */
export async function fetchGdeltEvents(windows = 8): Promise<WorldEvent[]> {
  const lastUpdate = await fetch(`${BASE}/lastupdate.txt`, { signal: AbortSignal.timeout(15_000) }).then((r) => r.text());
  const exportLine = lastUpdate.split("\n").find((l) => l.includes(".export."));
  const m = exportLine && /(\d{14})\.export/.exec(exportLine);
  if (!m) return [];
  const seen = new Set<string>();
  const out: WorldEvent[] = [];
  for (const stamp of stampsBack(m[1], windows)) {
    try {
      for (const e of parseGdeltEvents(await fetchExportCsv(`${BASE}/${stamp}.export.CSV.zip`))) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        out.push(e);
      }
    } catch { /* a missing/failed 15-min window shouldn't sink the rest */ }
  }
  return out;
}
