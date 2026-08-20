# 02 · Conflict — Schemas

The target canonical schema is **`VaultEvent`** in `lib/intel/schemas.ts` (Zod),
stored with `kind: "conflict"`. **No conflict-specific provider schema exists
yet** — it would be added per source (ACLED, ReliefWeb) mirroring the pattern in
`lib/providers/*`. Everything here is PLANNED.

## Target `VaultEvent` fields

| Field | Zod type | Req | Conflict use |
|---|---|---|---|
| `id` | string | yes | `event:<provider>:<providerId>` |
| `kind` | string | yes | `"conflict"` |
| `subtype` | string | no | event type (e.g. "armed clash", "protest") |
| `title` | string | yes | headline / short description |
| `summary` | string | no | neutral narrative (no inferred casualties) |
| `severity` | enum | yes | `info \| watch \| warning \| critical` |
| `occurredAt` | string | yes | ISO-8601 event time |
| `publishedAt` | string | no | report time |
| `lat` / `lon` | number | no | event location |
| `countryCode` | string | no | resolved ISO2 |
| `source` | string | yes | `acled` / `reliefweb` / `gdelt` |
| `sourceUrl` | string | no | link to report |
| `confidence` | number 0–1 | no | source/geo confidence |
| `tags` | string[] | dflt `[]` | actors, event categories |
| `provenance` | `VaultProvenance[]` | dflt `[]` | required per source terms |

## Validation & storage (target)

- Source payloads would be Zod-validated in a per-source provider, transformed
  to `VaultEvent`, then validated again before `upsertEvent()`.
- `upsertEvent()` (`lib/intel/repositories.ts`) is IMPLEMENTED: writes `events` +
  `fts_events` (title + summary + tags) + `provenance`, idempotent on `id`.
- Malformed records are logged and skipped, never stored raw.

## Severity discipline

`severity` must reflect **reported, verifiable** magnitude. Do **not** derive
`critical` from unconfirmed casualty rumours; prefer `watch`/`warning` when the
report is ambiguous. Casualty counts are not fabricated into the summary.

## Example target record (illustrative, PLANNED)

```json
{
  "id": "event:acled:0011223",
  "kind": "conflict",
  "subtype": "armed clash",
  "title": "Reported clashes near <location>",
  "summary": "ACLED-coded armed clash between two actors; details per source.",
  "severity": "warning",
  "occurredAt": "2026-08-18T00:00:00Z",
  "countryCode": "SY",
  "lat": 35.0,
  "lon": 38.5,
  "source": "acled",
  "sourceUrl": "https://acleddata.com/…",
  "confidence": 0.8,
  "tags": ["armed-clash", "actor1", "actor2"],
  "provenance": [
    { "provider": "acled", "providerRecordId": "0011223",
      "license": "ACLED licence", "attribution": "ACLED",
      "retrievedAt": "2026-08-20T09:20:11Z" }
  ]
}
```
