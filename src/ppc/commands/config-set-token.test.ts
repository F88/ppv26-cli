import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runConfigSetToken } from './config-set-token.js';
import { resetConfigEntriesForTests } from '../../core/config-entries.js';

const KEY = 'PROTOPEDIA_API_V2_TOKEN';

describe('runConfigSetToken', () => {
  let home: string;
  let savedEnv: Record<string, string | undefined>;
  let out: string;
  let err: string;

  beforeEach(async () => {
    home = await mkdtemp(path.join(tmpdir(), 'ppv-cli-settoken-'));
    savedEnv = {
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
    };
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    // set-token decides create-vs-update from the startup snapshot.
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

  it('creates ~/.ppv-cli/config with the token and says so', async () => {
    const code = await runConfigSetToken(async () => 'tok-123');
    expect(code).toBe(0);
    const content = await readFile(configPath(), 'utf8');
    expect(content).toContain(`${KEY}=tok-123`);
    // The rest of the template survives the token upsert.
    expect(content).toContain('# PPV_CLI_LOG_LEVEL=info');
    // Init's creation step reports the new file, then the save.
    expect(out).toContain(`設定ファイルを作成しました: ${configPath()}`);
    expect(out).toContain('保存しました');
    if (process.platform !== 'win32') {
      const mode = (await stat(configPath())).mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });

  it('replaces the token but preserves other settings', async () => {
    await mkdir(path.dirname(configPath()), { recursive: true });
    await writeFile(
      configPath(),
      `PPV_CLI_SNAPSHOT_DIR=/data\n${KEY}=old-token\n`,
      'utf8',
    );
    const code = await runConfigSetToken(async () => 'new-token');
    expect(code).toBe(0);
    const content = await readFile(configPath(), 'utf8');
    expect(content).toContain(`${KEY}=new-token`);
    expect(content).not.toContain('old-token');
    expect(content).toContain('PPV_CLI_SNAPSHOT_DIR=/data');
    // An existing file gets its path reported, not a creation notice.
    expect(out).toContain(`設定ファイル: ${configPath()}`);
    expect(out).not.toContain('作成しました');
    expect(out).toContain('保存しました');
  });

  it('replaces the template placeholder in place', async () => {
    // First run init's creation step implicitly, then set the token:
    // the placeholder line is replaced where it stands, not appended.
    await runConfigSetToken(async () => 'real-token');
    const content = await readFile(configPath(), 'utf8');
    expect(content).toContain(`${KEY}=real-token`);
    expect(content).not.toContain('your-token-here');
  });

  it('rejects empty input without writing the token', async () => {
    const code = await runConfigSetToken(async () => '   ');
    expect(code).toBe(1);
    expect(err).toContain('[error] トークンが入力されませんでした。');
    // The file was created by init's creation step (before the
    // prompt), but no token was written into it.
    const content = await readFile(configPath(), 'utf8');
    expect(content).toContain(`${KEY}=your-token-here`);
  });

  it('rejects input outside printable ASCII without writing', async () => {
    // An arrow key in raw mode arrives as an invisible escape
    // sequence; a paste can carry whitespace or non-ASCII.
    const withEscape = 'abc\u001B[Adef';
    for (const invalid of [withEscape, 'abc def', 'トークン123']) {
      err = '';
      const code = await runConfigSetToken(async () => invalid);
      expect(code).toBe(1);
      expect(err).toContain('入力値に使用できない文字が含まれています');
      expect(err).toContain('トークン設定処理を中止します');
    }
    // The template file was created, but no token was written.
    const content = await readFile(configPath(), 'utf8');
    expect(content).toContain(`${KEY}=your-token-here`);
  });

  it.skipIf(process.platform === 'win32')(
    'aborts when the file exists but is unreadable',
    async () => {
      await mkdir(path.dirname(configPath()), { recursive: true });
      await writeFile(configPath(), `${KEY}=old-token\n`, 'utf8');
      await chmod(configPath(), 0o000);
      const code = await runConfigSetToken(async () => 'new-token');
      expect(code).toBe(1);
      expect(err).toContain('[error] 設定ファイルを更新できませんでした');
      // The existing file was NOT replaced with the template.
      await chmod(configPath(), 0o600);
      expect(await readFile(configPath(), 'utf8')).toBe(`${KEY}=old-token\n`);
    },
  );
});
