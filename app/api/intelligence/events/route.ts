import { NextRequest } from "next/server";
import { listEvents, parseBbox, parsePage, parseSince } from "@/lib/intel/queries";
import { attachFreshness } from "@/lib/intel/freshness";
import { emptyPage, safeVault } from "@/lib/intel/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") ?? undefined;
  const domain = kind === "conflict" ? "conflict" : "event";
  return safeVault(
    () => attachFreshness(
      listEvents(parsePage(sp), {
        kind,
        country: sp.get("country") ?? undefined,
        bbox: parseBbox(sp.get("bbox")),
        since: parseSince(sp.get("since")),
      }),
      domain,
      "occurredAt",
    ),
    emptyPage({}, domain),
  );
}
