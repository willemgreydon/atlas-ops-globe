"use client";
import { useApp } from "@/stores/app-store";
import StatusBadge from "@/components/common/StatusBadge";

export default function NewsFeed() {
  const app = useApp();
  const { rows, meta } = app.news;

  return (
    <section className="panel feed news-feed" aria-label="News feed">
      <div className="panel-head">
        <h3>Global News</h3>
        {app.layers.news && meta && <StatusBadge status={meta.status} title={`source: ${meta.source}`} />}
      </div>
      {!app.layers.news && <p className="muted-note feed-empty">Enable the News layer to stream headlines.</p>}
      <div className="feed-scroll">
        {app.layers.news &&
          rows.slice(0, 30).map((n) => (
            <button key={n.id} className="feed-item" onClick={() => app.select({ kind: "news", id: n.id })}>
              <div className="meta">{n.source} · {n.countryCode || "GLOBAL"}</div>
              <div className="title">{n.title}</div>
            </button>
          ))}
      </div>
    </section>
  );
}
