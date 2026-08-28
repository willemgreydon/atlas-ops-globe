import { NextRequest } from "next/server";
import { listOrganizations, parsePage } from "@/lib/intel/queries";
import { emptyPage, safeVault } from "@/lib/intel/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return safeVault(
    () => ({ ...listOrganizations(parsePage(req.nextUrl.searchParams)), attribution: "Event Registry / Wikipedia" }),
    emptyPage({ attribution: "Event Registry / Wikipedia" }),
  );
}
