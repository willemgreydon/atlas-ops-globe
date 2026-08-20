import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeArrayResults, runProvider, type ProviderDefinition } from "@/lib/core/provider";
import { cache } from "@/lib/core/cache";

function def(over: Partial<ProviderDefinition<number[]>> = {}): ProviderDefinition<number[]> {
  return {
    key: "test",
    label: "Test",
    ttlMs: 10_000,
    fetch: async () => [1, 2, 3],
    mock: () => [0],
    ...over,
  };
}

describe("runProvider", () => {
  beforeEach(() => cache.clear());

  it("returns LIVE on a fresh fetch", async () => {
    const r = await runProvider(def());
    expect(r.status).toBe("live");
    expect(r.cached).toBe(false);
    expect(r.data).toEqual([1, 2, 3]);
    expect(r.count).toBe(3);
  });

  it("serves a warm cache as LIVE without refetching", async () => {
    const fetch = vi.fn(async () => [9]);
    await runProvider(def({ fetch }));
    const r = await runProvider(def({ fetch }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(r.cached).toBe(true);
    expect(r.status).toBe("live");
  });

  it("degrades to stale CACHED when a refetch fails", async () => {
    let call = 0;
    const fetch = vi.fn(async () => {
      call += 1;
      if (call === 1) return [1];
      throw new Error("upstream 503");
    });
    await runProvider(def({ fetch, ttlMs: -1 })); // immediately stale
    const r = await runProvider(def({ fetch, ttlMs: -1 }));
    expect(r.status).toBe("cached");
    expect(r.stale).toBe(true);
    expect(r.data).toEqual([1]);
    expect(r.error).toContain("503");
  });

  it("falls back to MOCK when there is no cache", async () => {
    const r = await runProvider(def({ fetch: async () => { throw new Error("boom"); } }));
    expect(r.status).toBe("mock");
    expect(r.source).toBe("mock");
    expect(r.data).toEqual([0]);
  });

  it("reports OFFLINE when the provider is disabled", async () => {
    const fetch = vi.fn(async () => [1]);
    const r = await runProvider(def({ enabled: false, fetch }));
    expect(r.status).toBe("offline");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("mergeArrayResults", () => {
  it("concatenates rows and takes the least-trustworthy status", () => {
    const live = { data: [1], source: "a", status: "live" as const, cached: false, stale: false, fetchedAt: "", count: 1 };
    const mock = { data: [2], source: "b", status: "mock" as const, cached: false, stale: true, fetchedAt: "", count: 1, error: "x" };
    const merged = mergeArrayResults([live, mock], "a+b");
    expect(merged.data).toEqual([1, 2]);
    expect(merged.status).toBe("mock");
    expect(merged.stale).toBe(true);
    expect(merged.error).toContain("b:");
  });
});
