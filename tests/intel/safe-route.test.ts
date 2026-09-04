import { describe, it, expect, vi, afterEach } from "vitest";
import { scrubError, safeVault } from "@/lib/intel/safe-route";

afterEach(() => vi.restoreAllMocks());

describe("scrubError — never leaks infrastructure detail to the client", () => {
  it("returns a generic message and logs the real error server-side", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "Sync(PullFrame(403, SQL read operations are forbidden)) at /tmp/atlas-intel.db";
    const out = scrubError(new Error(secret), "vault-read");
    expect(out).toBe("temporarily unavailable");
    expect(out).not.toContain("403");
    expect(out).not.toContain("forbidden");
    expect(out).not.toContain("/tmp");
    // The real detail is preserved in the server log for ops.
    expect(spy).toHaveBeenCalledOnce();
    expect(String(spy.mock.calls[0]?.[1] ?? "")).toContain("SQL read operations are forbidden");
  });

  it("safeVault degrades to the fallback body with a scrubbed error, never the raw one", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = safeVault(() => { throw new Error("Turso read quota blocked"); }, { data: [] });
    const body = await res.json();
    expect(body.degraded).toBe(true);
    expect(body.error).toBe("temporarily unavailable");
    expect(JSON.stringify(body)).not.toContain("quota");
  });
});
