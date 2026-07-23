/**
 * `ppc prototype list` - loads a snapshot (latest by default) and lists
 * prototypes as tab-separated lines (id, name, users), ID ascending.
 *
 * Unlike `prototype search` (which requires criteria), `list` enumerates
 * without conditions. Exactly one of --all / --first / --last is
 * required (the CLI layer shows help when none is given); --first /
 * --last narrow the output to the n smallest / largest IDs while
 * keeping the ascending display order.
 *
 * Works fully offline; no API token is required.
 */
import {
  createStderrLogger,
  resolveLibraryLogLevel,
} from '../../core/logger.js';
import { createRepository } from '../../core/repository-factory.js';
import { formatPrototypeRow } from '../format-prototype-row.js';
import { loadSnapshot, selectSnapshot } from '../snapshot-loader.js';

import type { LogLevel } from 'promidas/logger';

export type PrototypeListCommandOptions = {
  /** Show all prototypes. Mutually exclusive with `first` / `last`. */
  readonly all?: boolean;
  /** Show only the n smallest IDs. Mutually exclusive with the others. */
  readonly first?: number;
  /** Show only the n largest IDs. Mutually exclusive with the others. */
  readonly last?: number;
  readonly snapshot?: string;
  readonly snapshotDir?: string;
  readonly logLevel: LogLevel;
};

/**
 * Entry point for `ppc prototype list`. Returns the process exit code.
 */
export async function runPrototypeList(
  options: PrototypeListCommandOptions,
): Promise<number> {
  const logger = createStderrLogger(options.logLevel);

  const rangeOptionCount = [
    options.all === true,
    options.first !== undefined,
    options.last !== undefined,
  ].filter(Boolean).length;
  if (rangeOptionCount !== 1) {
    logger.error(
      '--all / --first <n> / --last <n> のいずれか 1 つを指定してください。',
    );
    return 1;
  }

  const selection = await selectSnapshot(options, logger);
  if (!selection) return 1;

  const libraryLogger = createStderrLogger(
    resolveLibraryLogLevel(options.logLevel),
  );
  const repository = createRepository({ logger: libraryLogger });
  try {
    if (!(await loadSnapshot(repository, selection, logger))) return 1;

    const all = [...(await repository.getAllFromSnapshot())].sort(
      (a, b) => a.id - b.id,
    );

    let listed: typeof all;
    if (options.first !== undefined) {
      listed = all.slice(0, options.first);
      logger.info(`先頭${listed.length}件を表示します (全${all.length}件)`);
    } else if (options.last !== undefined) {
      listed = all.slice(Math.max(0, all.length - options.last));
      logger.info(`末尾${listed.length}件を表示します (全${all.length}件)`);
    } else {
      listed = all;
      logger.info(`全${all.length}件を表示します`);
    }

    for (const prototype of listed) {
      process.stdout.write(`${formatPrototypeRow(prototype)}\n`);
    }
    return 0;
  } finally {
    repository.dispose();
  }
}
