"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ConstantPositionProperty,
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
import * as satellite from "satellite.js";
import { useApp, type VesselRow, type WeatherRow } from "@/stores/app-store";
import { LAYER_BY_ID } from "@/lib/config/layers";
import type { AircraftState, NewsItem, Severity, WorldEvent } from "@/types/domain";

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

// Colour satellites by orbit regime (from period in minutes).
function satColor(periodMin: number | null): Color {
  if (periodMin == null) return Color.fromCssColorString("#c0c8d4");
  if (periodMin < 128) return Color.fromCssColorString("#65f6c7"); // LEO
  if (periodMin < 800) return Color.fromCssColorString("#54c7ff"); // MEO
  return Color.fromCssColorString("#ffd166"); // GEO / HEO
}

function severityColor(sev: Severity): Color {
  switch (sev) {
    case "critical": return Color.fromCssColorString("#ff5a62");
    case "warning": return Color.fromCssColorString("#ffae45");
    case "watch": return Color.fromCssColorString("#54c7ff");
    default: return Color.fromCssColorString("#65f6c7");
  }
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

  // --- scene setup + picking (click + hover) --------------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer) return;
    configureScene(viewer);
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
      // A cluster or empty space → zoom toward the clicked point (de-cluster).
      // Uses the ellipsoid pick, never the cluster's entity array (which can be
      // huge and crash the render loop when enumerated).
      if (picked && !entity) zoomTowardCursor(viewer, m.position);
    }, ScreenSpaceEventType.LEFT_CLICK);

    // Hover: pointer cursor over anything selectable.
    handler.setInputAction((m: { endPosition: Cartesian2 }) => {
      const picked = scene.pick(m.endPosition);
      const hit = !!picked && (Array.isArray(picked.id) || picked.id instanceof CesiumEntity);
      scene.canvas.style.cursor = hit ? "pointer" : "default";
    }, ScreenSpaceEventType.MOUSE_MOVE);

    return () => handler.destroy();
  }, [ready]);

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
        ds = loaded;
        viewer.dataSources.add(loaded);
      });
    }
    return () => { cancelled = true; if (ds) viewer.dataSources.remove(ds, true); };
  }, [ready, app.layers.countries]);

  // --- aircraft layer -------------------------------------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer || !aircraftArrow) return;
    const ds = new CustomDataSource("aircraft");
    styleClusters(ds, LAYER_BY_ID.aircraft.color);
    ds.clustering.pixelRange = 28;
    ds.clustering.minimumClusterSize = 5;
    if (app.layers.aircraft) {
      for (const a of app.aircraft.rows) addAircraft(ds, a, aircraftArrow);
      viewer.dataSources.add(ds);
    }
    return () => { viewer.dataSources.remove(ds, true); };
  }, [ready, app.layers.aircraft, app.aircraft.rows, aircraftArrow]);

  // --- events layer (earthquakes + natural events) --------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer) return;
    const ds = new CustomDataSource("events");
    const show = app.layers.earthquakes || app.layers.naturalEvents;
    if (show) {
      for (const e of app.events.rows) {
        const isQuake = e.tags?.includes("earthquake");
        if (isQuake && !app.layers.earthquakes) continue;
        if (!isQuake && !app.layers.naturalEvents) continue;
        addEvent(ds, e);
      }
      viewer.dataSources.add(ds);
    }
    return () => { viewer.dataSources.remove(ds, true); };
  }, [ready, app.layers.earthquakes, app.layers.naturalEvents, app.events.rows]);

  // --- conflict layer (ACLED events from the vault) -------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer) return;
    const ds = new CustomDataSource("conflict");
    if (app.layers.conflict) {
      for (const e of app.conflict.rows) addEvent(ds, e);
      viewer.dataSources.add(ds);
    }
    return () => { viewer.dataSources.remove(ds, true); };
  }, [ready, app.layers.conflict, app.conflict.rows]);

  // --- news layer -----------------------------------------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer) return;
    const ds = new CustomDataSource("news");
    if (app.layers.news) {
      for (const n of app.news.rows) if (n.location) addNews(ds, n);
      viewer.dataSources.add(ds);
    }
    return () => { viewer.dataSources.remove(ds, true); };
  }, [ready, app.layers.news, app.news.rows]);

  // --- maritime layer (vessels) ---------------------------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer) return;
    const ds = new CustomDataSource("vessels");
    styleClusters(ds, LAYER_BY_ID.maritime.color);
    ds.clustering.pixelRange = 28;
    ds.clustering.minimumClusterSize = 6;
    if (app.layers.maritime) {
      for (const v of app.vessels.rows) addVessel(ds, v);
      viewer.dataSources.add(ds);
    }
    return () => { viewer.dataSources.remove(ds, true); };
  }, [ready, app.layers.maritime, app.vessels.rows]);

  // --- weather layer --------------------------------------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer) return;
    const ds = new CustomDataSource("weather");
    if (app.layers.weather) {
      for (const w of app.weather.rows) addWeather(ds, w);
      viewer.dataSources.add(ds);
    }
    return () => { viewer.dataSources.remove(ds, true); };
  }, [ready, app.layers.weather, app.weather.rows]);

  // --- satellites layer (SGP4-propagated from TLEs) -------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer || !app.layers.space) return;
    const ds = new CustomDataSource("satellites");
    const tracked: { rec: satellite.SatRec; prop: ConstantPositionProperty }[] = [];
    for (const s of app.satellites.rows) {
      if (!s.tle1 || !s.tle2) continue;
      let rec: satellite.SatRec;
      try { rec = satellite.twoline2satrec(s.tle1, s.tle2); } catch { continue; }
      if (rec.error) continue;
      const prop = new ConstantPositionProperty();
      const ent = ds.entities.add({ position: prop, point: {
        pixelSize: 3.5, color: satColor(s.periodMin ?? null),
        outlineColor: Color.BLACK.withAlpha(0.4), outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new NearFarScalar(2.0e6, 1.4, 6.0e7, 0.5),
      } });
      selectionMap.set(ent, { kind: "satellite", id: s.id });
      tracked.push({ rec, prop });
    }
    viewer.dataSources.add(ds);
    const propagate = () => {
      const now = new Date();
      const gmst = satellite.gstime(now);
      for (const { rec, prop } of tracked) {
        const pv = satellite.propagate(rec, now);
        if (!pv || typeof pv.position === "boolean" || !pv.position) continue;
        const geo = satellite.eciToGeodetic(pv.position, gmst);
        const lon = satellite.degreesLong(geo.longitude);
        const lat = satellite.degreesLat(geo.latitude);
        if (Number.isFinite(lon) && Number.isFinite(lat)) {
          prop.setValue(Cartesian3.fromDegrees(lon, lat, geo.height * 1000));
        }
      }
    };
    propagate();
    const timer = setInterval(propagate, 3000);
    return () => { clearInterval(timer); viewer.dataSources.remove(ds, true); };
  }, [ready, app.layers.space, app.satellites.rows]);

  // --- fly-to ---------------------------------------------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!ready || !viewer || !app.flyTo) return;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(app.flyTo.lon, app.flyTo.lat, 2_500_000),
      duration: 1.2,
    });
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

// Imperative one-time scene configuration. Module-scope so React Compiler does
// not treat the viewer as a render value being mutated.
function configureScene(viewer: CesiumViewer) {
  if (process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN) Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
  const scene = viewer.scene;
  scene.globe.enableLighting = true;
  scene.globe.showGroundAtmosphere = true;
  if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
  scene.globe.baseColor = Color.fromCssColorString("#0a1016");
  scene.backgroundColor = Color.fromCssColorString("#05070a");
}

// Maps Cesium entities we create to their domain selection, for click picking.
const selectionMap = new WeakMap<CesiumEntity, NonNullable<import("@/stores/app-store").Selection>>();

/** Zoom the camera toward the ellipsoid point under the cursor (de-cluster). */
function zoomTowardCursor(viewer: CesiumViewer, position: Cartesian2) {
  const camera = viewer.camera;
  const carto = camera.pickEllipsoid(position);
  if (!carto) return;
  const c = Cartographic.fromCartesian(carto);
  const height = camera.positionCartographic.height;
  viewer.camera.flyTo({
    destination: Cartesian3.fromRadians(c.longitude, c.latitude, Math.max(height * 0.4, 250_000)),
    duration: 0.8,
  });
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
    cluster.label.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    cluster.billboard.show = true;
    cluster.billboard.image = disc;
    cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
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

function addAircraft(ds: CustomDataSource, a: AircraftState, sprite: HTMLCanvasElement) {
  const ent = ds.entities.add({
    position: Cartesian3.fromDegrees(a.position.lon, a.position.lat, a.position.alt ?? 9000),
    billboard: {
      image: sprite,
      rotation: a.headingDeg != null ? -CMath.toRadians(a.headingDeg) : 0,
      scale: 0.9,
      verticalOrigin: VerticalOrigin.CENTER,
      scaleByDistance: new NearFarScalar(1.0e6, 1.2, 1.5e7, 0.55),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  selectionMap.set(ent, { kind: "aircraft", id: a.id });
}

function addEvent(ds: CustomDataSource, e: WorldEvent) {
  const ent = ds.entities.add({
    position: Cartesian3.fromDegrees(e.location.lon, e.location.lat, Math.max(e.location.alt ?? 0, 0)),
    point: {
      pixelSize: e.severity === "critical" ? 14 : e.severity === "warning" ? 11 : 9,
      color: severityColor(e.severity),
      outlineColor: Color.WHITE.withAlpha(0.45),
      outlineWidth: 1,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  selectionMap.set(ent, { kind: "event", id: e.id });
}

function addNews(ds: CustomDataSource, n: NewsItem) {
  const ent = ds.entities.add({
    position: Cartesian3.fromDegrees(n.location!.lon, n.location!.lat, 0),
    point: {
      pixelSize: 8,
      color: Color.fromCssColorString(LAYER_BY_ID.news.color).withAlpha(0.9),
      outlineColor: Color.BLACK.withAlpha(0.3),
      outlineWidth: 1,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  selectionMap.set(ent, { kind: "news", id: n.id });
}

function addVessel(ds: CustomDataSource, v: VesselRow) {
  const ent = ds.entities.add({
    position: Cartesian3.fromDegrees(v.lon, v.lat, 0),
    point: {
      pixelSize: 7,
      color: Color.fromCssColorString(LAYER_BY_ID.maritime.color).withAlpha(0.95),
      outlineColor: Color.BLACK.withAlpha(0.35),
      outlineWidth: 1,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  selectionMap.set(ent, { kind: "vessel", id: v.id });
}

// Blue (cold) → red (hot) ramp for temperature in °C.
function tempColor(c: number): Color {
  const t = Math.max(0, Math.min(1, (c + 10) / 50));
  return Color.fromHsl((1 - t) * 0.66, 0.85, 0.55);
}

function addWeather(ds: CustomDataSource, w: WeatherRow) {
  const temp = w.value;
  const ent = ds.entities.add({
    position: Cartesian3.fromDegrees(w.lon, w.lat, 0),
    point: {
      pixelSize: 10,
      color: (temp != null ? tempColor(temp) : Color.GRAY).withAlpha(0.95),
      outlineColor: Color.WHITE.withAlpha(0.5),
      outlineWidth: 1,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: temp != null ? {
      text: `${Math.round(temp)}°`,
      font: "600 12px Inter, sans-serif",
      fillColor: Color.WHITE,
      showBackground: true,
      backgroundColor: Color.fromCssColorString("#0c1016").withAlpha(0.7),
      pixelOffset: new Cartesian2(0, -16),
      scaleByDistance: new NearFarScalar(2.0e6, 1.0, 1.2e7, 0.0),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    } : undefined,
  });
  selectionMap.set(ent, { kind: "weather", id: w.id });
}
