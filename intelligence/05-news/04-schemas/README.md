# 05 · News — Schemas

Canonical schema: **`VaultNews`** in `lib/intel/schemas.ts` (Zod). External
GDELT payloads are validated against the provider `Schema` in
`lib/providers/gdelt.ts`, transformed, then validated against `VaultNews` before
storage. Malformed records are logged and skipped, never stored raw.

## `VaultNews` fields

| Field | Zod type | Req | Notes |
|---|---|---|---|
| `id` | string | yes | `IdOf.news(url)` |
| `title` | string | yes | headline |
| `url` | string | no | source link (metadata only) |
| `source` | string | yes | GDELT `domain` (publisher host) |
| `publisher` | string | no | mirrors `source` |
| `publishedAt` | string | yes | ISO-8601 (from `seendate`) |
| `language` | string | no | GDELT language |
| `countryCode` | string | no | resolved source/first-mention ISO2 |
| `lat` / `lon` | number | no | unused for GDELT |
| `persons` | string[] | dflt `[]` | PLANNED (NER) |
| `organizations` | string[] | dflt `[]` | PLANNED (NER) |
| `themes` | string[] | dflt `[]` | reserved |
| `storyId` | string | no | cluster assignment |
| `provenance` | `VaultProvenance[]` | dflt `[]` | see below |

## Provider source schema (`gdelt.ts`)

`{ articles?: [{ url, title, seendate, domain, language?, sourcecountry? }] }`.
`seendate` `YYYYMMDDTHHMMSSZ` is normalized by `parseSeenDate()`.

## Provenance (`VaultProvenance`)

Each article gets one provenance row: `provider: "gdelt"`,
`providerRecordId: <url>`, `sourceUrl: <url>`, `publishedAt`,
`license: "GDELT terms; metadata/link only"`, `attribution: "The GDELT Project"`,
`retrievedAt` (now), `transformation: { pipeline: "vault", version }`.

## Validation & idempotency

- Provider Zod parse rejects malformed GDELT responses (and the plain-text
  rate-limit body never reaches parsing — it throws earlier).
- `upsertNews()` uses `ON CONFLICT(id) DO UPDATE`, so re-ingest is idempotent on
  the URL-hash id.
- `fts_news` is re-synced (delete+insert) with `title` + joined
  persons/orgs/themes as the body column.

## Example canonical record

```json
{
  "id": "news:9f2c4e7a1b3d",
  "title": "EU agrees new sanctions package targeting shadow fleet",
  "url": "https://example-news.eu/eu-sanctions-shadow-fleet",
  "source": "example-news.eu",
  "publisher": "example-news.eu",
  "publishedAt": "2026-08-20T09:14:00Z",
  "language": "English",
  "countryCode": "RU",
  "persons": [],
  "organizations": [],
  "themes": [],
  "storyId": "story:1a7b…",
  "provenance": [
    {
      "provider": "gdelt",
      "providerRecordId": "https://example-news.eu/eu-sanctions-shadow-fleet",
      "sourceUrl": "https://example-news.eu/eu-sanctions-shadow-fleet",
      "publishedAt": "2026-08-20T09:14:00Z",
      "license": "GDELT terms; metadata/link only",
      "attribution": "The GDELT Project",
      "retrievedAt": "2026-08-20T09:20:11Z"
    }
  ]
}
```
