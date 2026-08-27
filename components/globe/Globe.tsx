"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArcType,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ConstantProperty,
  CustomDataSource,
  GeoJsonDataSource,
  Ion,
  Math as CMath,
  OpenStreetMapImageryProvider,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Entity as CesiumEntity,
  NearFarScalar,
  VerticalOrigin,
  HeightReference,
} from "cesium";
import { ImageryLayer, Viewer, type CesiumComponentRef } from "resium";
import type { Viewer as CesiumViewer } from "cesium";
import { loadSgp4 } from "@/lib/sgp4-client";
import { useApp, type SatelliteRow, type Selection, type VesselRow, type WeatherRow } from "@/stores/app-store";
import { LAYER_BY_ID } from "@/lib/config/layers";
import type { AircraftState, NewsItem, Severity, WorldEvent } from "@/types/domain";
import { configureScene } from "@/lib/globe/scene";
import { GlobePerformanceManager } from "@/lib/globe/performance";
import { GlobeCameraController } from "@/lib/globe/camera";
import { setGlobeRuntime } from "@/lib/globe/runtime";
import { LodController } from "@/lib/globe/lod";
import { QUALITY_PRESETS } from "@/lib/globe/quality";
import { MovingLayer } from "@/lib/globe/render/motion";
import { StaticLayer } from "@/lib/globe/render/static";
import { createAircraftLayer, createVesselLayer, createSatelliteLayer, satColor, DEPTH_TEST_DISABLE_M } from "@/lib/globe/render/layers";
import { OrbitTrail } from "@/lib/globe/render/orbits";
import { FocusOverlay } from "@/lib/globe/render/focus";
import { TerrainController } from "@/lib/globe/terrain";
import { CelestialEnvironment } from "@/lib/globe/render/celestial";
import { EffectsLayer } from "@/lib/globe/render/effects";
import { EntityTrail } from "@/lib/globe/render/trails";
import { CoverageCone } from "@/lib/globe/render/coverage";
import { setHover, type HoverInfo } from "@/lib/globe/hover";

type Sgp4 = Awaited<ReturnType<typeof loadSgp4>>;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

/** Current sub-satellite geodetic point from a TLE (for focus fly-to). */
function subSatellitePoint(sat: Sgp4, row: SatelliteRow): { lon: number; lat: number; alt: number } | null {
  if (!row.tle1 || !row.tle2) return null;
  try {
    const rec = sat.twoline2satrec(row.tle1, row.tle2);
    if (rec.error) return null;
    const date = new Date();
    const pv = sat.propagate(rec, date);
    if (!pv || typeof pv.position === "boolean" || !pv.position) return null;
    const geo = sat.eciToGeodetic(pv.position, sat.gstime(date));
    const lon = sat.degreesLong(geo.longitude);
    const lat = sat.degreesLat(geo.latitude);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    return { lon, lat, alt: geo.height * 1000 };
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  const g = window as typeof window & { CESIUM_BASE_URL?: string };
  g.CESIUM_BASE_URL ??= "/cesium/";
}

// One reusable arrow sprite for aircraft, rotated per-entity by heading.
function arrowCanvas(color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 18;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(9, 1);
  ctx.lineTo(16, 16);
  ctx.lineTo(9, 12);
  ctx.lineTo(2, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  return c;
}

function severityColor(sev: Severity): Color {
  switch (sev) {
    case "critical": return Color.fromCssColorString("#ff5a62");
    case "warning": return Color.fromCssColorString("#ffae45");
    case "watch": return Color.fromCssColorString("#54c7ff");
    default: return Color.fromCssColorString("#65f6c7");
  }
}

// Camera follow offsets in the entity's East-North-Up frame (x=E, y=N, z=up).
// Pulled back + tilted down so the object and its trail read clearly (§19).
const AIRCRAFT_VIEWFROM = new Cartesian3(0, -120_000, 280_000); // ~305 km, ~67° down
const VESSEL_VIEWFROM = new Cartesian3(0, -22_000, 52_000); // ~57 km, close inspection

/** Follow distance for a satellite scales with its altitude so LEO and GEO both frame well. */
function satelliteViewFrom(s: SatelliteRow | undefined, sat: Sgp4 | null): Cartesian3 {
  let alt = 700_000;
  if (s && sat && s.tle1 && s.tle2) {
    const g = subSatellitePoint(sat, s);
    if (g) alt = g.alt;
  }
  const dist = Math.min(6_000_000, Math.max(1_200_000, alt * 1.4));
  return new Cartesian3(0, -dist * 0.4, dist * 0.9);
}

export default function Globe() {
  const ref = useRef<CesiumComponentRef<CesiumViewer>>(null);
  const app = useApp();
  const imagery = useMemo(() => new OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }), []);
  const aircraftArrow = useMemo(() => (typeof document !== "undefined" ? arrowCanvas(LAYER_BY_ID.aircraft.color) : undefined), []);

  // The Cesium viewer is created asynchronously by Resium. Poll for it and flip
  // a `ready` flag so every effect (picking, layers) runs once it truly exists —
  // this is what makes the globe interactive. Effects read the live viewer from
  // the ref (not tracked state) so imperative Cesium mutations are allowed.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      const v = ref.current?.cesiumElement;
      if (v && !v.isDestroyed()) setReady(true);
      else raf = requestAnimationFrame(check);
    };
    check();
    return () => cancelAnimationFrame(raf);
  }, []);

  const selectRef = useRef(app.select);
  useEffect(() => { selectRef.current = app.select; }, [app.select]);

  // Imperative managers (mission §112 §113) — created once the viewer exists,
  // owned outside React state so the compiler never reconciles them per frame.
  const perfRef = useRef<GlobePerformanceManager | null>(null);
  const camRef = useRef<GlobeCameraController | null>(null);
  const focusRef = useRef<FocusOverlay | null>(null);
  const celestialRef = useRef<CelestialEnvironment | null>(null);
  const effectsRef = useRef<EffectsLayer | null>(null);
  const trailRef = useRef<EntityTrail | null>(null);
  const coneRef = useRef<CoverageCone | null>(null);
  const terrainRef = useRef<TerrainController | null>(null);
  const lodRef = useRef<LodController | null>(null);
  // Latest scene config, read by the create-once bootstrap without re-running it.
  const configRef = useRef({ quality: app.quality, atmosphere: app.atmosphere, lighting: app.lighting, autoQuality: app.autoQuality, environment: app.environment, terrain: app.terrain });
  useEffect(() => {
    configRef.current = { quality: app.quality, atmosphere: app.atmosphere, lighting: app.lighting, autoQuality: app.autoQuality, environment: app.environment, terrain: app.terrain };
  }, [app.quality, app.atmosphere, app.lighting, app.autoQuality, app.environment, app.terrain]);

  // --- engine bootstrap: scene, managers, runtime, picking ------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer) return;
    const cfg = configRef.current;

    // Premium providers (terrain/photorealistic) require an ion token; the app
    // works fully without one (mission §164). Set it if configured.
    if (process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN) Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;

    configureScene(viewer, { quality: cfg.quality, atmosphere: cfg.atmosphere, lighting: cfg.lighting });

    const camera = new GlobeCameraController(viewer);
    const performance = new GlobePerformanceManager(viewer, cfg.quality);
    performance.setAuto(cfg.autoQuality);
    performance.start();
    const focus = new FocusOverlay(viewer);
    // Cinematic environment + effect vocabulary (mission §8 §34 §22 §53).
    const celestial = new CelestialEnvironment(viewer);
    celestial.configure({ enabled: cfg.environment, quality: QUALITY_PRESETS[cfg.quality] });
    const effects = new EffectsLayer(viewer);
    const trail = new EntityTrail(viewer, { maxSamples: QUALITY_PRESETS[cfg.quality].trailSamples });
    const cone = new CoverageCone(viewer);
    // Premium surface (terrain / photorealistic 3D tiles), gated by an ion token.
    const terrain = new TerrainController(viewer);
    void terrain.apply(cfg.terrain);
    // LOD + declutter: altitude-driven layer visibility + label budget (§14 §64 §104).
    const lod = new LodController(viewer);
    lod.setMaxLabels(QUALITY_PRESETS[cfg.quality].maxLabels);
    lod.start();
    camRef.current = camera;
    perfRef.current = performance;
    focusRef.current = focus;
    celestialRef.current = celestial;
    effectsRef.current = effects;
    trailRef.current = trail;
    coneRef.current = cone;
    terrainRef.current = terrain;
    lodRef.current = lod;
    setGlobeRuntime({ viewer, performance, camera, lod });

    // Dev-only selection bridge for diagnostics / e2e probes (mission §117).
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __globeSelect?: (s: Selection) => void }).__globeSelect = (s) => selectRef.current(s);
    }

    const scene = viewer.scene;
    const handler = new ScreenSpaceEventHandler(scene.canvas);

    handler.setInputAction((m: { position: Cartesian2 }) => {
      const picked = scene.pick(m.position);
      // Single domain entity → select it and open the inspector.
      const entity: CesiumEntity | undefined = picked?.id instanceof CesiumEntity ? picked.id : undefined;
      if (entity) {
        const sel = selectionMap.get(entity);
        if (sel) { selectRef.current(sel); return; }
        const iso3 = entity.properties?.ISO_A3?.getValue?.();
        const name = entity.properties?.ADMIN?.getValue?.();
        if (iso3) { selectRef.current({ kind: "country", iso3, name }); return; }
      }
      // Tapped something that isn't a selectable object → release the current
      // selection. This is what keeps a selection "sticky" after the mobile
      // detail sheet is closed (closing the sheet never deselects) yet still lets
      // a tap "somewhere besides it" drop focus, per the expected behaviour.
      if (selectRef.current) selectRef.current(null);
      // A cluster or empty space → zoom toward the clicked point (de-cluster).
      // Uses the ellipsoid pick, never the cluster's entity array (which can be
      // huge and crash the render loop when enumerated).
      if (picked && !entity) {
        const carto = camera && ellipsoidPick(viewer, m.position);
        if (carto) camera.zoomTowardCursor(carto);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    // Hover: pointer cursor + identity tooltip over anything selectable (§63).
    handler.setInputAction((m: { endPosition: Cartesian2 }) => {
      const picked = scene.pick(m.endPosition);
      const hit = !!picked && (Array.isArray(picked.id) || picked.id instanceof CesiumEntity);
      scene.canvas.style.cursor = hit ? "pointer" : "default";
      setHover(hit ? buildHoverInfo(picked, m.endPosition.x, m.endPosition.y, feedsRef.current) : null);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      handler.destroy();
      setHover(null);
      setGlobeRuntime(null);
      performance.dispose();
      camera.dispose();
      focus.dispose();
      celestial.dispose();
      effects.dispose();
      trail.dispose();
      cone.dispose();
      terrain.dispose();
      lod.dispose();
      perfRef.current = null;
      camRef.current = null;
      focusRef.current = null;
      celestialRef.current = null;
      effectsRef.current = null;
      trailRef.current = null;
      coneRef.current = null;
      terrainRef.current = null;
      lodRef.current = null;
      if (process.env.NODE_ENV !== "production") {
        delete (window as unknown as { __globeSelect?: unknown }).__globeSelect;
      }
    };
  }, [ready]);

  // --- react to quality / atmosphere / lighting changes ---------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer) return;
    configureScene(viewer, { quality: app.quality, atmosphere: app.atmosphere, lighting: app.lighting });
    perfRef.current?.setCeiling(app.quality);
    perfRef.current?.setAuto(app.autoQuality);
    lodRef.current?.setMaxLabels(QUALITY_PRESETS[app.quality].maxLabels);
  }, [ready, app.quality, app.atmosphere, app.lighting, app.autoQuality]);

  // --- celestial environment (stars/sun/moon/bloom/lens flare) --------------
  // Runs after the scene effect above so it reads the HDR state that the
  // atmosphere preset just set, rather than fighting it (mission §8).
  useEffect(() => {
    const celestial = celestialRef.current;
    if (!ready || !celestial) return;
    celestial.configure({ enabled: app.environment, quality: QUALITY_PRESETS[app.quality] });
  }, [ready, app.environment, app.quality, app.atmosphere]);

  // --- surface mode: ellipsoid / world terrain / photorealistic tiles (§9) ---
  // Ion-gated; the controller no-ops to the ellipsoid without a token and owns
  // `depthTestAgainstTerrain`, so this never fights the scene configurator.
  useEffect(() => {
    const terrain = terrainRef.current;
    if (!ready || !terrain) return;
    void terrain.apply(app.terrain);
  }, [ready, app.terrain]);

  // --- disaster / alert shockwave ripples (effect registry) -----------------
  useEffect(() => {
    const fx = effectsRef.current;
    if (!ready || !fx) return;
    const rows: WorldEvent[] = [];
    if (app.effects) {
      if (app.layers.earthquakes || app.layers.naturalEvents) rows.push(...app.events.rows);
      if (app.layers.conflict) rows.push(...app.conflict.rows);
    }
    const q = QUALITY_PRESETS[app.quality];
    fx.update(rows, { max: q.maxParticleSystems === 0 ? 16 : 48, reducedMotion: prefersReducedMotion() });
  }, [ready, app.effects, app.layers.earthquakes, app.layers.naturalEvents, app.layers.conflict, app.events.rows, app.conflict.rows, app.quality]);

  // --- country borders layer ------------------------------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer) return;
    let ds: GeoJsonDataSource | undefined;
    let cancelled = false;
    if (app.layers.countries) {
      GeoJsonDataSource.load("/data/countries-110m.geojson", {
        stroke: Color.fromCssColorString("#8aa0b6").withAlpha(0.55),
        fill: Color.fromCssColorString("#8aa0b6").withAlpha(0.04),
        strokeWidth: 1,
      }).then((loaded) => {
        if (cancelled) return;
        // Harden against a Cesium tessellation overflow: the 110m country
        // polygons carry long, near-antipodal edges (Antarctica, Russia) that
        // make `computeRhumbLineSubdivision` blow up ("Too many properties to
        // enumerate", crashing the whole render loop) once the camera pulls far
        // out — e.g. flying to a high-orbit satellite. Forcing geodesic edges
        // routes around the buggy rhumb path; a coarse granularity bounds the
        // point count for good measure.
        for (const ent of loaded.entities.values) {
          if (ent.polygon) {
            ent.polygon.arcType = new ConstantProperty(ArcType.GEODESIC);
            ent.polygon.granularity = new ConstantProperty(CMath.toRadians(1.5));
          }
        }
        ds = loaded;
        viewer.dataSources.add(loaded);
        lodRef.current?.register("countries", loaded);
      });
    }
    return () => { cancelled = true; if (ds) { lodRef.current?.unregister(ds); viewer.dataSources.remove(ds, true); } };
  }, [ready, app.layers.countries]);

  // --- aircraft layer (diff/patch render manager, smooth dead-reckoned motion)
  const aircraftLayer = useRef<MovingLayer<AircraftState> | null>(null);
  const aircraftRows = useRef<AircraftState[]>([]);
  useEffect(() => {
    aircraftRows.current = app.aircraft.rows;
    aircraftLayer.current?.update(app.aircraft.rows);
  }, [app.aircraft.rows]);
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer || !aircraftArrow || !app.layers.aircraft) return;
    const layer = createAircraftLayer(viewer, selectionMap, aircraftArrow);
    styleClusters(layer.ds, LAYER_BY_ID.aircraft.color);
    layer.ds.clustering.pixelRange = 28;
    layer.ds.clustering.minimumClusterSize = 5;
    layer.mount();
    layer.update(aircraftRows.current);
    aircraftLayer.current = layer;
    return () => { layer.dispose(); aircraftLayer.current = null; };
  }, [ready, app.layers.aircraft, aircraftArrow]);

  // --- events layer (earthquakes + natural events) — static diff/patch -------
  // A poll no longer tears down the datasource: a persistent StaticLayer diffs
  // rows by id, so markers keep identity, selection and hover across refreshes
  // (audit W1 for static layers). Sub-toggles just change the filtered set the
  // layer diffs against — no rebuild.
  const eventsLayer = useRef<StaticLayer<WorldEvent> | null>(null);
  const eventsRows = useRef<WorldEvent[]>([]);
  const eventsOn = app.layers.earthquakes || app.layers.naturalEvents;
  useEffect(() => {
    const filtered = app.events.rows.filter((e) =>
      e.tags?.includes("earthquake") ? app.layers.earthquakes : app.layers.naturalEvents,
    );
    eventsRows.current = filtered;
    eventsLayer.current?.update(filtered);
  }, [app.events.rows, app.layers.earthquakes, app.layers.naturalEvents]);
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer || !eventsOn) return;
    const layer = createEventLayer(viewer, "events");
    layer.mount();
    layer.update(eventsRows.current);
    eventsLayer.current = layer;
    lodRef.current?.register("events", layer.ds);
    return () => { lodRef.current?.unregister(layer.ds); layer.dispose(); eventsLayer.current = null; };
  }, [ready, eventsOn]);

  // --- conflict layer (ACLED events from the vault) — static diff/patch -------
  const conflictLayer = useRef<StaticLayer<WorldEvent> | null>(null);
  const conflictRows = useRef<WorldEvent[]>([]);
  useEffect(() => {
    conflictRows.current = app.conflict.rows;
    conflictLayer.current?.update(app.conflict.rows);
  }, [app.conflict.rows]);
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer || !app.layers.conflict) return;
    const layer = createEventLayer(viewer, "conflict");
    layer.mount();
    layer.update(conflictRows.current);
    conflictLayer.current = layer;
    lodRef.current?.register("conflict", layer.ds);
    return () => { lodRef.current?.unregister(layer.ds); layer.dispose(); conflictLayer.current = null; };
  }, [ready, app.layers.conflict]);

  // --- news layer — static diff/patch ---------------------------------------
  const newsLayer = useRef<StaticLayer<NewsItem> | null>(null);
  const newsRows = useRef<NewsItem[]>([]);
  useEffect(() => {
    const located = app.news.rows.filter((n) => n.location);
    newsRows.current = located;
    newsLayer.current?.update(located);
  }, [app.news.rows]);
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer || !app.layers.news) return;
    const layer = createNewsLayer(viewer);
    layer.mount();
    layer.update(newsRows.current);
    newsLayer.current = layer;
    lodRef.current?.register("news", layer.ds);
    return () => { lodRef.current?.unregister(layer.ds); layer.dispose(); newsLayer.current = null; };
  }, [ready, app.layers.news]);

  // --- maritime layer (vessels) — diff/patch render manager -----------------
  const vesselLayer = useRef<MovingLayer<VesselRow> | null>(null);
  const vesselRows = useRef<VesselRow[]>([]);
  useEffect(() => {
    vesselRows.current = app.vessels.rows;
    vesselLayer.current?.update(app.vessels.rows);
  }, [app.vessels.rows]);
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer || !app.layers.maritime) return;
    const layer = createVesselLayer(viewer, selectionMap);
    styleClusters(layer.ds, LAYER_BY_ID.maritime.color);
    layer.ds.clustering.pixelRange = 28;
    layer.ds.clustering.minimumClusterSize = 6;
    layer.mount();
    layer.update(vesselRows.current);
    vesselLayer.current = layer;
    return () => { layer.dispose(); vesselLayer.current = null; };
  }, [ready, app.layers.maritime]);

  // --- weather layer — static diff/patch ------------------------------------
  const weatherLayer = useRef<StaticLayer<WeatherRow> | null>(null);
  const weatherRows = useRef<WeatherRow[]>([]);
  useEffect(() => {
    weatherRows.current = app.weather.rows;
    weatherLayer.current?.update(app.weather.rows);
  }, [app.weather.rows]);
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer || !app.layers.weather) return;
    const layer = createWeatherLayer(viewer);
    layer.mount();
    layer.update(weatherRows.current);
    weatherLayer.current = layer;
    lodRef.current?.register("weather", layer.ds);
    return () => { lodRef.current?.unregister(layer.ds); layer.dispose(); weatherLayer.current = null; };
  }, [ready, app.layers.weather]);

  // --- satellites layer (SGP4 via render manager, continuous smooth motion) --
  // satellite.js is code-split; load it once the space layer is first enabled.
  const [sgp4, setSgp4] = useState<Sgp4 | null>(null);
  useEffect(() => {
    if (!app.layers.space || sgp4) return;
    let cancelled = false;
    loadSgp4().then((m) => { if (!cancelled) setSgp4(m); });
    return () => { cancelled = true; };
  }, [app.layers.space, sgp4]);

  const satelliteLayer = useRef<MovingLayer<SatelliteRow> | null>(null);
  const satelliteRows = useRef<SatelliteRow[]>([]);
  const orbitTrail = useRef<OrbitTrail | null>(null);
  const sgp4Ref = useRef<Sgp4 | null>(null);
  useEffect(() => { sgp4Ref.current = sgp4; }, [sgp4]);
  useEffect(() => {
    satelliteRows.current = app.satellites.rows;
    satelliteLayer.current?.update(app.satellites.rows);
  }, [app.satellites.rows]);
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer || !app.layers.space || !sgp4) return;
    const layer = createSatelliteLayer(viewer, selectionMap, sgp4);
    layer.mount();
    layer.update(satelliteRows.current);
    satelliteLayer.current = layer;
    const trail = new OrbitTrail(viewer, sgp4);
    orbitTrail.current = trail;
    return () => { layer.dispose(); satelliteLayer.current = null; trail.dispose(); orbitTrail.current = null; };
  }, [ready, app.layers.space, sgp4]);

  // Latest feed rows, so the focus effect resolves a selection to coordinates
  // without re-firing (and re-flying the camera) on every background poll.
  const feedsRef = useRef({
    aircraft: app.aircraft.rows, vessels: app.vessels.rows, events: app.events.rows,
    conflict: app.conflict.rows, news: app.news.rows, weather: app.weather.rows, satellites: app.satellites.rows,
  });
  useEffect(() => {
    // Deliberate latest-value ref: the focus/hover effects read these rows to
    // resolve a selection to coordinates WITHOUT taking them as dependencies
    // (which would re-fly the camera on every poll). The React Compiler lint
    // flags writing reactive values into a cross-effect ref; that is exactly the
    // escape hatch intended here, so it is suppressed at this single site.
    // eslint-disable-next-line react-hooks/immutability
    feedsRef.current = {
      aircraft: app.aircraft.rows, vessels: app.vessels.rows, events: app.events.rows,
      conflict: app.conflict.rows, news: app.news.rows, weather: app.weather.rows, satellites: app.satellites.rows,
    };
  }, [app.aircraft.rows, app.vessels.rows, app.events.rows, app.conflict.rows, app.news.rows, app.weather.rows, app.satellites.rows]);

  // --- focus mode: follow (moving) or fly-to (static) the selection ---------
  // Moving objects (aircraft/vessel/satellite) are *tracked* (§19): the camera
  // locks on and follows them, framed by a per-type `viewFrom` offset that sits
  // far enough back to read the object + its trail. Static points (events/news/
  // weather) get a one-shot cinematic fly-to. Falls back to fly-to if the live
  // entity isn't materialized yet (§16 §62).
  useEffect(() => {
    const cam = camRef.current;
    const focus = focusRef.current;
    const viewer = ref.current?.cesiumElement;
    const sel = app.selection;
    if (!ready || !cam || !viewer) return;
    const rm = prefersReducedMotion();

    // `viewer.trackedEntity = …` IS Cesium's entity-tracking API — following a
    // moving object is impossible without this mutation. The React Compiler lint
    // treats mutating a ref-derived object inside a selection-keyed effect as
    // forbidden; it is an unavoidable imperative Cesium call, suppressed here.
    // eslint-disable-next-line react-hooks/immutability
    const untrack = () => { viewer.trackedEntity = undefined; cam.setTracking(false); };
    const follow = (ent: CesiumEntity, viewFrom: Cartesian3) => {
      ent.viewFrom = new ConstantProperty(viewFrom);
      viewer.trackedEntity = ent;
      cam.setTracking(true);
    };

    if (!sel) { untrack(); orbitTrail.current?.hide(); focus?.hide(); return; }
    const feeds = feedsRef.current;
    switch (sel.kind) {
      case "aircraft": {
        const ent = aircraftLayer.current?.getEntity(sel.id);
        if (ent) {
          follow(ent, AIRCRAFT_VIEWFROM);
          if (ent.position) focus?.showAt(ent.position, { stem: true, reducedMotion: rm });
        } else {
          untrack();
          const a = feeds.aircraft.find((r) => r.id === sel.id);
          if (a) cam.flyToAircraft(a.position.lon, a.position.lat, a.position.alt ?? 9000);
        }
        orbitTrail.current?.hide();
        break;
      }
      case "vessel": {
        const ent = vesselLayer.current?.getEntity(sel.id);
        if (ent) {
          follow(ent, VESSEL_VIEWFROM);
          if (ent.position) focus?.showAt(ent.position, { reducedMotion: rm });
        } else {
          untrack();
          const v = feeds.vessels.find((r) => r.id === sel.id);
          if (v) cam.flyToVessel(v.lon, v.lat);
        }
        orbitTrail.current?.hide();
        break;
      }
      case "satellite": {
        const s = feeds.satellites.find((r) => r.id === sel.id);
        if (s) orbitTrail.current?.show(s);
        const ent = satelliteLayer.current?.getEntity(sel.id);
        if (ent) {
          follow(ent, satelliteViewFrom(s, sgp4Ref.current));
          if (ent.position) focus?.showAt(ent.position, { stem: true, reducedMotion: rm });
        } else {
          untrack();
          const sat = sgp4Ref.current;
          if (s && sat && s.tle1 && s.tle2) {
            const g = subSatellitePoint(sat, s);
            if (g) cam.flyToSatellite(g.lon, g.lat, g.alt);
          }
        }
        break;
      }
      case "event": {
        untrack();
        const e = [...feeds.events, ...feeds.conflict].find((r) => r.id === sel.id);
        if (e) { cam.flyToEvent(e.location.lon, e.location.lat); focus?.showAt(Cartesian3.fromDegrees(e.location.lon, e.location.lat, 0), { reducedMotion: rm }); }
        orbitTrail.current?.hide();
        break;
      }
      case "news": {
        untrack();
        const n = feeds.news.find((r) => r.id === sel.id);
        if (n?.location) { cam.flyToEvent(n.location.lon, n.location.lat); focus?.showAt(Cartesian3.fromDegrees(n.location.lon, n.location.lat, 0), { reducedMotion: rm }); }
        orbitTrail.current?.hide();
        break;
      }
      case "weather": {
        untrack();
        const w = feeds.weather.find((r) => r.id === sel.id);
        if (w) { cam.flyToPoint(w.lon, w.lat, 300_000); focus?.showAt(Cartesian3.fromDegrees(w.lon, w.lat, 0), { reducedMotion: rm }); }
        orbitTrail.current?.hide();
        break;
      }
      default:
        untrack();
        orbitTrail.current?.hide();
        focus?.hide();
    }
  }, [ready, app.selection]);

  // --- motion trail + satellite coverage cone for the selection -------------
  // Separate from the camera focus effect so toggling trails (or changing
  // quality) never re-flies the camera. Reads live entities from the layers.
  useEffect(() => {
    const trail = trailRef.current;
    const cone = coneRef.current;
    if (!ready || !trail) return;
    const sel = app.selection;
    cone?.hide();
    if (!sel || !app.trails) { trail.hide(); }

    if (sel && app.trails) {
      if (sel.kind === "aircraft") {
        const ent = aircraftLayer.current?.getEntity(sel.id);
        if (ent) trail.follow(ent, { color: Color.fromCssColorString(LAYER_BY_ID.aircraft.color), minSampleMeters: 1500, width: 4 });
        else trail.hide();
      } else if (sel.kind === "vessel") {
        const ent = vesselLayer.current?.getEntity(sel.id);
        if (ent) trail.follow(ent, { color: Color.fromCssColorString(LAYER_BY_ID.maritime.color), minSampleMeters: 400, width: 4 });
        else trail.hide();
      } else if (sel.kind === "satellite") {
        const ent = satelliteLayer.current?.getEntity(sel.id);
        const s = feedsRef.current.satellites.find((r) => r.id === sel.id);
        if (ent) trail.follow(ent, { color: satColor(s?.periodMin ?? null), minSampleMeters: 25_000, width: 3 });
        else trail.hide();
      } else {
        trail.hide();
      }
    }

    // Coverage cone follows the satellite regardless of the trail toggle.
    if (sel?.kind === "satellite") {
      const ent = satelliteLayer.current?.getEntity(sel.id);
      const s = feedsRef.current.satellites.find((r) => r.id === sel.id);
      if (ent) cone?.follow(ent, satColor(s?.periodMin ?? null));
    }
  }, [ready, app.selection, app.trails, app.quality]);

  // --- fly-to ---------------------------------------------------------------
  // Distance-adaptive cinematic flight (mission §16) via the camera controller.
  useEffect(() => {
    if (!ready || !app.flyTo) return;
    camRef.current?.flyToCountry(app.flyTo.lon, app.flyTo.lat);
  }, [ready, app.flyTo]);

  return (
    <Viewer
      ref={ref}
      full
      timeline={false}
      animation={false}
      baseLayerPicker={false}
      geocoder={false}
      homeButton={false}
      sceneModePicker={false}
      navigationHelpButton={false}
      fullscreenButton={false}
      infoBox={false}
      selectionIndicator={false}
      shouldAnimate
    >
      <ImageryLayer imageryProvider={imagery} alpha={0.7} brightness={0.62} />
    </Viewer>
  );
}

// Maps Cesium entities we create to their domain selection, for click picking.
const selectionMap = new WeakMap<CesiumEntity, NonNullable<Selection>>();

/** Latest feed rows the hover resolver reads to label a picked entity. */
interface HoverFeeds {
  aircraft: AircraftState[];
  vessels: VesselRow[];
  events: WorldEvent[];
  conflict: WorldEvent[];
  news: NewsItem[];
  weather: WeatherRow[];
  satellites: SatelliteRow[];
}

/** Resolve a picked scene object into a hover tooltip payload (or null). */
function buildHoverInfo(picked: { id?: unknown }, x: number, y: number, feeds: HoverFeeds): HoverInfo | null {
  const pid = picked.id;
  if (Array.isArray(pid)) return { x, y, kind: "CLUSTER", title: `${pid.length} objects`, subtitle: "click to zoom in", color: "#93a0b1" };
  const ent = pid instanceof CesiumEntity ? pid : undefined;
  if (!ent) return null;
  const sel = selectionMap.get(ent);
  if (sel) return hoverForSelection(sel, feeds, x, y);
  const iso3 = ent.properties?.ISO_A3?.getValue?.();
  const name = ent.properties?.ADMIN?.getValue?.();
  if (iso3) return { x, y, kind: "COUNTRY", title: (name as string) ?? String(iso3), subtitle: String(iso3), color: "#8aa0b6" };
  return null;
}

function join(parts: (string | undefined | null)[]): string | undefined {
  const s = parts.filter(Boolean).join(" · ");
  return s || undefined;
}

function hoverForSelection(sel: NonNullable<Selection>, feeds: HoverFeeds, x: number, y: number): HoverInfo | null {
  switch (sel.kind) {
    case "aircraft": {
      const a = feeds.aircraft.find((r) => r.id === sel.id);
      const alt = a?.position.alt != null ? `FL${Math.round(a.position.alt / 0.3048 / 100)}` : undefined;
      return { x, y, kind: "AIRCRAFT", title: a?.callsign?.trim() || sel.id, subtitle: join([a?.country, alt]), color: LAYER_BY_ID.aircraft.color };
    }
    case "vessel": {
      const v = feeds.vessels.find((r) => r.id === sel.id);
      return { x, y, kind: "VESSEL", title: v?.name?.trim() || v?.mmsi || sel.id, subtitle: join([v?.vesselType, v?.flag]), color: LAYER_BY_ID.maritime.color };
    }
    case "satellite": {
      const s = feeds.satellites.find((r) => r.id === sel.id);
      return { x, y, kind: "SATELLITE", title: s?.name || sel.id, subtitle: join([s?.operator, s?.objectType]), color: satColor(s?.periodMin ?? null).toCssColorString() };
    }
    case "event": {
      const e = [...feeds.events, ...feeds.conflict].find((r) => r.id === sel.id);
      return e ? { x, y, kind: e.kind.toUpperCase(), title: e.title, subtitle: e.severity, color: severityColor(e.severity).toCssColorString() } : null;
    }
    case "news": {
      const n = feeds.news.find((r) => r.id === sel.id);
      return n ? { x, y, kind: "NEWS", title: n.title, subtitle: n.source, color: LAYER_BY_ID.news.color } : null;
    }
    case "weather": {
      const w = feeds.weather.find((r) => r.id === sel.id);
      return w ? { x, y, kind: "WEATHER", title: w.place || "Observation", subtitle: w.value != null ? `${Math.round(w.value)}°${w.unit ?? "C"}` : undefined, color: LAYER_BY_ID.weather.color } : null;
    }
    default:
      return null;
  }
}

/** Ellipsoid pick → Cartographic, for de-cluster zoom. Null over empty space. */
function ellipsoidPick(viewer: CesiumViewer, position: Cartesian2): Cartographic | null {
  const cart = viewer.camera.pickEllipsoid(position);
  return cart ? Cartographic.fromCartesian(cart) : null;
}

/** Give a datasource's clusters a filled disc + white count label. */
function styleClusters(ds: CustomDataSource, cssColor: string) {
  ds.clustering.enabled = true;
  const disc = discCanvas(cssColor);
  ds.clustering.clusterEvent.addEventListener((clustered, cluster) => {
    cluster.label.show = true;
    cluster.label.text = String(clustered.length);
    cluster.label.font = "600 12px Inter, sans-serif";
    cluster.label.fillColor = Color.WHITE;
    cluster.label.verticalOrigin = VerticalOrigin.CENTER;
    cluster.label.disableDepthTestDistance = DEPTH_TEST_DISABLE_M;
    cluster.billboard.show = true;
    cluster.billboard.image = disc;
    cluster.billboard.disableDepthTestDistance = DEPTH_TEST_DISABLE_M;
    cluster.billboard.scale = clustered.length > 100 ? 1.5 : clustered.length > 25 ? 1.25 : 1.0;
  });
}

function discCanvas(cssColor: string): string {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d")!;
  const col = Color.fromCssColorString(cssColor);
  const rgb = `${Math.round(col.red * 255)},${Math.round(col.green * 255)},${Math.round(col.blue * 255)}`;
  ctx.beginPath();
  ctx.arc(16, 16, 13, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb},0.28)`;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(${rgb},0.95)`;
  ctx.stroke();
  return c.toDataURL();
}

const eventSize = (sev: Severity): number => (sev === "critical" ? 14 : sev === "warning" ? 11 : 9);

function eventGraphics(e: WorldEvent): CesiumEntity.ConstructorOptions {
  return {
    point: {
      pixelSize: eventSize(e.severity),
      color: severityColor(e.severity),
      outlineColor: Color.WHITE.withAlpha(0.45),
      outlineWidth: 1,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: DEPTH_TEST_DISABLE_M,
    },
  };
}

/** Shared factory for the event-shaped static layers (quakes/natural + conflict). */
function createEventLayer(viewer: CesiumViewer, name: string): StaticLayer<WorldEvent> {
  return new StaticLayer<WorldEvent>(viewer, selectionMap, {
    name,
    position: (e) => Cartesian3.fromDegrees(e.location.lon, e.location.lat, Math.max(e.location.alt ?? 0, 0)),
    build: (e) => eventGraphics(e),
    selection: (e) => ({ kind: "event", id: e.id }),
    version: (e) => e.severity,
    onUpdate: (ent, e) => {
      if (!ent.point) return;
      ent.point.pixelSize = new ConstantProperty(eventSize(e.severity));
      ent.point.color = new ConstantProperty(severityColor(e.severity));
    },
  });
}

/** Deterministic ±~0.7° spread from a stable id, so many same-country articles
 *  (all anchored to one country centroid) fan into a readable, clickable cluster
 *  instead of stacking on a single pixel. Stable across polls → no jitter jump. */
function scatter(id: string, lat: number): { lon: number; lat: number } {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  const a = ((h >>> 0) % 1000) / 1000;
  const b = ((h >>> 10) % 1000) / 1000;
  const dLat = (a - 0.5) * 1.4;
  const dLon = (b - 0.5) * 1.4 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return { lon: dLon, lat: dLat };
}

function createNewsLayer(viewer: CesiumViewer): StaticLayer<NewsItem> {
  return new StaticLayer<NewsItem>(viewer, selectionMap, {
    name: "news",
    position: (n) => {
      const off = scatter(n.id, n.location!.lat);
      return Cartesian3.fromDegrees(n.location!.lon + off.lon, n.location!.lat + off.lat, 0);
    },
    build: () => ({
      point: {
        pixelSize: 8,
        color: Color.fromCssColorString(LAYER_BY_ID.news.color).withAlpha(0.9),
        outlineColor: Color.BLACK.withAlpha(0.3),
        outlineWidth: 1,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: DEPTH_TEST_DISABLE_M,
      },
    }),
    selection: (n) => ({ kind: "news", id: n.id }),
  });
}

// Blue (cold) → red (hot) ramp for temperature in °C.
function tempColor(c: number): Color {
  const t = Math.max(0, Math.min(1, (c + 10) / 50));
  return Color.fromHsl((1 - t) * 0.66, 0.85, 0.55);
}

function weatherGraphics(w: WeatherRow): CesiumEntity.ConstructorOptions {
  const temp = w.value;
  return {
    point: {
      pixelSize: 10,
      color: (temp != null ? tempColor(temp) : Color.GRAY).withAlpha(0.95),
      outlineColor: Color.WHITE.withAlpha(0.5),
      outlineWidth: 1,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: DEPTH_TEST_DISABLE_M,
    },
    label: temp != null ? {
      text: `${Math.round(temp)}°`,
      font: "600 12px Inter, sans-serif",
      fillColor: Color.WHITE,
      showBackground: true,
      backgroundColor: Color.fromCssColorString("#0c1016").withAlpha(0.7),
      pixelOffset: new Cartesian2(0, -16),
      scaleByDistance: new NearFarScalar(2.0e6, 1.0, 1.2e7, 0.0),
      disableDepthTestDistance: DEPTH_TEST_DISABLE_M,
    } : undefined,
  };
}

function createWeatherLayer(viewer: CesiumViewer): StaticLayer<WeatherRow> {
  return new StaticLayer<WeatherRow>(viewer, selectionMap, {
    name: "weather",
    position: (w) => Cartesian3.fromDegrees(w.lon, w.lat, 0),
    build: (w) => weatherGraphics(w),
    selection: (w) => ({ kind: "weather", id: w.id }),
    version: (w) => String(w.value ?? ""),
    onUpdate: (ent, w) => {
      const temp = w.value;
      if (ent.point) ent.point.color = new ConstantProperty((temp != null ? tempColor(temp) : Color.GRAY).withAlpha(0.95));
      if (ent.label && temp != null) ent.label.text = new ConstantProperty(`${Math.round(temp)}°`);
    },
  });
}
