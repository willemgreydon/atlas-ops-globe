import { describe, expect, it } from "vitest";
import { fnv1a, stableId } from "@/lib/core/id";

describe("stable ids", () => {
  it("is deterministic across calls", () => {
    expect(stableId("news", "https://x.test/a")).toBe(stableId("news", "https://x.test/a"));
  });

  it("differs for different inputs", () => {
    expect(stableId("news", "a")).not.toBe(stableId("news", "b"));
  });

  it("namespaces by kind", () => {
    expect(stableId("news", "a").startsWith("news:")).toBe(true);
    expect(stableId("event", "a").startsWith("event:")).toBe(true);
  });

  it("ignores undefined parts", () => {
    expect(stableId("k", "a", undefined)).toBe(stableId("k", "a"));
  });

  it("fnv1a is stable and base36", () => {
    expect(fnv1a("hello")).toBe(fnv1a("hello"));
    expect(/^[0-9a-z]+$/.test(fnv1a("hello"))).toBe(true);
  });
});
