"use client";
import { useApp } from "@/stores/app-store";
import LayerManager from "@/components/panels/LayerManager";
import SystemStatus from "@/components/panels/SystemStatus";
import GlobeSettings from "@/components/panels/GlobeSettings";
import RightStack from "@/components/layout/RightStack";
import MobileNav from "@/components/layout/MobileNav";

/**
 * The heads-up overlay over the globe. On desktop the left controls and the
 * right analytical stack float at the edges, always visible. On a phone they
 * collapse to bottom sheets summoned by `MobileNav`; `data-dock` drives which
 * (if any) is open, so the globe stays fully visible while exploring. A scrim
 * behind the open sheet dismisses it on tap.
 */
export default function Hud() {
  const app = useApp();
  return (
    <div className="hud" data-dock={app.dock ?? "none"}>
      {app.dock && (
        <button className="dock-scrim" aria-label="Close panel" tabIndex={-1} onClick={() => app.setDock(null)} />
      )}
      <div className="hud-left">
        <LayerManager />
        <SystemStatus />
        <GlobeSettings />
      </div>
      <RightStack />
      <MobileNav />
    </div>
  );
}
