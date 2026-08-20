"use client";
import { useMemo } from "react";
import { useApp } from "@/stores/app-store";
import { activeProviders } from "@/data/provider-registry";

/**
 * Bottom ticker. Streams the latest *real* signals (events + news) with an
 * honest source attribution line. Deliberately shows no market figures until a
 * market feed is wired — no fabricated "S&P +0.24%".
 */
export default function Ticker() {
  const app = useApp();
  const items = useMemo(() => {
    const out: { tag: string; text: string }[] = [];
    for (const e of app.events.rows.slice(0, 4)) {
      out.push({ tag: e.severity === "critical" ? "CRITICAL" : e.severity === "warning" ? "WARNING" : "EVENT", text: e.title });
    }
    for (const n of app.news.rows.slice(0, 4)) out.push({ tag: "NEWS", text: n.title });
    return out;
  }, [app.events.rows, app.news.rows]);

  const sources = activeProviders.map((p) => p.name.toUpperCase()).join(" · ");

  return (
    <footer className="ticker" aria-label="Signal ticker">
      <div className="ticker-track">
        {items.length === 0 && <span className="muted-note">Awaiting live signal stream…</span>}
        {items.map((it, i) => (
          <span className="ticker-item" key={i}>
            <span className={`ticker-tag tag-${it.tag.toLowerCase()}`}>{it.tag}</span>
            {it.text}
          </span>
        ))}
        <span className="ticker-sources">SOURCES: {sources}</span>
      </div>
    </footer>
  );
}
