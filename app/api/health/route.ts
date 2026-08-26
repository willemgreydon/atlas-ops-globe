import { NextResponse } from "next/server";
import { SOURCES } from "@/lib/intel/sources";

export const dynamic = "force-dynamic";

/**
 * Service + provider configuration health. Derived from the single operational
 * source-of-truth registry (`lib/intel/sources.ts`) — the same one the ingest
 * CLI uses — so this endpoint reflects what is actually wired, not a second,
 * drifting list (audit P1-3: the old `data/provider-registry.ts`-backed health
 * contradicted reality, e.g. marking live providers "planned" and disagreeing
 * on ACLED's env-var names).
 */
export function GET() {
  const providers = SOURCES.map((s) => ({
    key: s.id,
    name: s.name,
    category: s.domains[0] ?? "global",
    domains: s.domains,
    status: s.status, // implemented | next | credential-required | legal-review | research
    enabled: s.enabled,
    configured: (s.envKeys ?? []).every((k) => !!process.env[k]),
    requiresEnv: s.envKeys ?? [],
  }));
  return NextResponse.json({
    ok: true,
    service: "atlas-ops-globe",
    time: new Date().toISOString(),
    providers,
  });
}
