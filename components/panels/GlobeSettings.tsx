"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useApp } from "@/stores/app-store";
import { GLOBE_QUALITIES, type GlobeQuality } from "@/lib/globe/quality";
import type { AtmospherePreset, LightingMode } from "@/lib/globe/scene";
import { type TerrainMode, ionTokenPresent } from "@/lib/globe/terrain-config";

/**
 * Globe render controls (mission §3 §6 §7 — Phase B control surface). Drives the
 * quality ceiling, atmosphere character and lighting model that the engine
 * (`lib/globe/scene.ts`, `performance.ts`) reads. Every control maps to real
 * engine state — no decorative toggles.
 */

const QUALITY_LABELS: Record<GlobeQuality, string> = {
  performance: "Perf",
  balanced: "Balanced",
  high: "High",
  ultra: "Ultra",
};

const ATMOSPHERES: { id: AtmospherePreset; label: string }[] = [
  { id: "scientific", label: "Scientific" },
  { id: "natural", label: "Natural" },
  { id: "cinematic", label: "Cinematic" },
  { id: "minimal", label: "Minimal" },
];

const LIGHTINGS: { id: LightingMode; label: string }[] = [
  { id: "realtime-sun", label: "Real-time sun" },
  { id: "timeline-sun", label: "Timeline sun" },
  { id: "flat-analytical", label: "Flat" },
];

const SURFACES: { id: TerrainMode; label: string }[] = [
  { id: "ellipsoid", label: "Ellipsoid" },
  { id: "world", label: "Terrain" },
  { id: "photorealistic", label: "Photoreal" },
];

function Segmented<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="setting">
      <span className="setting-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={value === o.id}
            aria-label={`${label}: ${o.label}`}
            className={value === o.id ? "seg active" : "seg"}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GlobeSettings() {
  const app = useApp();
  const [open, setOpen] = useState(true);
  const qualityOptions = GLOBE_QUALITIES.map((q) => ({ id: q, label: QUALITY_LABELS[q] }));

  return (
    <section className={`panel globe-settings ${open ? "" : "collapsed"}`} aria-label="Globe render settings">
      <button
        className="collapse-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="globe-settings-body"
      >
        <h3>Globe</h3>
        <ChevronDown className="collapse-chevron" size={15} aria-hidden />
      </button>
      <div id="globe-settings-body" className="collapse-body" hidden={!open}>
      <Segmented label="Quality" value={app.quality} options={qualityOptions} onChange={app.setQuality} />
      <label className="setting-check">
        <input
          type="checkbox"
          checked={app.autoQuality}
          onChange={(e) => app.setAutoQuality(e.target.checked)}
          aria-label="Auto-adjust quality"
        />
        <span>Auto-adjust to hold framerate</span>
      </label>
      <Segmented label="Atmosphere" value={app.atmosphere} options={ATMOSPHERES} onChange={app.setAtmosphere} />
      <Segmented label="Lighting" value={app.lighting} options={LIGHTINGS} onChange={app.setLighting} />

      {ionTokenPresent() ? (
        <Segmented label="Surface" value={app.terrain} options={SURFACES} onChange={app.setTerrain} />
      ) : (
        <div className="setting">
          <span className="setting-label">Surface</span>
          <p className="setting-hint">
            Add a free Cesium ion token (<code>NEXT_PUBLIC_CESIUM_ION_TOKEN</code>) to unlock 3D terrain relief &amp; Google photorealistic tiles.
          </p>
        </div>
      )}

      <div className="setting-group" role="group" aria-label="Cinematic layers">
        <span className="setting-label">Cinematic</span>
        <Toggle label="Deep-space environment" hint="Starfield · sun · moon · bloom" checked={app.environment} onChange={app.setEnvironment} />
        <Toggle label="Disaster shockwaves" hint="Ripples on quakes & critical alerts" checked={app.effects} onChange={app.setEffects} />
        <Toggle label="Motion trails" hint="Comet-trail behind the selected object" checked={app.trails} onChange={app.setTrails} />
      </div>
      </div>
    </section>
  );
}

function Toggle({
  label, hint, checked, onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="setting-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="setting-check-text">
        <span>{label}</span>
        {hint ? <span className="setting-hint">{hint}</span> : null}
      </span>
    </label>
  );
}
