/**
 * Level-of-detail + declutter engine (mission §14 §64 §104 §106 · audit W3).
 *
 * The globe used to render every row of every enabled layer at every altitude —
 * fine ground stipple (weather temperatures, local news pins) turned into visual
 * noise the moment you pulled back to see a continent, and nothing bounded the
 * number of on-screen labels. This engine closes that gap with two policies,
 * both driven purely by the camera height above the surface:
 *
 *  1. **Altitude bands** (`bandForHeight`) — a coarse zoom class, matching the
 *     design in `docs/globe/LOD.md`. Fine layers reveal as you descend.
 *  2. **Layer visibility** (`layerVisibleAt`) — a per-layer camera-height window.
 *     Fine ground layers (weather, news) hide from orbit where they read as
 *     noise; aggregates, borders, satellites and major events stay.
 *  3. **Label budget** (`pickLabelBudget`) — a hard ceiling (from the active
 *     quality preset's `maxLabels`) on simultaneously visible labels, keeping the
 *     nearest-to-camera ones and hiding the rest so labels never pile up.
 *
 * The pure functions below carry the policy and are unit-tested in isolation;
 * `LodController` is the thin imperative shell that samples the camera off the
 * render loop and applies them to the live datasources.
 */
import {
  Cartesian3,
  Cartographic,
  ConstantProperty,
  type DataSource,
  type Viewer,
} from "cesium";

/** Coarse zoom class, from far (orbit) to near (city). Matches `docs/globe/LOD.md`. */
export type LodBand = "orbit" | "continent" | "country" | "regional" | "city";

/** Every domain layer the engine can gate. */
export type LodLayerKind =
  | "aircraft"
  | "vessels"
  | "satellites"
  | "events"
  | "conflict"
  | "news"
  | "weather"
  | "countries";

/** Ordered band ceilings (camera height in metres). First match wins, top→down. */
export const LOD_BANDS: { band: LodBand; below: number }[] = [
  { band: "city", below: 60_000 },
  { band: "regional", below: 400_000 },
  { band: "country", below: 2_000_000 },
  { band: "continent", below: 8_000_000 },
  { band: "orbit", below: Infinity },
];

/**
 * Per-layer camera-height window (metres) in which the layer's markers show.
 * `maxHeight` hides a fine layer once you pull back past it; `minHeight` would
 * hide a coarse aggregate once you dive in (none needed yet). Layers absent from
 * the table are always visible.
 *
 * Only the genuinely fine ground layers are gated — weather and news pins are
 * noise from orbit — so the declutter is useful without hiding anything a user
 * would expect to keep (borders, satellites, quakes, clustered traffic).
 */
export const LOD_POLICY: Partial<Record<LodLayerKind, { minHeight?: number; maxHeight?: number }>> = {
  weather: { maxHeight: 8_000_000 }, // hide above the CONTINENT band
  news: { maxHeight: 8_000_000 },
};

/** Classify a camera height (metres above the surface) into a zoom band. */
export function bandForHeight(heightM: number): LodBand {
  const h = Number.isFinite(heightM) ? heightM : Infinity;
  for (const { band, below } of LOD_BANDS) if (h < below) return band;
  return "orbit";
}

/** Should this layer's markers be visible at the given camera height? */
export function layerVisibleAt(kind: LodLayerKind, heightM: number): boolean {
  const p = LOD_POLICY[kind];
  if (!p) return true;
  const h = Number.isFinite(heightM) ? heightM : Infinity;
  if (p.maxHeight != null && h > p.maxHeight) return false;
  if (p.minHeight != null && h < p.minHeight) return false;
  return true;
}

/**
 * Choose which labels stay visible under a budget: the `max` nearest to the
 * camera. Pure and deterministic — ties broken by id so the set never flickers.
 * `max <= 0` hides all; `items.length <= max` shows all.
 */
export function pickLabelBudget(items: { id: string; distance: number }[], max: number): Set<string> {
  if (max <= 0) return new Set();
  if (items.length <= max) return new Set(items.map((i) => i.id));
  const ranked = [...items].sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
  return new Set(ranked.slice(0, max).map((i) => i.id));
}

/**
 * Imperative shell: samples the camera off the render loop (throttled) and
 * applies the pure policies to every registered datasource. One instance per
 * viewer, owned by the Globe bootstrap alongside the other managers.
 */
export class LodController {
  private viewer: Viewer;
  private targets = new Map<DataSource, LodLayerKind>();
  private maxLabels = 80;
  private band: LodBand = "orbit";
  private height = Infinity;
  private removePostRender?: () => void;
  private lastSample = 0;
  private listeners = new Set<(band: LodBand) => void>();
  private scratch = new Cartesian3();

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  start(): void {
    const scene = this.viewer.scene;
    const now = () => (typeof performance !== "undefined" ? performance.now() : 0);
    const onPostRender = () => {
      const t = now();
      if (t - this.lastSample < 150) return; // ~6 Hz is plenty for LOD
      this.lastSample = t;
      this.refresh();
    };
    scene.postRender.addEventListener(onPostRender);
    this.removePostRender = () => scene.postRender.removeEventListener(onPostRender);
    this.refresh();
  }

  /** Register a datasource under a layer kind; applies the current policy at once. */
  register(kind: LodLayerKind, ds: DataSource): () => void {
    this.targets.set(ds, kind);
    this.applyTo(ds, kind);
    return () => this.unregister(ds);
  }

  unregister(ds: DataSource): void {
    this.targets.delete(ds);
  }

  /** Update the label ceiling (from the active quality preset) and re-apply. */
  setMaxLabels(n: number): void {
    if (n === this.maxLabels) return;
    this.maxLabels = n;
    this.refresh();
  }

  getBand(): LodBand {
    return this.band;
  }

  getHeight(): number {
    return this.height;
  }

  /** Subscribe to band changes; fires immediately with the current band. */
  subscribe(fn: (band: LodBand) => void): () => void {
    this.listeners.add(fn);
    fn(this.band);
    return () => this.listeners.delete(fn);
  }

  private refresh(): void {
    const cam = this.viewer.scene.camera;
    const carto = Cartographic.fromCartesian(cam.positionWC, this.viewer.scene.globe.ellipsoid);
    this.height = carto ? carto.height : Infinity;
    const band = bandForHeight(this.height);
    const changed = band !== this.band;
    this.band = band;
    for (const [ds, kind] of this.targets) this.applyTo(ds, kind);
    if (changed) for (const fn of this.listeners) fn(band);
  }

  private applyTo(ds: DataSource, kind: LodLayerKind): void {
    const visible = layerVisibleAt(kind, this.height);
    if (ds.show !== visible) ds.show = visible;
    // Only weather carries per-entity labels today; budget them by distance.
    if (visible && kind === "weather") this.applyLabelBudget(ds);
  }

  private applyLabelBudget(ds: DataSource): void {
    const camPos = this.viewer.scene.camera.positionWC;
    const time = this.viewer.clock.currentTime;
    const labelled: { id: string; distance: number; ent: DataSource["entities"]["values"][number] }[] = [];
    for (const ent of ds.entities.values) {
      if (!ent.label) continue;
      const pos = ent.position?.getValue(time, this.scratch);
      labelled.push({ id: ent.id, distance: pos ? Cartesian3.distance(camPos, pos) : Infinity, ent });
    }
    if (labelled.length === 0) return;
    const shown = pickLabelBudget(labelled, this.maxLabels);
    for (const { id, ent } of labelled) {
      if (!ent.label) continue;
      const on = shown.has(id);
      const cur = ent.label.show?.getValue(time);
      if (cur !== on) ent.label.show = new ConstantProperty(on);
    }
  }

  dispose(): void {
    this.removePostRender?.();
    this.targets.clear();
    this.listeners.clear();
  }
}
