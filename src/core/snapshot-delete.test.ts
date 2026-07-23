import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteSnapshotFiles } from './snapshot-delete.js';

describe('deleteSnapshotFiles', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ppv-cli-delete-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('deletes the given files and reports each success', async () => {
    const a = path.join(dir, 'a.json');
    const b = path.join(dir, 'b.json');
    await writeFile(a, '{}', 'utf8');
    await writeFile(b, '{}', 'utf8');

    const results = await deleteSnapshotFiles([a, b]);
    expect(results).toEqual([
      { filePath: a, fileName: 'a.json', ok: true },
      { filePath: b, fileName: 'b.json', ok: true },
    ]);
  });

  it('reports a per-file failure and continues with the rest', async () => {
    const missing = path.join(dir, 'missing.json');
    const real = path.join(dir, 'real.json');
    await writeFile(real, '{}', 'utf8');

    const results = await deleteSnapshotFiles([missing, real]);
    expect(results).toHaveLength(2);
    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.message).toContain('ENOENT');
    // The failure did not stop the second deletion.
    expect(results[1]).toEqual({
      filePath: real,
      fileName: 'real.json',
      ok: true,
    });
  });
});
