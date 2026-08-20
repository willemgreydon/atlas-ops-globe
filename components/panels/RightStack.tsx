"use client";
import type { NewsItem, WorldEvent } from "@/types/domain";
export default function RightStack({events,news,aircraftCount}:{events:WorldEvent[];news:NewsItem[];aircraftCount:number}){
  const critical=events.find(e=>e.severity==="critical") || events[0];
  return <div className="right-stack">
    <section className="panel"><div className="panel-body"><h3>Active Alert</h3>{critical?<div className="alert"><small>{critical.kind.toUpperCase()} · CONFIDENCE {Math.round((critical.confidence||.82)*100)}%</small><strong>{critical.title}</strong><small>{critical.source} · {new Date(critical.occurredAt).toLocaleTimeString()}</small></div>:<small>No active alert.</small>}</div></section>
    <section className="panel"><div className="panel-body"><h3>Global Telemetry</h3><div className="country-grid"><div className="metric"><label>Aircraft visible</label><b>{aircraftCount.toLocaleString()}</b></div><div className="metric"><label>Events loaded</label><b>{events.length}</b></div><div className="metric"><label>News records</label><b>{news.length}</b></div><div className="metric"><label>Mode</label><b>LIVE</b></div></div></div></section>
    <section className="panel feed"><div className="panel-body"><h3>Global News / Entities</h3></div>{news.slice(0,18).map(n=><div className="feed-item" key={n.id}><div className="meta">{n.source} · {n.countryCode||"GLOBAL"}</div><div className="title">{n.title}</div></div>)}</section>
  </div>
}
