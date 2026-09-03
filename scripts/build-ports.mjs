/**
 * Build the ports layer from the NGA World Port Index (Pub 150) — a US
 * Government work in the public domain. ~3,800 ports worldwide, dense along the
 * Chinese, Russian (Arctic + Pacific), African and Australian coasts, so it
 * complements the live AIS/maritime layer with fixed harbour infrastructure.
 *
 * Fetches the WPI CSV, keeps name + position + country + harbour size, and
 * writes a compact static JSON to /public/data (immutable-cached). No runtime
 * cost, no request-time fetch, no vault. Re-run when NGA updates Pub 150.
 *
 *   node scripts/build-ports.mjs
 *
 * Attribution: NGA World Port Index (Pub 150), public domain.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SRC =
  process.env.PORTS_CSV_URL ||
  "https://msi.nga.mil/api/publications/download?type=view&key=16920959/SFH00000/UpdatedPub150.csv";

/** RFC-4180-ish CSV splitter (quoted fields with embedded commas). */
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

const SIZE = { "Very Small": "xs", Small: "s", Medium: "m", Large: "l" };

const res = await fetch(SRC);
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText} for ${SRC}`);
  process.exit(1);
}
let text = await res.text();
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip UTF-8 BOM
const lines = text.split(/\r?\n/).filter(Boolean);
const header = splitCsv(lines[0]).map((h) => h.trim());
const col = (name) => header.indexOf(name);
const iName = col("Main Port Name");
const iLat = col("Latitude");
const iLon = col("Longitude");
const iCountry = col("Country Code"); // holds the country name in WPI
const iSize = col("Harbor Size");
const iType = col("Harbor Type");
const iId = col("World Port Index Number");

const out = [];
for (let i = 1; i < lines.length; i++) {
  const c = splitCsv(lines[i]);
  const lat = Number(c[iLat]);
  const lon = Number(c[iLon]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const name = (c[iName] || "").trim();
  if (!name) continue;
  out.push({
    id: (c[iId] || `wpi:${i}`).trim(),
    name,
    lat: +lat.toFixed(4),
    lon: +lon.toFixed(4),
    country: (c[iCountry] || "").trim() || undefined,
    size: SIZE[(c[iSize] || "").trim()] || undefined,
    type: (c[iType] || "").trim() || undefined,
  });
}

const dir = resolve(process.cwd(), "public/data");
mkdirSync(dir, { recursive: true });
const file = resolve(dir, "ports.json");
writeFileSync(file, JSON.stringify(out));

const bySize = out.reduce((m, p) => ((m[p.size || "?"] = (m[p.size || "?"] || 0) + 1), m), {});
console.log(`wrote ${out.length} ports → ${file}`);
console.log("by size:", bySize);
