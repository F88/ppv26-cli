/**
 * `ppc prototype show <id>` - loads a snapshot (latest by default) and prints the
 * prototype with the given ID as JSON to stdout.
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

export type PrototypeShowCommandOptions = {
  readonly prototypeId: number;
  readonly snapshot?: string;
  readonly snapshotDir?: string;
  readonly logLevel: LogLevel;
};

/**
 * Entry point for `ppc prototype show`. Returns the process exit code.
 */
export async function runPrototypeShow(
  options: PrototypeShowCommandOptions,
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

    const prototype = await repository.getPrototypeFromSnapshotByPrototypeId(
      options.prototypeId,
    );
    if (prototype === null) {
      logger.error(`ID ${options.prototypeId} の作品はありません。`);
      return 1;
    }

    process.stdout.write(`${JSON.stringify(prototype, null, 2)}\n`);
    return 0;
  } finally {
    repository.dispose();
  }
}
