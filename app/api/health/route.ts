import { NextResponse } from "next/server";
import { providerRegistry } from "@/data/provider-registry";

export const dynamic = "force-dynamic";

/**
 * Service + provider configuration health. Reports which providers are wired
 * and whether their required credentials are present in the environment.
 */
export function GET() {
  const providers = providerRegistry.map((p) => ({
    key: p.key,
    name: p.name,
    category: p.category,
    status: p.status,
    configured: (p.envKeys ?? []).every((k) => !!process.env[k]),
    requiresEnv: p.envKeys ?? [],
  }));
  return NextResponse.json({
    ok: true,
    service: "atlas-ops-globe",
    time: new Date().toISOString(),
    providers,
  });
}
