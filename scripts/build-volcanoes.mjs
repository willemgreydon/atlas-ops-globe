/**
 * Build the volcanoes layer from the Smithsonian Global Volcanism Program (GVP)
 * Holocene volcano list, fetched from its GeoServer WFS as GeoJSON. ~1,200
 * volcanoes — dense over Kamchatka (Russia), the East African Rift / DR Congo
 * (Central Africa), Indonesia and the Australia/PNG arc.
 *
 * GVP's WFS sends no CORS header, so the browser can't fetch it directly — but
 * the Holocene list is effectively static, so we resolve it here at build time
 * and ship a compact static JSON from /public/data (immutable-cached). No
 * runtime cost, no request-time fetch, no vault.
 *
 *   node scripts/build-volcanoes.mjs
 *
 * Attribution: Global Volcanism Program, Smithsonian Institution (volcano.si.edu).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SRC =
  process.env.VOLCANOES_WFS_URL ||
  "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json&srsName=EPSG:4326";

const res = await fetch(SRC);
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText} for ${SRC}`);
  process.exit(1);
}
const geo = await res.json();
const features = Array.isArray(geo.features) ? geo.features : [];

const out = [];
for (const f of features) {
  const p = f.properties || {};
  const coords = f.geometry?.coordinates; // [lon, lat]
  const lon = Number(coords?.[0]);
  const lat = Number(coords?.[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const last = Number(p.Last_Eruption_Year);
  out.push({
    id: String(p.Volcano_Number ?? `gvp:${out.length}`),
    name: p.Volcano_Name || "Unknown volcano",
    lat: +lat.toFixed(4),
    lon: +lon.toFixed(4),
    type: p.Primary_Volcano_Type || undefined,
    elevation: Number.isFinite(Number(p.Elevation)) ? Math.round(Number(p.Elevation)) : undefined,
    country: p.Country || undefined,
    lastEruption: Number.isFinite(last) ? last : undefined,
  });
}

const dir = resolve(process.cwd(), "public/data");
mkdirSync(dir, { recursive: true });
const file = resolve(dir, "volcanoes.json");
writeFileSync(file, JSON.stringify(out));
console.log(`wrote ${out.length} volcanoes → ${file}`);
