/**
 * Shared snapshot selection and loading for offline commands
 * (stats / show / search).
 *
 * Selection logic:
 * - --snapshot <file> when given, otherwise the latest conforming file
 *   in the snapshot directory.
 * - Warns (never auto-fetches) when the selected snapshot is older than
 *   the staleness threshold, judged by the file name timestamp.
 */
import path from 'node:path';

import { importSnapshotFromFile } from 'promidas-utils/file-io';

import {
  PPV_CLI_TOOL_NAME,
  resolveSnapshotStaleAfterMs,
} from '../core/constants.js';
import { describeFileIoError } from '../core/file-io-errors.js';
import { formatLocalDateTime } from '../core/format.js';
import {
  findLatestSnapshot,
  parseSnapshotFileName,
  resolveSnapshotDir,
} from '../core/snapshot-catalog.js';

import type { ProtopediaInMemoryRepository } from 'promidas';
import type { Logger } from 'promidas/logger';

export type SnapshotSelection = {
  readonly filePath: string;
  /** Taken-at time from the file name; null for non-conforming names. */
  readonly takenAt: Date | null;
};

export type SnapshotSelectOptions = {
  /** Explicit snapshot file path. Defaults to the latest in the directory. */
  readonly snapshot?: string;
  readonly snapshotDir?: string;
};

/**
 * Resolves which snapshot file to load. Logs an error and returns null
 * when no snapshot is available.
 */
export async function selectSnapshot(
  options: SnapshotSelectOptions,
  logger: Logger,
): Promise<SnapshotSelection | null> {
  if (options.snapshot) {
    const filePath = path.resolve(options.snapshot);
    return {
      filePath,
      takenAt: parseSnapshotFileName(path.basename(filePath))?.takenAt ?? null,
    };
  }

  const snapshotDir = resolveSnapshotDir(options.snapshotDir);
  const latest = await findLatestSnapshot(snapshotDir);
  if (!latest) {
    logger.error(
      `snapshot が見つかりません (${snapshotDir})。まず \`${PPV_CLI_TOOL_NAME} snapshot create\` を実行してください。`,
    );
    return null;
  }
  return { filePath: latest.filePath, takenAt: latest.takenAt };
}

/**
 * Loads the selected snapshot file into the repository.
 * Logs the outcome (including a staleness warning) and returns whether
 * the load succeeded.
 */
export async function loadSnapshot(
  repository: ProtopediaInMemoryRepository,
  selection: SnapshotSelection,
  logger: Logger,
): Promise<boolean> {
  const result = await importSnapshotFromFile(repository, selection.filePath);
  if (!result.ok) {
    logger.error(
      `snapshot の読み込みに失敗しました: ${describeFileIoError(result.error)}`,
    );
    return false;
  }

  logger.info(`snapshot をロードしました: ${selection.filePath}`);
  logLoadSummary(result.prototypesLoaded, selection.takenAt, logger);
  return true;
}

/**
 * Logs a one-line summary of the loaded snapshot (count, taken-at time,
 * age) and warns when it is older than the staleness threshold.
 *
 * The age is judged from the file name timestamp: loading a file resets
 * the store's cachedAt to "now", so store stats cannot tell the file age.
 */
function logLoadSummary(
  count: number,
  takenAt: Date | null,
  logger: Logger,
): void {
  if (!takenAt) {
    logger.info(`${count}件, 取得時刻: 不明 (ファイル名が命名規則外)`);
    return;
  }

  const ageMs = Date.now() - takenAt.getTime();
  const hours = (ageMs / 3_600_000).toFixed(1);
  logger.info(
    `${count}件, 取得時刻: ${formatLocalDateTime(takenAt)} (約${hours}時間前)`,
  );
  if (ageMs >= resolveSnapshotStaleAfterMs()) {
    logger.warn(
      `この snapshot は約 ${hours} 時間前のデータです。\`${PPV_CLI_TOOL_NAME} snapshot create\` で更新できます。`,
    );
  }
}
