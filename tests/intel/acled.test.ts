import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAcled } from "@/lib/intel/providers/acled";
import { VaultEvent } from "@/lib/intel/schemas";

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "..", "fixtures", "acled.sample.json"), "utf8"),
);

describe("ACLED normalization", () => {
  const events = normalizeAcled(fixture);

  it("maps events to valid conflict VaultEvents, dropping bad coords", () => {
    expect(events).toHaveLength(2); // third row has no lat/lon
    for (const e of events) {
      expect(e.kind).toBe("conflict");
      expect(() => VaultEvent.parse(e)).not.toThrow();
    }
  });

  it("derives severity from fatalities + disorder type", () => {
    const georgia = events.find((e) => e.id.includes("GEO3998"))!;
    const ukraine = events.find((e) => e.id.includes("UKR12345"))!;
    expect(georgia.severity).toBe("watch"); // peaceful protest, 0 fatalities
    expect(ukraine.severity).toBe("warning"); // 3 fatalities
  });

  it("resolves country codes and carries ACLED provenance", () => {
    const ukraine = events.find((e) => e.id.includes("UKR12345"))!;
    expect(ukraine.countryCode).toBe("UA");
    expect(ukraine.lat).toBeCloseTo(49.9935, 3);
    expect(ukraine.provenance[0].provider).toBe("acled");
    expect(ukraine.tags).toContain("3 fatalities");
  });
});
