/**
 * Concrete moving-entity render managers (mission §20 §21 §25 §50 §51 §112).
 *
 * Each returns a configured `MovingLayer` that preserves entity identity across
 * polls and produces smooth, honest motion:
 *  - aircraft & vessels dead-reckon from the last ADS-B/AIS observation,
 *  - satellites propagate via SGP4 (throttled + eased), positions computed not
 *    stored (mission §51).
 */
import {
  Color,
  ConstantProperty,
  Math as CMath,
  NearFarScalar,
  VerticalOrigin,
  type Entity,
  type Viewer,
} from "cesium";
import type { Selection, SatelliteRow, VesselRow } from "@/stores/app-store";
import type { AircraftState } from "@/types/domain";
import { LAYER_BY_ID } from "@/lib/config/layers";
import { MovingLayer, deadReckon, secondsSince } from "./motion";

type SelMap = WeakMap<Entity, NonNullable<Selection>>;
const KN_TO_MS = 0.514444;

/**
 * Depth-test near-bubble for data markers (mission §65 §66). Inside this camera
 * distance the depth test is skipped so close-up markers never clip into the
 * ground; beyond it the marker is depth-tested against the globe/tiles, so
 * markers on the far hemisphere are correctly hidden instead of bleeding through
 * a "transparent" planet. Pairs with `globe.depthTestAgainstTerrain = true`.
 */
export const DEPTH_TEST_DISABLE_M = 50_000;

/** Colour satellites by orbit regime (from period in minutes). */
export function satColor(periodMin: number | null): Color {
  if (periodMin == null) return Color.fromCssColorString("#c0c8d4");
  if (periodMin < 128) return Color.fromCssColorString("#65f6c7"); // LEO
  if (periodMin < 800) return Color.fromCssColorString("#54c7ff"); // MEO
  return Color.fromCssColorString("#ffd166"); // GEO / HEO
}

// --- aircraft ---------------------------------------------------------------
export function createAircraftLayer(viewer: Viewer, sel: SelMap, sprite: HTMLCanvasElement): MovingLayer<AircraftState> {
  return new MovingLayer<AircraftState>(viewer, sel, {
    name: "aircraft",
    snapThresholdM: 80_000,
    smoothingTau: 0.5,
    sample: (a) => {
      const elapsed = secondsSince(a.lastContact);
      const p = deadReckon(a.position.lon, a.position.lat, a.headingDeg, a.velocityMs, elapsed, 30);
      return { lon: p.lon, lat: p.lat, alt: a.position.alt ?? 9000, headingDeg: a.headingDeg };
    },
    build: () => ({
      billboard: {
        image: sprite,
        scale: 0.9,
        rotation: 0,
        verticalOrigin: VerticalOrigin.CENTER,
        scaleByDistance: new NearFarScalar(1.0e6, 1.2, 1.5e7, 0.55),
        disableDepthTestDistance: DEPTH_TEST_DISABLE_M,
      },
    }),
    onUpdate: (ent, _a, s) => {
      if (ent.billboard && s.headingDeg != null) {
        ent.billboard.rotation = new ConstantProperty(-CMath.toRadians(s.headingDeg));
      }
    },
    selection: (a) => ({ kind: "aircraft", id: a.id }),
  });
}

// --- vessels ----------------------------------------------------------------
export function createVesselLayer(viewer: Viewer, sel: SelMap): MovingLayer<VesselRow> {
  const color = Color.fromCssColorString(LAYER_BY_ID.maritime.color).withAlpha(0.95);
  return new MovingLayer<VesselRow>(viewer, sel, {
    name: "vessels",
    snapThresholdM: 40_000,
    smoothingTau: 0.8,
    sample: (v) => {
      const elapsed = secondsSince(v.lastContact);
      const speedMs = v.speedKn != null ? v.speedKn * KN_TO_MS : undefined;
      const p = deadReckon(v.lon, v.lat, v.courseDeg ?? undefined, speedMs, elapsed, 180);
      return { lon: p.lon, lat: p.lat, alt: 0, headingDeg: v.courseDeg ?? undefined };
    },
    build: () => ({
      point: {
        pixelSize: 7,
        color,
        outlineColor: Color.BLACK.withAlpha(0.35),
        outlineWidth: 1,
        scaleByDistance: new NearFarScalar(2.0e6, 1.1, 2.0e7, 0.5),
        disableDepthTestDistance: DEPTH_TEST_DISABLE_M,
      },
    }),
    selection: (v) => ({ kind: "vessel", id: v.id }),
  });
}

// --- satellites (SGP4) ------------------------------------------------------
type Sgp4 = Awaited<ReturnType<typeof import("@/lib/sgp4-client").loadSgp4>>;
type SatRec = ReturnType<Sgp4["twoline2satrec"]>;

export function createSatelliteLayer(viewer: Viewer, sel: SelMap, sat: Sgp4): MovingLayer<SatelliteRow> {
  // Per-satellite SGP4 record + throttled propagation cache (recompute ≤ 4 Hz;
  // the render layer's easing interpolates between propagations).
  const recs = new Map<string, SatRec | null>();
  const cache = new Map<string, { at: number; lon: number; lat: number; alt: number } | null>();

  const recFor = (s: SatelliteRow): SatRec | null => {
    if (recs.has(s.id)) return recs.get(s.id)!;
    let rec: SatRec | null = null;
    if (s.tle1 && s.tle2) {
      try {
        const r = sat.twoline2satrec(s.tle1, s.tle2);
        rec = r.error ? null : r;
      } catch { rec = null; }
    }
    recs.set(s.id, rec);
    return rec;
  };

  return new MovingLayer<SatelliteRow>(viewer, sel, {
    name: "satellites",
    snapThresholdM: 500_000,
    smoothingTau: 0.35,
    sample: (s, now) => {
      const cached = cache.get(s.id);
      if (cached && now - cached.at < 250) return { lon: cached.lon, lat: cached.lat, alt: cached.alt };
      const rec = recFor(s);
      if (!rec) return null;
      const date = new Date(now);
      const pv = sat.propagate(rec, date);
      if (!pv || typeof pv.position === "boolean" || !pv.position) return null;
      const gmst = sat.gstime(date);
      const geo = sat.eciToGeodetic(pv.position, gmst);
      const lon = sat.degreesLong(geo.longitude);
      const lat = sat.degreesLat(geo.latitude);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      const out = { at: now, lon, lat, alt: geo.height * 1000 };
      cache.set(s.id, out);
      return { lon, lat, alt: out.alt };
    },
    build: (s) => ({
      point: {
        pixelSize: 3.5,
        color: satColor(s.periodMin ?? null),
        outlineColor: Color.BLACK.withAlpha(0.4),
        outlineWidth: 1,
        scaleByDistance: new NearFarScalar(2.0e6, 1.4, 6.0e7, 0.5),
        disableDepthTestDistance: DEPTH_TEST_DISABLE_M,
      },
    }),
    selection: (s) => ({ kind: "satellite", id: s.id }),
  });
}
