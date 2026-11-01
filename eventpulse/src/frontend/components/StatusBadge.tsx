import type { EventStatus } from "../../shared/types";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  live: "Live Now",
  ended: "Ended",
  cancelled: "Cancelled",
  postponed: "Postponed",
  paused: "Paused",
};

export function StatusBadge({ status }: { status: EventStatus }) {
  const cls = `status-badge status-${status}`;
  return (
    <span className={cls}>
      <span className="dot" />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function LiveStatusIndicator({
  status,
  availableTickets,
  lastUpdated,
  isStale,
  connected,
}: {
  status: string | null;
  availableTickets: number | null;
  lastUpdated: number | null;
  isStale: boolean;
  connected: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {status && <StatusBadge status={status as EventStatus} />}
      {availableTickets !== null && (
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {availableTickets} tickets available
        </span>
      )}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        {lastUpdated && (
          <span className="last-updated">
            Last updated {new Date(lastUpdated).toLocaleTimeString()}
          </span>
        )}
        {connected && (
          <span style={{ fontSize: "0.75rem", color: "var(--green)" }}>
            ● Live
          </span>
        )}
        {isStale && (
          <span className="stale-warning">⚠ Data may be stale</span>
        )}
      </div>
    </div>
  );
}
