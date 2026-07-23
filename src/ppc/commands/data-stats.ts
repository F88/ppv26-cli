/**
 * `ppc data stats` - loads a snapshot file (latest by default) into the
 * repository and prints the store stats as JSON to stdout.
 *
 * Works fully offline; no API token is required.
 */
import { statsToJson } from '../../core/format.js';
import {
  createStderrLogger,
  resolveLibraryLogLevel,
} from '../../core/logger.js';
import { createRepository } from '../../core/repository-factory.js';
import { loadSnapshot, selectSnapshot } from '../snapshot-loader.js';

import type { LogLevel } from 'promidas/logger';

export type DataStatsCommandOptions = {
  /** Explicit snapshot file path. Defaults to the latest in the directory. */
  readonly snapshot?: string;
  readonly snapshotDir?: string;
  readonly logLevel: LogLevel;
};

/**
 * Entry point for `ppc data stats`. Returns the process exit code.
 */
export async function runDataStats(
  options: DataStatsCommandOptions,
): Promise<number> {
  const logger = createStderrLogger(options.logLevel);

  const selection = await selectSnapshot(options, logger);
  if (!selection) return 1;

  const libraryLogger = createStderrLogger(
    resolveLibraryLogLevel(options.logLevel),
  );
  const repository = createRepository({ logger: libraryLogger });
  try {
    if (!(await loadSnapshot(repository, selection, logger))) return 1;

    const stats = repository.getStats();
    process.stdout.write(
      `${JSON.stringify(
        {
          snapshotFile: selection.filePath,
          snapshotTakenAt: selection.takenAt?.toISOString() ?? null,
          ...statsToJson(stats),
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  } finally {
    repository.dispose();
  }
}
