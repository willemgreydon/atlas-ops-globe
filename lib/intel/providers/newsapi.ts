import { z } from "zod";
import { fetchJson } from "@/lib/fetch-json";
import { prov } from "@/lib/intel/provenance";
import { stableId } from "@/lib/core/id";
import { extractCountryMentions } from "@/lib/intel/resolve";
import type { VaultNews } from "@/lib/intel/schemas";

/**
 * NewsAPI.org — broad headline/article search. Free "developer" tier is
 * NON-commercial and DELAYED (~24h); we label provenance accordingly and never
 * present it as real-time. Country is inferred from headline mentions (NewsAPI
 * gives no per-article geolocation). Credential-gated by NEWSAPI_KEY.
 */
const Schema = z.object({
  status: z.string().optional(),
  articles: z
    .array(
      z.object({
        source: z.object({ id: z.string().nullable().optional(), name: z.string().optional() }).optional(),
        title: z.string(),
        description: z.string().nullable().optional(),
        url: z.string(),
        publishedAt: z.string().optional(),
      }),
    )
    .optional(),
});

export function newsApiConfigured(): boolean {
  return !!process.env.NEWSAPI_KEY;
}

export function normalizeNewsApi(raw: unknown): VaultNews[] {
  const data = Schema.parse(raw);
  return (data.articles ?? []).map((a) => {
    const mentions = extractCountryMentions(`${a.title} ${a.description ?? ""}`);
    return {
      id: stableId("news", a.url),
      title: a.title,
      url: a.url,
      source: a.source?.name ?? "NewsAPI",
      publisher: a.source?.name,
      publishedAt: a.publishedAt ?? new Date().toISOString(),
      countryCode: mentions[0]?.iso2,
      persons: [],
      organizations: [],
      themes: [],
      provenance: [
        prov({
          provider: "newsapi",
          providerRecordId: a.url,
          sourceUrl: a.url,
          publishedAt: a.publishedAt,
          license: "NewsAPI developer tier — non-commercial, ~24h delayed",
          attribution: "NewsAPI.org",
        }),
      ],
    } satisfies VaultNews;
  });
}

export async function fetchNewsApi(opts: { query?: string; pageSize?: number } = {}): Promise<VaultNews[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) throw new Error("NEWSAPI_KEY not set");
  const qs = new URLSearchParams({
    q: opts.query ?? "world OR conflict OR politics OR economy",
    language: "en",
    sortBy: "publishedAt",
    pageSize: String(Math.min(opts.pageSize ?? 80, 100)),
  });
  const raw = await fetchJson<unknown>(`https://newsapi.org/v2/everything?${qs}`, {
    headers: { "X-Api-Key": apiKey },
    timeoutMs: 20_000,
  });
  return normalizeNewsApi(raw);
}
