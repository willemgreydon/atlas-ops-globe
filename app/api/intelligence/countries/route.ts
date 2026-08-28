import { NextRequest } from "next/server";
import { listCountries, parsePage } from "@/lib/intel/queries";
import { emptyPage, safeVault } from "@/lib/intel/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return safeVault(() => listCountries(parsePage(req.nextUrl.searchParams)), emptyPage());
}
