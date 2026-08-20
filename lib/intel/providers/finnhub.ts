import { z } from "zod";
import { fetchJson } from "@/lib/fetch-json";
import { prov } from "@/lib/intel/provenance";
import { mapPool, limiter } from "@/lib/intel/pool";
import type { VaultMarketObs } from "@/lib/intel/schemas";

/**
 * Finnhub — real-time US equity/ETF quotes (free tier: 60 req/min).
 * https://finnhub.io/docs/api/quote
 *
 * Index quotes require a paid plan, so we use liquid ETF proxies (SPY≈S&P 500,
 * QQQ≈Nasdaq-100, DIA≈Dow) alongside megacaps. Free-tier US quotes are
 * real-time during market hours; outside hours `/quote` returns the last trade,
 * which we still label `realtime` (last-trade), never fabricated.
 */
export interface MarketSymbol {
  symbol: string;
  name: string;
  assetClass: VaultMarketObs["assetClass"];
}

export const MARKET_SYMBOLS: MarketSymbol[] = [
  { symbol: "SPY", name: "S&P 500 (SPY)", assetClass: "index" },
  { symbol: "QQQ", name: "Nasdaq 100 (QQQ)", assetClass: "index" },
  { symbol: "DIA", name: "Dow Jones (DIA)", assetClass: "index" },
  { symbol: "AAPL", name: "Apple", assetClass: "equity" },
  { symbol: "MSFT", name: "Microsoft", assetClass: "equity" },
  { symbol: "NVDA", name: "NVIDIA", assetClass: "equity" },
  { symbol: "AMZN", name: "Amazon", assetClass: "equity" },
  { symbol: "GOOGL", name: "Alphabet", assetClass: "equity" },
  { symbol: "TSLA", name: "Tesla", assetClass: "equity" },
];

const QuoteSchema = z.object({
  c: z.number(), // current
  d: z.number().nullable(), // change
  dp: z.number().nullable(), // percent change
  t: z.number().nullable(), // unix ts
  pc: z.number().nullable(), // prev close
});

export function finnhubConfigured(): boolean {
  return !!process.env.FINNHUB_API_KEY;
}

export function normalizeQuote(sym: MarketSymbol, raw: unknown): VaultMarketObs | null {
  const q = QuoteSchema.safeParse(raw);
  if (!q.success || q.data.c === 0) return null; // 0 = no data / bad symbol
  const ts = q.data.t ? new Date(q.data.t * 1000).toISOString() : new Date().toISOString();
  return {
    id: `mkt:finnhub:${sym.symbol}`,
    symbol: sym.symbol,
    name: sym.name,
    assetClass: sym.assetClass,
    price: q.data.c,
    change: q.data.d,
    changePct: q.data.dp,
    currency: "USD",
    latencyClass: "realtime",
    ts,
    provider: "finnhub",
    provenance: [
      prov({
        provider: "finnhub",
        dataset: "quote",
        providerRecordId: sym.symbol,
        sourceUrl: `https://finnhub.io/`,
        observedAt: ts,
        attribution: "Finnhub",
      }),
    ],
  };
}

export async function fetchQuotes(symbols = MARKET_SYMBOLS, apiKey = process.env.FINNHUB_API_KEY): Promise<VaultMarketObs[]> {
  if (!apiKey) throw new Error("FINNHUB_API_KEY not set");
  const results = await mapPool(symbols, 4, async (sym) => {
    await limiter.wait("finnhub", 250); // stay well under 60/min
    try {
      const raw = await fetchJson<unknown>(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym.symbol)}&token=${apiKey}`,
        { timeoutMs: 12_000 },
      );
      return normalizeQuote(sym, raw);
    } catch {
      return null;
    }
  });
  return results.filter((r): r is VaultMarketObs => r !== null);
}
