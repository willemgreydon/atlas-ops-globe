/**
 * Moving-entity render layer (mission §21 §109 §111 §112).
 *
 * The engine's answer to the #1 audit weakness: instead of tearing down and
 * rebuilding a datasource on every feed poll (which teleports entities), a
 * `MovingLayer` keeps a persistent `CustomDataSource` and **diffs** incoming
 * rows against live tracks by id — updating positions in place, adding new
 * entities, removing gone ones. Object identity is preserved across polls.
 *
 * Motion is produced two ways, honestly:
 *  - a `sample(row, nowMs)` function returns where the entity *should* be now
 *    (dead-reckoned from the last observation for ADS-B/AIS, SGP4 for sats),
 *  - a per-frame `CallbackProperty` eases the *rendered* position toward that
 *    target with a frame-rate-independent time constant, so a corrected
 *    observation glides in rather than snapping (no invented trajectory beyond
 *    the reckoning window — mission §21).
 */
import {
  CallbackPositionProperty,
  CallbackProperty,
  Cartesian3,
  CustomDataSource,
  Math as CMath,
  Quaternion,
  type Entity,
  type Viewer,
} from "cesium";
import type { Selection } from "@/stores/app-store";

export interface Sample {
  lon: number;
  lat: number;
  alt: number;
  /** Heading in degrees, if the graphics should orient to travel. */
  headingDeg?: number;
}

interface Track<T> {
  entity: Entity;
  row: T;
  /** Smoothed rendered position (world), eased toward the sampled target. */
  render: Cartesian3;
  /** Reused target scratch — the eased-toward point, recomputed each frame. */
  target: Cartesian3;
  /** Last sample + when it was taken, so position & orientation share one call. */
  sample: Sample | null;
  sampleAt: number;
  lastFrameMs: number;
  primed: boolean;
}

export interface MovingLayerOptions<T extends { id: string }> {
  name: string;
  /**
   * Graphics options for a new entity (billboard/point/model). Returned as a
   * plain options object so Cesium's `entities.add` converts it to Graphics.
   */
  build: (row: T) => Entity.ConstructorOptions;
  /** Where should this row be at wall-clock `nowMs`? Null → skip/park. */
  sample: (row: T, nowMs: number) => Sample | null;
  /** Domain selection for click picking. */
  selection: (row: T) => NonNullable<Selection>;
  /** Optional: update graphics when a new observation arrives (e.g. rotation). */
  onUpdate?: (entity: Entity, row: T, sample: Sample) => void;
  /**
   * Optional per-frame model orientation, driven by the smoothed render
   * position and the latest heading. When set, the entity gets an `orientation`
   * property so a glTF model stands correctly on the globe (mission §85). Must
   * write into and return `result` (a per-track scratch quaternion).
   */
  orient?: (position: Cartesian3, row: T, headingDeg: number | undefined, result: Quaternion) => Quaternion;
  /**
   * Camera distance (m) beyond which the model is distance-culled, so the
   * orientation callback can skip the quaternion recompute and return the last
   * value (mission §85). Cheap distance check replaces the full ENU solve for
   * the thousands of entities whose model isn't currently drawn.
   */
  orientMaxDistanceM?: number;
  /** Snap (don't ease) if a correction exceeds this many metres — stale data. */
  snapThresholdM?: number;
  /** Smoothing time constant in seconds (smaller = snappier). */
  smoothingTau?: number;
}

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class MovingLayer<T extends { id: string }> {
  readonly ds: CustomDataSource;
  private viewer: Viewer;
  private opts: Required<Pick<MovingLayerOptions<T>, "snapThresholdM" | "smoothingTau">> & MovingLayerOptions<T>;
  private tracks = new Map<string, Track<T>>();
  private selectionMap: WeakMap<Entity, NonNullable<Selection>>;
  private mounted = false;

  constructor(viewer: Viewer, selectionMap: WeakMap<Entity, NonNullable<Selection>>, opts: MovingLayerOptions<T>) {
    this.viewer = viewer;
    this.selectionMap = selectionMap;
    this.opts = { snapThresholdM: 60_000, smoothingTau: 0.4, ...opts };
    this.ds = new CustomDataSource(opts.name);
  }

  mount(): void {
    if (this.mounted) return;
    this.viewer.dataSources.add(this.ds);
    this.mounted = true;
  }

  /** Diff incoming rows against live tracks. Never rebuilds the datasource. */
  update(rows: T[]): void {
    const seen = new Set<string>();
    for (const row of rows) {
      seen.add(row.id);
      const existing = this.tracks.get(row.id);
      if (existing) {
        existing.row = row;
        const s = this.opts.sample(row, Date.now());
        if (s) this.opts.onUpdate?.(existing.entity, row, s);
      } else {
        this.add(row);
      }
    }
    // Remove tracks no longer present.
    for (const [id, track] of this.tracks) {
      if (!seen.has(id)) {
        this.ds.entities.remove(track.entity);
        this.selectionMap.delete(track.entity);
        this.tracks.delete(id);
      }
    }
  }

  private add(row: T): void {
    const initial = this.opts.sample(row, Date.now());
    const start = initial
      ? Cartesian3.fromDegrees(initial.lon, initial.lat, initial.alt)
      : Cartesian3.fromDegrees(0, 0, 0);
    const track: Track<T> = {
      entity: undefined as unknown as Entity,
      row,
      render: start.clone(),
      target: new Cartesian3(),
      sample: initial,
      sampleAt: nowMs(),
      lastFrameMs: nowMs(),
      primed: false,
    };

    const position = new CallbackPositionProperty(() => this.evaluate(track), false);
    const graphics = this.opts.build(row);
    const options: Entity.ConstructorOptions = { ...graphics, position };
    if (this.opts.orient) {
      const q = new Quaternion();
      const maxD = this.opts.orientMaxDistanceM;
      options.orientation = new CallbackProperty(() => {
        // Skip the ENU solve when the model is distance-culled — it isn't drawn.
        if (maxD !== undefined && Cartesian3.distance(this.viewer.camera.positionWC, track.render) > maxD) {
          return q;
        }
        const s = this.sampleNow(track);
        return this.opts.orient!(track.render, track.row, s?.headingDeg, q);
      }, false);
    }
    const entity = this.ds.entities.add(options);
    if (initial) this.opts.onUpdate?.(entity, row, initial);
    track.entity = entity;
    this.tracks.set(row.id, track);
    this.selectionMap.set(entity, this.opts.selection(row));
  }

  /**
   * Sample the track's target position at most once per rendered frame, shared
   * between the position and orientation callbacks (which Cesium evaluates
   * microseconds apart). Halves SGP4/dead-reckon work for entities that carry
   * both, and removes a per-entity, per-frame allocation.
   */
  private sampleNow(track: Track<T>): Sample | null {
    const t = nowMs();
    if (t - track.sampleAt < 8) return track.sample; // same frame → reuse
    track.sampleAt = t;
    track.sample = this.opts.sample(track.row, Date.now());
    return track.sample;
  }

  /** Per-frame position: ease `render` toward the freshly sampled target. */
  private evaluate(track: Track<T>): Cartesian3 {
    const s = this.sampleNow(track);
    if (!s) return track.render;
    const target = Cartesian3.fromDegrees(s.lon, s.lat, s.alt, undefined, track.target);
    const t = nowMs();
    const dt = Math.min(0.25, Math.max(0, (t - track.lastFrameMs) / 1000));
    track.lastFrameMs = t;

    if (!track.primed) {
      track.primed = true;
      Cartesian3.clone(target, track.render);
      return track.render;
    }
    // Snap on large corrections (stale/relocated) to avoid slow cross-globe drift.
    if (Cartesian3.distance(track.render, target) > this.opts.snapThresholdM) {
      Cartesian3.clone(target, track.render);
      return track.render;
    }
    // Frame-rate-independent exponential smoothing.
    const k = 1 - Math.exp(-dt / this.opts.smoothingTau);
    Cartesian3.lerp(track.render, target, k, track.render);
    return track.render;
  }

  get size(): number {
    return this.tracks.size;
  }

  /** The live entity for a row id — its `position` follows the smoothed motion. */
  getEntity(id: string): Entity | undefined {
    return this.tracks.get(id)?.entity;
  }

  dispose(): void {
    if (this.mounted) this.viewer.dataSources.remove(this.ds, true);
    for (const [, track] of this.tracks) this.selectionMap.delete(track.entity);
    this.tracks.clear();
    this.mounted = false;
  }
}

/**
 * Dead-reckon a lon/lat forward along a heading at a ground speed, for the
 * seconds elapsed since the last observation. Clamped to `maxSeconds` so we
 * never invent trajectory far beyond the data (mission §21). Equirectangular
 * step — accurate to metres over a poll interval.
 */
export function deadReckon(
  lon: number,
  lat: number,
  headingDeg: number | undefined,
  speedMs: number | undefined,
  elapsedSec: number,
  maxSeconds: number,
): { lon: number; lat: number } {
  if (headingDeg == null || speedMs == null || speedMs <= 0) return { lon, lat };
  const dt = Math.max(0, Math.min(elapsedSec, maxSeconds));
  if (dt === 0) return { lon, lat };
  const dist = speedMs * dt; // metres
  const hdg = CMath.toRadians(headingDeg);
  const dNorth = dist * Math.cos(hdg);
  const dEast = dist * Math.sin(hdg);
  const dLat = dNorth / 111_320;
  const dLon = dEast / (111_320 * Math.cos(CMath.toRadians(lat)) || 1);
  return { lon: lon + dLon, lat: lat + dLat };
}

/** Seconds between an ISO timestamp and now (0 if unparseable/future). */
export function secondsSince(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, (Date.now() - ms) / 1000);
}
