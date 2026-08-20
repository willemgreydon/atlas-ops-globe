import { fetchJson } from "@/lib/fetch-json";
import { AircraftState } from "@/types/domain";

type OpenSkyResponse = { time:number; states?: Array<[string,string|null,string|null,number|null,number|null,number|null,number|null,boolean|null,number|null,number|null,number|null,number|null,number|null,number|null,number|null,boolean|null,number|null]> };

export async function fetchOpenSkyStates(): Promise<AircraftState[]> {
  const data = await fetchJson<OpenSkyResponse>("https://opensky-network.org/api/states/all");
  return (data.states ?? []).flatMap((s) => {
    const [icao24,callsign,origin_country,,last_contact,lon,lat,baro_altitude,on_ground,velocity,true_track,vertical_rate] = s;
    if (lat == null || lon == null) return [];
    return [{
      id: icao24,
      callsign: callsign?.trim() || undefined,
      country: origin_country || undefined,
      position: { lat, lon, alt: baro_altitude ?? undefined },
      velocityMs: velocity ?? undefined,
      headingDeg: true_track ?? undefined,
      verticalRateMs: vertical_rate ?? undefined,
      onGround: on_ground ?? undefined,
      lastContact: new Date((last_contact ?? data.time) * 1000).toISOString(),
    } satisfies AircraftState];
  });
}
