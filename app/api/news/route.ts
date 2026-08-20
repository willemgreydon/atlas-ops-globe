import { NextRequest, NextResponse } from "next/server";
import { fetchGdeltNews } from "@/lib/providers/gdelt";
import { mockNews } from "@/lib/mock";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){ const q=req.nextUrl.searchParams.get("q") || undefined; try { const rows=await fetchGdeltNews(q); return NextResponse.json({provider:"gdelt",live:true,rows}); } catch(error){ return NextResponse.json({provider:"mock",live:false,error:String(error),rows:mockNews}); } }
