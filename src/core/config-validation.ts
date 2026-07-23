/**
 * Startup validation of the config entries (invalid ->
 * error, never fall back).
 *
 * Only the two keys whose validity is INTRINSIC to the value are
 * checked here: PPV_CLI_LOG_LEVEL (closed enum) and
 * PPV_CLI_SNAPSHOT_STALE_HOURS (positive number). Their truth does
 * not depend on when or whether the value is used, so a broken
 * entry stops every settings-consuming command until fixed.
 *
 * PPV_CLI_SNAPSHOT_DIR and the token are NOT checked: their validity
 * lives outside the value (the filesystem at use time / the
 * ProtoPedia API), so errors surface where they can actually be
 * judged - at use.
 */
import { LOG_LEVEL_KEY, STALE_HOURS_KEY } from './config-entries.js';
import { globalConfigPath } from './user-dirs.js';

import type { ConfigEntries } from './config-entries.js';
import type { LogLevel } from 'promidas/logger';

export const VALID_LOG_LEVELS: readonly string[] = [
  'debug',
  'info',
  'warn',
  'error',
  'silent',
];

/** True when the value is one of the five log levels. */
export function isValidLogLevel(value: string): value is LogLevel {
  return VALID_LOG_LEVELS.includes(value);
}

/** True when the value is a positive number (decimals allowed). */
export function isValidStaleHours(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value) && Number(value) > 0;
}

/** One invalid entry, with per-language hints for the error line. */
export type ConfigEntryError = {
  readonly key: string;
  readonly value: string;
  readonly hintJa: string;
  readonly hintEn: string;
};

/**
 * Returns the invalid entries among the intrinsically checkable
 * keys. Unset keys (null) are not errors - absence is normal.
 */
export function validateConfigEntries(
  entries: ConfigEntries,
): ConfigEntryError[] {
  const errors: ConfigEntryError[] = [];
  if (entries.logLevel !== null && !isValidLogLevel(entries.logLevel)) {
    errors.push({
      key: LOG_LEVEL_KEY,
      value: entries.logLevel,
      hintJa: 'debug | info | warn | error | silent',
      hintEn: 'debug | info | warn | error | silent',
    });
  }
  if (entries.staleHours !== null && !isValidStaleHours(entries.staleHours)) {
    errors.push({
      key: STALE_HOURS_KEY,
      value: entries.staleHours,
      hintJa: '正の数値、小数可',
      hintEn: 'positive number',
    });
  }
  return errors;
}

/**
 * Builds the startup-gate error lines for a broken config file -
 * unreadable, or a value outside its prescribed set -
 * or returns null when the entries pass. The wording of BOTH
 * languages lives here and nowhere else; the binaries only choose
 * the language, the output channel and how to exit.
 */
export function configGateErrors(
  entries: ConfigEntries,
  lang: 'ja' | 'en',
): string[] | null {
  const configPath = globalConfigPath();
  if (entries.fileStatus === 'unreadable') {
    return lang === 'ja'
      ? [
          `設定ファイルを読み込めませんでした: ${configPath}`,
          'ファイルの権限を確認してください。',
        ]
      : [
          `Could not read the config file: ${configPath}`,
          'Check the file permissions.',
        ];
  }
  const errors = validateConfigEntries(entries);
  if (errors.length === 0) {
    return null;
  }
  const lines = errors.map(({ key, value, hintJa, hintEn }) =>
    lang === 'ja'
      ? `設定ファイルの ${key} の値が不正です: "${value}" (${hintJa})`
      : `Invalid ${key} in the config file: "${value}" (${hintEn})`,
  );
  lines.push(
    lang === 'ja'
      ? `設定ファイルを修正してください: ${configPath}`
      : `Fix the config file: ${configPath}`,
  );
  return lines;
}
