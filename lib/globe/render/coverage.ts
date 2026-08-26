/**
 * Satellite sensor-coverage cone (mission §53 — 3D space vocabulary).
 *
 * A translucent 3D cone hung under the selected satellite: apex at the craft,
 * base a circular footprint on the surface directly below. It follows the live
 * (smoothed) satellite position by sharing its position property, so it tracks
 * the marker exactly as the orbit advances.
 *
 * Geometry is a Cesium `cylinder` with `topRadius = 0` (→ cone) whose axis is
 * the local up vector (the default ENU orientation), sized each frame from the
 * craft's real altitude and a fixed sensor half-angle. This is genuine 3D
 * geometry — it occludes and parallaxes correctly against the globe, unlike a
 * flat billboard.
 */
import {
  CallbackPositionProperty,
  CallbackProperty,
  Cartesian3,
  Cartographic,
  Color,
  CustomDataSource,
  Math as CMath,
  type Entity,
  type Viewer,
} from "cesium";

/** Sensor half-angle from nadir; 45° gives a footprint radius ≈ altitude. */
const HALF_ANGLE_DEG = 45;

export class CoverageCone {
  private viewer: Viewer;
  private ds: CustomDataSource;
  private mounted = false;
  private cone?: Entity;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.ds = new CustomDataSource("coverage-cone");
  }

  private mount(): void {
    if (this.mounted) return;
    this.viewer.dataSources.add(this.ds);
    this.mounted = true;
  }

  /** Attach a coverage cone that follows `entity` (a live satellite marker). */
  follow(entity: Entity, color: Color): void {
    this.mount();
    this.clear();
    const tan = Math.tan(CMath.toRadians(HALF_ANGLE_DEG));

    const altAt = (): number => {
      const p = entity.position?.getValue(this.viewer.clock.currentTime);
      if (!p) return 0;
      const c = Cartographic.fromCartesian(p);
      return c ? c.height : 0;
    };

    // Cone is centred at half altitude so its apex sits at the craft and its
    // base rests on the surface below.
    const position = new CallbackPositionProperty(() => {
      const p = entity.position?.getValue(this.viewer.clock.currentTime);
      if (!p) return undefined;
      const c = Cartographic.fromCartesian(p);
      if (!c) return undefined;
      return Cartesian3.fromRadians(c.longitude, c.latitude, c.height / 2);
    }, false);

    this.cone = this.ds.entities.add({
      position,
      cylinder: {
        length: new CallbackProperty(() => Math.max(1, altAt()), false),
        topRadius: 0,
        bottomRadius: new CallbackProperty(() => Math.max(1, altAt() * tan), false),
        material: color.withAlpha(0.07),
        outline: true,
        outlineColor: color.withAlpha(0.35),
        numberOfVerticalLines: 4,
        slices: 48,
      },
    });
  }

  private clear(): void {
    this.ds.entities.removeAll();
    this.cone = undefined;
  }

  hide(): void {
    this.clear();
  }

  dispose(): void {
    this.clear();
    if (this.mounted && !this.viewer.isDestroyed()) {
      this.viewer.dataSources.remove(this.ds, true);
    }
    this.mounted = false;
  }
}
