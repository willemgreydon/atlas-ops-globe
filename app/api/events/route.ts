import { NextResponse } from "next/server";
import { fetchEonetEvents } from "@/lib/providers/eonet";
import { fetchEarthquakes } from "@/lib/providers/usgs";
import { mockEvents } from "@/lib/mock";
export const dynamic = "force-dynamic";
export async function GET(){ try { const [eonet,quakes] = await Promise.allSettled([fetchEonetEvents(),fetchEarthquakes()]); const rows=[...(eonet.status==="fulfilled"?eonet.value:[]),...(quakes.status==="fulfilled"?quakes.value:[])]; return NextResponse.json({live:rows.length>0,rows:rows.length?rows:mockEvents}); } catch(error){ return NextResponse.json({live:false,error:String(error),rows:mockEvents}); } }
