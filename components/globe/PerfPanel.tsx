"use client";
/**
 * Development performance/diagnostics panel (mission §117).
 *
 * Shows FPS, frame time, effective vs ceiling quality, camera state, primitive
 * count and camera altitude. Hidden unless `?perf=1` is in the URL or
 * NODE_ENV !== "production", so it never ships enabled by default.
 */
import { useEffect, useState } from "react";
import { Cartographic } from "cesium";
import { onGlobeRuntime, type GlobeRuntime } from "@/lib/globe/runtime";
import type { PerfStats } from "@/lib/globe/performance";
import type { LodBand } from "@/lib/globe/lod";

function enabled(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("perf") === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export default function PerfPanel() {
  const [runtime, setRuntime] = useState<GlobeRuntime | null>(null);
  const [stats, setStats] = useState<PerfStats | null>(null);
  const [alt, setAlt] = useState<number>(0);
  const [band, setBand] = useState<LodBand | null>(null);
  // Evaluated once at mount (client-only dynamic import, so `window` is safe).
  const [show] = useState(enabled);

  useEffect(() => onGlobeRuntime(setRuntime), []);

  useEffect(() => {
    if (!runtime) return;
    const off = runtime.performance.subscribe(setStats);
    const offBand = runtime.lod.subscribe(setBand);
    const scene = runtime.viewer.scene;
    const tick = () => {
      const carto = Cartographic.fromCartesian(scene.camera.positionWC);
      if (carto) setAlt(carto.height);
    };
    scene.camera.changed.addEventListener(tick);
    tick();
    return () => { off(); offBand(); scene.camera.changed.removeEventListener(tick); };
  }, [runtime]);

  if (!show || !stats) return null;

  const fpsColor = stats.fps >= 55 ? "#65f6c7" : stats.fps >= 35 ? "#ffae45" : "#ff5a62";
  const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 1e6 ? 0 : 1)} km` : `${Math.round(m)} m`);

  return (
    <div className="perf-panel" aria-hidden>
      <div className="perf-row">
        <span>FPS</span>
        <b style={{ color: fpsColor }}>{stats.fps}</b>
        <span className="perf-dim">{stats.frameTimeMs} ms</span>
      </div>
      <div className="perf-row">
        <span>Quality</span>
        <b>{stats.effectiveQuality}</b>
        <span className="perf-dim">≤ {stats.ceiling}{stats.auto ? " · auto" : " · locked"}</span>
      </div>
      <div className="perf-row">
        <span>Camera</span>
        <b>{km(alt)}</b>
        <span className="perf-dim">{stats.cameraMoving ? "moving" : "idle"}</span>
      </div>
      <div className="perf-row">
        <span>LOD band</span>
        <b>{band ?? "—"}</b>
      </div>
      <div className="perf-row">
        <span>Primitives</span>
        <b>{stats.primitiveCount}</b>
      </div>
    </div>
  );
}
