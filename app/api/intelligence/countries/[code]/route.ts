import { NextRequest, NextResponse } from "next/server";
import { getCountryProfile } from "@/lib/intel/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!/^[A-Za-z]{2,3}$/.test(code)) {
    return NextResponse.json({ error: "invalid country code" }, { status: 400 });
  }
  const profile = getCountryProfile(code);
  if (!profile) return NextResponse.json({ error: "country not found" }, { status: 404 });
  return NextResponse.json(profile);
}
