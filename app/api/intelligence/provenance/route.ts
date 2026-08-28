import { NextRequest, NextResponse } from "next/server";
import { listProvenance } from "@/lib/intel/queries";
import { safeVault } from "@/lib/intel/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lineage trace for a single vault subject: `?subject=<record-or-relationship-id>`.
 * Returns the normalized provenance rows (provider, record id, timestamps,
 * transformation) so a client can answer "why does Atlas believe this?" (§9).
 */
export function GET(req: NextRequest) {
  const subject = req.nextUrl.searchParams.get("subject");
  if (!subject) {
    return NextResponse.json({ error: "missing `subject` parameter" }, { status: 400 });
  }
  return safeVault(() => ({ subject, provenance: listProvenance(subject) }), { subject, provenance: [] });
}
