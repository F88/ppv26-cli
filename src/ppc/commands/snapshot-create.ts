/**
 * `ppc snapshot create` - fetches all prototypes from the ProtoPedia API
 * and saves them as a new snapshot file.
 *
 * This is the only command that talks to the API (and therefore the only
 * one that needs the token). Fetching is always an explicit user action;
 * the CLI never fetches automatically.
 */
import path from 'node:path';

import { exportSnapshotToFile } from 'promidas-utils/file-io';
import { toLocalizedMessage } from 'promidas-utils/repository';

import { describeFileIoError } from '../../core/file-io-errors.js';
import { formatBytes, statsToJson } from '../../core/format.js';
import {
  createStderrLogger,
  resolveLibraryLogLevel,
} from '../../core/logger.js';
import { createRepository } from '../../core/repository-factory.js';
import {
  buildSnapshotFileName,
  resolveSnapshotDir,
} from '../../core/snapshot-catalog.js';
import { resolveToken, SET_TOKEN_COMMAND } from '../../core/token.js';

import type { FetchProgressEvent } from 'promidas/fetcher';
import type { LogLevel } from 'promidas/logger';

export type SnapshotCreateCommandOptions = {
  readonly limit: number;
  readonly snapshotDir?: string;
  readonly logLevel: LogLevel;
};

/**
 * Renders download progress to stderr.
 * Uses carriage returns for in-place percentage updates.
 *
 * Exported for unit testing. `complete` fires for 4xx/5xx too (the error
 * body still transfers to the end), so the rendering consults each
 * event's HTTP `status` to avoid presenting an error response as a
 * successful download (promidas #126).
 */
export function createProgressRenderer(): (event: FetchProgressEvent) => void {
  let inProgressLine = false;
  const endProgressLine = (): void => {
    if (inProgressLine) {
      process.stderr.write('\n');
      inProgressLine = false;
    }
  };

  return (event) => {
    switch (event.type) {
      case 'request-start':
        process.stderr.write('API リクエストを開始しました...\n');
        break;
      case 'response-received':
        // For a 4xx/5xx the estimatedTotal (derived from the URL limit)
        // is meaningless against the small error body, so show the status
        // instead of a misleading size estimate.
        process.stderr.write(
          event.status >= 400
            ? `レスポンス受信 (HTTP ${event.status})\n`
            : `レスポンス受信 (推定サイズ: ${formatBytes(event.estimatedTotal)})\n`,
        );
        break;
      case 'download-progress': {
        // The body being streamed for a 4xx/5xx is the error payload
        // (e.g. a 401 JSON): its percentage and size say nothing about a
        // fetch, so do not render a progress line for it.
        if (event.status >= 400) break;
        const percentage =
          typeof event.percentage === 'number'
            ? `${event.percentage.toFixed(1)}%`
            : '?%';
        process.stderr.write(
          `\rダウンロード中 ${percentage} (${formatBytes(event.received)})`,
        );
        inProgressLine = true;
        break;
      }
      case 'complete':
        endProgressLine();
        // `complete` also fires for 4xx/5xx once the error body finishes
        // transferring (WHATWG fetch semantics), so check the status to
        // avoid presenting it as a successful download (promidas #126).
        process.stderr.write(
          event.status >= 400
            ? `レスポンス受信完了 (HTTP ${event.status}, ${formatBytes(event.received)})\n`
            : `ダウンロード完了 (${formatBytes(event.received)}, ${event.totalTimeMs}ms)\n`,
        );
        break;
      case 'error':
        endProgressLine();
        process.stderr.write(`ダウンロードエラー: ${event.error}\n`);
        break;
    }
  };
}

/**
 * Entry point for `ppc snapshot create`. Returns the process exit code.
 */
export async function runSnapshotCreate(
  options: SnapshotCreateCommandOptions,
): Promise<number> {
  const logger = createStderrLogger(options.logLevel);

  const token = resolveToken();
  if (token === null) {
    logger.error('PROTOPEDIA_API_V2_TOKEN が設定されていません。');
    logger.error(`${SET_TOKEN_COMMAND} を実行してトークンを設定してください。`);
    return 1;
  }

  const libraryLogger = createStderrLogger(
    resolveLibraryLogLevel(options.logLevel),
  );
  const repository = createRepository({
    token,
    logger: libraryLogger,
    onProgress: createProgressRenderer(),
  });

  try {
    repository.events?.on('snapshotStarted', (params) => {
      logger.debug('snapshotStarted', params);
    });
    repository.events?.on('snapshotCompleted', (stats) => {
      logger.debug('snapshotCompleted', { size: stats.size });
    });
    repository.events?.on('snapshotFailed', (failure) => {
      logger.debug('snapshotFailed', {
        origin: failure.origin,
        message: failure.message,
      });
    });

    logger.info(`ProtoPedia API から取得します (limit: ${options.limit})`);
    const result = await repository.setupSnapshot({
      limit: options.limit,
      offset: 0,
    });
    if (!result.ok) {
      logger.error(`データ取得に失敗しました: ${toLocalizedMessage(result)}`);
      return 1;
    }

    const stats = result.stats;
    const snapshotDir = resolveSnapshotDir(options.snapshotDir);
    const fileName = buildSnapshotFileName(
      stats.cachedAt ?? new Date(),
      stats.size,
    );
    const exportResult = await exportSnapshotToFile(
      repository,
      path.join(snapshotDir, fileName),
    );
    if (!exportResult.ok) {
      logger.error(
        `snapshot の保存に失敗しました: ${describeFileIoError(exportResult.error)}`,
      );
      return 1;
    }

    logger.info(
      `snapshot を保存しました: ${exportResult.filePath} ` +
        `(${exportResult.prototypesExported}件, ${formatBytes(exportResult.bytesWritten)})`,
    );
    process.stdout.write(
      `${JSON.stringify(
        { snapshotFile: exportResult.filePath, ...statsToJson(stats) },
        null,
        2,
      )}\n`,
    );
    return 0;
  } finally {
    repository.dispose();
  }
}
