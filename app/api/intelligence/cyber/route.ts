import { NextRequest } from "next/server";
import { listVulnerabilities, parsePage, parseSince } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";
import { emptyPage, safeVault } from "@/lib/intel/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return safeVault(
    () => ({
      ...attachFreshness(
        listVulnerabilities(parsePage(sp), {
          kevOnly: sp.get("kev") === "1" || sp.get("kev") === "true",
          since: parseSince(sp.get("since")),
        }),
        "cyber",
        "publishedAt",
      ),
      attribution: "CISA KEV / NVD",
    }),
    emptyPage({ attribution: "CISA KEV / NVD" }, "cyber"),
  );
}
