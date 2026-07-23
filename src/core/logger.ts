/**
 * Stderr logger for the CLI.
 *
 * All diagnostics (logs, progress, warnings) go to stderr so that stdout
 * stays reserved for command results (JSON etc.) and remains pipe-friendly.
 */
import { inspect } from 'node:util';

import { configEntries, LOG_LEVEL_KEY } from './config-entries.js';
import { isValidLogLevel } from './config-validation.js';

import type { Logger, LogLevel } from 'promidas/logger';

const LEVEL_PRIORITY: Record<Exclude<LogLevel, 'silent'>, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export type LogLevelFlags = {
  readonly verbose?: boolean;
  readonly quiet?: boolean;
};

/**
 * Resolves the log level with the following precedence:
 * --quiet > --verbose > PPV_CLI_LOG_LEVEL (config file) > 'info'.
 *
 * 'info' is the default for an ABSENT key only - there is no
 * fallback for invalid values (invalid -> error). The
 * startup gate stops settings-consuming commands before this point,
 * so an invalid value here is a wiring bug and throws.
 */
export function resolveLogLevel(flags: LogLevelFlags): LogLevel {
  if (flags.quiet) return 'error';
  if (flags.verbose) return 'debug';

  const configured = configEntries().logLevel;
  if (configured === null) return 'info';
  if (!isValidLogLevel(configured)) {
    throw new Error(`invalid ${LOG_LEVEL_KEY}: "${configured}"`);
  }
  return configured;
}

/**
 * Log level for the PROMIDAS library layers (store/fetcher/repository).
 *
 * Libraries log construction and internal details at info level, which is
 * noisy for normal CLI usage; keep them at warn unless --verbose is given.
 */
export function resolveLibraryLogLevel(cliLevel: LogLevel): LogLevel {
  return cliLevel === 'debug' ? 'debug' : 'warn';
}

/**
 * Creates a PROMIDAS-compatible logger that writes to stderr.
 */
export function createStderrLogger(level: LogLevel): Logger {
  const threshold =
    level === 'silent' ? Number.POSITIVE_INFINITY : LEVEL_PRIORITY[level];

  const write = (
    messageLevel: Exclude<LogLevel, 'silent'>,
    message: string,
    meta?: unknown,
  ): void => {
    if (LEVEL_PRIORITY[messageLevel] < threshold) return;
    const suffix =
      meta === undefined
        ? ''
        : ` ${inspect(meta, { depth: 4, breakLength: Number.POSITIVE_INFINITY })}`;
    process.stderr.write(`[${messageLevel}] ${message}${suffix}\n`);
  };

  return {
    error: (message, meta) => write('error', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    info: (message, meta) => write('info', message, meta),
    debug: (message, meta) => write('debug', message, meta),
  };
}
