import { z } from "zod";
import { fetchJson } from "@/lib/fetch-json";
import { prov } from "@/lib/intel/provenance";
import { stableId } from "@/lib/core/id";
import { IdFromWiki } from "@/lib/intel/ids";
import { resolveCountry } from "@/lib/intel/resolve";
import type { VaultNews, VaultOrganization, VaultPerson } from "@/lib/intel/schemas";

/**
 * Event Registry (newsapi.ai) — news articles enriched with linked entities.
 * https://eventregistry.org/documentation
 *
 * The key value: each article carries `concepts` (persons, organizations,
 * locations) with Wikipedia URIs + relevance scores, plus sentiment and
 * geolocation — this is what populates the persons/organizations graph.
 * Credential-gated by EVENTREGISTRY_API_KEY.
 */
const API_URL = "https://eventregistry.org/api/v1/article/getArticles";

const ConceptSchema = z.object({
  uri: z.string(),
  type: z.string(), // person | org | loc | wiki
  score: z.number().optional(),
  label: z.record(z.string(), z.string()).optional(),
  location: z
    .object({ label: z.record(z.string(), z.string()).optional(), country: z.object({ label: z.record(z.string(), z.string()).optional() }).optional() })
    .nullable()
    .optional(),
});
const ArticleSchema = z.object({
  uri: z.string().optional(),
  url: z.string(),
  title: z.string(),
  dateTime: z.string().optional(),
  date: z.string().optional(),
  lang: z.string().optional(),
  source: z.object({ title: z.string().optional(), uri: z.string().optional() }).optional(),
  concepts: z.array(ConceptSchema).optional(),
  categories: z.array(z.object({ label: z.string().optional(), uri: z.string().optional() })).optional(),
  sentiment: z.number().nullable().optional(),
  location: z.object({ country: z.object({ label: z.record(z.string(), z.string()).optional() }).optional() }).nullable().optional(),
});
const ResponseSchema = z.object({
  articles: z.object({ results: z.array(ArticleSchema).default([]) }).optional(),
  error: z.string().optional(),
});

export interface EnrichedArticle {
  news: VaultNews;
  persons: VaultPerson[];
  organizations: VaultOrganization[];
}

export function eventRegistryConfigured(): boolean {
  return !!process.env.EVENTREGISTRY_API_KEY;
}

const eng = (l?: Record<string, string>): string | undefined => l?.eng ?? (l ? Object.values(l)[0] : undefined);

export function normalizeEventRegistry(raw: unknown): EnrichedArticle[] {
  const parsed = ResponseSchema.parse(raw);
  const results = parsed.articles?.results ?? [];
  return results.map((a) => {
    const publishedAt = a.dateTime ?? (a.date ? `${a.date}T00:00:00Z` : new Date().toISOString());
    const concepts = (a.concepts ?? []).filter((c) => (c.score ?? 0) >= 2 && eng(c.label));
    const persons: VaultPerson[] = [];
    const organizations: VaultOrganization[] = [];
    const personNames: string[] = [];
    const orgNames: string[] = [];
    let countryFromConcepts: string | undefined;

    for (const c of concepts) {
      const name = eng(c.label)!;
      const provenance = [prov({ provider: "eventregistry", dataset: "concept", sourceUrl: c.uri, attribution: "Event Registry" })];
      if (c.type === "person") {
        persons.push({ id: IdFromWiki.person(c.uri), canonicalName: name, aliases: [], wikipediaUrl: c.uri, roles: [], countries: [], mentionCount: 1, data: {}, provenance });
        personNames.push(name);
      } else if (c.type === "org") {
        organizations.push({ id: IdFromWiki.org(c.uri), canonicalName: name, aliases: [], wikipediaUrl: c.uri, mentionCount: 1, data: {}, provenance });
        orgNames.push(name);
      } else if (c.type === "loc" && !countryFromConcepts) {
        const cn = eng(c.location?.country?.label) ?? eng(c.location?.label);
        countryFromConcepts = resolveCountry(cn)?.iso2;
      }
    }
    const country = resolveCountry(eng(a.location?.country?.label))?.iso2 ?? countryFromConcepts;

    const news: VaultNews = {
      id: stableId("news", a.url),
      title: a.title,
      url: a.url,
      source: a.source?.title ?? a.source?.uri ?? "Event Registry",
      publisher: a.source?.title,
      publishedAt,
      language: a.lang,
      countryCode: country,
      persons: personNames,
      organizations: orgNames,
      themes: (a.categories ?? []).map((c) => c.label ?? "").filter(Boolean),
      provenance: [
        prov({
          provider: "eventregistry",
          providerRecordId: a.uri,
          sourceUrl: a.url,
          publishedAt,
          license: "Event Registry terms; metadata/links only",
          attribution: "Event Registry (newsapi.ai)",
        }),
      ],
    };
    return { news, persons, organizations };
  });
}

export async function fetchEventRegistry(opts: { keyword?: string; count?: number } = {}): Promise<EnrichedArticle[]> {
  const apiKey = process.env.EVENTREGISTRY_API_KEY;
  if (!apiKey) throw new Error("EVENTREGISTRY_API_KEY not set");
  const bodyObj: Record<string, unknown> = {
    action: "getArticles",
    resultType: "articles",
    articlesSortBy: "date",
    articlesCount: Math.min(opts.count ?? 80, 100),
    includeArticleConcepts: true,
    includeArticleCategories: true,
    includeArticleLocation: true,
    lang: "eng",
    apiKey,
  };
  if (opts.keyword) bodyObj.keyword = opts.keyword;
  const raw = await fetchJson<unknown>(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bodyObj),
    timeoutMs: 25_000,
  });
  return normalizeEventRegistry(raw);
}
