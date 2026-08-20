import { fetchQuotes, finnhubConfigured } from "../providers/finnhub";
import { runIngestor, type IngestReport } from "../ingest";
import { upsertMarketObs } from "../repositories";

/**
 * Market quotes via Finnhub (real-time US equities/ETFs, free tier). ETF
 * proxies stand in for indices. Credential-gated: without FINNHUB_API_KEY the
 * job fails fast with a clear OFFLINE message — no fabricated tickers.
 */
export async function ingestMarkets(): Promise<IngestReport> {
  return runIngestor({ domain: "markets", source: "finnhub", job: "quotes" }, async (c) => {
    if (!finnhubConfigured()) {
      throw new Error("FINNHUB_API_KEY not set — markets is credential-required (OFFLINE)");
    }
    const quotes = await fetchQuotes();
    for (const q of quotes) {
      c.fetched++;
      upsertMarketObs(q);
      c.created++;
    }
    if (quotes.length === 0) c.failed++;
  });
}
