/**
 * Selected-satellite orbit trail + ground track (mission §50 §52).
 *
 * When a satellite is selected we draw its analytic orbit from SGP4: the past
 * arc (faded) and the future arc (bright) over ±½ orbital period, plus the
 * sub-satellite ground track clamped to the surface. Recomputed at 1 Hz so the
 * arcs slide with real time. Deterministic (no external data), which makes it a
 * reliable regression signal.
 *
 * Orbit polylines use `ArcType.NONE` — the vertices are true ECEF positions in
 * space, so straight segments between them are correct (a geodesic would wrongly
 * pull them to the ellipsoid). The ground track uses geodesic + clamp-to-ground.
 */
import {
  ArcType,
  Cartesian3,
  Color,
  CustomDataSource,
  PolylineDashMaterialProperty,
  type Viewer,
} from "cesium";
import type { SatelliteRow } from "@/stores/app-store";
import { satColor } from "./layers";

type Sgp4 = Awaited<ReturnType<typeof import("@/lib/sgp4-client").loadSgp4>>;
type SatRec = ReturnType<Sgp4["twoline2satrec"]>;

const SAMPLES_PER_SIDE = 128;

export interface OrbitSample {
  past: { lon: number; lat: number; alt: number }[];
  future: { lon: number; lat: number; alt: number }[];
  ground: { lon: number; lat: number; alt: number }[];
}

/** Orbital period (seconds) from a satrec's mean motion, with fallbacks. */
export function periodSeconds(rec: SatRec, periodMin?: number | null): number {
  if (periodMin != null && periodMin > 0) return periodMin * 60;
  const noRadMin = (rec as unknown as { no?: number }).no;
  return noRadMin && noRadMin > 0 ? (2 * Math.PI / noRadMin) * 60 : 95 * 60;
}

/**
 * Sample the geodetic orbit ±½ period around `nowMs` (pure, deterministic — the
 * unit-tested core). `past` covers [-½P, 0], `future` [0, +½P]; `ground` is the
 * full sub-satellite track. Points that fail to propagate are skipped.
 */
export function sampleOrbitGeodetic(sat: Sgp4, rec: SatRec, periodSec: number, nowMs: number, samplesPerSide = SAMPLES_PER_SIDE): OrbitSample {
  const step = periodSec / samplesPerSide; // seconds
  const past: OrbitSample["past"] = [];
  const future: OrbitSample["future"] = [];
  const ground: OrbitSample["ground"] = [];
  for (let i = -samplesPerSide; i <= samplesPerSide; i++) {
    const date = new Date(nowMs + i * step * 1000);
    const pv = sat.propagate(rec, date);
    if (!pv || typeof pv.position === "boolean" || !pv.position) continue;
    const geo = sat.eciToGeodetic(pv.position, sat.gstime(date));
    const lon = sat.degreesLong(geo.longitude);
    const lat = sat.degreesLat(geo.latitude);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const p = { lon, lat, alt: geo.height * 1000 };
    if (i <= 0) past.push(p);
    if (i >= 0) future.push(p);
    ground.push(p);
  }
  return { past, future, ground };
}

export class OrbitTrail {
  private viewer: Viewer;
  private sat: Sgp4;
  private ds: CustomDataSource;
  private rec: SatRec | null = null;
  private periodSec = 95 * 60;
  private color = Color.WHITE;
  private currentId: string | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private mounted = false;

  constructor(viewer: Viewer, sat: Sgp4) {
    this.viewer = viewer;
    this.sat = sat;
    this.ds = new CustomDataSource("orbit-trail");
  }

  private mount(): void {
    if (this.mounted) return;
    this.viewer.dataSources.add(this.ds);
    this.mounted = true;
  }

  /** Show (or switch to) the orbit of the given satellite. */
  show(row: SatelliteRow): void {
    if (!row.tle1 || !row.tle2) { this.hide(); return; }
    if (this.currentId === row.id) return; // already showing
    let rec: SatRec | null = null;
    try {
      const r = this.sat.twoline2satrec(row.tle1, row.tle2);
      rec = r.error ? null : r;
    } catch { rec = null; }
    if (!rec) { this.hide(); return; }

    this.rec = rec;
    this.currentId = row.id;
    this.periodSec = periodSeconds(rec, row.periodMin);
    this.color = satColor(row.periodMin ?? null);

    this.mount();
    this.recompute();
    if (!this.timer) this.timer = setInterval(() => this.recompute(), 1000);
  }

  /**
   * Resample the arcs around "now" and rebuild the three polylines. Rebuilding
   * (rather than mutating strictly-typed graphics properties) is trivially cheap
   * for a single satellite at 1 Hz and keeps the code type-clean.
   */
  private recompute(): void {
    if (!this.rec) return;
    const { past, future, ground } = sampleOrbitGeodetic(this.sat, this.rec, this.periodSec, Date.now(), SAMPLES_PER_SIDE);
    const pastPos = past.map((g) => Cartesian3.fromDegrees(g.lon, g.lat, g.alt));
    const futurePos = future.map((g) => Cartesian3.fromDegrees(g.lon, g.lat, g.alt));
    const groundPos = ground.map((g) => Cartesian3.fromDegrees(g.lon, g.lat, 0));

    this.ds.entities.removeAll();
    // Past arc — faded; future arc — bright; both straight ECEF segments (space).
    this.ds.entities.add({ polyline: { positions: pastPos, width: 1.5, arcType: ArcType.NONE, material: this.color.withAlpha(0.28) } });
    this.ds.entities.add({ polyline: { positions: futurePos, width: 2, arcType: ArcType.NONE, material: this.color.withAlpha(0.9) } });
    // Ground track — dashed, clamped to the surface.
    this.ds.entities.add({
      polyline: {
        positions: groundPos,
        width: 1,
        clampToGround: true,
        arcType: ArcType.GEODESIC,
        material: new PolylineDashMaterialProperty({ color: this.color.withAlpha(0.5) }),
      },
    });
  }

  hide(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
    this.ds.entities.removeAll();
    this.rec = null;
    this.currentId = null;
  }

  dispose(): void {
    this.hide();
    if (this.mounted) this.viewer.dataSources.remove(this.ds, true);
    this.mounted = false;
  }
}
