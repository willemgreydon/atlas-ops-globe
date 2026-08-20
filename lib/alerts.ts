import type { Alert, WorldEvent } from "@/types/domain";

/**
 * Derive alerts from the current event set. Alerts are not a separate fabricated
 * feed — they are the highest-severity real events promoted to the alert model,
 * so clicking one focuses a real marker on the globe.
 */
const SEVERITY_ORDER = { critical: 0, warning: 1, watch: 2, info: 3 } as const;

export function deriveAlerts(events: WorldEvent[], limit = 8): Alert[] {
  return [...events]
    .filter((e) => e.severity === "critical" || e.severity === "warning")
    .sort((a, b) => {
      const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      return s !== 0 ? s : b.occurredAt.localeCompare(a.occurredAt);
    })
    .slice(0, limit)
    .map((e) => ({
      id: `alert:${e.id}`,
      title: e.title,
      category: e.kind,
      severity: e.severity,
      confidence: e.confidence,
      location: e.location,
      relatedEventId: e.id,
      source: e.source,
      createdAt: e.occurredAt,
    }));
}
