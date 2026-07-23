import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadSession } from './session.js';

function prototypeFixture(id: number): Record<string, unknown> {
  return {
    id,
    createDate: '2026-01-01T00:00:00.000Z',
    releaseFlg: 1,
    status: 1,
    prototypeNm: `Prototype ${id}`,
    summary: '',
    freeComment: '',
    systemDescription: '',
    users: ['tester'],
    teamNm: '',
    tags: [],
    materials: [],
    events: [],
    awards: [],
    mainUrl: `https://protopedia.net/prototype/${id}`,
    viewCount: 0,
    goodCount: 0,
    commentCount: 0,
  };
}

describe('loadSession', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ppc-session-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loads a snapshot and returns metadata from the file content', async () => {
    const filePath = path.join(dir, 'snapshot-20260715T100000Z-3.json');
    await writeFile(
      filePath,
      JSON.stringify({
        version: '1.0.0',
        serializedAt: '2026-07-15T10:00:00.123Z',
        prototypes: [
          prototypeFixture(5),
          prototypeFixture(42),
          prototypeFixture(17),
        ],
      }),
      'utf8',
    );

    const result = await loadSession(filePath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    try {
      expect(result.session.fileName).toBe('snapshot-20260715T100000Z-3.json');
      expect(result.session.version).toBe('1.0.0');
      // The real generation time, millisecond precision, from the file.
      expect(result.session.serializedAt.toISOString()).toBe(
        '2026-07-15T10:00:00.123Z',
      );
      expect(result.session.size).toBe(3);
      expect(result.session.minId).toBe(5);
      expect(result.session.maxId).toBe(42);
    } finally {
      result.repository.dispose();
    }
  });

  it('fails on a missing file', async () => {
    const result = await loadSession(path.join(dir, 'missing.json'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('読み込めません');
  });

  it('fails on broken JSON', async () => {
    const filePath = path.join(dir, 'broken.json');
    await writeFile(filePath, '{ broken', 'utf8');
    const result = await loadSession(filePath);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('JSON');
  });

  it('fails on an invalid serializedAt', async () => {
    const filePath = path.join(dir, 'bad-date.json');
    await writeFile(
      filePath,
      JSON.stringify({
        version: '1.0.0',
        serializedAt: 'not-a-date',
        prototypes: [],
      }),
      'utf8',
    );
    const result = await loadSession(filePath);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('serializedAt');
  });
});
