/**
 * `ppc config set-token` - interactively stores the ProtoPedia API
 * token in the global config file, so users never
 * have to edit a dotfile by hand (issue #7).
 *
 * The token is read from an interactive masked prompt on purpose:
 * a --token argument would leak the secret into the shell history,
 * so none is provided.
 */
import { TOKEN_KEYS } from 'promidas-utils/token';

import { createConfigWithNotice } from './config-init.js';
import { configEntries } from '../../core/config-entries.js';
import {
  updateGlobalConfig,
  upsertConfigEntry,
} from '../../core/config-file.js';
import { globalConfigPath } from '../../core/user-dirs.js';
import { print, printError } from '../output.js';

const TOKEN_KEY = TOKEN_KEYS.PROTOPEDIA_API_V2_TOKEN;

/**
 * Reads one line from a TTY stdin without echoing it (each keystroke
 * is masked). Exported type for test injection.
 */
export type SecretReader = (promptText: string) => Promise<string>;

const readSecretFromTty: SecretReader = (promptText) =>
  new Promise((resolve) => {
    const { stdin, stderr } = process;
    stderr.write(promptText);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk: string): void => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.off('data', onData);
          stdin.setRawMode(false);
          stdin.pause();
          stderr.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          // Ctrl+C
          stdin.setRawMode(false);
          stderr.write('\n');
          process.exit(1);
        }
        if (char === '\u007F' || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stderr.write('\b \b');
          }
          continue;
        }
        value += char;
        stderr.write('*');
      }
    };
    stdin.on('data', onData);
  });

/**
 * Entry point for `ppc config set-token`. Returns the process exit code.
 */
export async function runConfigSetToken(
  readSecret: SecretReader = readSecretFromTty,
): Promise<number> {
  if (readSecret === readSecretFromTty && !process.stdin.isTTY) {
    printError(
      'set-token は対話的なターミナル (TTY) でのみ実行できます。' +
        `非対話環境では ${globalConfigPath()} に直接記述してください。`,
    );
    return 1;
  }

  // Run init's creation step when the file does not exist yet, so
  // the user is told a file was created and where.
  if (configEntries().fileStatus === 'missing') {
    await createConfigWithNotice();
  } else {
    print(`設定ファイル: ${globalConfigPath()}`);
    print('');
  }

  print('ProtoPedia API v2 のトークンを設定します');
  print('参考: https://protopediav2.docs.apiary.io/');
  print('');

  print('トークンを入力して下さい (入力内容は画面には表示されません)');
  const token = (await readSecret('> ')).trim();
  if (token === '') {
    printError('トークンが入力されませんでした。中止します。');
    return 1;
  }
  // Minimal check on the ENTERED STRING, nothing more. The token
  // format itself is unknown here (realistically alphanumeric, but
  // symbols are possible) - only the ProtoPedia API can judge a
  // token. This rejects input that cannot be stored and read back
  // faithfully in unquoted KEY=VALUE: control characters (raw-mode
  // input silently picks up invisible key-escape sequences),
  // whitespace and non-ASCII.
  if (!/^[\u0021-\u007E]+$/.test(token)) {
    printError(
      '入力値に使用できない文字が含まれています ' +
        '(空白・制御文字・非 ASCII 文字は不可)',
    );
    printError('トークン設定処理を中止します');
    return 1;
  }

  try {
    await updateGlobalConfig((content) =>
      upsertConfigEntry(content, TOKEN_KEY, token),
    );
  } catch (error) {
    // The file exists but could not be read or written back (e.g. a
    // permission problem). Never fall back to recreating it - that
    // would silently destroy the user's settings.
    printError(
      `設定ファイルを更新できませんでした: ${globalConfigPath()} (${String(error)})`,
    );
    return 1;
  }

  print('保存しました');

  return 0;
}
