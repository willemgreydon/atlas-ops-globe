import { describe, it, expect, beforeEach, vi } from "vitest";
import { cachedFetch, __clearLiveCache } from "@/lib/intel/live";

describe("cachedFetch (live-at-request TTL cache)", () => {
  beforeEach(() => {
    __clearLiveCache();
    vi.useRealTimers();
  });

  it("coalesces concurrent + repeat calls within the TTL to one upstream fetch", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return "v1";
    };
    const [a, b] = await Promise.all([cachedFetch("k", 10_000, fn), cachedFetch("k", 10_000, fn)]);
    const c = await cachedFetch("k", 10_000, fn);
    expect(a).toBe("v1");
    expect(b).toBe("v1");
    expect(c).toBe("v1");
    expect(calls).toBe(1);
  });

  it("refetches once the TTL has elapsed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let n = 0;
    const fn = async () => `v${++n}`;
    expect(await cachedFetch("k", 1_000, fn)).toBe("v1");
    vi.setSystemTime(1_500);
    expect(await cachedFetch("k", 1_000, fn)).toBe("v2");
  });

  it("serves the last good value when a refetch fails, then retries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let mode: "ok" | "fail" = "ok";
    const fn = async () => {
      if (mode === "fail") throw new Error("upstream down");
      return "good";
    };
    expect(await cachedFetch("k", 1_000, fn)).toBe("good");

    // TTL elapsed + upstream failing → last good value is served, not an error.
    vi.setSystemTime(2_000);
    mode = "fail";
    expect(await cachedFetch("k", 1_000, fn)).toBe("good");

    // Failed entry is not cached: a subsequent poll retries and picks up recovery.
    vi.setSystemTime(2_100);
    mode = "ok";
    expect(await cachedFetch("k", 1_000, fn)).toBe("good");
  });

  it("propagates the error when there is no last good value", async () => {
    const fn = async () => {
      throw new Error("cold failure");
    };
    await expect(cachedFetch("k", 1_000, fn)).rejects.toThrow("cold failure");
  });
});
