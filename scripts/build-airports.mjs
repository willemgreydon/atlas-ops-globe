/**
 * Build a compact airports layer from the OurAirports dataset (public domain).
 * Keeps large + medium airports only (~5k) — the significant ones — as a static
 * JSON served from /public/data with immutable caching. No runtime cost, no
 * external fetch, no vault. Re-run when the source CSV updates.
 *
 *   node scripts/build-airports.mjs "/path/to/airports.csv"
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const src = process.argv[2] || process.env.AIRPORTS_CSV;
if (!src) {
  console.error('usage: node scripts/build-airports.mjs "/path/to/airports.csv"');
  process.exit(1);
}

/** Minimal RFC-4180-ish CSV line splitter (handles quoted fields with commas). */
function splitCsv(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const text = readFileSync(src, "utf8");
const lines = text.split(/\r?\n/).filter(Boolean);
const header = splitCsv(lines[0]);
const col = (name) => header.indexOf(name);
const iType = col("type");
const iName = col("name");
const iLat = col("latitude_deg");
const iLon = col("longitude_deg");
const iCountry = col("iso_country");
const iIata = col("iata_code");
const iIcao = col("icao_code");
const iIdent = col("ident");
const iSched = col("scheduled_service");

const KEEP = new Set(["large_airport", "medium_airport"]);
const airports = [];
for (let i = 1; i < lines.length; i++) {
  const r = splitCsv(lines[i]);
  const type = r[iType];
  if (!KEEP.has(type)) continue;
  const lat = Number(r[iLat]);
  const lon = Number(r[iLon]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  airports.push({
    id: r[iIcao] || r[iIdent],
    name: r[iName],
    lat: Math.round(lat * 1000) / 1000,
    lon: Math.round(lon * 1000) / 1000,
    iata: r[iIata] || undefined,
    country: r[iCountry] || undefined,
    large: type === "large_airport" || undefined,
    scheduled: r[iSched] === "yes" || undefined,
  });
}

// Large first so the globe prioritises them when it clusters/culls.
airports.sort((a, b) => (b.large ? 1 : 0) - (a.large ? 1 : 0));

const outDir = resolve(process.cwd(), "public", "data");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "airports.json");
writeFileSync(outPath, JSON.stringify(airports));
const large = airports.filter((a) => a.large).length;
console.log(`Wrote ${airports.length} airports (${large} large, ${airports.length - large} medium) → ${outPath}`);
console.log(`Size: ${(JSON.stringify(airports).length / 1024).toFixed(0)} KB`);
