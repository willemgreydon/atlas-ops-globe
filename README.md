# Atlas Ops Globe

A production-oriented scaffold for a real-time 3D global intelligence interface: live aircraft, hazards, conflict/news overlays, public-figure/entity enrichment, country metrics, alert cards, market/ticker surfaces and provider adapters.

## Run

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`.

The project boots without paid API keys. OpenSky, NASA EONET, USGS and GDELT are wired as first adapters; API routes fall back to demo data when a source is rate-limited/unavailable.

## Included

- Next.js + React + TypeScript
- Cesium/Resium 3D globe
- live aircraft adapter (OpenSky)
- live natural-event adapter (NASA EONET)
- live earthquake adapter (USGS)
- global news adapter (GDELT DOC)
- country profile route (World Bank)
- normalized domain model for events, aircraft and news
- control layer / right-side intelligence panel / live ticker UI
- provider registry and detailed API integration plan
- architecture, data model, feature map and legal/ops notes

## Production recommendation

Do **not** connect every external provider directly from the browser. Put all sources behind a server-side ingestion layer, normalize them into one event/entity schema, deduplicate, confidence-score, cache and stream deltas to clients via WebSocket/SSE. For heavy workloads use a queue (Kafka/Redpanda/NATS), Redis, Postgres + PostGIS, ClickHouse/Timescale for time series, and object storage for raw source snapshots.

See `docs/` for the full plan.
