import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  initConfigEntries,
  LOG_LEVEL_KEY,
  resetConfigEntriesForTests,
} from './config-entries.js';
import { resolveLogLevel } from './logger.js';

describe('resolveLogLevel', () => {
  let dir: string;

  async function configureLogLevel(value: string | null): Promise<void> {
    const file = path.join(dir, '.ppv-cli', 'config');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      value === null ? '' : `${LOG_LEVEL_KEY}=${value}\n`,
      'utf8',
    );
    initConfigEntries();
  }

  let savedHome: Record<string, string | undefined>;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ppv-cli-loglevel-'));
    savedHome = {
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
    };
    process.env.HOME = dir;
    process.env.USERPROFILE = dir;
    // Pin an empty config so the developer's real files never leak in.
    await configureLogLevel(null);
  });

  afterEach(async () => {
    resetConfigEntriesForTests();
    for (const [key, value] of Object.entries(savedHome)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    await rm(dir, { recursive: true, force: true });
  });

  it('defaults to info', () => {
    expect(resolveLogLevel({})).toBe('info');
  });

  it('maps --verbose to debug and --quiet to error', () => {
    expect(resolveLogLevel({ verbose: true })).toBe('debug');
    expect(resolveLogLevel({ quiet: true })).toBe('error');
    expect(resolveLogLevel({ verbose: true, quiet: true })).toBe('error');
  });

  it('reads the default from PPV_CLI_LOG_LEVEL in config files', async () => {
    await configureLogLevel('warn');
    expect(resolveLogLevel({})).toBe('warn');
  });

  it('lets CLI flags win over the configured level', async () => {
    await configureLogLevel('silent');
    expect(resolveLogLevel({ verbose: true })).toBe('debug');
  });

  it('throws for invalid values (the startup gate stops commands first)', async () => {
    // invalid -> error, never fall back. The empty string
    // is just one more value outside the prescribed set.
    for (const invalid of ['loud', '']) {
      await configureLogLevel(invalid);
      expect(() => resolveLogLevel({})).toThrow('PPV_CLI_LOG_LEVEL');
    }
  });

  it('ignores the PPV_CLI_LOG_LEVEL environment variable', () => {
    const saved = process.env[LOG_LEVEL_KEY];
    process.env[LOG_LEVEL_KEY] = 'silent';
    try {
      expect(resolveLogLevel({})).toBe('info');
    } finally {
      if (saved === undefined) {
        delete process.env[LOG_LEVEL_KEY];
      } else {
        process.env[LOG_LEVEL_KEY] = saved;
      }
    }
  });
});
