/**
 * Snapshot session management for the interactive UIs (ppex, pptop).
 *
 * A "session" is a loaded snapshot plus the metadata shown in the
 * always-visible header: file identity, the real generation time
 * (serializedAt from the file content, not the file name), counts,
 * data size, and the prototype ID range used for input validation.
 *
 * Loading parses the file itself and calls
 * setupSnapshotFromSerializedData() (the PROMIDAS-native path) instead
 * of promidas-utils' importSnapshotFromFile(), because the latter does
 * not hand back the parsed metadata.
 *
 * Non-React module so that it stays unit-testable.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { exportSnapshotToFile } from 'promidas-utils/file-io';
import { toLocalizedMessage } from 'promidas-utils/repository';

import { FETCH_ALL_LIMIT } from './constants.js';
import { describeFileIoError } from './file-io-errors.js';
import { createStderrLogger } from './logger.js';
import { createRepository } from './repository-factory.js';
import { buildSnapshotFileName } from './snapshot-catalog.js';

import type { ProtopediaInMemoryRepository } from 'promidas';
import type { FetchProgressEvent } from 'promidas/fetcher';

type SerializedSnapshotData = Parameters<
  ProtopediaInMemoryRepository['setupSnapshotFromSerializedData']
>[0];

export type SnapshotSession = {
  readonly filePath: string;
  readonly fileName: string;
  /** Snapshot format version from the file content. */
  readonly version: string;
  /** Real generation time from the file content (serializedAt). */
  readonly serializedAt: Date;
  readonly size: number;
  readonly dataSizeBytes: number;
  /** null when the snapshot is empty. */
  readonly minId: number | null;
  readonly maxId: number | null;
};

export type SessionResult =
  | {
      readonly ok: true;
      readonly session: SnapshotSession;
      readonly repository: ProtopediaInMemoryRepository;
    }
  | { readonly ok: false; readonly message: string };

/**
 * Builds the session metadata from a repository that already holds the
 * snapshot data.
 */
async function buildSession(
  repository: ProtopediaInMemoryRepository,
  filePath: string,
  version: string,
  serializedAt: Date,
): Promise<SnapshotSession> {
  const stats = repository.getStats();
  const { min, max } = await repository.analyzePrototypes();
  return {
    filePath,
    fileName: path.basename(filePath),
    version,
    serializedAt,
    size: stats.size,
    dataSizeBytes: stats.dataSizeBytes,
    minId: min,
    maxId: max,
  };
}

/**
 * Loads a snapshot file into a fresh repository and returns the session.
 * The caller owns the returned repository (call dispose() when done).
 */
export async function loadSession(filePath: string): Promise<SessionResult> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    return {
      ok: false,
      message: `ファイルを読み込めません: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  let data: SerializedSnapshotData;
  try {
    data = JSON.parse(raw) as SerializedSnapshotData;
  } catch {
    return { ok: false, message: 'JSON として解釈できません。' };
  }

  const serializedAt = new Date(data.serializedAt);
  if (Number.isNaN(serializedAt.getTime())) {
    return { ok: false, message: 'serializedAt が不正です。' };
  }

  const repository = createRepository({
    logger: createStderrLogger('silent'),
  });
  const result = repository.setupSnapshotFromSerializedData(data);
  if (!result.ok) {
    repository.dispose();
    return { ok: false, message: toLocalizedMessage(result) };
  }

  return {
    ok: true,
    session: await buildSession(
      repository,
      filePath,
      data.version,
      serializedAt,
    ),
    repository,
  };
}

export type CreateSessionOptions = {
  readonly token: string;
  readonly snapshotDir: string;
  readonly onProgress?: (event: FetchProgressEvent) => void;
};

/**
 * Fetches all prototypes from the API, saves a new snapshot file, and
 * returns the session for the freshly fetched data.
 * The caller owns the returned repository (call dispose() when done).
 */
export async function createSession(
  options: CreateSessionOptions,
): Promise<SessionResult> {
  const repository = createRepository({
    token: options.token,
    logger: createStderrLogger('silent'),
    ...(options.onProgress ? { onProgress: options.onProgress } : {}),
  });

  const result = await repository.setupSnapshot({
    limit: FETCH_ALL_LIMIT,
    offset: 0,
  });
  if (!result.ok) {
    repository.dispose();
    return {
      ok: false,
      message: `データ取得に失敗しました: ${toLocalizedMessage(result)}`,
    };
  }

  const stats = result.stats;
  const takenAt = stats.cachedAt ?? new Date();
  const filePath = path.join(
    options.snapshotDir,
    buildSnapshotFileName(takenAt, stats.size),
  );
  const exportResult = await exportSnapshotToFile(repository, filePath);
  if (!exportResult.ok) {
    repository.dispose();
    return {
      ok: false,
      message: `snapshot の保存に失敗しました: ${describeFileIoError(exportResult.error)}`,
    };
  }

  const version = repository.getSerializableSnapshot().version;
  return {
    ok: true,
    session: await buildSession(repository, filePath, version, takenAt),
    repository,
  };
}
