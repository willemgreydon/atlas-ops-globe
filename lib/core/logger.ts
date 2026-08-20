/**
 * Structured logging. Emits single-line JSON so logs can later be shipped to
 * Loki/OpenTelemetry without reformatting (see docs/ARCHITECTURE.md §observability).
 */

type Level = "debug" | "info" | "warn" | "error";

export interface LogFields {
  provider?: string;
  requestId?: string;
  durationMs?: number;
  status?: string;
  cacheHit?: boolean;
  records?: number;
  error?: string;
  [key: string]: unknown;
}

function emit(level: Level, message: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ level, message, ts: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, fields?: LogFields) => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
};
