/**
 * Application configuration (issue #7).
 *
 * The global config file (path: user-dirs.ts) is the single source
 * of truth - for every value,
 * the token included. No .env files, no --config option, no
 * environment-variable overrides (all considered and rejected on
 * 2026-07-16: one well-known file keeps the behavior predictable
 * and closes every injection route). One-shot overrides are the
 * existing CLI options (--snapshot-dir, --verbose / --quiet).
 *
 * dotenv is used as a pure parser and NOTHING is written into
 * process.env.
 */
import { readFileSync } from 'node:fs';

import { parse as parseDotenv } from 'dotenv';
import { TOKEN_KEYS } from 'promidas-utils/token';

import { TOKEN_PLACEHOLDER } from './config-file.js';
import { globalConfigPath } from './user-dirs.js';

export const SNAPSHOT_DIR_KEY = 'PPV_CLI_SNAPSHOT_DIR';
export const LOG_LEVEL_KEY = 'PPV_CLI_LOG_LEVEL';
export const STALE_HOURS_KEY = 'PPV_CLI_SNAPSHOT_STALE_HOURS';

/**
 * How reading the config file went. 'missing' is the normal
 * first-run state; 'unreadable' (the file exists but could not be
 * read, e.g. a permission problem) is an environment error - the
 * entries are unknown then, not unset.
 */
export type ConfigFileStatus = 'read' | 'missing' | 'unreadable';

export type ConfigEntries = {
  readonly token: string | null;
  readonly snapshotDir: string | null;
  readonly logLevel: string | null;
  readonly staleHours: string | null;
  /** How reading the file went. */
  readonly fileStatus: ConfigFileStatus;
};

let current: ConfigEntries | null = null;

/**
 * Loads the global config file and installs the result as the
 * process-wide
 * config. A missing file is the normal first-run state.
 */
export function initConfigEntries(): ConfigEntries {
  let parsed: Record<string, string> = {};
  let fileStatus: ConfigFileStatus = 'read';
  try {
    parsed = parseDotenv(readFileSync(globalConfigPath(), 'utf8'));
  } catch (error) {
    // Missing file (the normal first-run state) runs on built-in
    // defaults. Anything else means the file exists but could not
    // be read - never treat that as "unset" (the entries are
    // unknown); commands that consume settings stop on it.
    fileStatus =
      (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'missing'
        : 'unreadable';
  }

  // The template's placeholder means "not set yet" - normalize it
  // here so no other layer has to know the magic value.
  const rawToken = parsed[TOKEN_KEYS.PROTOPEDIA_API_V2_TOKEN] ?? null;
  current = {
    token: rawToken === TOKEN_PLACEHOLDER ? null : rawToken,
    snapshotDir: parsed[SNAPSHOT_DIR_KEY] ?? null,
    logLevel: parsed[LOG_LEVEL_KEY] ?? null,
    staleHours: parsed[STALE_HOURS_KEY] ?? null,
    fileStatus,
  };
  return current;
}

/**
 * Returns the process-wide config, loading it lazily when
 * initConfigEntries() has not been called.
 */
export function configEntries(): ConfigEntries {
  return current ?? initConfigEntries();
}

/** Clears the process-wide config (test isolation only). */
export function resetConfigEntriesForTests(): void {
  current = null;
}
