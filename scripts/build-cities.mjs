/**
 * Build the world cities layer from the GeoNames gazetteer (CC BY 4.0). Every
 * populated place with >15,000 inhabitants — ~26k cities worldwide, so no
 * populated region is ever blank: Moscow, Beijing, Lagos, Kinshasa, Sydney and
 * every other major city gets a marker, visible from orbit.
 *
 * GeoNames ships the dump as a zip of a tab-separated file; we download it,
 * unzip the single member, keep name/position/country/population, and write a
 * compact static JSON to /public/data (immutable-cached). No runtime cost, no
 * request-time fetch, no vault. Re-run when GeoNames refreshes the dump.
 *
 *   node scripts/build-cities.mjs
 *
 * Attribution (required, CC BY 4.0): this work is based on data from GeoNames
 * (https://www.geonames.org/).
 */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const DATASET = process.env.CITIES_DATASET || "cities15000"; // cities1000 / 5000 / 15000
const SRC = process.env.CITIES_ZIP_URL || `https://download.geonames.org/export/dump/${DATASET}.zip`;

// GeoNames dump columns (tab-separated, no header).
const COL = { id: 0, name: 1, lat: 4, lon: 5, featureClass: 6, country: 8, admin1: 10, population: 14 };

const res = await fetch(SRC);
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText} for ${SRC}`);
  process.exit(1);
}
const zipPath = join(tmpdir(), `${DATASET}.zip`);
writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));

// Extract the single .txt member to stdout (unzip is present on macOS/Linux CI).
let text;
try {
  text = execFileSync("unzip", ["-p", zipPath, `${DATASET}.txt`], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");
} finally {
  rmSync(zipPath, { force: true });
}

const out = [];
for (const line of text.split("\n")) {
  if (!line) continue;
  const c = line.split("\t");
  if (c[COL.featureClass] !== "P") continue; // populated places only
  const lat = Number(c[COL.lat]);
  const lon = Number(c[COL.lon]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const name = (c[COL.name] || "").trim();
  if (!name) continue;
  const pop = Number(c[COL.population]) || 0;
  out.push({
    id: `geo:${c[COL.id]}`,
    name,
    lat: +lat.toFixed(4),
    lon: +lon.toFixed(4),
    country: (c[COL.country] || "").trim() || undefined,
    pop,
  });
}

// Biggest first — nicer draw order and lets the render prioritise megacities.
out.sort((a, b) => b.pop - a.pop);

const dir = resolve(process.cwd(), "public/data");
mkdirSync(dir, { recursive: true });
const file = resolve(dir, "cities.json");
writeFileSync(file, JSON.stringify(out));
console.log(`wrote ${out.length} cities (${DATASET}) → ${file}`);
console.log("largest:", out.slice(0, 5).map((c) => `${c.name} (${c.pop.toLocaleString()})`).join(", "));
