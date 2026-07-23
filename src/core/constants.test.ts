import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  initConfigEntries,
  resetConfigEntriesForTests,
  STALE_HOURS_KEY,
} from './config-entries.js';
import {
  DEFAULT_SNAPSHOT_STALE_AFTER_MS,
  resolveSnapshotStaleAfterMs,
} from './constants.js';

const HOUR_MS = 3_600_000;

describe('resolveSnapshotStaleAfterMs', () => {
  let dir: string;

  async function configureStaleHours(value: string | null): Promise<void> {
    const file = path.join(dir, '.ppv-cli', 'config');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      value === null ? '' : `${STALE_HOURS_KEY}=${value}\n`,
      'utf8',
    );
    initConfigEntries();
  }

  let savedHome: Record<string, string | undefined>;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ppv-cli-stale-'));
    savedHome = {
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
    };
    process.env.HOME = dir;
    process.env.USERPROFILE = dir;
    // Pin an empty config so the developer's real files never leak in.
    await configureStaleHours(null);
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

  it('defaults to 1 hour when unset', () => {
    expect(resolveSnapshotStaleAfterMs()).toBe(DEFAULT_SNAPSHOT_STALE_AFTER_MS);
    expect(DEFAULT_SNAPSHOT_STALE_AFTER_MS).toBe(1 * HOUR_MS);
  });

  it('reads hours from PPV_CLI_SNAPSHOT_STALE_HOURS in config files', async () => {
    await configureStaleHours('12');
    expect(resolveSnapshotStaleAfterMs()).toBe(12 * HOUR_MS);
  });

  it('accepts decimal hours', async () => {
    await configureStaleHours('0.5');
    expect(resolveSnapshotStaleAfterMs()).toBe(0.5 * HOUR_MS);
  });

  it('throws for invalid values (the startup gate stops commands first)', async () => {
    // invalid -> error, never fall back. The empty string
    // is just one more value outside the prescribed set.
    for (const invalid of ['abc', '0', '-3', '1O', '1h', '']) {
      await configureStaleHours(invalid);
      expect(() => resolveSnapshotStaleAfterMs()).toThrow(
        'PPV_CLI_SNAPSHOT_STALE_HOURS',
      );
    }
  });

  it('ignores the environment variable', () => {
    const saved = process.env[STALE_HOURS_KEY];
    process.env[STALE_HOURS_KEY] = '99';
    try {
      expect(resolveSnapshotStaleAfterMs()).toBe(
        DEFAULT_SNAPSHOT_STALE_AFTER_MS,
      );
    } finally {
      if (saved === undefined) {
        delete process.env[STALE_HOURS_KEY];
      } else {
        process.env[STALE_HOURS_KEY] = saved;
      }
    }
  });
});
