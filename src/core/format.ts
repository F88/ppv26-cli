/**
 * Formatting helpers shared across commands.
 */
import type { SnapshotFileInfo } from './snapshot-catalog.js';
import type { PrototypeInMemoryStats } from 'promidas';

/**
 * Formats a byte count as a human-readable string (binary units).
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return '?';
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unit = 'B';
  for (const nextUnit of ['KiB', 'MiB', 'GiB']) {
    if (value < 1024) break;
    value /= 1024;
    unit = nextUnit;
  }
  return `${value.toFixed(1)} ${unit}`;
}

/**
 * Formats a file size as "18.4 MB" (SI units, one decimal; values
 * under 1 MB as "512.3 KB"). Snapshot sizes on disk - distinct from
 * formatBytes (binary units) used for in-memory stats.
 */
export function formatSizeMB(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return '?';
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

/**
 * One-line representation of a snapshot file:
 * date, count, size, file name. Shared by ppv-cli snapshot list, the
 * snapshot picker and the snapshot manager.
 */
export function formatSnapshotRow(info: SnapshotFileInfo): string {
  const when = info.takenAt
    ? formatLocalDateTime(info.takenAt)
    : '(命名規則外)      ';
  const count = info.count !== null ? `${info.count}件` : '-';
  return `${when}  ${count}  ${formatSizeMB(info.sizeBytes)}  ${info.fileName}`;
}

/**
 * Formats a Date in the local timezone as "YYYY-MM-DD HH:mm:ss".
 */
export function formatLocalDateTime(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const hms = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${ymd} ${hms}`;
}

/**
 * Converts PrototypeInMemoryStats into a JSON-friendly plain object.
 */
export function statsToJson(
  stats: PrototypeInMemoryStats,
): Record<string, unknown> {
  return {
    size: stats.size,
    cachedAt: stats.cachedAt?.toISOString() ?? null,
    isExpired: stats.isExpired,
    remainingTtlMs: stats.remainingTtlMs,
    dataSizeBytes: stats.dataSizeBytes,
    refreshInFlight: stats.refreshInFlight,
  };
}
