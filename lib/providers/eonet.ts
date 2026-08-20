import { fetchJson } from "@/lib/fetch-json";
import { WorldEvent } from "@/types/domain";

type Eonet = { events: Array<{id:string;title:string;categories?:Array<{title:string}>;geometry?:Array<{date:string;coordinates:number[]}>;sources?:Array<{id:string;url:string}>}> };
export async function fetchEonetEvents(): Promise<WorldEvent[]> {
  const data = await fetchJson<Eonet>("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=80");
  return data.events.flatMap((e) => {
    const g = e.geometry?.at(-1); if (!g || g.coordinates.length < 2) return [];
    return [{ id:`eonet:${e.id}`, kind:"disaster", title:e.title, severity:"watch", occurredAt:g.date, location:{lon:g.coordinates[0],lat:g.coordinates[1]}, source:e.sources?.[0]?.id || "NASA EONET", sourceUrl:e.sources?.[0]?.url, tags:e.categories?.map(c=>c.title) } satisfies WorldEvent];
  });
}
