import { describe, expect, it } from "vitest";
import { parseCsv, normalizeSdn } from "@/lib/intel/providers/ofac";
import { VaultSanction } from "@/lib/intel/schemas";

// A representative slice of the OFAC SDN.CSV format (no header; "-0-" = null;
// Remarks may contain commas, quotes and — in the wild — newlines).
const SAMPLE = [
  `36,"AEROCARIBBEAN AIRLINES","-0- ","CUBA","-0- ","-0- ","-0- ","-0- ","-0- ","-0- ","-0- ","-0- "`,
  `7157,"AL-QADI, Yasin","individual","SDGT","-0- ","-0- ","-0- ","-0- ","-0- ","-0- ","-0- ","DOB 1955, a.k.a. ""QADI, Yassin"""`,
  `15582,"KAMET","vessel","IRAN","-0- ","-0- ","Bulk Carrier","-0- ","-0- ","Malta","IRISL","IMO 9247287"`,
].join("\n");

describe("OFAC SDN parsing", () => {
  it("parses quoted CSV with embedded commas and escaped quotes", () => {
    const rows = parseCsv(SAMPLE);
    expect(rows).toHaveLength(3);
    expect(rows[1][1]).toBe("AL-QADI, Yasin"); // comma inside quotes preserved
    expect(rows[1][11]).toContain('"QADI, Yassin"'); // escaped quotes
  });

  it("normalizes to typed VaultSanctions with correct subject types", () => {
    const s = normalizeSdn(SAMPLE);
    expect(s).toHaveLength(3);
    const byName = Object.fromEntries(s.map((x) => [x.name, x]));
    expect(byName["AEROCARIBBEAN AIRLINES"].subjectType).toBe("entity"); // -0- type
    expect(byName["AL-QADI, Yasin"].subjectType).toBe("person");
    expect(byName["KAMET"].subjectType).toBe("vessel");
    expect(byName["KAMET"].program).toBe("IRAN");
    expect(byName["KAMET"].authority).toBe("OFAC");
    expect(byName["KAMET"].identifiers.vesselFlag).toBe("Malta");
    for (const x of s) expect(() => VaultSanction.parse(x)).not.toThrow();
  });

  it("treats -0- and blanks as null (not stored as literal)", () => {
    const s = normalizeSdn(SAMPLE);
    expect(s.find((x) => x.name === "AEROCARIBBEAN AIRLINES")!.program).toBe("CUBA");
    expect(s.find((x) => x.name === "AEROCARIBBEAN AIRLINES")!.remarks).toBeUndefined();
  });
});
