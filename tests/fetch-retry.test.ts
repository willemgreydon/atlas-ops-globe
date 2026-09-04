import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchJson, HttpError } from "@/lib/fetch-json";

const okJson = (body: unknown) =>
  ({ ok: true, status: 200, statusText: "OK", json: async () => body, text: async () => JSON.stringify(body) }) as Response;
const httpErr = (status: number) =>
  ({ ok: false, status, statusText: `E${status}`, json: async () => ({}), text: async () => "" }) as Response;

afterEach(() => vi.unstubAllGlobals());

describe("fetch-json retry policy", () => {
  it("retries a transient 5xx then succeeds", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(httpErr(503))
      .mockResolvedValueOnce(okJson({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchJson<{ ok: number }>("https://x.test/a", { retries: 2, retryBaseMs: 1 });
    expect(out).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a network error then succeeds", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(okJson({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchJson("https://x.test/b", { retries: 1, retryBaseMs: 1 });
    expect(out).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a 4xx (permanent) — throws immediately", async () => {
    const fetchMock = vi.fn().mockResolvedValue(httpErr(404));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJson("https://x.test/c", { retries: 3, retryBaseMs: 1 })).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retries on a client error
  });

  it("default (no retries) throws on the first failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(httpErr(500));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJson("https://x.test/d")).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after exhausting retries and throws the last error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(httpErr(502));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJson("https://x.test/e", { retries: 2, retryBaseMs: 1 })).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
