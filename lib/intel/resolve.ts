import { countryCentroids, type CountryCentroid } from "@/data/country-centroids";
import { haversineKm } from "@/lib/core/geo";
import { WORLD_CITIES } from "@/lib/intel/geo/gazetteer";
import type { GeoPoint } from "@/types/domain";

/**
 * Country entity resolution. Maps the many ways a country is named/coded to one
 * canonical record. Aliases are never discarded — unmatched inputs return null
 * (we never guess). Backed by the bundled Natural Earth centroid table.
 */
export interface ResolvedCountry {
  iso2: string;
  iso3: string;
  name: string;
  point: GeoPoint;
}

const byIso2 = new Map<string, CountryCentroid>();
const byIso3 = new Map<string, CountryCentroid>();
const byName = new Map<string, CountryCentroid>();
for (const c of countryCentroids) {
  if (c.iso2) byIso2.set(c.iso2.toUpperCase(), c);
  if (c.iso3) byIso3.set(c.iso3.toUpperCase(), c);
  byName.set(c.name.toLowerCase(), c);
}

/** Common name/code variants → ISO2. Extend as coverage gaps surface. */
const ALIASES: Record<string, string> = {
  "usa": "US", "u.s.": "US", "u.s.a.": "US", "united states": "US", "united states of america": "US", "america": "US",
  "uk": "GB", "u.k.": "GB", "britain": "GB", "great britain": "GB", "england": "GB",
  "russia": "RU", "russian federation": "RU",
  "south korea": "KR", "republic of korea": "KR", "korea": "KR",
  "north korea": "KP", "dprk": "KP",
  "iran": "IR", "islamic republic of iran": "IR",
  "syria": "SY", "syrian arab republic": "SY",
  "venezuela": "VE", "bolivia": "BO", "tanzania": "TZ", "vietnam": "VN", "laos": "LA",
  "czechia": "CZ", "czech republic": "CZ", "turkey": "TR", "turkiye": "TR", "türkiye": "TR",
  "uae": "AE", "united arab emirates": "AE",
  "drc": "CD", "democratic republic of the congo": "CD", "congo-kinshasa": "CD",
  "republic of the congo": "CG", "congo-brazzaville": "CG",
  "ivory coast": "CI", "cote d'ivoire": "CI", "côte d'ivoire": "CI",
  "burma": "MM", "myanmar": "MM", "moldova": "MD", "palestine": "PS",
};

export function resolveCountry(input: string | undefined | null): ResolvedCountry | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();

  let hit = (raw.length === 2 && byIso2.get(upper)) || (raw.length === 3 && byIso3.get(upper)) || byName.get(lower);
  if (!hit && ALIASES[lower]) hit = byIso2.get(ALIASES[lower]);
  if (!hit) return null;
  return { iso2: hit.iso2, iso3: hit.iso3, name: hit.name, point: hit.point };
}

// Precompute word-boundary matchers for country names + notable aliases, longest
// first so "United States" wins over "States". Used for light NER over text.
const NAME_MATCHERS: { re: RegExp; iso2: string }[] = (() => {
  const entries: { term: string; iso2: string }[] = [];
  for (const c of countryCentroids) entries.push({ term: c.name, iso2: c.iso2 });
  for (const [alias, iso2] of Object.entries(ALIASES)) if (alias.length > 3) entries.push({ term: alias, iso2 });
  entries.sort((a, b) => b.term.length - a.term.length);
  return entries
    .filter((e) => e.iso2)
    .map((e) => ({ iso2: e.iso2, re: new RegExp(`\\b${e.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i") }));
})();

// City matchers, longest name first so "New York" wins over any substring and a
// multi-word city beats a bare country. Each resolves to a precise city point
// but carries its country's ISO codes (from the centroid table).
const CITY_MATCHERS: { re: RegExp; iso2: string; name: string; point: GeoPoint }[] = (() => {
  const entries: { term: string; iso2: string; name: string; point: GeoPoint }[] = [];
  for (const c of WORLD_CITIES) {
    const point = { lat: c.lat, lon: c.lon };
    for (const term of [c.name, ...(c.aliases ?? [])]) entries.push({ term, iso2: c.iso2, name: c.name, point });
  }
  entries.sort((a, b) => b.term.length - a.term.length);
  return entries.map((e) => ({
    iso2: e.iso2,
    name: e.name,
    point: e.point,
    re: new RegExp(`\\b${e.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
  }));
})();

/** First city named in the text → precise point + its country's ISO codes. */
export function locateCity(text: string): ResolvedCountry | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  let best: { iso2: string; name: string; point: GeoPoint } | null = null;
  let bestIdx = Infinity;
  for (const m of CITY_MATCHERS) {
    const idx = lower.search(m.re);
    if (idx >= 0 && idx < bestIdx) { bestIdx = idx; best = m; }
  }
  if (!best) return null;
  const country = resolveCountry(best.iso2);
  return { iso2: best.iso2, iso3: country?.iso3 ?? "", name: best.name, point: best.point };
}

/** Extract distinct country mentions from free text (headlines). Conservative. */
export function extractCountryMentions(text: string): ResolvedCountry[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const m of NAME_MATCHERS) {
    if (found.has(m.iso2)) continue;
    if (m.re.test(text)) found.add(m.iso2);
  }
  return [...found].map((iso2) => resolveCountry(iso2)).filter((c): c is ResolvedCountry => !!c);
}

/**
 * Best geographic anchor for a news headline. Resolution order, most specific
 * first: a named city (precise point) → the country mentioned *earliest* in the
 * title (headlines lead with their subject) → the article's source country.
 * Returns null when nothing resolves — we plot nothing rather than invent a
 * location (mission: honest provenance). City matching in particular closes the
 * old gaps over Russia/China/Africa/Australia, where headlines name the city.
 */
export function locateNews(title: string, sourceCountry?: string | null): ResolvedCountry | null {
  const city = locateCity(title);
  if (city) return city;

  const mentions = extractCountryMentions(title);
  if (mentions.length > 0) {
    const lower = title.toLowerCase();
    let best = mentions[0];
    let bestIdx = Infinity;
    for (const c of mentions) {
      const idx = lower.indexOf(c.name.toLowerCase());
      if (idx >= 0 && idx < bestIdx) { bestIdx = idx; best = c; }
    }
    return best;
  }
  return resolveCountry(sourceCountry ?? null);
}

/** Nearest country to a point (centroid distance). For geolocating events.
 *  `maxKm` rejects points that are absurdly far from ANY centroid (open ocean),
 *  which would otherwise snap onto the nearest speck of land. Centroid distance
 *  is coarse — big-country interiors sit far from their own centroid — so keep
 *  the cap generous; it's a sanity net, not a precise point-in-polygon test. */
export function nearestCountry(point: GeoPoint, maxKm = Infinity): ResolvedCountry | null {
  let best: CountryCentroid | null = null;
  let bestKm = Infinity;
  for (const c of countryCentroids) {
    const d = haversineKm(point, c.point);
    if (d < bestKm) { bestKm = d; best = c; }
  }
  if (!best || bestKm > maxKm) return null;
  return { iso2: best.iso2, iso3: best.iso3, name: best.name, point: best.point };
}
