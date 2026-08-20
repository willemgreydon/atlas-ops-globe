import { NextResponse } from "next/server";
import { fetchOpenSkyStates } from "@/lib/providers/opensky";
import { mockAircraft } from "@/lib/mock";
export const dynamic = "force-dynamic";
export async function GET(){ try { const rows = await fetchOpenSkyStates(); return NextResponse.json({provider:"opensky",live:true,rows:rows.slice(0,3000)}); } catch (error) { return NextResponse.json({provider:"mock",live:false,error:String(error),rows:mockAircraft}); } }
