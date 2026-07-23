/**
 * Snapshot file catalog: naming convention, listing, and latest resolution.
 *
 * File name convention:
 *   snapshot-<compact UTC timestamp>-<count>.json
 *   e.g. snapshot-20260715T100000Z-1234.json
 *
 * The timestamp and count are embedded in the file name so that listing
 * does not require parsing each JSON file. The authoritative metadata is
 * still the `serializedAt` field inside the file.
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { configEntries } from './config-entries.js';
import { defaultSnapshotDir } from './user-dirs.js';

const SNAPSHOT_FILE_PATTERN =
  /^snapshot-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-(\d+)\.json$/;

export type SnapshotFileInfo = {
  readonly fileName: string;
  readonly filePath: string;
  /** null when the file name does not follow the naming convention. */
  readonly takenAt: Date | null;
  /** null when the file name does not follow the naming convention. */
  readonly count: number | null;
  /** File size on disk; null when stat failed (e.g. just removed). */
  readonly sizeBytes: number | null;
};

/**
 * Resolves the snapshot directory (issue #7):
 * CLI option > PPV_CLI_SNAPSHOT_DIR in the config file > defaultSnapshotDir()
 *
 * Settings are read from the global config file only, never from
 * environment variables or .env files. Repo-clone development uses
 * ./snapshots by passing --snapshot-dir ./snapshots.
 */
export function resolveSnapshotDir(cliDir?: string): string {
  const dir = cliDir ?? configEntries().snapshotDir ?? defaultSnapshotDir();
  return path.resolve(dir);
}

/**
 * Builds a snapshot file name from its taken-at time and prototype count.
 */
export function buildSnapshotFileName(takenAt: Date, count: number): string {
  const compact = takenAt
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replaceAll('-', '')
    .replaceAll(':', '');
  return `snapshot-${compact}-${count}.json`;
}

/**
 * Parses a snapshot file name. Returns null for non-conforming names.
 */
export function parseSnapshotFileName(
  fileName: string,
): { takenAt: Date; count: number } | null {
  const match = SNAPSHOT_FILE_PATTERN.exec(fileName);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, count] = match;
  const takenAt = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );
  if (Number.isNaN(takenAt.getTime())) return null;
  return { takenAt, count: Number(count) };
}

/**
 * Lists JSON files in the snapshot directory, newest first.
 * Files that do not follow the naming convention are placed last
 * (sorted by name). A missing directory yields an empty list.
 * The size comes from stat only - the JSON is never opened.
 */
export async function listSnapshots(dir: string): Promise<SnapshotFileInfo[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const infos = await Promise.all(
    names
      .filter((name) => name.endsWith('.json'))
      .map(async (fileName): Promise<SnapshotFileInfo> => {
        const filePath = path.join(dir, fileName);
        const parsed = parseSnapshotFileName(fileName);
        let sizeBytes: number | null = null;
        try {
          sizeBytes = (await stat(filePath)).size;
        } catch {
          // The file vanished between readdir and stat: keep null.
        }
        return {
          fileName,
          filePath,
          takenAt: parsed?.takenAt ?? null,
          count: parsed?.count ?? null,
          sizeBytes,
        };
      }),
  );

  return infos.sort((a, b) => {
    if (a.takenAt && b.takenAt)
      return b.takenAt.getTime() - a.takenAt.getTime();
    if (a.takenAt) return -1;
    if (b.takenAt) return 1;
    return a.fileName.localeCompare(b.fileName);
  });
}

/**
 * Returns the newest conforming snapshot, or null when none exists.
 */
export async function findLatestSnapshot(
  dir: string,
): Promise<SnapshotFileInfo | null> {
  const infos = await listSnapshots(dir);
  return infos.find((info) => info.takenAt !== null) ?? null;
}
