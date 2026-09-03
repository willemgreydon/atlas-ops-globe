/**
 * Build the power-plants layer from the WRI Global Power Plant Database v1.3
 * (CC BY 4.0). ~35k plants worldwide — dense over exactly the regions the globe
 * looked empty: China (~4,200), Russia, Australia, and scattered across Africa.
 *
 * Fetches the canonical CSV, keeps plants at/above a capacity floor (drops
 * rooftop-scale noise), rounds coordinates, and writes a compact static JSON to
 * /public/data served with immutable caching. No runtime cost, no external
 * fetch at request time, no vault. Re-run when WRI publishes a new release.
 *
 *   node scripts/build-powerplants.mjs
 *
 * Attribution (required, CC BY 4.0): Global Energy Observatory, Google, KTH
 * Royal Institute of Technology in Stockholm, Enipedia, World Resources
 * Institute. 2019. Global Power Plant Database.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SRC =
  process.env.POWERPLANTS_CSV_URL ||
  "https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv";
const MIN_MW = Number(process.env.POWERPLANTS_MIN_MW ?? 30); // utility-scale floor — drops rooftop/small-farm noise

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

// WRI primary_fuel values → the compact fuel classes the globe colours by.
function fuelClass(raw) {
  const f = (raw || "").toLowerCase();
  if (f.includes("coal")) return "coal";
  if (f.includes("gas")) return "gas";
  if (f.includes("oil") || f.includes("petcoke")) return "oil";
  if (f.includes("nuclear")) return "nuclear";
  if (f.includes("hydro")) return "hydro";
  if (f.includes("wind")) return "wind";
  if (f.includes("solar")) return "solar";
  if (f.includes("geothermal")) return "geothermal";
  if (f.includes("biomass") || f.includes("waste") || f.includes("cogeneration")) return "biomass";
  return "other";
}

const res = await fetch(SRC);
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText} for ${SRC}`);
  process.exit(1);
}
const text = await res.text();
const lines = text.split(/\r?\n/).filter(Boolean);
const header = splitCsv(lines[0]);
const col = (name) => header.indexOf(name);
const iName = col("name");
const iId = col("gppd_idnr");
const iMw = col("capacity_mw");
const iLat = col("latitude");
const iLon = col("longitude");
const iFuel = col("primary_fuel");
const iCountry = col("country_long");

const out = [];
for (let i = 1; i < lines.length; i++) {
  const c = splitCsv(lines[i]);
  const lat = Number(c[iLat]);
  const lon = Number(c[iLon]);
  const mw = Number(c[iMw]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  if (!Number.isFinite(mw) || mw < MIN_MW) continue;
  out.push({
    id: c[iId] || `wri:${i}`,
    name: c[iName] || "Unknown plant",
    lat: +lat.toFixed(4),
    lon: +lon.toFixed(4),
    fuel: fuelClass(c[iFuel]),
    mw: Math.round(mw),
    country: c[iCountry] || undefined,
  });
}

// Largest first — a nicer draw order and lets any future cap keep the big plants.
out.sort((a, b) => b.mw - a.mw);

const dir = resolve(process.cwd(), "public/data");
mkdirSync(dir, { recursive: true });
const file = resolve(dir, "powerplants.json");
writeFileSync(file, JSON.stringify(out));

const byFuel = out.reduce((m, p) => ((m[p.fuel] = (m[p.fuel] || 0) + 1), m), {});
console.log(`wrote ${out.length} plants (>=${MIN_MW} MW) → ${file}`);
console.log("by fuel:", byFuel);
