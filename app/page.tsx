"use client";
import dynamic from "next/dynamic";
import { AppProvider } from "@/stores/app-store";
import TopBar from "@/components/layout/TopBar";
import Hud from "@/components/layout/Hud";
import Ticker from "@/components/layout/Ticker";
import CommandPalette from "@/components/search/CommandPalette";

const Globe = dynamic(() => import("@/components/globe/Globe"), {
  ssr: false,
  loading: () => <div className="loading">INITIALIZING GLOBAL VIEW</div>,
});
const PerfPanel = dynamic(() => import("@/components/globe/PerfPanel"), { ssr: false });
const GlobeTooltip = dynamic(() => import("@/components/globe/GlobeTooltip"), { ssr: false });

export default function Page() {
  return (
    <AppProvider>
      <main className="app-shell">
        <TopBar />
        <section className="workspace">
          <div className="globe-wrap">
            <Globe />
            <PerfPanel />
            <GlobeTooltip />
          </div>
          <Hud />
        </section>
        <Ticker />
        <CommandPalette />
      </main>
    </AppProvider>
  );
}
