import { buildGlobalSnapshot } from "@/lib/intel/global";
import { safeVault } from "@/lib/intel/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full-shape fallback: the client reads v.counts.<x> and v.majorStories without
// deep null-guards, so a partial object would crash render. Everything zeroed.
const EMPTY_SNAPSHOT = {
  generatedAt: new Date(0).toISOString(),
  activeDisasters: 0,
  earthquakes24h: 0,
  majorStories: [] as { id: string; title: string; articleCount: number }[],
  counts: {
    countries: 0, newsArticles: 0, newsStories: 0, events: 0, vulnerabilities: 0, kev: 0,
    spaceObjects: 0, aircraftSnapshot: 0, relationships: 0, persons: 0, organizations: 0, sanctions: 0,
  },
  markets: null,
  maritime: null,
  sources: [] as string[],
};

export function GET() {
  return safeVault(
    () => buildGlobalSnapshot() as unknown as Record<string, unknown>,
    { ...EMPTY_SNAPSHOT, generatedAt: new Date().toISOString() },
  );
}
