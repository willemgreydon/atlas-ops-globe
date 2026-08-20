import type { IngestReport } from "./ingest";
import { ingestCountries } from "./domains/countries";
import { ingestNews } from "./domains/news";
import { ingestDisasters } from "./domains/disasters";
import { ingestEconomics } from "./domains/economics";
import { ingestCyber } from "./domains/cyber";
import { ingestSpace } from "./domains/space";
import { ingestAviationSnapshot } from "./domains/aviation";
import { ingestMaritime } from "./domains/maritime";
import { ingestWeather } from "./domains/weather";

export interface IngestOpts {
  query?: string;
  group?: string;
  limit?: number;
}

/** Domain → ingestor. Each is independent and isolates its own failures. */
export const INGESTORS: Record<string, (o: IngestOpts) => Promise<IngestReport>> = {
  countries: () => ingestCountries(),
  disasters: () => ingestDisasters(),
  economics: () => ingestEconomics(),
  cyber: () => ingestCyber(),
  space: (o) => ingestSpace(o.group ?? "active", o.limit ?? 2000),
  aviation: (o) => ingestAviationSnapshot(o.limit ?? 2000),
  maritime: () => ingestMaritime(),
  weather: () => ingestWeather(),
  news: (o) => ingestNews(o.query),
};

/** Bootstrap order: cheap/offline first, rate-limited news last. */
export const BOOTSTRAP_ORDER = ["countries", "disasters", "economics", "cyber", "space", "weather", "news"];

/** Incremental update set (skips the one-off country seed). */
export const UPDATE_ORDER = ["disasters", "economics", "cyber", "space", "weather", "news"];
