/**
 * Repository construction via PromidasRepositoryBuilder.
 *
 * Configuration follows the reference implementation in F88/promidas-demo
 * (src/lib/repository/), adapted for a CLI: all layers share a stderr
 * logger, and download progress is reported through a callback.
 *
 * Note: the factory functions (createPromidasForLocal etc.) are
 * intentionally not used, per the library author's recommendation.
 */
import { PromidasRepositoryBuilder } from 'promidas';

import {
  resolveSnapshotStaleAfterMs,
  STORE_MAX_DATA_SIZE_BYTES,
} from './constants.js';

import type { ProtopediaInMemoryRepository } from 'promidas';
import type { FetchProgressEvent } from 'promidas/fetcher';
import type { Logger } from 'promidas/logger';

/**
 * Placeholder token for offline usage (loading snapshots from files).
 *
 * The builder always constructs the API client, and the client's
 * constructor rejects a missing token even when the API is never called.
 * Offline commands therefore pass this placeholder; any accidental API
 * call with it fails with an authentication error.
 */
const OFFLINE_TOKEN_PLACEHOLDER = 'offline-no-token';

export type CreateRepositoryOptions = {
  /** API token. Omit for offline usage (loading snapshots from files). */
  readonly token?: string;
  readonly logger: Logger;
  /** Download progress callback used during fetch. */
  readonly onProgress?: (event: FetchProgressEvent) => void;
};

/**
 * Builds a ProtopediaInMemoryRepository configured for this CLI.
 */
export function createRepository(
  options: CreateRepositoryOptions,
): ProtopediaInMemoryRepository {
  const { token, logger, onProgress } = options;

  return new PromidasRepositoryBuilder()
    .setStoreConfig({
      ttlMs: resolveSnapshotStaleAfterMs(),
      maxDataSizeBytes: STORE_MAX_DATA_SIZE_BYTES,
      logger,
    })
    .setApiClientConfig({
      protoPediaApiClientOptions: {
        token: token ?? OFFLINE_TOKEN_PLACEHOLDER,
        logger,
      },
      logger,
      // Progress is rendered by the CLI's own callback instead.
      progressLog: false,
      ...(onProgress ? { progressCallback: onProgress } : {}),
    })
    .setRepositoryConfig({
      logger,
      enableEvents: true,
    })
    .build();
}
