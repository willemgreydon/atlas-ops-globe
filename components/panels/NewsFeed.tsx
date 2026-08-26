"use client";
import { useMemo, useState } from "react";
import { useApp } from "@/stores/app-store";
import StatusBadge from "@/components/common/StatusBadge";

type Sort = "recent" | "source";

export default function NewsFeed() {
  const app = useApp();
  const { rows, meta } = app.news;
  const [sort, setSort] = useState<Sort>("recent");

  const sorted = useMemo(() => {
    const r = [...rows];
    if (sort === "source") r.sort((a, b) => a.source.localeCompare(b.source) || b.publishedAt.localeCompare(a.publishedAt));
    else r.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return r.slice(0, 30);
  }, [rows, sort]);

  return (
    <section className="panel feed news-feed" aria-label="News feed">
      <div className="panel-head">
        <h3>Global News</h3>
        {app.layers.news && meta && <StatusBadge status={meta.status} title={`source: ${meta.source}`} />}
      </div>
      {!app.layers.news && <p className="muted-note feed-empty">Enable the News layer to stream headlines.</p>}
      {app.layers.news && rows.length > 0 && (
        <div className="chip-row" role="group" aria-label="Sort news">
          <button className={`chip ${sort === "recent" ? "active" : ""}`} onClick={() => setSort("recent")} aria-pressed={sort === "recent"}>Recent</button>
          <button className={`chip ${sort === "source" ? "active" : ""}`} onClick={() => setSort("source")} aria-pressed={sort === "source"}>By source</button>
        </div>
      )}
      <div className="feed-scroll">
        {app.layers.news &&
          sorted.map((n) => (
            <button key={n.id} className="feed-item" onClick={() => app.select({ kind: "news", id: n.id })}>
              <div className="meta">{n.source} · {n.countryCode || "GLOBAL"}</div>
              <div className="title">{n.title}</div>
            </button>
          ))}
      </div>
    </section>
  );
}
