/**
 * Selection focus overlay (mission §61 §62).
 *
 * Draws a high-contrast halo + altitude stem that FOLLOW the selected entity
 * (by sharing its live position property), plus a one-shot radar pulse on
 * appear that expands and fades exactly once — never a continuous blink (§61).
 * Reduced-motion suppresses the pulse (§60). The halo is white so it reads
 * against any imagery background (§62).
 */
import {
  ArcType,
  CallbackProperty,
  Cartesian3,
  Cartographic,
  Color,
  ConstantPositionProperty,
  CustomDataSource,
  NearFarScalar,
  type PositionProperty,
  type Viewer,
} from "cesium";

const HALO_CSS = "#eaf2ff";
const STEM_CSS = "#8fd4ff";

function ringCanvas(cssColor: string, lineWidth = 2.5): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 48;
  const ctx = c.getContext("2d")!;
  const col = Color.fromCssColorString(cssColor);
  const rgb = `${Math.round(col.red * 255)},${Math.round(col.green * 255)},${Math.round(col.blue * 255)}`;
  ctx.beginPath();
  ctx.arc(24, 24, 18, 0, Math.PI * 2);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = `rgba(${rgb},0.95)`;
  ctx.shadowColor = `rgba(${rgb},0.9)`;
  ctx.shadowBlur = 6;
  ctx.stroke();
  return c;
}

export interface FocusOptions {
  stem?: boolean;
  reducedMotion?: boolean;
}

export class FocusOverlay {
  private viewer: Viewer;
  private ds: CustomDataSource;
  private mounted = false;
  private pulseTimer?: ReturnType<typeof setTimeout>;
  private halo = ringCanvas(HALO_CSS);
  private pulseRing = ringCanvas(HALO_CSS, 3);

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.ds = new CustomDataSource("focus-overlay");
  }

  private mount(): void {
    if (this.mounted) return;
    this.viewer.dataSources.add(this.ds);
    this.mounted = true;
  }

  /** Focus on a live position property (follows) or a fixed point. */
  showAt(position: PositionProperty | Cartesian3, opts: FocusOptions = {}): void {
    this.mount();
    this.clear();
    const posProp: PositionProperty = position instanceof Cartesian3 ? new ConstantPositionProperty(position) : position;

    // Steady halo — follows by sharing the entity's position property.
    this.ds.entities.add({
      position: posProp,
      billboard: {
        image: this.halo,
        scale: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new NearFarScalar(5.0e5, 1.1, 2.0e7, 0.55),
      },
    });

    // Altitude stem down to the surface, for aircraft/satellites (§62).
    if (opts.stem) {
      const positions = new CallbackProperty(() => {
        const p = posProp.getValue(this.viewer.clock.currentTime);
        if (!p) return [];
        const carto = Cartographic.fromCartesian(p);
        if (!carto) return [];
        return [p, Cartesian3.fromRadians(carto.longitude, carto.latitude, 0)];
      }, false);
      this.ds.entities.add({
        polyline: { positions, width: 1, arcType: ArcType.NONE, material: Color.fromCssColorString(STEM_CSS).withAlpha(0.5) },
      });
    }

    if (!opts.reducedMotion) this.pulse(posProp);
  }

  /** One radar pulse: expand + fade over ~750 ms, then remove itself (§61). */
  private pulse(posProp: PositionProperty): void {
    const start = typeof performance !== "undefined" ? performance.now() : 0;
    const DURATION = 750;
    const elapsed = () => ((typeof performance !== "undefined" ? performance.now() : 0) - start) / DURATION;
    const ent = this.ds.entities.add({
      position: posProp,
      billboard: {
        image: this.pulseRing,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scale: new CallbackProperty(() => { const e = elapsed(); return e >= 1 ? 0 : 1 + e * 2.6; }, false),
        color: new CallbackProperty(() => {
          const e = elapsed();
          return Color.WHITE.withAlpha(e >= 1 ? 0 : 0.6 * (1 - e));
        }, false),
      },
    });
    this.pulseTimer = setTimeout(() => { this.ds.entities.remove(ent); }, DURATION + 60);
  }

  clear(): void {
    if (this.pulseTimer) { clearTimeout(this.pulseTimer); this.pulseTimer = undefined; }
    this.ds.entities.removeAll();
  }

  hide(): void {
    this.clear();
  }

  dispose(): void {
    this.clear();
    if (this.mounted) this.viewer.dataSources.remove(this.ds, true);
    this.mounted = false;
  }
}
