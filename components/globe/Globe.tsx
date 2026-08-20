"use client";
import { Cartesian3, Color, Ion, Math as CesiumMath, OpenStreetMapImageryProvider, UrlTemplateImageryProvider } from "cesium";
import { Entity, ImageryLayer, Viewer } from "resium";
import { useMemo } from "react";
import type { AircraftState, WorldEvent } from "@/types/domain";

function eventColor(severity: WorldEvent["severity"]) {
  if (severity === "critical") return Color.fromCssColorString("#ff5a62");
  if (severity === "warning") return Color.fromCssColorString("#ffae45");
  if (severity === "watch") return Color.fromCssColorString("#54c7ff");
  return Color.fromCssColorString("#65f6c7");
}

export default function Globe({ aircraft, events }:{aircraft:AircraftState[];events:WorldEvent[]}){
  (globalThis as typeof globalThis & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = "/cesium/";
  const imagery = useMemo(() => new OpenStreetMapImageryProvider({ url:"https://tile.openstreetmap.org/" }), []);
  if (process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN) Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
  return <Viewer full timeline={false} animation={false} baseLayerPicker={false} geocoder={false} homeButton={false} sceneModePicker={false} navigationHelpButton={false} infoBox={true} selectionIndicator={true} imageryProvider={false} shouldAnimate>
    <ImageryLayer imageryProvider={imagery} alpha={0.65} />
    {events.map(e => <Entity key={e.id} name={e.title} description={`${e.source} · ${e.severity}`} position={Cartesian3.fromDegrees(e.location.lon,e.location.lat,Math.max(e.location.alt||0,0))} point={{pixelSize:e.severity==="critical"?14:10,color:eventColor(e.severity),outlineColor:Color.WHITE.withAlpha(.45),outlineWidth:1}} />)}
    {aircraft.map(a => <Entity key={a.id} name={a.callsign||a.id} description={`${a.country||"Unknown"} · ${Math.round((a.position.alt||0)/100)*100}m`} position={Cartesian3.fromDegrees(a.position.lon,a.position.lat,a.position.alt||8000)} point={{pixelSize:5,color:Color.fromCssColorString("#65f6c7")}} />)}
  </Viewer>;
}
