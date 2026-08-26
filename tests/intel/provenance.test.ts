process.env.INTEL_DB_PATH = ":memory:";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/intel/db";
import {
  upsertCountry, upsertEvent, upsertSanction, upsertSpaceObject, upsertWeatherObs, upsertMarketObs,
} from "@/lib/intel/repositories";
import { linkEventCountry } from "@/lib/intel/enrich";
import { listProvenance } from "@/lib/intel/queries";
import { stableId } from "@/lib/core/id";

const pv = (provider: string) => [{ provider, retrievedAt: "2026-08-26T00:00:00Z", providerRecordId: "rec-1" }];

beforeAll(() => {
  getDb();
  upsertCountry({ iso2: "JP", iso3: "JPN", name: "Japan", lat: 36, lon: 138, data: {}, provenance: [] });
  upsertEvent({ id: "event:usgs:q1", kind: "disaster", title: "M6 quake", severity: "critical", occurredAt: "2026-08-20T10:00:00Z", lat: 36, lon: 140, countryCode: "JP", source: "USGS", tags: [], provenance: pv("usgs") });
  // Previously provenance-less record types (audit P0-4):
  upsertSanction({ id: "ofac:sdn:12345", subjectType: "person", name: "Test Subject", aliases: [], authority: "OFAC", identifiers: {}, source: "ofac", provenance: pv("ofac") });
  upsertSpaceObject({ id: "sat:25544", norad: "25544", name: "ISS", source: "celestrak", provenance: pv("celestrak") });
  upsertWeatherObs({ id: "wx:tokyo:temp", lat: 36, lon: 138, observedAt: "2026-08-26T00:00:00Z", variable: "temperature_2m", value: 30, provider: "openmeteo", provenance: pv("openmeteo") });
  upsertMarketObs({ id: "mkt:AAPL", symbol: "AAPL", assetClass: "equity", ts: "2026-08-26T00:00:00Z", price: 200, latencyClass: "delayed", provider: "finnhub", provenance: pv("finnhub") });
  // Derived edge (audit P0-2): event OCCURRED_IN country, spatially resolved.
  linkEventCountry("event:usgs:q1", "JP", "spatially-near");
});

describe("provenance persistence (P0-2, P0-4)", () => {
  it("persists provenance for record types that previously stored it inline only", () => {
    for (const id of ["ofac:sdn:12345", "sat:25544", "wx:tokyo:temp", "mkt:AAPL", "event:usgs:q1"]) {
      const rows = listProvenance(id);
      expect(rows.length, `expected provenance for ${id}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("gives each derived relationship traceable lineage back to its source record", () => {
    const relId = stableId("rel", "event:usgs:q1", "OCCURRED_IN", "country:JP");
    const rows = listProvenance(relId);
    expect(rows.length).toBe(1);
    const p = rows[0];
    expect(p.provider).toBe("atlas-enrich");
    expect(p.pipeline).toBe("enrich");
    // The edge points back to the `from` record, whose own provenance chains
    // to the origin provider — an unbroken lineage.
    expect(p.providerRecordId).toBe("event:usgs:q1");
    expect(listProvenance("event:usgs:q1").length).toBeGreaterThanOrEqual(1);
  });

  it("does not fabricate provenance when none is supplied", () => {
    upsertSpaceObject({ id: "sat:00000", norad: "00000", name: "No-prov debris", source: "celestrak", provenance: [] });
    expect(listProvenance("sat:00000").length).toBe(0);
  });
});
