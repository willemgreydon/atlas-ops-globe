import { describe, it, expect } from "vitest";
import { ucdpEventToWorld } from "@/lib/providers/ucdp";

// A representative UCDP GED event (string-typed fields, as the API returns them).
const drcEvent = {
  id: 123456,
  latitude: "-1.6585",
  longitude: "29.2201",
  date_start: "2026-03-10",
  date_end: "2026-03-11",
  best: "37",
  deaths_civilians: "20",
  country: "DR Congo (Zaire)",
  side_a: "Government of DR Congo",
  side_b: "M23",
  type_of_violence: "1",
};

describe("ucdpEventToWorld", () => {
  it("maps a GED event to a conflict WorldEvent with location + severity", () => {
    const w = ucdpEventToWorld(drcEvent)!;
    expect(w).not.toBeNull();
    expect(w.kind).toBe("conflict");
    expect(w.location).toMatchObject({ lat: -1.6585, lon: 29.2201 });
    expect(w.severity).toBe("warning"); // 37 fatalities → 25..99 band
    expect(w.title).toBe("Government of DR Congo vs M23");
    expect(w.source).toBe("UCDP");
    expect(w.occurredAt).toBe("2026-03-11T00:00:00.000Z"); // date_end wins
    expect(w.tags).toContain("state-based");
    expect(w.id).toMatch(/^event:ucdp:123456$/);
  });

  it("bands severity by fatalities", () => {
    const sev = (best: string) => ucdpEventToWorld({ ...drcEvent, best })!.severity;
    expect(sev("0")).toBe("info");
    expect(sev("3")).toBe("watch");
    expect(sev("40")).toBe("warning");
    expect(sev("150")).toBe("critical");
  });

  it("rejects events without a valid point", () => {
    expect(ucdpEventToWorld({ ...drcEvent, latitude: "", longitude: "" })).toBeNull();
    expect(ucdpEventToWorld({ ...drcEvent, latitude: "999", longitude: "999" })).toBeNull();
  });
});
