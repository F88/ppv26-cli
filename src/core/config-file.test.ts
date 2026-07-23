import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parse as parseDotenv } from 'dotenv';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createGlobalConfig,
  globalConfigExists,
  updateGlobalConfig,
  upsertConfigEntry,
} from './config-file.js';

const KEY = 'PROTOPEDIA_API_V2_TOKEN';

describe('upsertConfigEntry', () => {
  it('appends to empty content', () => {
    expect(upsertConfigEntry('', KEY, 'abc')).toBe(`${KEY}=abc\n`);
  });

  it('appends after existing lines, keeping one trailing newline', () => {
    expect(upsertConfigEntry('PPV_CLI_LOG_LEVEL=debug\n', KEY, 'abc')).toBe(
      `PPV_CLI_LOG_LEVEL=debug\n${KEY}=abc\n`,
    );
    expect(upsertConfigEntry('PPV_CLI_LOG_LEVEL=debug', KEY, 'abc')).toBe(
      `PPV_CLI_LOG_LEVEL=debug\n${KEY}=abc\n`,
    );
  });

  it('replaces in place, preserving comments and other keys', () => {
    const before = `# comment\n${KEY}=old\nPPV_CLI_SNAPSHOT_DIR=/data\n`;
    const after = upsertConfigEntry(before, KEY, 'new');
    expect(after).toBe(`# comment\n${KEY}=new\nPPV_CLI_SNAPSHOT_DIR=/data\n`);
  });

  it('does not touch commented-out template lines of the key', () => {
    const before = `# ${KEY}=example\nPPV_CLI_LOG_LEVEL=info\n`;
    const after = upsertConfigEntry(before, KEY, 'real');
    expect(after).toContain(`# ${KEY}=example`);
    expect(after).toContain(`${KEY}=real`);
  });

  it('collapses duplicate key lines into one (dotenv: last wins)', () => {
    // Pin the dotenv semantics this guarantee protects against: with
    // duplicates, parse() returns the LAST occurrence, so replacing
    // only the first line would leave the old value effective.
    expect(parseDotenv(`${KEY}=a\n${KEY}=b\n`)[KEY]).toBe('b');

    const after = upsertConfigEntry(
      `${KEY}=a\n${KEY}=b\nOTHER=x\n`,
      KEY,
      'new',
    );
    expect(after).toBe(`${KEY}=new\nOTHER=x\n`);
    expect(parseDotenv(after)[KEY]).toBe('new');
  });

  it('normalizes CRLF input without corrupting lines', () => {
    const before = `# note\r\n${KEY}=old\r\nOTHER=x\r\n`;
    const after = upsertConfigEntry(before, KEY, 'new');
    expect(after).toBe(`# note\n${KEY}=new\nOTHER=x\n`);
    expect(parseDotenv(after)[KEY]).toBe('new');
  });

  it('always ends the file with exactly one newline', () => {
    expect(upsertConfigEntry(`${KEY}=old`, KEY, 'new')).toBe(`${KEY}=new\n`);
    expect(upsertConfigEntry(`${KEY}=old\n`, KEY, 'new')).toBe(`${KEY}=new\n`);
  });
});

describe('createGlobalConfig / updateGlobalConfig', () => {
  let home: string;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(async () => {
    home = await mkdtemp(path.join(tmpdir(), 'ppv-cli-configfile-'));
    savedEnv = {
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
    };
    process.env.HOME = home;
    process.env.USERPROFILE = home;
  });

  afterEach(async () => {
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

  it('createGlobalConfig writes the template', async () => {
    expect(await globalConfigExists()).toBe(false);
    const written = await createGlobalConfig();
    expect(written).toBe(configPath());
    expect(await globalConfigExists()).toBe(true);
    expect(await readFile(configPath(), 'utf8')).toContain(
      `${KEY}=your-token-here`,
    );
  });

  it('updateGlobalConfig rewrites an existing file', async () => {
    await mkdir(path.dirname(configPath()), { recursive: true });
    await writeFile(configPath(), `${KEY}=old\n`, 'utf8');
    await updateGlobalConfig((content) =>
      upsertConfigEntry(content, KEY, 'new'),
    );
    expect(await readFile(configPath(), 'utf8')).toBe(`${KEY}=new\n`);
  });

  it('updateGlobalConfig never creates a missing file', async () => {
    await expect(updateGlobalConfig((content) => content)).rejects.toThrow();
    expect(await globalConfigExists()).toBe(false);
  });
});
