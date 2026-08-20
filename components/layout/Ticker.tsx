"use client";
import { useMemo } from "react";
import { useApp } from "@/stores/app-store";
import { activeProviders } from "@/data/provider-registry";

/**
 * Bottom ticker. Streams real market quotes (Finnhub, when configured) followed
 * by the latest event/news signals — with honest source attribution. Market
 * figures come only from live data; nothing is fabricated, and each quote keeps
 * its provider + latency class.
 */
export default function Ticker() {
  const app = useApp();
  const quotes = app.markets.rows;
  const marketsLive = app.markets.meta?.status === "live" && quotes.length > 0;

  const items = useMemo(() => {
    const out: { tag: string; text: string }[] = [];
    for (const e of app.events.rows.slice(0, 3)) {
      out.push({ tag: e.severity === "critical" ? "CRITICAL" : e.severity === "warning" ? "WARNING" : "EVENT", text: e.title });
    }
    for (const n of app.news.rows.slice(0, 3)) out.push({ tag: "NEWS", text: n.title });
    return out;
  }, [app.events.rows, app.news.rows]);

  const sources = activeProviders.map((p) => p.name.toUpperCase()).join(" · ");

  return (
    <footer className="ticker" aria-label="Signal ticker">
      <div className="ticker-track">
        {marketsLive && (
          <>
            <span className="ticker-tag tag-markets">MARKETS</span>
            {quotes.map((q) => {
              const up = (q.changePct ?? 0) >= 0;
              return (
                <span className="quote" key={q.id} title={`${q.name ?? q.symbol} · ${q.latencyClass} · ${q.provider}`}>
                  <b>{q.symbol}</b>
                  <span className="quote-px">{q.price != null ? q.price.toFixed(2) : "—"}</span>
                  {q.changePct != null && (
                    <span className={up ? "up" : "down"}>{up ? "▲" : "▼"} {Math.abs(q.changePct).toFixed(2)}%</span>
                  )}
                </span>
              );
            })}
            <span className="ticker-divider" />
          </>
        )}
        {items.length === 0 && !marketsLive && <span className="muted-note">Awaiting live signal stream…</span>}
        {items.map((it, i) => (
          <span className="ticker-item" key={i}>
            <span className={`ticker-tag tag-${it.tag.toLowerCase()}`}>{it.tag}</span>
            {it.text}
          </span>
        ))}
        <span className="ticker-sources">SOURCES: {sources}{marketsLive ? " · FINNHUB" : ""}</span>
      </div>
    </footer>
  );
}
