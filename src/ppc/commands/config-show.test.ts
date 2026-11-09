import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  initConfigEntries,
  resetConfigEntriesForTests,
} from '../../core/config-entries.js';
import { PPV_CLI_TOOL_NAME } from '../../core/constants.js';
import { maskToken, runConfigShow } from './config-show.js';

const KEY = 'PROTOPEDIA_API_V2_TOKEN';

describe('maskToken', () => {
  it('keeps only the last 4 characters', () => {
    expect(maskToken('abcdefgh')).toBe('****efgh');
    expect(maskToken('secret-token-abcd')).toBe('****abcd');
  });

  it('hides values shorter than 8 characters entirely', () => {
    // Showing 4 of 5 characters would expose most of the secret.
    expect(maskToken('abc')).toBe('****');
    expect(maskToken('abcde')).toBe('****');
    expect(maskToken('abcdefg')).toBe('****');
  });
});

describe('runConfigShow', () => {
  let home: string;
  let savedEnv: Record<string, string | undefined>;
  let out: string;
  let err: string;

  beforeEach(async () => {
    home = await mkdtemp(path.join(tmpdir(), 'ppv-cli-show-'));
    savedEnv = {
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
    };
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    resetConfigEntriesForTests();
    out = '';
    err = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      out += String(chunk);
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      err += String(chunk);
      return true;
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    resetConfigEntriesForTests();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    await rm(home, { recursive: true, force: true });
  });

  const configPath = () => path.join(home, '.ppv-cli', 'config');

  async function writeConfig(content: string): Promise<void> {
    await mkdir(path.dirname(configPath()), { recursive: true });
    await writeFile(configPath(), content, 'utf8');
    initConfigEntries();
  }

  it('shows the file path and the entries the file sets', async () => {
    await writeConfig(`${KEY}=secret-token-abcd\nPPV_CLI_LOG_LEVEL=debug\n`);
    const code = await runConfigShow();
    expect(code).toBe(0);
    expect(out).toContain(`設定ファイル: ${configPath()} (あり)`);
    expect(out).toContain(`${KEY}: 設定済み (****abcd)`);
    expect(out).toContain('PPV_CLI_LOG_LEVEL: debug');
    expect(err).toBe('');
  });

  it('hides optional keys the file does not set', async () => {
    await writeConfig(`${KEY}=secret-token-abcd\n`);
    await runConfigShow();
    expect(out).not.toContain('PPV_CLI_SNAPSHOT_DIR');
    expect(out).not.toContain('PPV_CLI_LOG_LEVEL');
    expect(out).not.toContain('PPV_CLI_SNAPSHOT_STALE_HOURS');
  });

  it('never prints the full token', async () => {
    await writeConfig(`${KEY}=secret-token-abcd\n`);
    await runConfigShow();
    expect(out).not.toContain('secret-token-abcd');
    expect(err).not.toContain('secret-token-abcd');
  });

  it('always reports the token state, set or not', async () => {
    await writeConfig('PPV_CLI_LOG_LEVEL=debug\n');
    await runConfigShow();
    expect(out).toContain(`${KEY}: 未設定`);
  });

  it('treats the template placeholder as an unset token', async () => {
    await writeConfig(`${KEY}=your-token-here\n`);
    await runConfigShow();
    expect(out).toContain(`${KEY}: 未設定`);
    expect(out).not.toContain('設定済み');
  });

  it('reports a missing file and points to config init', async () => {
    initConfigEntries();
    const code = await runConfigShow();
    expect(code).toBe(0);
    expect(out).toContain(`設定ファイル: ${configPath()} (なし)`);
    expect(out).toContain(`作成用コマンド: ${PPV_CLI_TOOL_NAME} config init`);
    // No entries are listed - there is no file to show.
    expect(out).not.toContain(KEY);
    expect(err).toBe('');
  });

  it('shows invalid values as written, without interpretation', async () => {
    await writeConfig('PPV_CLI_LOG_LEVEL=loud\n');
    await runConfigShow();
    expect(out).toContain('PPV_CLI_LOG_LEVEL: loud');
  });

  it('ignores unrecognized keys silently', async () => {
    await writeConfig(`PPV_CLI_LOGLEVEL=debug\n${KEY}=secret-token-abcd\n`);
    const code = await runConfigShow();
    expect(code).toBe(0);
    expect(out).not.toContain('PPV_CLI_LOGLEVEL');
    expect(err).toBe('');
  });

  it.skipIf(process.platform === 'win32')(
    'fails when the file exists but cannot be read',
    async () => {
      await writeConfig(`${KEY}=secret-token-abcd\n`);
      await chmod(configPath(), 0o000);
      resetConfigEntriesForTests();
      initConfigEntries();
      const code = await runConfigShow();
      await chmod(configPath(), 0o600);
      expect(code).toBe(1);
      expect(out).toContain(`設定ファイル: ${configPath()} (あり)`);
      expect(err).toContain('[error] 設定ファイルを読み込めませんでした。');
      // Unknown entries are not shown as "unset".
      expect(out).not.toContain('未設定');
    },
  );

  it('ignores environment variables (the file is the SSOT)', async () => {
    const saved = process.env[KEY];
    process.env[KEY] = 'env-token-zzzz';
    try {
      await writeConfig('PPV_CLI_LOG_LEVEL=debug\n');
      await runConfigShow();
      expect(out).toContain(`${KEY}: 未設定`);
      expect(out).not.toContain('zzzz');
    } finally {
      if (saved === undefined) {
        delete process.env[KEY];
      } else {
        process.env[KEY] = saved;
      }
    }
  });
});
