import { z } from "zod";
import { fetchJson, hashPayload } from "@/lib/fetch-json";
import { makeProvenance } from "@/lib/core/provenance";
import { scoreConfidence } from "@/lib/core/confidence";
import { isValidPoint } from "@/lib/core/geo";
import type { ProviderDefinition } from "@/lib/core/provider";
import type { AircraftState } from "@/types/domain";
import { mockAircraft } from "@/lib/mock";

/**
 * OpenSky Network — live ADS-B aircraft states.
 * https://openskynetwork.github.io/opensky-api/rest.html
 *
 * The `/states/all` response is a JSON array of heterogeneous tuples. We
 * validate the envelope shape at the boundary, then index the tuple by the
 * documented column order.
 */
const StateVectorSchema = z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]));
const ResponseSchema = z.object({
  time: z.number(),
  states: z.array(StateVectorSchema).nullable().optional(),
});

// Column indices per the OpenSky state-vector spec.
const I = {
  icao24: 0,
  callsign: 1,
  originCountry: 2,
  lastContact: 4,
  lon: 5,
  lat: 6,
  baroAltitude: 7,
  onGround: 8,
  velocity: 9,
  trueTrack: 10,
  verticalRate: 11,
} as const;

const RELIABILITY = 0.85;
const FRESHNESS_SLA_S = 30;

export async function fetchOpenSkyStates(): Promise<AircraftState[]> {
  const data = await fetchJson<unknown>("https://opensky-network.org/api/states/all");
  const parsed = ResponseSchema.parse(data);
  const now = Date.now();

  return (parsed.states ?? []).flatMap((s) => {
    const lon = num(s[I.lon]);
    const lat = num(s[I.lat]);
    const point = { lat: lat ?? NaN, lon: lon ?? NaN, alt: num(s[I.baroAltitude]) };
    if (!isValidPoint(point)) return [];

    const icao24 = String(s[I.icao24]);
    const lastContact = num(s[I.lastContact]) ?? parsed.time;
    const observedAt = new Date(lastContact * 1000).toISOString();
    const ageSeconds = Math.max(0, now / 1000 - lastContact);
    const confidence = scoreConfidence({
      sourceCount: 1,
      providerReliability: RELIABILITY,
      ageSeconds,
      freshnessSlaSeconds: FRESHNESS_SLA_S,
      geoPrecision: 0.95,
    }).score;

    return [
      {
        id: `aircraft:${icao24}`,
        callsign: str(s[I.callsign]),
        country: str(s[I.originCountry]),
        position: point,
        velocityMs: num(s[I.velocity]),
        headingDeg: num(s[I.trueTrack]),
        verticalRateMs: num(s[I.verticalRate]),
        onGround: bool(s[I.onGround]),
        lastContact: observedAt,
        provenance: makeProvenance({
          provider: "opensky",
          providerRecordId: icao24,
          sourceUrl: "https://opensky-network.org/",
          observedAt,
          confidence,
          rawObjectHash: hashPayload(s),
        }),
      } satisfies AircraftState,
    ];
  });
}

export const openSkyProvider: ProviderDefinition<AircraftState[]> = {
  key: "opensky",
  label: "OpenSky Network (ADS-B)",
  ttlMs: 10_000,
  reliability: RELIABILITY,
  fetch: async () => (await fetchOpenSkyStates()).slice(0, 3000),
  mock: () => mockAircraft(),
};

function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}
