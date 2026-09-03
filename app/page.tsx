"use client";
import dynamic from "next/dynamic";
import { AppProvider, useApp } from "@/stores/app-store";
import TopBar from "@/components/layout/TopBar";
import Hud from "@/components/layout/Hud";
import Ticker from "@/components/layout/Ticker";
import CommandPalette from "@/components/search/CommandPalette";
import Observatory from "@/components/dashboard/Observatory";

const Globe = dynamic(() => import("@/components/globe/Globe"), {
  ssr: false,
  loading: () => <div className="loading">INITIALIZING GLOBAL VIEW</div>,
});
const PerfPanel = dynamic(() => import("@/components/globe/PerfPanel"), { ssr: false });
const GlobeTooltip = dynamic(() => import("@/components/globe/GlobeTooltip"), { ssr: false });

/** The globe stays mounted (hidden) when the dashboard is open, so switching
 *  views never re-initialises the Cesium scene. */
function Workspace() {
  const { view } = useApp();
  const dashboard = view === "dashboard";
  return (
    <section className="workspace">
      <div className="globe-wrap" style={dashboard ? { display: "none" } : undefined}>
        <Globe />
        <PerfPanel />
        <GlobeTooltip />
      </div>
      {dashboard ? <Observatory /> : <Hud />}
    </section>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <main className="app-shell">
        <TopBar />
        <Workspace />
        <Ticker />
        <CommandPalette />
      </main>
    </AppProvider>
  );
}
