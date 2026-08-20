"use client";
import dynamic from "next/dynamic";
import { AppProvider } from "@/stores/app-store";
import TopBar from "@/components/layout/TopBar";
import RightStack from "@/components/layout/RightStack";
import Ticker from "@/components/layout/Ticker";
import LayerManager from "@/components/panels/LayerManager";
import CommandPalette from "@/components/search/CommandPalette";

const Globe = dynamic(() => import("@/components/globe/Globe"), {
  ssr: false,
  loading: () => <div className="loading">INITIALIZING GLOBAL VIEW</div>,
});

export default function Page() {
  return (
    <AppProvider>
      <main className="app-shell">
        <TopBar />
        <section className="workspace">
          <div className="globe-wrap">
            <Globe />
          </div>
          <div className="hud">
            <LayerManager />
            <RightStack />
          </div>
        </section>
        <Ticker />
        <CommandPalette />
      </main>
    </AppProvider>
  );
}
