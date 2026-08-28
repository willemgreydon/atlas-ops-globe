import { buildGlobalSnapshot } from "@/lib/intel/global";
import { safeVault } from "@/lib/intel/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return safeVault(
    () => buildGlobalSnapshot() as unknown as Record<string, unknown>,
    { generatedAt: new Date().toISOString(), activeDisasters: 0, earthquakes24h: 0, majorStories: [] },
  );
}
