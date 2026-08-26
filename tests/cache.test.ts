import { describe, it, expect } from "vitest";
import { MemoryCache, isFresh } from "@/lib/core/cache";

describe("MemoryCache (bounded LRU)", () => {
  it("stores and reads fresh entries", () => {
    const c = new MemoryCache(3);
    c.set("a", 1, 10_000);
    const e = c.get<number>("a");
    expect(e?.value).toBe(1);
    expect(isFresh(e)).toBe(true);
  });

  it("evicts the least-recently-used key past the cap", () => {
    const c = new MemoryCache(3);
    c.set("a", 1, 10_000);
    c.set("b", 2, 10_000);
    c.set("c", 3, 10_000);
    // Touch "a" so "b" becomes least-recently-used.
    c.get("a");
    c.set("d", 4, 10_000); // size would be 4 → evict LRU ("b")
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")?.value).toBe(1);
    expect(c.get("c")?.value).toBe(3);
    expect(c.get("d")?.value).toBe(4);
  });

  it("never exceeds the cap under unique-key churn", () => {
    const c = new MemoryCache(50);
    for (let i = 0; i < 1000; i++) c.set(`k${i}`, i, 10_000);
    // Only the last 50 keys survive.
    expect(c.get("k0")).toBeUndefined();
    expect(c.get("k949")).toBeUndefined();
    expect(c.get("k999")?.value).toBe(999);
    expect(c.get("k950")?.value).toBe(950);
  });
});
