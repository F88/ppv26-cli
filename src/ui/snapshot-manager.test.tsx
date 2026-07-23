import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { render } from 'ink-testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SnapshotManager } from './snapshot-manager.js';

const SPACE = ' ';
const ESCAPE = '\u001B';

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// retry: same Windows-CI stdin flakiness as the app tests (the
// ink-testing-library mock stdin can drop a keypress between
// screens); a retry re-runs the whole scenario cleanly.
describe('SnapshotManager', { retry: 2 }, () => {
  let dir: string;
  let fileA: string;
  let fileB: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ppv-cli-manager-'));
    fileA = path.join(dir, 'snapshot-20260716T100000Z-10.json');
    fileB = path.join(dir, 'snapshot-20260715T100000Z-20.json');
    await writeFile(fileA, '{"a":1}', 'utf8');
    await writeFile(fileB, '{"b":2}', 'utf8');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('lists file names with sizes; facts arrive via auto-verify', async () => {
    const { lastFrame, unmount } = render(
      <SnapshotManager snapshotDir={dir} lang="ja" onExit={() => {}} />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Snapshot管理');
      expect(lastFrame()).toContain(path.basename(fileA));
      expect(lastFrame()).toContain(path.basename(fileB));
    });
    // No file-name estimates: the manager shows verified facts only.
    expect(lastFrame()).not.toContain('10件');
    expect(lastFrame()).not.toContain('20件');
    expect(lastFrame()).toContain('KB');
    expect(lastFrame()).toContain('Space: 選択');
    // The junk fixtures ({"a":1}) are invalid snapshots.
    await vi.waitFor(
      () => {
        expect(lastFrame()).toContain('✗');
      },
      { timeout: 10_000 },
    );
    unmount();
  });

  it('deletes a marked snapshot after confirmation', async () => {
    const { lastFrame, stdin, unmount } = render(
      <SnapshotManager snapshotDir={dir} lang="ja" onExit={() => {}} />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(path.basename(fileA));
    });
    stdin.write(SPACE); // mark the newest (fileA)
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('[x]');
    });
    stdin.write('d'); // -> confirm
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('削除しますか');
    });
    stdin.write('y');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('削除: 1 件成功');
    });
    expect(await exists(fileA)).toBe(false);
    expect(await exists(fileB)).toBe(true);
    unmount();
  });

  it('cancels the deletion with any other key', async () => {
    const { lastFrame, stdin, unmount } = render(
      <SnapshotManager snapshotDir={dir} lang="ja" onExit={() => {}} />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(path.basename(fileA));
    });
    stdin.write(SPACE);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('[x]');
    });
    stdin.write('d');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('削除しますか');
    });
    stdin.write('n');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Space: 選択');
    });
    expect(await exists(fileA)).toBe(true);
    expect(await exists(fileB)).toBe(true);
    unmount();
  });

  it('cannot mark the loaded snapshot', async () => {
    const { lastFrame, stdin, unmount } = render(
      <SnapshotManager
        snapshotDir={dir}
        loadedFileName={path.basename(fileA)}
        lang="ja"
        onExit={() => {}}
      />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('(ロード中)');
    });
    // The cursor starts on the loaded (disabled) row: Space is a no-op.
    stdin.write(SPACE);
    expect(lastFrame()).not.toContain('[x]');
    expect(lastFrame()).toContain('[-]');
    unmount();
  });

  it('exits with Esc from the list', async () => {
    const onExit = vi.fn();
    const { lastFrame, stdin, unmount } = render(
      <SnapshotManager snapshotDir={dir} lang="ja" onExit={onExit} />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain(path.basename(fileA));
    });
    stdin.write(ESCAPE);
    await vi.waitFor(() => {
      expect(onExit).toHaveBeenCalled();
    });
    unmount();
  });

  it('auto-verifies files and shows verified facts only', async () => {
    // A REAL loadable snapshot (2 prototypes), but the file name
    // claims 5: verification shows the true count and the mismatch.
    const valid = path.join(dir, 'snapshot-20260717T090000Z-5.json');
    await writeFile(
      valid,
      JSON.stringify({
        version: '1.0.0',
        serializedAt: '2026-07-17T09:00:00.000Z',
        prototypes: [
          {
            id: 10,
            createDate: '2026-01-01T00:00:00.000Z',
            releaseFlg: 1,
            status: 1,
            prototypeNm: 'Alpha',
            summary: '',
            freeComment: '',
            systemDescription: '',
            users: ['tester'],
            teamNm: '',
            tags: [],
            materials: [],
            events: [],
            awards: [],
            mainUrl: 'https://protopedia.net/prototype/10',
            viewCount: 0,
            goodCount: 0,
            commentCount: 0,
          },
          {
            id: 30,
            createDate: '2026-01-01T00:00:00.000Z',
            releaseFlg: 1,
            status: 1,
            prototypeNm: 'Beta',
            summary: '',
            freeComment: '',
            systemDescription: '',
            users: ['tester'],
            teamNm: '',
            tags: [],
            materials: [],
            events: [],
            awards: [],
            mainUrl: 'https://protopedia.net/prototype/30',
            viewCount: 0,
            goodCount: 0,
            commentCount: 0,
          },
        ],
      }),
      'utf8',
    );
    // fileA / fileB are not valid snapshots ({"a":1}): invalid.
    const { lastFrame, unmount } = render(
      <SnapshotManager snapshotDir={dir} lang="ja" onExit={() => {}} />,
    );
    // Auto-verification fills the detail lines with facts: the real
    // count and ID range, the real serializedAt, and the mismatch
    // note against the lying file name. No key press needed.
    await vi.waitFor(
      () => {
        expect(lastFrame()).toContain('2件  ID 10-30');
      },
      { timeout: 10_000 },
    );
    expect(lastFrame()).toContain('(ファイル名と不一致)');
    expect(lastFrame()).not.toContain('5件');
    await vi.waitFor(
      () => {
        expect(lastFrame()).toContain('✗');
      },
      { timeout: 10_000 },
    );
    unmount();
  });

  it('renders English labels for pptop', async () => {
    const { lastFrame, unmount } = render(
      <SnapshotManager snapshotDir={dir} lang="en" onExit={() => {}} />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Space: Mark');
    });
    unmount();
  });
});
