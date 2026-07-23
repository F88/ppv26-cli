import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { render } from 'ink-testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PpexApp, CREATE_LABEL, MAIN_MENU } from './ppex-app.js';

const ARROW_DOWN = '\u001B[B';
const ENTER = '\r';
const ESCAPE = '\u001B';

// vi.waitFor's 1s default expires on slow Windows CI runners before
// Ink finishes a full-screen re-render; give every transition wait
// the same headroom the 15s suite testTimeout already allows for.
function waitForFrame(check: () => void): Promise<void> {
  return vi.waitFor(check, { timeout: 5000 });
}

function prototypeFixture(id: number, name: string): Record<string, unknown> {
  return {
    id,
    createDate: '2026-01-01T00:00:00.000Z',
    releaseFlg: 1,
    status: 1,
    prototypeNm: name,
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

async function writeSnapshotFixture(dir: string): Promise<string> {
  const filePath = path.join(dir, 'snapshot-20260715T100000Z-2.json');
  await writeFile(
    filePath,
    JSON.stringify({
      version: '1.0.0',
      serializedAt: '2026-07-15T10:00:00.000Z',
      prototypes: [
        prototypeFixture(10, 'Alpha Machine'),
        prototypeFixture(30, 'Beta Device'),
      ],
    }),
    'utf8',
  );
  return filePath;
}

// retry: multi-screen key sequences flake on slow Windows CI
// runners (never reproduced locally, 0/15 stress runs). The
// ink-testing-library mock stdin is a bare EventEmitter with a
// single-slot buffer, so a keypress written in the gap while Ink
// re-attaches its readable listener between screens can be lost or
// mis-delivered. A retry re-runs the whole scenario cleanly.
describe('PpexApp', { retry: 2 }, () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ppc-app-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('offers only the create option when no snapshot exists', async () => {
    const { lastFrame, unmount } = render(<PpexApp snapshotDir={dir} />);
    await waitForFrame(() => {
      expect(lastFrame()).toContain('snapshot がありません');
    });
    expect(lastFrame()).toContain(CREATE_LABEL);
    expect(lastFrame()).not.toContain('[最新]');
    unmount();
  });

  it('loads a snapshot and shows the metadata header with the menu', async () => {
    await writeSnapshotFixture(dir);
    const { lastFrame, stdin, unmount } = render(<PpexApp snapshotDir={dir} />);
    await waitForFrame(() => {
      expect(lastFrame()).toContain('[最新]');
    });

    stdin.write(ENTER);
    // Wait for the menu cursor: "スナップショット" alone also matches
    // the picker hint (m: スナップショット管理).
    await waitForFrame(() => {
      expect(lastFrame()).toContain(`> ${MAIN_MENU.search}`);
    });
    const frame = lastFrame() ?? '';
    // Always-visible metadata header (real serializedAt, count, range).
    expect(frame).toContain('snapshot-20260715T100000Z-2.json');
    expect(frame).toContain('出力日時: 2026-07-15');
    expect(frame).toContain('時間前');
    expect(frame).toContain('2 件');
    expect(frame).toContain('ID: 10 - 30');
    expect(frame).toContain(MAIN_MENU.search);
    unmount();
  });

  it('opens the snapshot manager with m and protects the loaded snapshot', async () => {
    await writeSnapshotFixture(dir);
    const { lastFrame, stdin, unmount } = render(<PpexApp snapshotDir={dir} />);
    await waitForFrame(() => {
      expect(lastFrame()).toContain('[最新]');
    });
    stdin.write(ENTER); // load
    await waitForFrame(() => {
      expect(lastFrame()).toContain(`> ${MAIN_MENU.search}`);
    });
    stdin.write(ARROW_DOWN); // 作品探索 -> スナップショット
    await waitForFrame(() => {
      expect(lastFrame()).toContain(`> ${MAIN_MENU.snapshot}`);
    });
    stdin.write(ENTER); // -> picker (direct; no intermediate menu)
    await waitForFrame(() => {
      expect(lastFrame()).toContain('m: スナップショット管理');
    });
    stdin.write('m'); // -> snapshot manager
    // The rows and their sizes load asynchronously after the screen
    // mounts, so wait for them too, not just the title.
    await waitForFrame(() => {
      expect(lastFrame()).toContain('Snapshot管理');
      // The loaded snapshot cannot be selected, and sizes are shown.
      expect(lastFrame()).toContain('[-]');
      expect(lastFrame()).toContain('(ロード中)');
      expect(lastFrame()).toContain('KB');
    });
    unmount();
  });

  it('marks the currently loaded snapshot on the re-select picker', async () => {
    const filePath = await writeSnapshotFixture(dir);
    const fileName = path.basename(filePath);
    const { lastFrame, stdin, unmount } = render(<PpexApp snapshotDir={dir} />);
    await waitForFrame(() => {
      expect(lastFrame()).toContain('[最新]');
    });
    // At startup nothing is loaded yet: no current marker.
    expect(lastFrame()).not.toContain(`* ${fileName}`);
    expect(lastFrame()).not.toContain('* 2026-07-15');

    stdin.write(ENTER); // load
    // Wait for the menu cursor, not just the label: the cursor
    // proves the main-menu Menu is mounted and owns the keys
    // (looser waits lost the next keypress on slow CI runners).
    await waitForFrame(() => {
      expect(lastFrame()).toContain(`> ${MAIN_MENU.search}`);
    });
    stdin.write(ARROW_DOWN); // 作品探索 -> スナップショット
    await waitForFrame(() => {
      expect(lastFrame()).toContain(`> ${MAIN_MENU.snapshot}`);
    });
    stdin.write(ENTER); // -> picker (direct)
    await waitForFrame(() => {
      expect(lastFrame()).toContain('snapshot を選択');
    });
    // The loaded snapshot is marked, and Esc-back is offered.
    expect(lastFrame()).toContain('* 2026-07-15');
    expect(lastFrame()).toContain('* = ロード中');
    expect(lastFrame()).toContain('Esc: 戻る');
    unmount();
  });

  it('opens 作品探索 from the menu with every prototype listed', async () => {
    await writeSnapshotFixture(dir);
    const { lastFrame, stdin, unmount } = render(<PpexApp snapshotDir={dir} />);
    await waitForFrame(() => {
      expect(lastFrame()).toContain('[最新]');
    });
    stdin.write(ENTER); // load
    await waitForFrame(() => {
      expect(lastFrame()).toContain(`> ${MAIN_MENU.search}`);
    });
    stdin.write(ENTER); // 作品探索 is the first item
    await waitForFrame(() => {
      expect(lastFrame()).toContain('ヒット: 2件 (全2件)');
    });
    // Rows are ID ascending; the header stays visible.
    expect(lastFrame()).toContain('> 10 Alpha Machine');
    expect(lastFrame()).toContain('30 Beta Device');
    expect(lastFrame()).toContain('出力日時: 2026-07-15');

    stdin.write(ESCAPE); // back to the main menu
    await waitForFrame(() => {
      expect(lastFrame()).toContain(`> ${MAIN_MENU.search}`);
    });
    unmount();
  });

  it('shows an error notice on the picker when loading fails', async () => {
    const broken = path.join(dir, 'snapshot-20260715T100000Z-1.json');
    await writeFile(broken, '{ broken', 'utf8');
    const { lastFrame, stdin, unmount } = render(<PpexApp snapshotDir={dir} />);
    await waitForFrame(() => {
      expect(lastFrame()).toContain('snapshot を選択');
    });
    stdin.write(ENTER);
    await waitForFrame(() => {
      expect(lastFrame()).toContain('ロードに失敗しました');
    });
    // Still on the picker; the create option remains available.
    expect(lastFrame()).toContain(CREATE_LABEL);
    unmount();
  });
});
