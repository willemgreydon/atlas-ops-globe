import { tableCounts } from "@/lib/intel/repositories";
import { safeVault } from "@/lib/intel/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return safeVault(
    () => ({ generatedAt: new Date().toISOString(), counts: tableCounts() }),
    { generatedAt: new Date().toISOString(), counts: {} },
  );
}
