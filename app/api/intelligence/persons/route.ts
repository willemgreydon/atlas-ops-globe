import { NextRequest } from "next/server";
import { listPersons, parsePage } from "@/lib/intel/queries";
import { emptyPage, safeVault } from "@/lib/intel/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return safeVault(
    () => ({ ...listPersons(parsePage(req.nextUrl.searchParams)), attribution: "Event Registry / Wikipedia" }),
    emptyPage({ attribution: "Event Registry / Wikipedia" }),
  );
}
