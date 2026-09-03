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
    // Cover every feed, not just aircraft/events/news, so each active layer row
    // shows an honest liveness dot (was silently blank for maritime/weather/space).
    switch (feed) {
      case "aircraft": return app.aircraft.meta?.status;
      case "airports": return app.airports.meta?.status;
      case "powerplants": return app.powerplants.meta?.status;
      case "ports": return app.ports.meta?.status;
      case "volcanoes": return app.volcanoes.meta?.status;
      case "events": return app.events.meta?.status;
      case "news": return app.news.meta?.status;
      case "vessels": return app.vessels.meta?.status;
      case "weather": return app.weather.meta?.status;
      case "airquality": return app.airquality.meta?.status;
      case "conflict": return app.conflict.meta?.status;
      case "satellites": return app.satellites.meta?.status;
      default: return undefined;
    }
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
