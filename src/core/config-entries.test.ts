import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  configEntries,
  initConfigEntries,
  resetConfigEntriesForTests,
  SNAPSHOT_DIR_KEY,
} from './config-entries.js';
import { resolveSnapshotDir } from './snapshot-catalog.js';
import { resolveToken } from './token.js';

const TOKEN_KEY = 'PROTOPEDIA_API_V2_TOKEN';

let home: string;
let savedEnv: Record<string, string | undefined>;

beforeEach(async () => {
  home = await mkdtemp(path.join(tmpdir(), 'ppv-cli-home-'));
  savedEnv = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    [TOKEN_KEY]: process.env[TOKEN_KEY],
    [SNAPSHOT_DIR_KEY]: process.env[SNAPSHOT_DIR_KEY],
  };
  process.env.HOME = home; // POSIX
  process.env.USERPROFILE = home; // Windows
  delete process.env[TOKEN_KEY];
  delete process.env[SNAPSHOT_DIR_KEY];
  resetConfigEntriesForTests();
});

afterEach(async () => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  resetConfigEntriesForTests();
  await rm(home, { recursive: true, force: true });
});

async function writeGlobalConfig(content: string): Promise<void> {
  await mkdir(path.join(home, '.ppv-cli'), { recursive: true });
  await writeFile(path.join(home, '.ppv-cli', 'config'), content, 'utf8');
}

describe('initConfigEntries (single source: ~/.ppv-cli/config)', () => {
  it('reads values from the config file', async () => {
    await writeGlobalConfig(`${TOKEN_KEY}=tok\n${SNAPSHOT_DIR_KEY}=/data\n`);
    initConfigEntries();
    expect(configEntries().token).toBe('tok');
    expect(configEntries().snapshotDir).toBe('/data');
    expect(configEntries().fileStatus).toBe('read');
  });

  it('runs on defaults when the file is missing', () => {
    initConfigEntries();
    expect(configEntries().token).toBeNull();
    expect(configEntries().fileStatus).toBe('missing');
  });

  it.skipIf(process.platform === 'win32')(
    'reports an existing but unreadable file as unreadable',
    async () => {
      await writeGlobalConfig(`${TOKEN_KEY}=tok\n`);
      const file = path.join(home, '.ppv-cli', 'config');
      await chmod(file, 0o000);
      initConfigEntries();
      await chmod(file, 0o600);
      expect(configEntries().fileStatus).toBe('unreadable');
      // Unknown, not unset - but the raw values are null either way.
      expect(configEntries().token).toBeNull();
    },
  );

  it('never writes anything into process.env', async () => {
    await writeGlobalConfig(
      `DATABASE_URL=postgres://secret\n${TOKEN_KEY}=tok\n`,
    );
    initConfigEntries();
    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(process.env[TOKEN_KEY]).toBeUndefined();
  });

  it('normalizes the template placeholder token to null', async () => {
    await writeGlobalConfig(`${TOKEN_KEY}=your-token-here\n`);
    initConfigEntries();
    expect(configEntries().token).toBeNull();
  });
});

describe('the config file is the single source of truth', () => {
  it('resolveSnapshotDir ignores the environment variable', () => {
    process.env[SNAPSHOT_DIR_KEY] = '/from-env';
    initConfigEntries();
    expect(resolveSnapshotDir()).toBe(
      path.resolve(path.join(home, '.ppv-cli', 'snapshots')),
    );
  });

  it('resolveToken ignores the environment variable', async () => {
    await writeGlobalConfig(`${TOKEN_KEY}=from-file\n`);
    process.env[TOKEN_KEY] = 'from-env';
    initConfigEntries();
    expect(resolveToken()).toBe('from-file');
  });

  it('resolveToken returns null when nothing is configured', () => {
    initConfigEntries();
    expect(resolveToken()).toBeNull();
  });
});
