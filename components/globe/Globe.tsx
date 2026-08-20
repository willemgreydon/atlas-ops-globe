"use client";
import { useEffect, useMemo, useRef } from "react";
import {
  Cartesian2,
  Cartesian3,
  Color,
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
import { useApp, type VesselRow, type WeatherRow } from "@/stores/app-store";
import { LAYER_BY_ID } from "@/lib/config/layers";
import type { AircraftState, NewsItem, Severity, WorldEvent } from "@/types/domain";

// Cesium resolves its Workers/Assets/Widgets against CESIUM_BASE_URL at first
// use. The postinstall step copies those into /public/cesium, so point Cesium
// there before any Viewer is constructed. Must run before component render.
if (typeof window !== "undefined") {
  const g = window as typeof window & { CESIUM_BASE_URL?: string };
  g.CESIUM_BASE_URL ??= "/cesium/";
}

// One reusable arrow sprite for aircraft, rotated per-entity by heading.
function arrowCanvas(color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(8, 1);
  ctx.lineTo(14, 15);
  ctx.lineTo(8, 11);
  ctx.lineTo(2, 15);
  ctx.closePath();
  ctx.fill();
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

export default function Globe() {
  const ref = useRef<CesiumComponentRef<CesiumViewer>>(null);
  const app = useApp();
  const imagery = useMemo(() => new OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }), []);
  const aircraftArrow = useMemo(() => (typeof document !== "undefined" ? arrowCanvas(LAYER_BY_ID.aircraft.color) : undefined), []);

  // Keep the latest selection setter reachable from imperative handlers.
  const selectRef = useRef(app.select);
  useEffect(() => {
    selectRef.current = app.select;
  }, [app.select]);

  // --- one-time scene setup + picking ---------------------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!viewer) return;
    if (process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN) Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;

    const scene = viewer.scene;
    scene.globe.enableLighting = true;
    scene.globe.showGroundAtmosphere = true;
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
    scene.globe.baseColor = Color.fromCssColorString("#0a1016");
    viewer.scene.backgroundColor = Color.fromCssColorString("#05070a");

    const selMap = selectionMap;
    const handler = new ScreenSpaceEventHandler(scene.canvas);
    handler.setInputAction((movement: { position: Cartesian2 }) => {
      const picked = scene.pick(movement.position);
      const entity: CesiumEntity | undefined = picked?.id instanceof CesiumEntity ? picked.id : undefined;
      if (entity) {
        const sel = selMap.get(entity);
        if (sel) { selectRef.current(sel); return; }
        // Country polygon from GeoJSON
        const iso3 = entity.properties?.ISO_A3?.getValue?.();
        const name = entity.properties?.ADMIN?.getValue?.();
        if (iso3) { selectRef.current({ kind: "country", iso3, name }); return; }
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => handler.destroy();
  }, []);

  // --- country borders layer ------------------------------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!viewer) return;
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
    return () => {
      cancelled = true;
      if (ds) viewer.dataSources.remove(ds, true);
    };
  }, [app.layers.countries]);

  // --- aircraft layer -------------------------------------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!viewer || !aircraftArrow) return;
    const ds = new CustomDataSource("aircraft");
    ds.clustering.enabled = true;
    ds.clustering.pixelRange = 40;
    ds.clustering.minimumClusterSize = 6;
    if (app.layers.aircraft) {
      for (const a of app.aircraft.rows) addAircraft(ds, a, aircraftArrow);
      viewer.dataSources.add(ds);
    }
    return () => { viewer.dataSources.remove(ds, true); };
  }, [app.layers.aircraft, app.aircraft.rows, aircraftArrow]);

  // --- events layer (earthquakes + natural events) --------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!viewer) return;
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
  }, [app.layers.earthquakes, app.layers.naturalEvents, app.events.rows]);

  // --- news layer -----------------------------------------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!viewer) return;
    const ds = new CustomDataSource("news");
    if (app.layers.news) {
      for (const n of app.news.rows) if (n.location) addNews(ds, n);
      viewer.dataSources.add(ds);
    }
    return () => { viewer.dataSources.remove(ds, true); };
  }, [app.layers.news, app.news.rows]);

  // --- maritime layer (vessels from the intelligence vault) -----------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!viewer) return;
    const ds = new CustomDataSource("vessels");
    ds.clustering.enabled = true;
    ds.clustering.pixelRange = 36;
    ds.clustering.minimumClusterSize = 8;
    if (app.layers.maritime) {
      for (const v of app.vessels.rows) addVessel(ds, v);
      viewer.dataSources.add(ds);
    }
    return () => { viewer.dataSources.remove(ds, true); };
  }, [app.layers.maritime, app.vessels.rows]);

  // --- weather layer (Open-Meteo city observations) -------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!viewer) return;
    const ds = new CustomDataSource("weather");
    if (app.layers.weather) {
      for (const w of app.weather.rows) addWeather(ds, w);
      viewer.dataSources.add(ds);
    }
    return () => { viewer.dataSources.remove(ds, true); };
  }, [app.layers.weather, app.weather.rows]);

  // --- fly-to ---------------------------------------------------------------
  useEffect(() => {
    const viewer = ref.current?.cesiumElement;
    if (!viewer || !app.flyTo) return;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(app.flyTo.lon, app.flyTo.lat, 2_500_000),
      duration: 1.2,
    });
  }, [app.flyTo]);

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
const selectionMap = new WeakMap<CesiumEntity, NonNullable<import("@/stores/app-store").Selection>>();

function addAircraft(ds: CustomDataSource, a: AircraftState, sprite: HTMLCanvasElement) {
  const ent = ds.entities.add({
    position: Cartesian3.fromDegrees(a.position.lon, a.position.lat, a.position.alt ?? 9000),
    billboard: {
      image: sprite,
      rotation: a.headingDeg != null ? -CMath.toRadians(a.headingDeg) : 0,
      scale: 0.9,
      verticalOrigin: VerticalOrigin.CENTER,
      scaleByDistance: new NearFarScalar(1.0e6, 1.1, 1.5e7, 0.5),
    },
  });
  selectionMap.set(ent, { kind: "aircraft", id: a.id });
}

function addEvent(ds: CustomDataSource, e: WorldEvent) {
  const ent = ds.entities.add({
    position: Cartesian3.fromDegrees(e.location.lon, e.location.lat, Math.max(e.location.alt ?? 0, 0)),
    point: {
      pixelSize: e.severity === "critical" ? 13 : e.severity === "warning" ? 10 : 8,
      color: severityColor(e.severity),
      outlineColor: Color.WHITE.withAlpha(0.4),
      outlineWidth: 1,
      heightReference: HeightReference.CLAMP_TO_GROUND,
    },
  });
  selectionMap.set(ent, { kind: "event", id: e.id });
}

function addNews(ds: CustomDataSource, n: NewsItem) {
  const ent = ds.entities.add({
    position: Cartesian3.fromDegrees(n.location!.lon, n.location!.lat, 0),
    point: {
      pixelSize: 7,
      color: Color.fromCssColorString(LAYER_BY_ID.news.color).withAlpha(0.9),
      outlineColor: Color.BLACK.withAlpha(0.3),
      outlineWidth: 1,
      heightReference: HeightReference.CLAMP_TO_GROUND,
    },
  });
  selectionMap.set(ent, { kind: "news", id: n.id });
}

function addVessel(ds: CustomDataSource, v: VesselRow) {
  const ent = ds.entities.add({
    position: Cartesian3.fromDegrees(v.lon, v.lat, 0),
    point: {
      pixelSize: 6,
      color: Color.fromCssColorString(LAYER_BY_ID.maritime.color).withAlpha(0.95),
      outlineColor: Color.BLACK.withAlpha(0.35),
      outlineWidth: 1,
      heightReference: HeightReference.CLAMP_TO_GROUND,
    },
  });
  selectionMap.set(ent, { kind: "vessel", id: v.id });
}

// Blue (cold) → red (hot) ramp for temperature in °C.
function tempColor(c: number): Color {
  const t = Math.max(0, Math.min(1, (c + 10) / 50)); // -10°C..40°C → 0..1
  return Color.fromHsl((1 - t) * 0.66, 0.85, 0.55);
}

function addWeather(ds: CustomDataSource, w: WeatherRow) {
  const temp = w.value;
  const ent = ds.entities.add({
    position: Cartesian3.fromDegrees(w.lon, w.lat, 0),
    point: {
      pixelSize: 9,
      color: (temp != null ? tempColor(temp) : Color.GRAY).withAlpha(0.95),
      outlineColor: Color.WHITE.withAlpha(0.5),
      outlineWidth: 1,
      heightReference: HeightReference.CLAMP_TO_GROUND,
    },
    label: temp != null ? {
      text: `${Math.round(temp)}°`,
      font: "600 12px Inter, sans-serif",
      fillColor: Color.WHITE,
      showBackground: true,
      backgroundColor: Color.fromCssColorString("#0c1016").withAlpha(0.7),
      pixelOffset: new Cartesian2(0, -16),
      scaleByDistance: new NearFarScalar(2.0e6, 1.0, 1.2e7, 0.0),
    } : undefined,
  });
  selectionMap.set(ent, { kind: "weather", id: w.id });
}
