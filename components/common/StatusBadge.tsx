import type { DataStatus } from "@/types/domain";

const LABEL: Record<DataStatus, string> = {
  live: "LIVE",
  delayed: "DELAYED",
  cached: "CACHED",
  mock: "MOCK",
  offline: "OFFLINE",
};

/**
 * Honest liveness pill. Colour + label always reflect the real
 * {@link DataStatus} — mock/cached data is never shown as live.
 */
export default function StatusBadge({ status, title }: { status: DataStatus; title?: string }) {
  return (
    <span className={`status-badge status-${status}`} title={title}>
      <i className="status-dot" />
      {LABEL[status]}
    </span>
  );
}
