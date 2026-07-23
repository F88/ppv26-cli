import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildSnapshotFileName,
  findLatestSnapshot,
  listSnapshots,
  parseSnapshotFileName,
} from './snapshot-catalog.js';

describe('buildSnapshotFileName', () => {
  it('builds a compact UTC file name', () => {
    const takenAt = new Date('2026-07-15T10:00:00.123Z');
    expect(buildSnapshotFileName(takenAt, 1234)).toBe(
      'snapshot-20260715T100000Z-1234.json',
    );
  });
});

describe('parseSnapshotFileName', () => {
  it('round-trips with buildSnapshotFileName', () => {
    const takenAt = new Date('2026-07-15T10:00:00.000Z');
    const fileName = buildSnapshotFileName(takenAt, 42);
    const parsed = parseSnapshotFileName(fileName);
    expect(parsed).not.toBeNull();
    expect(parsed?.takenAt.toISOString()).toBe(takenAt.toISOString());
    expect(parsed?.count).toBe(42);
  });

  it('returns null for non-conforming names', () => {
    expect(parseSnapshotFileName('snapshot.json')).toBeNull();
    expect(parseSnapshotFileName('snapshot-20260715-1234.json')).toBeNull();
    expect(parseSnapshotFileName('other.txt')).toBeNull();
  });
});

describe('listSnapshots / findLatestSnapshot', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ppc-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns an empty list for a missing directory', async () => {
    expect(await listSnapshots(path.join(dir, 'missing'))).toEqual([]);
  });

  it('sorts conforming files newest first and others last', async () => {
    const older = 'snapshot-20260710T090000Z-1200.json';
    const newer = 'snapshot-20260715T100000Z-1234.json';
    const unknown = 'aaa-manual-copy.json';
    const notJson = 'notes.txt';
    for (const name of [older, newer, unknown, notJson]) {
      await writeFile(path.join(dir, name), '{}', 'utf8');
    }

    const infos = await listSnapshots(dir);
    expect(infos.map((info) => info.fileName)).toEqual([newer, older, unknown]);
    expect(infos[0]?.count).toBe(1234);
    expect(infos[2]?.takenAt).toBeNull();

    const latest = await findLatestSnapshot(dir);
    expect(latest?.fileName).toBe(newer);
  });
});
