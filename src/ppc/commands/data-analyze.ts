/**
 * `ppc data analyze` - loads a snapshot (latest by default) and prints the
 * result of PROMIDAS' analyzePrototypes() as JSON to stdout.
 *
 * Works fully offline; no API token is required.
 */
import {
  createStderrLogger,
  resolveLibraryLogLevel,
} from '../../core/logger.js';
import { createRepository } from '../../core/repository-factory.js';
import { loadSnapshot, selectSnapshot } from '../snapshot-loader.js';

import type { LogLevel } from 'promidas/logger';

export type DataAnalyzeCommandOptions = {
  readonly snapshot?: string;
  readonly snapshotDir?: string;
  readonly logLevel: LogLevel;
};

/**
 * Entry point for `ppc data analyze`. Returns the process exit code.
 */
export async function runDataAnalyze(
  options: DataAnalyzeCommandOptions,
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

    const analysis = await repository.analyzePrototypes();
    process.stdout.write(
      `${JSON.stringify(
        { snapshotFile: selection.filePath, ...analysis },
        null,
        2,
      )}\n`,
    );
    return 0;
  } finally {
    repository.dispose();
  }
}
