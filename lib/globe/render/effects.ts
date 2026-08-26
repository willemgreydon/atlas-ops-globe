/**
 * Disaster / alert effect layer (mission §34 §35 §37 §130 — effect vocabulary).
 *
 * A tiny, self-contained effect registry: qualifying world events (earthquakes,
 * critical + warning alerts) get an expanding, fading ground ripple — a radar
 * shockwave that reads instantly as "something happened here" without the
 * continuous blink the design language forbids elsewhere (mission §61). The
 * ripple radius is grounded in real magnitude when the event carries one, so a
 * M7 quake visibly dwarfs a M4.
 *
 * Kept honest and cheap:
 *  - diff/patch by event id (no teardown churn, mirrors `MovingLayer`),
 *  - a hard ceiling on simultaneous ripples (severity-prioritised) so a busy
 *    feed can't flood the GPU,
 *  - `reducedMotion` collapses the animation to a single static ring (§60).
 */
import {
  CallbackProperty,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  CustomDataSource,
  HeightReference,
  type Entity,
  type Viewer,
} from "cesium";
import type { Severity, WorldEvent } from "@/types/domain";

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#ff5a62",
  warning: "#ffae45",
  watch: "#54c7ff",
  info: "#65f6c7",
};

/** Priority for the ceiling: brightest emergencies win the last few slots. */
const SEVERITY_RANK: Record<Severity, number> = { critical: 3, warning: 2, watch: 1, info: 0 };

/** Best-effort Richter magnitude parsed from a quake headline ("M 6.1 - …"). */
export function magnitudeOf(e: WorldEvent): number | null {
  const isQuake = e.tags?.includes("earthquake") || e.kind === "disaster";
  if (!isQuake) return null;
  const m = /\bM\s*([0-9]+(?:\.[0-9]+)?)/i.exec(e.title);
  const v = m ? Number(m[1]) : NaN;
  return Number.isFinite(v) ? v : null;
}

/** Peak ground radius (m) of the ripple — magnitude-driven, severity fallback. */
export function peakRadius(e: WorldEvent): number {
  const mag = magnitudeOf(e);
  if (mag != null) {
    // Perceptually-scaled: felt-radius roughly doubles per magnitude step.
    return clamp(1000 * Math.pow(2.15, mag), 60_000, 900_000);
  }
  switch (e.severity) {
    case "critical": return 420_000;
    case "warning": return 260_000;
    case "watch": return 170_000;
    default: return 120_000;
  }
}

/** Ripple period (ms) — emergencies pulse faster. */
function periodMs(sev: Severity): number {
  return sev === "critical" ? 2100 : sev === "warning" ? 2800 : 3600;
}

/** Deterministic 0..1 phase offset from an id, so ripples don't beat in sync. */
function phaseOffset(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface EffectsConfig {
  /** Ceiling on simultaneous ripples (from the quality preset). */
  max: number;
  reducedMotion: boolean;
}

export class EffectsLayer {
  private viewer: Viewer;
  private ds: CustomDataSource;
  private rings = new Map<string, Entity>();
  private mounted = false;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.ds = new CustomDataSource("effects");
  }

  private mount(): void {
    if (this.mounted) return;
    this.viewer.dataSources.add(this.ds);
    this.mounted = true;
  }

  /** Diff qualifying events → ripples, honouring the severity-ranked ceiling. */
  update(events: WorldEvent[], config: EffectsConfig): void {
    this.mount();
    // Rank + cap: keep the most severe events, newest first within a tier.
    const ranked = events
      .filter((e) => Number.isFinite(e.location?.lat) && Number.isFinite(e.location?.lon))
      .filter((e) => e.severity === "critical" || e.severity === "warning" || magnitudeOf(e) != null)
      .sort((a, b) =>
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        Date.parse(b.occurredAt || "") - Date.parse(a.occurredAt || ""),
      )
      .slice(0, Math.max(0, config.max));

    const keep = new Set(ranked.map((e) => e.id));
    for (const [id, ent] of this.rings) {
      if (!keep.has(id)) { this.ds.entities.remove(ent); this.rings.delete(id); }
    }
    for (const e of ranked) {
      if (!this.rings.has(e.id)) this.add(e, config.reducedMotion);
    }
  }

  private add(e: WorldEvent, reducedMotion: boolean): void {
    const color = Color.fromCssColorString(SEVERITY_COLOR[e.severity] ?? "#65f6c7");
    const maxR = peakRadius(e);
    const position = Cartesian3.fromDegrees(e.location.lon, e.location.lat, 0);

    if (reducedMotion) {
      // Static footprint ring — no animation, still conveys reach + severity.
      const ent = this.ds.entities.add({
        position,
        ellipse: {
          semiMajorAxis: maxR * 0.6,
          semiMinorAxis: maxR * 0.6,
          height: 0,
          heightReference: HeightReference.NONE,
          material: color.withAlpha(0.08),
          outline: true,
          outlineColor: color.withAlpha(0.6),
          outlineWidth: 2,
        },
      });
      this.rings.set(e.id, ent);
      return;
    }

    const period = periodMs(e.severity);
    const start = (typeof performance !== "undefined" ? performance.now() : 0) - phaseOffset(e.id) * period;
    // Memoise the phase within a render frame: the ellipse's semiMajor and
    // semiMinor callbacks fire microseconds apart, and if each sampled the clock
    // independently the minor axis could read a fractionally larger radius than
    // the major — violating Cesium's `semiMajor >= semiMinor` invariant. Caching
    // for a couple of ms makes both same-frame reads identical.
    let phaseAt = -1;
    let phaseVal = 0;
    const phase = () => {
      const t = typeof performance !== "undefined" ? performance.now() : 0;
      if (t - phaseAt < 2) return phaseVal;
      phaseAt = t;
      phaseVal = ((t - start) % period) / period; // 0 → 1
      return phaseVal;
    };

    const radius = new CallbackProperty(() => Math.max(1, phase() * maxR), false);
    const fillColor = new CallbackProperty(() => {
      const p = phase();
      return color.withAlpha(0.16 * (1 - p) * (1 - p));
    }, false);
    const ringColor = new CallbackProperty(() => {
      const p = phase();
      return color.withAlpha(0.85 * (1 - p));
    }, false);

    const ent = this.ds.entities.add({
      position,
      ellipse: {
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        height: 0,
        heightReference: HeightReference.NONE,
        material: new ColorMaterialProperty(fillColor),
        outline: true,
        outlineColor: ringColor,
        outlineWidth: 2,
      },
    });
    this.rings.set(e.id, ent);
  }

  dispose(): void {
    if (this.mounted && !this.viewer.isDestroyed()) {
      this.viewer.dataSources.remove(this.ds, true);
    }
    this.rings.clear();
    this.mounted = false;
  }
}
