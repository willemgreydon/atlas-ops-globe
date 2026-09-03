/**
 * Frame governor — request-driven rendering (mission §3 §4 §71).
 *
 * By default Cesium runs an unconditional render loop: it redraws every display
 * refresh (60, 120, 144 Hz…) even when nothing on screen changed, burning GPU,
 * battery and thermal headroom for zero visible benefit. This flips the scene to
 * `requestRenderMode` and drives it from a single rAF pump that renders only when
 * something is actually animating — and caps the rate when it is.
 *
 * Fail-safe by design: it can only ever render *more* than necessary, never less
 * in a way you'd notice. Two independent triggers keep motion smooth —
 *  1. camera-motion detection (manual nav, fly-to, idle auto-orbit), and
 *  2. explicit `setAnimating` flags for live layers, selection and effects —
 * and when neither fires it still emits a low-frequency heartbeat, so the idle
 * auto-orbit countdown, LOD and any late repaint keep ticking. There is no state
 * in which the globe can freeze.
 *
 * Quality is preserved: `activeFps` defaults to 60 (the smoothness bar), so the
 * only frames removed are the redundant ones above 60 Hz and the idle ones.
 */
import { Cartesian3, type Scene, type Viewer } from "cesium";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export interface FrameGovernorOptions {
  /** Cap while anything is animating or the user is interacting. */
  activeFps?: number;
  /** Heartbeat rate while fully idle (keeps auto-orbit/LOD countdowns alive). */
  idleHz?: number;
  /** Keep rendering for this long after the last detected activity. */
  graceMs?: number;
}

export class FrameGovernor {
  private scene: Scene;
  private activeFps: number;
  private idleHz: number;
  private graceMs: number;
  private raf = 0;
  private lastRender = 0;
  private lastActivity = 0;
  private animating = new Set<string>();
  private camPos = new Cartesian3();
  private camDir = new Cartesian3();
  private prevRenderMode = false;
  private prevMaxTimeChange = 0;
  private disposed = false;

  constructor(viewer: Viewer, opts: FrameGovernorOptions = {}) {
    this.scene = viewer.scene;
    this.activeFps = opts.activeFps ?? 60;
    this.idleHz = opts.idleHz ?? 6;
    this.graceMs = opts.graceMs ?? 350;
  }

  start(): void {
    const scene = this.scene;
    this.prevRenderMode = scene.requestRenderMode;
    this.prevMaxTimeChange = scene.maximumRenderTimeChange;
    // We drive rendering; a clock-time change alone must not force a redraw
    // (the sun moves imperceptibly per frame — it rides the normal cadence).
    scene.requestRenderMode = true;
    scene.maximumRenderTimeChange = Infinity;

    Cartesian3.clone(scene.camera.positionWC, this.camPos);
    Cartesian3.clone(scene.camera.directionWC, this.camDir);
    this.lastActivity = now();

    const loop = () => {
      if (this.disposed) return;
      this.tick(now());
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Register/clear a named animation source (live layer, selection, effect). */
  setAnimating(key: string, on: boolean): void {
    if (on) {
      this.animating.add(key);
      this.lastActivity = now();
      this.scene.requestRender();
    } else {
      this.animating.delete(key);
    }
  }

  /** Force at least one render (e.g. after a data update mutates the scene). */
  kick(): void {
    this.lastActivity = now();
    this.scene.requestRender();
  }

  private tick(t: number): void {
    const cam = this.scene.camera;
    // Camera-motion detection covers manual navigation, fly-to and auto-orbit —
    // a moving camera is always an activity, regardless of the flags.
    const moved =
      !Cartesian3.equalsEpsilon(cam.positionWC, this.camPos, 1e-7, 1.0) ||
      !Cartesian3.equalsEpsilon(cam.directionWC, this.camDir, 1e-5);
    if (moved) {
      Cartesian3.clone(cam.positionWC, this.camPos);
      Cartesian3.clone(cam.directionWC, this.camDir);
      this.lastActivity = t;
    }
    if (this.animating.size > 0) this.lastActivity = t;

    const active = t - this.lastActivity < this.graceMs;
    const interval = 1000 / (active ? this.activeFps : this.idleHz);
    if (t - this.lastRender >= interval - 0.5) {
      this.lastRender = t;
      this.scene.requestRender();
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    // Restore the previous render policy so teardown/HMR can't leave a frozen scene.
    if (!this.scene.isDestroyed()) {
      this.scene.requestRenderMode = this.prevRenderMode;
      this.scene.maximumRenderTimeChange = this.prevMaxTimeChange;
      this.scene.requestRender();
    }
  }
}
