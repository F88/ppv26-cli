/**
 * `ppc config init` - initializes the global config file
 * from the documented template (issue #7).
 *
 * When the file already exists, asks interactively whether to
 * overwrite it with the template (default: No). Overwriting replaces
 * the whole content, the token included. In a non-interactive
 * environment the question cannot be asked, so the file is never
 * overwritten.
 */
import { createInterface } from 'node:readline';

import {
  createGlobalConfig,
  globalConfigExists,
} from '../../core/config-file.js';
import { PPV_CLI_TOOL_NAME } from '../../core/constants.js';
import { SET_TOKEN_COMMAND } from '../../core/token.js';
import { globalConfigPath } from '../../core/user-dirs.js';
import { print } from '../output.js';

/** Asks a yes/no question on the TTY. Exported type for test injection. */
export type ConfirmReader = (promptText: string) => Promise<boolean>;

const confirmFromTty: ConfirmReader = (promptText) =>
  new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });

/**
 * Creates the config file from the template and reports the path.
 * This is init's creation step; config set-token also runs it when
 * the file does not exist yet.
 */
export async function createConfigWithNotice(): Promise<void> {
  const configPath = await createGlobalConfig();
  print(`設定ファイルを作成しました: ${configPath}`);
}

/**
 * Entry point for `ppc config init`. Returns the process exit code.
 */
export async function runConfigInit(
  confirm: ConfirmReader = confirmFromTty,
): Promise<number> {
  const configPath = globalConfigPath();

  if (await globalConfigExists()) {
    if (confirm === confirmFromTty && !process.stdin.isTTY) {
      print(`設定ファイルは既に存在します: ${configPath}`);
      print('非対話環境のため上書き確認は行いません。');
      return 0;
    }
    const overwrite = await confirm(
      `設定ファイルは既に存在します: ${configPath}\n` +
        'テンプレートで上書きしますか? 現在の内容(トークンを含む)は失われます (y/N): ',
    );
    if (!overwrite) {
      print(
        `上書きしませんでした。内容の確認は ${PPV_CLI_TOOL_NAME} config show で行えます。`,
      );
      return 0;
    }
    await createGlobalConfig();
    print(`設定を初期化しました: ${configPath}`);
    print(`トークンは ${SET_TOKEN_COMMAND} で設定してください。`);
    return 0;
  }

  await createConfigWithNotice();
  print(`トークンは ${SET_TOKEN_COMMAND} で設定してください。`);
  print('その他の設定を変更する場合はファイルを直接編集して下さい。');
  return 0;
}
