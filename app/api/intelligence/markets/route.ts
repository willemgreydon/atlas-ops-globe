import { NextResponse } from "next/server";
import { fetchQuotes, finnhubConfigured } from "@/lib/intel/providers/finnhub";
import { attachFreshness } from "@/lib/intel/freshness";
import { cachedFetch } from "@/lib/intel/live";
import { scrubError } from "@/lib/intel/safe-route";
import type { VaultMarketObs } from "@/lib/intel/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Markets are fetched live-at-request from Finnhub (reachable from Vercel) rather
 * than served from the vault: a 60-minute stale threshold can't be met by any
 * sync cadence, so a vault-backed ticker read CACHED almost always. Freshness is
 * still derived honestly from the newest quote's timestamp — outside US market
 * hours `/quote` returns the last trade, so the header badge truthfully shows
 * delayed/cached when the market is closed, live when it's open.
 *
 * Finnhub free tier = 60 req/min; the 9-symbol batch is coalesced to one upstream
 * fetch per TTL window per warm instance (see {@link cachedFetch}).
 */
const TTL_MS = 20_000;
const ORDER: Record<string, number> = { index: 0, equity: 1 };

function toRow(q: VaultMarketObs): Record<string, unknown> {
  return {
    id: q.id,
    symbol: q.symbol,
    name: q.name,
    assetClass: q.assetClass,
    price: q.price,
    change: q.change ?? null,
    changePct: q.changePct ?? null,
    currency: q.currency,
    latencyClass: q.latencyClass,
    ts: q.ts,
    provider: q.provider,
  };
}

function envelope(data: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  const result = { data, page: { limit: data.length, offset: 0, count: data.length, nextOffset: null } };
  return NextResponse.json({ ...attachFreshness(result, "markets", "ts"), provider: "finnhub", attribution: "Finnhub", ...extra });
}

export async function GET() {
  if (!finnhubConfigured()) return envelope([]);
  try {
    const quotes = await cachedFetch("markets", TTL_MS, () => fetchQuotes());
    const data = quotes.map(toRow).sort(
      (a, b) =>
        (ORDER[a.assetClass as string] ?? 2) - (ORDER[b.assetClass as string] ?? 2) ||
        String(a.symbol).localeCompare(String(b.symbol)),
    );
    return envelope(data);
  } catch (e) {
    return envelope([], { error: scrubError(e, "markets") });
  }
}
