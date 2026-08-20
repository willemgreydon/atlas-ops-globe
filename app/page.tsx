"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Layers from "@/components/panels/Layers";
import RightStack from "@/components/panels/RightStack";
import type { AircraftState, NewsItem, WorldEvent } from "@/types/domain";
const Globe = dynamic(()=>import("@/components/globe/Globe"),{ssr:false,loading:()=> <div className="loading">INITIALIZING GLOBAL VIEW</div>});

async function getRows<T>(url:string):Promise<T[]>{ const r=await fetch(url,{cache:"no-store"}); const j=await r.json(); return j.rows||[]; }
export default function Page(){
  const [aircraft,setAircraft]=useState<AircraftState[]>([]); const [events,setEvents]=useState<WorldEvent[]>([]); const [news,setNews]=useState<NewsItem[]>([]);
  useEffect(()=>{ let on=true; const load=async()=>{ const [a,e,n]=await Promise.all([getRows<AircraftState>("/api/aircraft"),getRows<WorldEvent>("/api/events"),getRows<NewsItem>("/api/news")]); if(on){setAircraft(a);setEvents(e);setNews(n);} }; load(); const t=setInterval(load,60000); return()=>{on=false;clearInterval(t)}; },[]);
  return <main className="app-shell">
    <header className="topbar"><div className="brand">ATLAS / OPS</div><nav className="nav"><button className="active">GLOBAL</button><button>CONFLICT</button><button>LIVE TRACKING</button><button>CONTAMINATION</button><button>CYBER</button></nav><div className="market"><span className="up">S&P +0.24%</span><span className="down">NASDAQ -0.17%</span><span>UTC {new Date().toISOString().slice(11,16)}</span></div></header>
    <section className="workspace"><div className="globe-wrap"><Globe aircraft={aircraft} events={events}/></div><div className="hud"><Layers/><div className="legend"><span className="pill">● Live sources</span><span className="pill">◉ Confidence scored</span></div><RightStack events={events} news={news} aircraftCount={aircraft.length}/></div></section>
    <footer className="ticker"><span className="critical">CRITICAL</span><span>{events[0]?.title||"Awaiting event stream"}</span><span className="warning">WATCH</span><span>{news[0]?.title||"Awaiting news stream"}</span><span>DATA SOURCES: OPENSKY · NASA EONET · USGS · GDELT</span></footer>
  </main>
}
