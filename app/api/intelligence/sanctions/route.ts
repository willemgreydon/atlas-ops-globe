import { NextRequest } from "next/server";
import { listSanctions, parsePage } from "@/lib/intel/queries";
import { emptyPage, safeVault } from "@/lib/intel/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return safeVault(
    () => ({ ...listSanctions(parsePage(sp), { q: sp.get("q") ?? undefined, type: sp.get("type") ?? undefined }), attribution: "U.S. Treasury OFAC (SDN)" }),
    emptyPage({ attribution: "U.S. Treasury OFAC (SDN)" }),
  );
}
