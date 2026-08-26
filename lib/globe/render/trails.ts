/**
 * Live history trail (mission §22 §25 §77 — motion vocabulary).
 *
 * Draws a fading comet-trail behind a moving entity by sampling its *rendered*
 * (already-smoothed) position each frame into a rolling buffer, then drawing one
 * tapered, glowing polyline through it. Because it reads the same
 * `CallbackPositionProperty` the entity draws with, the trail is exactly the
 * path the viewer sees — never an invented one (mission §21).
 *
 * A new sample is only committed when the entity has travelled past a distance
 * gate, so a parked target doesn't pile points on one spot and a fast one keeps
 * a smooth line. The buffer is capped by the quality preset's `trailSamples`.
 * The head vertex is glued to the live position every frame so the trail never
 * lags the marker.
 */
import {
  CallbackProperty,
  Cartesian3,
  Color,
  CustomDataSource,
  PolylineGlowMaterialProperty,
  type Entity,
  type Viewer,
} from "cesium";

/** Per-selection appearance/behaviour, swapped on each `follow()`. */
export interface FollowOptions {
  color: Color;
  /** Commit a new sample only after moving this many metres. */
  minSampleMeters: number;
  width?: number;
}

export class EntityTrail {
  private viewer: Viewer;
  private ds: CustomDataSource;
  private mounted = false;
  private buffer: Cartesian3[] = [];
  private target?: Entity;
  private maxSamples: number;
  // Live per-follow state, read by the polyline's dynamic material each frame.
  private color = Color.WHITE;
  private width = 5;
  private minSampleMeters = 2000;
  private removeTick?: () => void;

  constructor(viewer: Viewer, opts: { maxSamples: number }) {
    this.viewer = viewer;
    this.maxSamples = opts.maxSamples;
    this.ds = new CustomDataSource("trail");
  }

  private mount(): void {
    if (this.mounted) return;
    this.viewer.dataSources.add(this.ds);
    this.mounted = true;
    // One polyline for the trail's life; positions + look read live state so a
    // new selection just swaps colour/width without rebuilding the entity.
    this.ds.entities.add({
      polyline: {
        positions: new CallbackProperty(() => this.buffer, false),
        width: new CallbackProperty(() => this.width, false),
        material: new PolylineGlowMaterialProperty({
          color: new CallbackProperty(() => this.color, false),
          glowPower: 0.22,
          taperPower: 0.5,
        }),
      },
    });
    const onTick = () => this.sample();
    this.viewer.scene.postRender.addEventListener(onTick);
    this.removeTick = () => this.viewer.scene.postRender.removeEventListener(onTick);
  }

  /** Begin trailing an entity with the given look (clears any previous path). */
  follow(entity: Entity, opts: FollowOptions): void {
    this.mount();
    this.target = entity;
    this.buffer = [];
    this.color = opts.color;
    this.minSampleMeters = opts.minSampleMeters;
    this.width = opts.width ?? 5;
  }

  /** Read the entity's current rendered position and extend the trail. */
  private sample(): void {
    const ent = this.target;
    if (!ent?.position) return;
    const p = ent.position.getValue(this.viewer.clock.currentTime);
    if (!p) return;
    if (this.buffer.length === 0) {
      this.buffer.push(p.clone());
      return;
    }
    // buffer[0] is the live head — keep it glued to the marker every frame.
    const head = this.buffer[0];
    if (Cartesian3.distance(head, p) >= this.minSampleMeters) {
      this.buffer.unshift(p.clone());
      if (this.buffer.length > this.maxSamples) this.buffer.pop();
    } else {
      Cartesian3.clone(p, head);
    }
  }

  hide(): void {
    this.target = undefined;
    this.buffer = [];
  }

  dispose(): void {
    this.removeTick?.();
    this.removeTick = undefined;
    if (this.mounted && !this.viewer.isDestroyed()) {
      this.viewer.dataSources.remove(this.ds, true);
    }
    this.mounted = false;
    this.buffer = [];
    this.target = undefined;
  }
}
