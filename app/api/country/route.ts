import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/fetch-json";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){ const iso=(req.nextUrl.searchParams.get("iso")||"AUT").toUpperCase(); try { const [meta,gdp,pop] = await Promise.all([
  fetchJson<any>(`https://api.worldbank.org/v2/country/${iso}?format=json`),
  fetchJson<any>(`https://api.worldbank.org/v2/country/${iso}/indicator/NY.GDP.MKTP.CD?format=json&per_page=3`),
  fetchJson<any>(`https://api.worldbank.org/v2/country/${iso}/indicator/SP.POP.TOTL?format=json&per_page=3`)
]); return NextResponse.json({iso,meta:meta?.[1]?.[0]??null,gdp:gdp?.[1]?.find((x:any)=>x.value!=null)??null,population:pop?.[1]?.find((x:any)=>x.value!=null)??null}); } catch(error){ return NextResponse.json({iso,error:String(error)},{status:502}); } }
