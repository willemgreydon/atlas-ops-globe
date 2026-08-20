import { describe, expect, it } from "vitest";
import { normalizeQuote, MARKET_SYMBOLS } from "@/lib/intel/providers/finnhub";
import { VaultMarketObs } from "@/lib/intel/schemas";

const AAPL = MARKET_SYMBOLS.find((s) => s.symbol === "AAPL")!;
const SPY = MARKET_SYMBOLS.find((s) => s.symbol === "SPY")!;

describe("Finnhub quote normalization", () => {
  it("maps a quote to a valid VaultMarketObs", () => {
    const obs = normalizeQuote(AAPL, { c: 315.41, d: -1.42, dp: -0.4482, pc: 316.83, t: 1755710700 })!;
    expect(obs.id).toBe("mkt:finnhub:AAPL");
    expect(obs.price).toBe(315.41);
    expect(obs.changePct).toBeCloseTo(-0.4482, 4);
    expect(obs.assetClass).toBe("equity");
    expect(obs.latencyClass).toBe("realtime");
    expect(obs.currency).toBe("USD");
    expect(obs.provenance[0].provider).toBe("finnhub");
    expect(() => VaultMarketObs.parse(obs)).not.toThrow();
  });

  it("labels ETF index proxies as index class", () => {
    const obs = normalizeQuote(SPY, { c: 640.1, d: 2.1, dp: 0.33, pc: 638.0, t: 1755710700 })!;
    expect(obs.assetClass).toBe("index");
  });

  it("drops empty quotes (c=0 = no data / bad symbol)", () => {
    expect(normalizeQuote(AAPL, { c: 0, d: 0, dp: 0, pc: 0, t: 0 })).toBeNull();
    expect(normalizeQuote(AAPL, { garbage: true })).toBeNull();
  });
});
