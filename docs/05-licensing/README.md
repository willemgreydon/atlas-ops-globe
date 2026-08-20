# Licensing

Every external source Atlas Ops Globe integrates — or plans to — is documented in the **provider registry** (`data/provider-registry.ts`) with its licensing posture, so we never assume "publicly accessible" means "freely redistributable."

## The core principle

> **Publicly accessible ≠ freely redistributable.**

An API being open, unauthenticated, or free of charge tells you nothing about whether you may use its data commercially or re-serve it to your own users. Each source has its own terms. The registry encodes those terms as structured fields so they can drive UI gating, entitlement checks (see `docs/SECURITY.md`), and required attribution.

## Registry structure

Each `ProviderRecord` (`data/provider-registry.ts`) carries:

| Field | Values | Purpose |
|-------|--------|---------|
| `key`, `name`, `category`, `url` | — | Identity and source link. |
| `auth` | `none | api-key | oauth | token` | How the source is accessed. |
| `rateLimit` | free text | Human-readable throttling note. |
| `commercialUse` | `permitted | attribution | restricted | unknown` | Whether commercial deployment is allowed. |
| `redistribution` | `permitted | attribution | restricted | unknown` | Whether we may re-serve the data. |
| `attribution?` | string | Required credit string, if any. |
| `status` | `active | planned` | Whether it is wired end-to-end. |
| `envKeys?` | string[] | Credentials required to enable it. |
| `notes?` | string | Term caveats. |

Helpers: `activeProviders` (the wired subset) and `providerByKey(key)`. The `status` field also drives the UI — `planned` providers surface as disabled controls (no fake functionality), and `/api/health` reports each provider's configured/credential state.

## All providers

Pulled directly from `data/provider-registry.ts`.

| Name | Category | Commercial use | Redistribution | Attribution | Status |
|------|----------|----------------|----------------|-------------|--------|
| OpenSky Network | aviation | restricted | restricted | Data: The OpenSky Network, https://opensky-network.org | active |
| USGS Earthquake Hazards | naturalHazards | permitted | permitted | U.S. Geological Survey | active |
| NASA EONET | naturalHazards | permitted | permitted | NASA Earth Observatory Natural Event Tracker | active |
| GDELT DOC 2.0 | news | attribution | restricted | The GDELT Project | active |
| World Bank Indicators | economics | permitted | attribution | World Bank Open Data (CC BY 4.0) | active |
| AISstream | maritime | restricted | restricted | — | planned |
| MarineTraffic | maritime | restricted | restricted | — | planned |
| ACLED | conflict | restricted | restricted | ACLED | planned |
| ReliefWeb | humanitarian | attribution | attribution | OCHA ReliefWeb | planned |
| CISA Known Exploited Vulnerabilities | cyber | permitted | permitted | — | planned |
| NVD CVE API | cyber | permitted | permitted | — | planned |
| Wikidata | entities | permitted | permitted | Wikidata (CC0) | planned |
| CelesTrak | space | attribution | attribution | CelesTrak | planned |
| Open-Meteo | weather | attribution | attribution | Open-Meteo (CC BY 4.0) | planned |
| OFAC Sanctions List Service | sanctions | permitted | permitted | — | planned |

## Terms of note (active providers)

- **OpenSky Network** — non-commercial / research terms. Commercial deployment needs a separate licence from OpenSky. Both `commercialUse` and `redistribution` are `restricted`. Attribution required: *"Data: The OpenSky Network, https://opensky-network.org"*.
- **GDELT DOC 2.0** — links and metadata only. **Do not republish full article text**; surface headlines/URLs that link back to the original source. `redistribution: restricted`, `commercialUse: attribution`. Credit: *"The GDELT Project"*.
- **World Bank Indicators** — licensed **CC BY 4.0**: commercial use and redistribution are permitted **with attribution**. Credit: *"World Bank Open Data (CC BY 4.0)"*.
- **USGS Earthquake Hazards** — U.S. Government work, effectively public domain; commercial use and redistribution permitted. Credit: *"U.S. Geological Survey"*.
- **NASA EONET** — U.S. Government open data; commercial use and redistribution permitted. Credit: *"NASA Earth Observatory Natural Event Tracker"*.

## Required attribution strings

Render these wherever the corresponding source's data is displayed:

| Provider | Attribution string |
|----------|--------------------|
| OpenSky Network | `Data: The OpenSky Network, https://opensky-network.org` |
| USGS Earthquake Hazards | `U.S. Geological Survey` |
| NASA EONET | `NASA Earth Observatory Natural Event Tracker` |
| GDELT DOC 2.0 | `The GDELT Project` |
| World Bank Indicators | `World Bank Open Data (CC BY 4.0)` |
| ACLED (planned) | `ACLED` |
| ReliefWeb (planned) | `OCHA ReliefWeb` |
| Wikidata (planned) | `Wikidata (CC0)` |
| CelesTrak (planned) | `CelesTrak` |
| Open-Meteo (planned) | `Open-Meteo (CC BY 4.0)` |

Before enabling any `planned` provider — especially the `restricted` maritime and conflict sources — confirm its current terms and obtain any required licence/key. Entitlement gating (per-workspace enforcement of these fields) is on the hardening backlog in `docs/SECURITY.md`.
