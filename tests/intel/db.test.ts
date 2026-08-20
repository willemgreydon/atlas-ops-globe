process.env.INTEL_DB_PATH = ":memory:";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/intel/db";
import {
  upsertCountry, upsertEvent, upsertNews, upsertVulnerability, upsertEconomicObs, tableCounts,
} from "@/lib/intel/repositories";
import { listEvents, listVulnerabilities, getCountryProfile, parseBbox, parseSince, parsePage } from "@/lib/intel/queries";

beforeAll(() => {
  getDb();
  upsertCountry({ iso2: "JP", iso3: "JPN", name: "Japan", lat: 36, lon: 138, data: {}, provenance: [] });
  upsertEvent({ id: "event:usgs:t1", kind: "disaster", title: "M6 quake near Japan", severity: "critical", occurredAt: "2026-08-20T10:00:00Z", lat: 36, lon: 140, countryCode: "JP", source: "USGS", tags: ["earthquake"], provenance: [{ provider: "usgs", retrievedAt: "2026-08-20T10:01:00Z" }] });
  upsertEvent({ id: "event:eonet:t2", kind: "disaster", title: "Wildfire USA", severity: "watch", occurredAt: "2026-08-19T10:00:00Z", lat: 34, lon: -118, countryCode: "US", source: "EONET", tags: ["wildfire"], provenance: [] });
  upsertNews({ id: "news:a1", title: "Quake response in Japan", source: "example.jp", publishedAt: "2026-08-20T11:00:00Z", countryCode: "JP", persons: [], organizations: [], themes: [], provenance: [] });
  upsertVulnerability({ id: "cve:CVE-2026-1", kev: true, kevDateAdded: "2026-08-18", cwe: ["CWE-79"], products: [], references: [], source: "cisa-kev", provenance: [] });
  upsertEconomicObs({ id: "econobs:JP:GDP:2025", countryCode: "JP", indicator: "NY.GDP.MKTP.CD", label: "GDP", period: "2025", value: 4200000000000, provider: "worldbank", provenance: [] });
});

describe("vault storage", () => {
  it("upserts and counts across tables", () => {
    const c = tableCounts();
    expect(c.countries).toBe(1);
    expect(c.events).toBe(2);
    expect(c.vulnerabilities).toBe(1);
    expect(c.provenance).toBeGreaterThanOrEqual(1);
  });

  it("upsert is idempotent (no duplicate rows)", () => {
    upsertEvent({ id: "event:usgs:t1", kind: "disaster", title: "M6.1 quake near Japan (updated)", severity: "critical", occurredAt: "2026-08-20T10:00:00Z", lat: 36, lon: 140, countryCode: "JP", source: "USGS", tags: ["earthquake"], provenance: [] });
    expect(tableCounts().events).toBe(2);
    const ev = listEvents(parsePage(new URLSearchParams()), { country: "JP" }).data[0];
    expect(ev.title).toContain("updated");
  });

  it("filters events by country and bbox", () => {
    expect(listEvents(parsePage(new URLSearchParams()), { country: "US" }).data.length).toBe(1);
    const bbox = parseBbox("130,30,145,40");
    expect(listEvents(parsePage(new URLSearchParams()), { bbox }).data.every((e) => e.countryCode === "JP")).toBe(true);
  });

  it("paginates with a nextOffset", () => {
    const p = listEvents({ limit: 1, offset: 0 });
    expect(p.data.length).toBe(1);
    expect(p.page.nextOffset).toBe(1);
  });

  it("returns only KEV vulnerabilities when requested", () => {
    expect(listVulnerabilities(parsePage(new URLSearchParams()), { kevOnly: true }).data.length).toBe(1);
  });

  it("assembles a country profile with indicators and current events", () => {
    const profile = getCountryProfile("JP");
    expect(profile?.name).toBe("Japan");
    expect((profile?.indicators as unknown[]).length).toBe(1);
    expect((profile?.current as { events: unknown[] }).events.length).toBe(1);
  });

  it("FTS finds the news article", () => {
    const hit = getDb().prepare("SELECT id FROM fts_news WHERE fts_news MATCH ?").all("japan");
    expect(hit.length).toBeGreaterThan(0);
  });
});

describe("query param parsing", () => {
  it("validates bbox bounds", () => {
    expect(parseBbox("1,2,3,4")).toEqual([1, 2, 3, 4]);
    expect(parseBbox("200,0,0,0")).toBeNull();
    expect(parseBbox("bad")).toBeNull();
  });
  it("parses relative since windows", () => {
    expect(parseSince("24h")).not.toBeNull();
    expect(parseSince("nonsense")).toBeNull();
  });
});
