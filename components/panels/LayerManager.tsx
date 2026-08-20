"use client";
import { useApp } from "@/stores/app-store";
import { LAYERS } from "@/lib/config/layers";
import type { DataStatus } from "@/types/domain";

/**
 * Layer manager. Active layers are real toggles bound to app state. Planned
 * layers are disabled and clearly labelled — no control that does nothing.
 */
export default function LayerManager() {
  const app = useApp();

  const feedStatus = (feed?: string): DataStatus | undefined => {
    if (feed === "aircraft") return app.aircraft.meta?.status;
    if (feed === "events") return app.events.meta?.status;
    if (feed === "news") return app.news.meta?.status;
    return undefined;
  };

  return (
    <section className="layers panel" aria-label="Operational layers">
      <h3>Operational Layers</h3>
      {LAYERS.map((l) => {
        const planned = l.status === "planned";
        const on = !!app.layers[l.id];
        const status = feedStatus(l.feed);
        return (
          <label
            key={l.id}
            className={`layer-row ${planned ? "planned" : ""}`}
            title={l.providerNote ?? l.label}
          >
            <span className="layer-name">
              <i className="dot" style={{ background: l.color }} />
              {l.label}
            </span>
            <span className="layer-ctl">
              {planned ? (
                <span className="tag-planned">PLANNED</span>
              ) : (
                <>
                  {on && status && <i className={`feed-dot feed-${status}`} title={status} />}
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => app.toggleLayer(l.id)}
                    aria-label={`Toggle ${l.label}`}
                  />
                </>
              )}
            </span>
          </label>
        );
      })}
    </section>
  );
}
