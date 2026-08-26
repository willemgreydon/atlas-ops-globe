/**
 * Cinematic camera controller (mission §15 §16 §18 §19).
 *
 * Wraps Cesium's camera with:
 *  - distance-adaptive flight durations + eased interpolation (§16 §59),
 *  - semantic `flyTo*` verbs that frame targets at an analytical viewing angle,
 *  - damped free navigation (inertia tuned once),
 *  - idle auto-orbit that yields instantly to user input (§18),
 *  - `prefers-reduced-motion` support (§60).
 *
 * All durations follow the Motion System (`docs/globe/MOTION-SYSTEM.md`).
 */
import {
  BoundingSphere,
  Cartesian3,
  Cartographic,
  EasingFunction,
  HeadingPitchRange,
  Math as CMath,
  type Viewer,
} from "cesium";

const EARTH_CIRCUMFERENCE = 40_075_000; // m

/** Analytical settle angle: slight tilt so terrain/altitude read (not straight down). */
const SETTLE_PITCH = CMath.toRadians(-55);

export interface CameraOptions {
  /** Idle seconds before auto-orbit begins (0 disables). */
  autoOrbitAfter?: number;
  reducedMotion?: boolean;
}

export class GlobeCameraController {
  private viewer: Viewer;
  private reducedMotion: boolean;
  private autoOrbitAfter: number;
  private lastInteraction = 0;
  private orbiting = false;
  /** True while `viewer.trackedEntity` is following a selection (§19). */
  private tracking = false;
  private removeTick?: () => void;
  private removeInteraction: Array<() => void> = [];
  private disposed = false;

  constructor(viewer: Viewer, opts: CameraOptions = {}) {
    this.viewer = viewer;
    this.reducedMotion = opts.reducedMotion ?? prefersReducedMotion();
    this.autoOrbitAfter = opts.autoOrbitAfter ?? 25;
    this.tuneNavigation();
    this.wireIdleOrbit();
  }

  /** Damped, weighty free navigation (mission §15 "smooth zoom, camera damping"). */
  private tuneNavigation(): void {
    const c = this.viewer.scene.screenSpaceCameraController;
    c.inertiaSpin = 0.9;
    c.inertiaTranslate = 0.9;
    c.inertiaZoom = 0.85;
    c.enableCollisionDetection = true;
    c.minimumZoomDistance = 120; // don't clip into the ground
    c.maximumZoomDistance = 6.0e7; // ~high orbit
  }

  // --- flight duration model ------------------------------------------------
  /** Duration scales with angular travel + altitude change, clamped to the motion spec. */
  private durationFor(dest: Cartesian3): number {
    if (this.reducedMotion) return 0;
    const cam = this.viewer.camera.positionWC;
    const surfaceArc = angularDistance(cam, dest) * (EARTH_CIRCUMFERENCE / (2 * Math.PI));
    const frac = Math.min(1, surfaceArc / (EARTH_CIRCUMFERENCE / 2));
    // 0.7 s (local) → 3.0 s (antipodal global), matching MOTION-SYSTEM.md.
    return 0.7 + frac * 2.3;
  }

  private easing(): EasingFunction.Callback {
    return EasingFunction.QUINTIC_IN_OUT;
  }

  // --- semantic verbs -------------------------------------------------------
  flyToLonLat(lon: number, lat: number, height: number, opts?: { pitch?: number; heading?: number }): void {
    this.cancelOrbit();
    const dest = Cartesian3.fromDegrees(lon, lat, height);
    this.viewer.camera.flyTo({
      destination: dest,
      orientation: {
        heading: opts?.heading ?? 0,
        pitch: opts?.pitch ?? CMath.toRadians(-90),
        roll: 0,
      },
      duration: this.durationFor(dest),
      easingFunction: this.easing(),
    });
  }

  /** Frame a point at an analytical tilt (used for events/infra/city focus). */
  flyToPoint(lon: number, lat: number, rangeMeters: number): void {
    this.cancelOrbit();
    const center = Cartesian3.fromDegrees(lon, lat, 0);
    this.viewer.camera.flyToBoundingSphere(boundingSphere(center, rangeMeters * 0.5), {
      offset: new HeadingPitchRange(0, SETTLE_PITCH, rangeMeters),
      duration: this.durationFor(center),
      easingFunction: this.easing(),
    });
  }

  flyToCountry(lon: number, lat: number): void {
    this.flyToLonLat(lon, lat, 2_500_000, { pitch: CMath.toRadians(-90) });
  }
  flyToEvent(lon: number, lat: number): void {
    this.flyToPoint(lon, lat, 350_000);
  }
  flyToAircraft(lon: number, lat: number, altM: number): void {
    this.flyToPoint(lon, lat, Math.max(80_000, altM * 12));
  }
  flyToVessel(lon: number, lat: number): void {
    this.flyToPoint(lon, lat, 120_000);
  }
  flyToSatellite(lon: number, lat: number, altM: number): void {
    this.flyToPoint(lon, lat, Math.max(altM * 1.5, 1_500_000));
  }
  flyToInfrastructure(lon: number, lat: number): void {
    this.flyToPoint(lon, lat, 60_000);
  }

  /** Global reset — pull back to a full-disc orbital view. */
  home(lon = 10, lat = 25): void {
    this.flyToLonLat(lon, lat, 2.4e7, { pitch: CMath.toRadians(-90) });
  }

  /** De-cluster: zoom toward a screen point on the ellipsoid (replaces old helper). */
  zoomTowardCursor(carto: Cartographic): void {
    this.cancelOrbit();
    const height = this.viewer.camera.positionCartographic.height;
    const dest = Cartesian3.fromRadians(carto.longitude, carto.latitude, Math.max(height * 0.4, 250_000));
    this.viewer.camera.flyTo({
      destination: dest,
      duration: this.reducedMotion ? 0 : 0.8,
      easingFunction: this.easing(),
    });
  }

  // --- idle auto-orbit ------------------------------------------------------
  private wireIdleOrbit(): void {
    if (this.autoOrbitAfter <= 0 || this.reducedMotion) return;
    const scene = this.viewer.scene;
    const mark = () => { this.lastInteraction = nowSec(); this.cancelOrbit(); };
    for (const ev of [scene.camera.moveStart] as const) {
      ev.addEventListener(mark);
      this.removeInteraction.push(() => ev.removeEventListener(mark));
    }
    // Pointer/keyboard also count as interaction.
    const canvas = scene.canvas;
    const onInput = () => { this.lastInteraction = nowSec(); this.cancelOrbit(); };
    canvas.addEventListener("pointerdown", onInput);
    canvas.addEventListener("wheel", onInput, { passive: true });
    window.addEventListener("keydown", onInput);
    this.removeInteraction.push(() => canvas.removeEventListener("pointerdown", onInput));
    this.removeInteraction.push(() => canvas.removeEventListener("wheel", onInput));
    this.removeInteraction.push(() => window.removeEventListener("keydown", onInput));

    this.lastInteraction = nowSec();
    const onTick = () => {
      if (this.disposed) return;
      const idle = nowSec() - this.lastInteraction;
      if (idle > this.autoOrbitAfter) this.orbiting = true;
      // Never auto-orbit while following a tracked entity — Cesium owns the
      // camera then, and rotating it fights the follow (§19).
      if (this.orbiting && !this.tracking) {
        // Gentle rotation about the globe — ~1 revolution / 120 s.
        this.viewer.camera.rotate(Cartesian3.UNIT_Z, -CMath.toRadians(0.05));
      }
    };
    scene.postRender.addEventListener(onTick);
    this.removeTick = () => scene.postRender.removeEventListener(onTick);
  }

  private cancelOrbit(): void {
    this.orbiting = false;
  }

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
    if (v) this.cancelOrbit();
  }

  /** Suspend idle auto-orbit while a selection is being followed (§19). */
  setTracking(v: boolean): void {
    this.tracking = v;
    this.lastInteraction = nowSec();
    if (v) this.cancelOrbit();
  }

  dispose(): void {
    this.disposed = true;
    this.removeTick?.();
    for (const off of this.removeInteraction) off();
    this.removeInteraction = [];
  }
}

// --- helpers ----------------------------------------------------------------
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}
function nowSec(): number {
  return (typeof performance !== "undefined" ? performance.now() : 0) / 1000;
}
function angularDistance(a: Cartesian3, b: Cartesian3): number {
  const na = Cartesian3.normalize(a, new Cartesian3());
  const nb = Cartesian3.normalize(b, new Cartesian3());
  const dot = CMath.clamp(Cartesian3.dot(na, nb), -1, 1);
  return Math.acos(dot);
}
function boundingSphere(center: Cartesian3, radius: number): BoundingSphere {
  return new BoundingSphere(center, radius);
}
