import { describe, it, expect } from "vitest";
import { safeHttpUrl } from "@/lib/safe-url";

describe("safeHttpUrl", () => {
  it("passes http and https URLs unchanged", () => {
    expect(safeHttpUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHttpUrl("http://gdeltproject.org/x")).toBe("http://gdeltproject.org/x");
  });

  it("rejects javascript: and data: payloads (the XSS sink)", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("JavaScript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeHttpUrl("vbscript:msgbox(1)")).toBeUndefined();
  });

  it("rejects non-http schemes and malformed values", () => {
    expect(safeHttpUrl("ftp://host/f")).toBeUndefined();
    expect(safeHttpUrl("mailto:a@b.com")).toBeUndefined();
    expect(safeHttpUrl("not a url")).toBeUndefined();
    expect(safeHttpUrl("")).toBeUndefined();
    expect(safeHttpUrl(undefined)).toBeUndefined();
    expect(safeHttpUrl(null)).toBeUndefined();
    expect(safeHttpUrl(42)).toBeUndefined();
  });
});
