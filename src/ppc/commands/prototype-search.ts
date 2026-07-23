/**
 * `ppc prototype search [keywords...]` - loads a snapshot (latest by
 * default) and filters prototypes by the given criteria.
 *
 * Criteria (including multiple keywords, Google-search style) are
 * combined with AND. Results are printed to stdout as tab-separated
 * lines: id, name, users. Works fully offline.
 */
import {
  createStderrLogger,
  resolveLibraryLogLevel,
} from '../../core/logger.js';
import { createRepository } from '../../core/repository-factory.js';
import {
  filterPrototypes,
  hasAnyCriteria,
  type SearchCriteria,
} from '../explorer.js';
import { formatPrototypeRow } from '../format-prototype-row.js';
import { loadSnapshot, selectSnapshot } from '../snapshot-loader.js';

import type { LogLevel } from 'promidas/logger';

export type PrototypeSearchCommandOptions = {
  readonly criteria: SearchCriteria;
  readonly snapshot?: string;
  readonly snapshotDir?: string;
  readonly logLevel: LogLevel;
};

/**
 * Entry point for `ppc prototype search`. Returns the process exit code.
 */
export async function runPrototypeSearch(
  options: PrototypeSearchCommandOptions,
): Promise<number> {
  const logger = createStderrLogger(options.logLevel);

  if (!hasAnyCriteria(options.criteria)) {
    logger.error(
      '検索条件を指定してください (キーワード (複数可、AND)、--tag、--user、--event、--material、--status)。',
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

    const all = await repository.getAllFromSnapshot();
    const hits = filterPrototypes(all, options.criteria);

    logger.info(`${hits.length}件ヒットしました (全${all.length}件)`);
    for (const prototype of hits) {
      process.stdout.write(`${formatPrototypeRow(prototype)}\n`);
    }
    return 0;
  } finally {
    repository.dispose();
  }
}
