/**
 * Provider data is untrusted (mission §23, §38). External URLs from feeds are
 * only validated as opaque strings at ingest, so an upstream record could carry
 * a `javascript:` / `data:` payload that becomes a clickable XSS sink if dropped
 * straight into an `href`. Every render site that links out MUST pass the value
 * through this guard, which returns the URL only when it parses as http(s).
 */
export function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:" ? value : undefined;
}
