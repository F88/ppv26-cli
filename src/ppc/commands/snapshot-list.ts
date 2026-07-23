/**
 * `ppc snapshot list` - lists saved snapshot files, newest first.
 */
import { PPV_CLI_TOOL_NAME } from '../../core/constants.js';
import { formatLocalDateTime, formatSizeMB } from '../../core/format.js';
import { createStderrLogger } from '../../core/logger.js';
import {
  listSnapshots,
  resolveSnapshotDir,
} from '../../core/snapshot-catalog.js';

import type { LogLevel } from 'promidas/logger';

export type SnapshotListCommandOptions = {
  readonly snapshotDir?: string;
  readonly logLevel: LogLevel;
};

/**
 * Entry point for `ppc snapshot list`. Returns the process exit code.
 */
export async function runSnapshotList(
  options: SnapshotListCommandOptions,
): Promise<number> {
  const logger = createStderrLogger(options.logLevel);
  const snapshotDir = resolveSnapshotDir(options.snapshotDir);
  const infos = await listSnapshots(snapshotDir);

  if (infos.length === 0) {
    logger.info(
      `snapshot はまだありません (${snapshotDir})。\`${PPV_CLI_TOOL_NAME} snapshot create\` で作成できます。`,
    );
    return 0;
  }

  logger.info(`snapshot ディレクトリ: ${snapshotDir}`);
  for (const info of infos) {
    const takenAt = info.takenAt
      ? formatLocalDateTime(info.takenAt)
      : '(命名規則外)      ';
    const count = info.count !== null ? `${info.count}件` : '-';
    const size = formatSizeMB(info.sizeBytes);
    process.stdout.write(`${takenAt}\t${count}\t${size}\t${info.fileName}\n`);
  }
  return 0;
}
