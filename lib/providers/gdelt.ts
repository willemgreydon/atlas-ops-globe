import { fetchJson } from "@/lib/fetch-json";
import { NewsItem } from "@/types/domain";

type GdeltDoc = { articles?: Array<{url:string;title:string;seendate:string;domain:string;language?:string;sourcecountry?:string}> };
export async function fetchGdeltNews(query = "conflict OR diplomacy OR sanctions OR disaster"): Promise<NewsItem[]> {
  const qs = new URLSearchParams({ query, mode:"ArtList", maxrecords:"50", format:"json", sort:"HybridRel" });
  const data = await fetchJson<GdeltDoc>(`https://api.gdeltproject.org/api/v2/doc/doc?${qs}`);
  return (data.articles ?? []).map((a,i) => ({ id:`gdelt:${i}:${a.url}`, title:a.title, url:a.url, source:a.domain, publishedAt:a.seendate, countryCode:a.sourcecountry }));
}
