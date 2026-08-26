/**
 * Adaptive performance governor (mission §4).
 *
 * Samples real frame time off Cesium's render loop, maintains a smoothed FPS,
 * and moves the *effective* quality preset up/down a ladder to hold a target
 * frame budget — never exceeding the user's chosen ceiling. Uses hysteresis
 * (separate up/down thresholds + dwell time) so quality never visibly
 * oscillates (mission §4 "Never create visible oscillation").
 */
import type { Viewer } from "cesium";
import {
  DEGRADE_LADDER,
  QUALITY_PRESETS,
  type GlobeQuality,
} from "./quality";
import { applyQuality } from "./scene";

export interface PerfStats {
  fps: number;
  frameTimeMs: number;
  /** The preset the governor is currently rendering at. */
  effectiveQuality: GlobeQuality;
  /** The user's chosen ceiling; governor never renders above this. */
  ceiling: GlobeQuality;
  /** Whether the governor is allowed to auto-adjust. */
  auto: boolean;
  cameraMoving: boolean;
  primitiveCount: number;
}

const TARGET = {
  // Degrade if smoothed FPS stays below this for `dwellMs`.
  degradeBelow: 34,
  // Recover a step if smoothed FPS stays above this for `recoverDwellMs`.
  recoverAbove: 57,
  dwellMs: 1500,
  recoverDwellMs: 4000,
  // Ignore the first frames while tiles stream in.
  warmupMs: 2500,
};

type Listener = (s: PerfStats) => void;

export class GlobePerformanceManager {
  private viewer: Viewer;
  private ceiling: GlobeQuality;
  private effective: GlobeQuality;
  private auto = true;
  private fps = 60;
  private lastFrame = 0;
  private startedAt = 0;
  private belowSince = 0;
  private aboveSince = 0;
  private cameraMoving = false;
  private listeners = new Set<Listener>();
  private removePostRender?: () => void;
  private removeMoveStart?: () => void;
  private removeMoveEnd?: () => void;
  private disposed = false;

  constructor(viewer: Viewer, ceiling: GlobeQuality) {
    this.viewer = viewer;
    this.ceiling = ceiling;
    this.effective = ceiling;
  }

  start(): void {
    const scene = this.viewer.scene;
    const now = () => (typeof performance !== "undefined" ? performance.now() : 0);
    this.startedAt = now();
    this.lastFrame = now();

    const onPostRender = () => {
      const t = now();
      const dt = t - this.lastFrame;
      this.lastFrame = t;
      if (dt > 0 && dt < 1000) {
        const inst = 1000 / dt;
        // Exponential moving average — smooth but responsive.
        this.fps = this.fps * 0.9 + inst * 0.1;
      }
      if (t - this.startedAt > TARGET.warmupMs) this.evaluate(t);
      this.emit();
    };
    scene.postRender.addEventListener(onPostRender);
    this.removePostRender = () => scene.postRender.removeEventListener(onPostRender);

    const onMoveStart = () => { this.cameraMoving = true; };
    const onMoveEnd = () => { this.cameraMoving = false; };
    scene.camera.moveStart.addEventListener(onMoveStart);
    scene.camera.moveEnd.addEventListener(onMoveEnd);
    this.removeMoveStart = () => scene.camera.moveStart.removeEventListener(onMoveStart);
    this.removeMoveEnd = () => scene.camera.moveEnd.removeEventListener(onMoveEnd);
  }

  private evaluate(t: number): void {
    if (!this.auto || this.disposed) return;
    const ladder = DEGRADE_LADDER;
    const idx = ladder.indexOf(this.effective);
    const ceilIdx = ladder.indexOf(this.ceiling);

    if (this.fps < TARGET.degradeBelow) {
      this.aboveSince = 0;
      if (!this.belowSince) this.belowSince = t;
      // Can we drop a step? (higher index = lower quality)
      if (t - this.belowSince > TARGET.dwellMs && idx < ladder.length - 1) {
        this.setEffective(ladder[idx + 1]);
        this.belowSince = 0;
      }
    } else if (this.fps > TARGET.recoverAbove) {
      this.belowSince = 0;
      if (!this.aboveSince) this.aboveSince = t;
      // Recover toward the ceiling (lower index), but never above it.
      if (t - this.aboveSince > TARGET.recoverDwellMs && idx > ceilIdx) {
        this.setEffective(ladder[idx - 1]);
        this.aboveSince = 0;
      }
    } else {
      this.belowSince = 0;
      this.aboveSince = 0;
    }
  }

  private setEffective(q: GlobeQuality): void {
    if (q === this.effective) return;
    this.effective = q;
    applyQuality(this.viewer, QUALITY_PRESETS[q], q);
  }

  /** User changed the ceiling (quality selector). Clamp effective to it. */
  setCeiling(ceiling: GlobeQuality): void {
    this.ceiling = ceiling;
    const ladder = DEGRADE_LADDER;
    // Snap effective back up to the new ceiling; the governor will re-degrade if needed.
    if (ladder.indexOf(this.effective) < ladder.indexOf(ceiling)) {
      this.setEffective(ceiling);
    } else {
      this.setEffective(ceiling);
    }
    this.belowSince = 0;
    this.aboveSince = 0;
  }

  setAuto(auto: boolean): void {
    this.auto = auto;
    if (!auto) this.setEffective(this.ceiling);
  }

  getStats(): PerfStats {
    return {
      fps: Math.round(this.fps),
      frameTimeMs: this.fps > 0 ? +(1000 / this.fps).toFixed(1) : 0,
      effectiveQuality: this.effective,
      ceiling: this.ceiling,
      auto: this.auto,
      cameraMoving: this.cameraMoving,
      primitiveCount: this.viewer.scene.primitives.length,
    };
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private lastEmit = 0;
  private emit(): void {
    // Throttle listener notifications to ~4 Hz — the UI doesn't need per-frame.
    const t = this.lastFrame;
    if (t - this.lastEmit < 250) return;
    this.lastEmit = t;
    const s = this.getStats();
    for (const fn of this.listeners) fn(s);
  }

  dispose(): void {
    this.disposed = true;
    this.removePostRender?.();
    this.removeMoveStart?.();
    this.removeMoveEnd?.();
    this.listeners.clear();
  }
}
