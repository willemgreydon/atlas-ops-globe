import { NextRequest } from "next/server";
import { listSpace, parsePage } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";
import { emptyPage, safeVault } from "@/lib/intel/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return safeVault(
    // Freshness is keyed on TLE epoch age — an old TLE must not read as live (§19).
    () => ({ ...attachFreshness(listSpace(parsePage(req.nextUrl.searchParams)), "space", "epoch"), attribution: "CelesTrak" }),
    emptyPage({ attribution: "CelesTrak" }, "space"),
  );
}
