/**
 * Shared constants for the CLI.
 */

/**
 * Default age after which a snapshot file is considered stale.
 * Override with PPV_CLI_SNAPSHOT_STALE_HOURS in the config files.
 */
import { configEntries, STALE_HOURS_KEY } from './config-entries.js';
import { isValidStaleHours } from './config-validation.js';

/**
 * The user-facing CLI command name (the `bin` in package.json). Kept as a
 * single constant because the name appears in several user-visible strings
 * (help output, the token-setup hint, the generated config comment), so a
 * future rename touches code in one place. The package.json bin key, the
 * entry file name, and the docs are literals that must still be updated by
 * hand - this only centralizes the in-code occurrences.
 */
export const PPV_CLI_TOOL_NAME = 'ppv-cli';

export const DEFAULT_SNAPSHOT_STALE_AFTER_MS = 1 * 60 * 60 * 1000;

/**
 * Resolves the age after which a snapshot file is considered stale.
 *
 * The CLI never fetches automatically; when the loaded snapshot is older
 * than this threshold, it only warns the user to run
 * `ppv-cli snapshot create`. Also used as the in-memory store TTL so that
 * `data stats` output (isExpired) conveys the same freshness signal.
 *
 * The default applies to an ABSENT key only - there is no fallback
 * for invalid values (invalid -> error). The startup gate
 * stops settings-consuming commands before this point, so an invalid
 * value here is a wiring bug and throws.
 */
export function resolveSnapshotStaleAfterMs(): number {
  const raw = configEntries().staleHours;
  if (raw === null) {
    return DEFAULT_SNAPSHOT_STALE_AFTER_MS;
  }
  if (!isValidStaleHours(raw)) {
    throw new Error(`invalid ${STALE_HOURS_KEY}: "${raw}"`);
  }
  return Number(raw) * 3_600_000;
}

/**
 * Maximum data size accepted by the in-memory store.
 * Matches PROMIDAS' internal LIMIT_DATA_SIZE_BYTES (30 MiB).
 */
export const STORE_MAX_DATA_SIZE_BYTES = 30 * 1024 * 1024;

/**
 * Fetch limit used to retrieve all prototypes in a single request.
 * Same value as the maximum used by F88/promidas-demo.
 */
export const FETCH_ALL_LIMIT = 10_000;
