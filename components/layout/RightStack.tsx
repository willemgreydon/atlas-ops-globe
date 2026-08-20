"use client";
import { useApp } from "@/stores/app-store";
import Inspector from "@/components/panels/Inspector";
import AlertCenter from "@/components/panels/AlertCenter";
import Telemetry from "@/components/panels/Telemetry";
import NewsFeed from "@/components/panels/NewsFeed";
import VaultPanel from "@/components/panels/VaultPanel";

/**
 * Right analytical column. The inspector takes the top slot when something is
 * selected; otherwise the alert center occupies it. Telemetry, the vault
 * summary and the news feed are always present.
 */
export default function RightStack() {
  const app = useApp();
  return (
    <div className="right-stack">
      {app.selection ? <Inspector /> : <AlertCenter />}
      <Telemetry />
      <VaultPanel />
      <NewsFeed />
    </div>
  );
}
