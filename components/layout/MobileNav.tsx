"use client";
import { useMemo } from "react";
import { Layers, Radar, Info, X } from "lucide-react";
import { useApp } from "@/stores/app-store";
import { deriveAlerts } from "@/lib/alerts";
import type { MobileDock } from "@/stores/app-store";

/**
 * Phone-only bottom tab bar. The HUD panels collapse to on-demand bottom sheets
 * so the globe is never occluded; this bar summons them. Hidden on desktop
 * (`display: none` above the mobile breakpoint), where the panels are always
 * visible. Tapping the active tab closes the sheet, returning to the full globe.
 */
export default function MobileNav() {
  const app = useApp();
  const dock = app.dock;
  const selected = !!app.selection;
  const alertCount = useMemo(
    () => deriveAlerts(app.events.rows).filter((a) => a.severity === "critical").length,
    [app.events.rows],
  );

  const toggle = (d: MobileDock) => app.setDock(dock === d ? null : d);

  return (
    <nav className="mobile-nav" aria-label="Panels">
      <button
        className={dock === "layers" ? "mnav-btn active" : "mnav-btn"}
        onClick={() => toggle("layers")}
        aria-pressed={dock === "layers"}
      >
        <Layers size={17} aria-hidden />
        <span>Layers</span>
      </button>
      <button
        className={dock === "intel" ? "mnav-btn active" : "mnav-btn"}
        onClick={() => toggle("intel")}
        aria-pressed={dock === "intel"}
      >
        <span className="mnav-ico">
          {selected ? <Info size={17} aria-hidden /> : <Radar size={17} aria-hidden />}
          {!selected && alertCount > 0 && <i className="mnav-badge" aria-hidden />}
        </span>
        <span>{selected ? "Details" : "Intel"}</span>
      </button>
      {dock && (
        <button className="mnav-btn mnav-close" onClick={() => app.setDock(null)} aria-label="Close panel">
          <X size={17} aria-hidden />
          <span>Close</span>
        </button>
      )}
    </nav>
  );
}
