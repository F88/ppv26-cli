import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runConfigInit } from './config-init.js';

describe('runConfigInit', () => {
  let home: string;
  let savedEnv: Record<string, string | undefined>;
  let out: string;

  beforeEach(async () => {
    home = await mkdtemp(path.join(tmpdir(), 'ppv-cli-init-'));
    savedEnv = {
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
    };
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    out = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      out += String(chunk);
      return true;
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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

  it('creates ~/.ppv-cli/config from the documented template', async () => {
    const code = await runConfigInit();
    expect(code).toBe(0);
    const content = await readFile(configPath(), 'utf8');
    expect(content).toContain('PROTOPEDIA_API_V2_TOKEN=your-token-here');
    expect(content).toContain('# PPV_CLI_SNAPSHOT_DIR=');
    expect(content).toContain('# PPV_CLI_LOG_LEVEL=info');
    expect(out).toContain(`設定ファイルを作成しました: ${configPath()}`);
  });

  it('keeps an existing file when the user answers No', async () => {
    await mkdir(path.dirname(configPath()), { recursive: true });
    await writeFile(configPath(), 'PPV_CLI_LOG_LEVEL=debug\n', 'utf8');
    const code = await runConfigInit(async () => false);
    expect(code).toBe(0);
    expect(await readFile(configPath(), 'utf8')).toBe(
      'PPV_CLI_LOG_LEVEL=debug\n',
    );
    expect(out).toContain('上書きしませんでした。');
  });

  it('overwrites with the template when the user answers Yes', async () => {
    await mkdir(path.dirname(configPath()), { recursive: true });
    await writeFile(
      configPath(),
      'PROTOPEDIA_API_V2_TOKEN=old\nPPV_CLI_LOG_LEVEL=debug\n',
      'utf8',
    );
    const code = await runConfigInit(async () => true);
    expect(code).toBe(0);
    const content = await readFile(configPath(), 'utf8');
    expect(content).toContain('PROTOPEDIA_API_V2_TOKEN=your-token-here');
    expect(content).not.toContain('PROTOPEDIA_API_V2_TOKEN=old');
    expect(content).not.toContain('PPV_CLI_LOG_LEVEL=debug');
    expect(out).toContain(`設定を初期化しました: ${configPath()}`);
  });

  it('never overwrites without a TTY (default confirm path)', async () => {
    await mkdir(path.dirname(configPath()), { recursive: true });
    await writeFile(configPath(), 'PPV_CLI_LOG_LEVEL=debug\n', 'utf8');
    const code = await runConfigInit();
    expect(code).toBe(0);
    expect(await readFile(configPath(), 'utf8')).toBe(
      'PPV_CLI_LOG_LEVEL=debug\n',
    );
    expect(out).toContain('非対話環境のため上書き確認は行いません。');
  });
});
