# Security

Security posture of Atlas Ops Globe as it stands today, plus the hardening backlog. Statements below reflect the actual code.

## Secrets stay server-side

- Provider credentials are read only inside server route handlers and provider adapters via `process.env`. They are never imported into client components.
- Only `NEXT_PUBLIC_*` variables are exposed to the browser by Next.js. The **only** one in this codebase is `NEXT_PUBLIC_CESIUM_ION_TOKEN`, consumed client-side in `components/globe/Globe.tsx` to set `Ion.defaultAccessToken`. This is a map-tiles token intended to be public.
- All other credentials (`OPENSKY_CLIENT_ID`/`OPENSKY_CLIENT_SECRET`, and the `envKeys` of planned providers such as `AISSTREAM_API_KEY`, `ACLED_CLIENT_ID/SECRET`, etc. in `data/provider-registry.ts`) are server-only. `/api/health` reports whether each is *configured* (`!!process.env[key]`) without ever returning the value.

## Input validation at API boundaries

Public routes validate and bound every user-controlled parameter:

- **`/api/country`** — the `iso` param is uppercased and checked against `^[A-Z]{2,3}$`. Anything else returns `400 { error: "invalid iso code" }`. Defaults to `AUT`.
- **`/api/news`** — the `q` param is truncated to 200 characters (`.slice(0, 200)`) before being passed to GDELT, and is used as a per-query cache key (`gdelt:<q>`) so searches don't clobber each other.
- **`/api/aircraft`**, **`/api/events`**, **`/api/health`** — take no user input.

## No arbitrary URL proxying

Routes call fixed, hardcoded upstream endpoints inside the provider adapters. There is no endpoint that accepts a caller-supplied URL to fetch, so the app cannot be used as an open proxy or SSRF pivot. User input only ever parameterizes a query string against a known host.

## Hard fetch timeouts

`lib/fetch-json.ts` wraps every outbound call in an `AbortController` with a hard timeout (default 9 s; the GDELT text path uses 20 s). A slow or hung upstream aborts rather than tying up the request. `fetchJson` also throws on any non-2xx response, and `fetchValidated` throws on Zod schema mismatch — both are caught by the provider framework.

## Graceful degradation, no leaked internals

`runProvider` (`lib/core/provider.ts`) never rethrows upstream failures as HTTP 500s. On failure it degrades to stale cache (`status: "cached"`) or mock (`status: "mock"`) and returns a normal `ProviderResult`. The `error` field carries a short, sanitized message (`err.message`), not a stack trace. Route handlers therefore always return `200` with an honest `DataStatus`; the client renders the degraded state instead of an error page. Stack traces stay in server logs only.

## Structured logging

`lib/core/logger.ts` emits single-line JSON (`level`, `message`, `ts`, plus fields like `provider`, `status`, `records`, `durationMs`, `error`), ready to ship to Loki/OpenTelemetry. This is the substrate for future audit logging but is not yet an authenticated audit trail.

## Hardening backlog

The app currently has no authentication and no per-route abuse controls. Before any production/multi-tenant deployment:

- **Rate limiting** on public API routes (`/api/aircraft`, `/api/events`, `/api/news`, `/api/country`) — per-IP/token quotas to protect both the service and upstream provider quotas. Today the only throttle is the shared in-memory cache TTL, which is not a security control.
- **Authentication & workspaces** — user/session auth and tenant isolation; today all routes are unauthenticated.
- **Provider entitlement gating** — enforce, per workspace, which providers a caller may use, honoring each provider's commercial/redistribution terms (`data/provider-registry.ts`). Ties into licensing (`docs/LICENSING.md`).
- **Content Security Policy** and related response headers (HSTS, `X-Content-Type-Options`, frame-ancestors), scoped to allow Cesium Ion assets.
- **Structured audit logging** — extend the JSON logger into an authenticated, tamper-evident audit trail with `requestId` correlation (the `LogFields` shape already reserves `requestId`).
- **Secret management** — move from raw `.env` to a managed secret store; add startup validation that required `envKeys` are present for enabled providers.
- **Dependency & schema hardening** — keep Zod schemas strict at the trust boundary; add CI dependency scanning.
