import { fetchJson } from "@/lib/fetch-json";
import { WorldEvent } from "@/types/domain";

type Usgs = { features:Array<{id:string;properties:{title:string;time:number;mag:number;url:string};geometry:{coordinates:[number,number,number]}}> };
export async function fetchEarthquakes(): Promise<WorldEvent[]> {
  const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson";
  const data = await fetchJson<Usgs>(url);
  return data.features.map(f => ({ id:`usgs:${f.id}`,kind:"disaster",title:f.properties.title,severity:f.properties.mag>=6?"critical":f.properties.mag>=5?"warning":"watch",occurredAt:new Date(f.properties.time).toISOString(),location:{lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1],alt:-f.geometry.coordinates[2]*1000},source:"USGS",sourceUrl:f.properties.url,tags:["earthquake",`M${f.properties.mag}`] }));
}
