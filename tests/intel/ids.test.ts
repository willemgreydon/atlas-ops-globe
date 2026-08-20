import { describe, expect, it } from "vitest";
import { IdOf, typeOfId } from "@/lib/intel/ids";

describe("universal IDs", () => {
  it("uses authoritative identifiers when present", () => {
    expect(IdOf.country("at")).toBe("country:AT");
    expect(IdOf.person("Q76")).toBe("person:Q76");
    expect(IdOf.aircraft("3C6444")).toBe("aircraft:icao24-3c6444");
    expect(IdOf.vessel({ imo: "9811000" })).toBe("vessel:imo-9811000");
    expect(IdOf.airport("loww")).toBe("airport:icao-LOWW");
    expect(IdOf.satellite(25544)).toBe("satellite:norad-25544");
    expect(IdOf.cve("cve-2026-1")).toBe("cve:CVE-2026-1");
  });

  it("derives deterministic IDs when no authoritative id exists", () => {
    expect(IdOf.person(undefined, "Jane Roe")).toBe(IdOf.person(undefined, "Jane Roe"));
    expect(IdOf.org({ name: "Acme" })).toMatch(/^org:/);
  });

  it("extracts the type prefix", () => {
    expect(typeOfId("country:AT")).toBe("country");
    expect(typeOfId("satellite:norad-25544")).toBe("satellite");
    expect(typeOfId("noprefix")).toBe("");
  });
});
