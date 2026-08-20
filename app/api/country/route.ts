import { NextRequest, NextResponse } from "next/server";
import { runProvider } from "@/lib/core/provider";
import { worldBankProvider } from "@/lib/providers/worldbank";

export const dynamic = "force-dynamic";

/** Accept ISO-3 (preferred) or common ISO-2 aliases; validate to letters only. */
export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("iso") || "AUT").toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(raw)) {
    return NextResponse.json({ error: "invalid iso code" }, { status: 400 });
  }
  const result = await runProvider(worldBankProvider(raw), { cacheKey: `worldbank:${raw}` });
  return NextResponse.json(result);
}
