/**
 * `ppc config show` - shows the contents and state of the global
 * config file for users who do not open it
 * themselves (issue #7): whether the file exists, whether the token
 * is set, and the entries the file actually sets (as written, no
 * interpretation). The only transformation is masking the token,
 * whose full value is never printed. Commented-out lines and
 * unrecognized keys are not settings and are not reported.
 *
 * show never writes: a missing file is reported as a normal state
 * (exit 0, pointing to config init), while a file that exists but
 * could not be read is an error (exit 1) - the entries are unknown
 * then, and pretending they are "unset" would be a lie.
 *
 * The listing is the command's RESULT, so it goes to stdout, outside
 * of the log-level control - otherwise PPV_CLI_LOG_LEVEL=error (or
 * --quiet) would silence the very command that displays it. The
 * warning and error lines go directly to stderr for the same reason:
 * config commands are upstream of the logging configuration (they
 * exist to create and repair it), so nothing they say may be
 * silenceable by it.
 */
import { TOKEN_KEYS } from 'promidas-utils/token';

import {
  configEntries,
  LOG_LEVEL_KEY,
  SNAPSHOT_DIR_KEY,
  STALE_HOURS_KEY,
} from '../../core/config-entries.js';
import { PPV_CLI_TOOL_NAME } from '../../core/constants.js';
import { globalConfigPath } from '../../core/user-dirs.js';
import { print, printError } from '../output.js';

import type { ConfigEntries } from '../../core/config-entries.js';

const TOKEN_KEY = TOKEN_KEYS.PROTOPEDIA_API_V2_TOKEN;

/**
 * Masks a secret, keeping only the last 4 characters. Values shorter
 * than 8 characters are masked entirely: showing 4 of, say, 5
 * characters would expose most of the secret.
 */
export function maskToken(token: string): string {
  const tail = token.length >= 8 ? token.slice(-4) : '';
  return `****${tail}`;
}

/**
 * Reports where the config file is and whether it exists, pointing
 * to config init when it does not. Returns whether the file exists,
 * so the caller knows if there is anything more to show. Reads the
 * startup snapshot's fileStatus - the same observation every other
 * output of this command is based on.
 */
function showFileStatus(config: ConfigEntries): boolean {
  const exists = config.fileStatus !== 'missing';
  print(`設定ファイル: ${globalConfigPath()} (${exists ? 'あり' : 'なし'})`);
  print('');
  if (!exists) {
    // A missing file is the normal first-run state: everything is
    // trivially unset, so listing the keys adds nothing - point to
    // the way forward instead.
    print(`作成用コマンド: ${PPV_CLI_TOOL_NAME} config init`);
    return false;
  }

  return true;
}

/**
 * Shows the entries of the config file. The token state is always
 * reported (set or not); the optional keys appear only when the file
 * actually sets them, values as written.
 */
function showEntries(config: ConfigEntries): void {
  // The token is the one thing everyone needs to check, so its state
  // is always reported, set or not.
  const tokenState =
    config.token !== null ? `設定済み (${maskToken(config.token)})` : '未設定';
  print(`${TOKEN_KEY}: ${tokenState}`);

  // Optional keys are part of the file's contents only when the file
  // actually sets them - absent keys are not shown.
  if (config.snapshotDir !== null) {
    print(`${SNAPSHOT_DIR_KEY}: ${config.snapshotDir}`);
  }
  if (config.logLevel !== null) {
    print(`${LOG_LEVEL_KEY}: ${config.logLevel}`);
  }
  if (config.staleHours !== null) {
    print(`${STALE_HOURS_KEY}: ${config.staleHours}`);
  }
}

/**
 * Entry point for `ppc config show`. Returns the process exit code:
 * 0 when the state was shown (a missing file is a normal state),
 * 1 when the file exists but could not be read.
 */
export async function runConfigShow(): Promise<number> {
  const config = configEntries();

  if (!showFileStatus(config)) {
    return 0;
  }
  if (config.fileStatus === 'unreadable') {
    // The file exists but could not be read (e.g. a permission
    // problem): the key states are unknown, not "unset", so showing
    // the list would be a lie. show cannot fulfill its purpose here.
    printError(
      '設定ファイルを読み込めませんでした。ファイルの権限を確認してください。',
    );
    return 1;
  }

  showEntries(config);

  return 0;
}
