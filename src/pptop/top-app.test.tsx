import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { render } from 'ink-testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TopApp } from './top-app.js';
import { computeSnapshotStats, countNewborns } from './top-stats.js';
import { formatLocalDateTime } from '../core/format.js';

import type { NormalizedPrototype } from 'promidas/types';

const TAB = '\t';
const PAGE_DOWN = '\u001B[6~';
const ARROW_DOWN = '\u001B[B';
const ENTER = '\r';
const ESCAPE = '\u001B';

function prototypeFixture(
  id: number,
  name: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
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
    ...extra,
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
        prototypeFixture(10, 'Alpha Machine', {
          status: 3,
          viewCount: 100,
          goodCount: 5,
          tags: ['LED'],
        }),
        prototypeFixture(30, 'Beta Device', { viewCount: 20 }),
      ],
    }),
    'utf8',
  );
  return filePath;
}

describe('computeSnapshotStats', () => {
  it('aggregates counts, sums, and distinct values', () => {
    const items = [
      prototypeFixture(1, 'A', {
        status: 3,
        viewCount: 100,
        goodCount: 2,
        commentCount: 1,
        users: ['alice'],
        tags: ['LED', 'IoT'],
        materials: ['M5Stack'],
        awards: ['Gugen'],
        events: ['MFT'],
        teamNm: 'team-x',
      }),
      prototypeFixture(2, 'B', {
        status: 1,
        viewCount: 50,
        users: ['alice', 'bob'],
        tags: ['LED'],
        events: ['MFT'],
      }),
    ] as unknown as readonly NormalizedPrototype[];

    const stats = computeSnapshotStats(items);
    expect(stats.total).toBe(2);
    expect(stats.statusCounts.get(3)).toBe(1);
    expect(stats.statusCounts.get(1)).toBe(1);
    expect(stats.viewsTotal).toBe(150);
    expect(stats.viewsAvg).toBe(75);
    expect(stats.viewsMax).toBe(100);
    expect(stats.goodsTotal).toBe(2);
    expect(stats.commentsTotal).toBe(1);
    expect(stats.distinctUsers).toBe(2);
    expect(stats.distinctTeams).toBe(1);
    expect(stats.distinctTags).toBe(2);
    expect(stats.distinctMaterials).toBe(1);
    expect(stats.distinctAwards).toBe(1);
    expect(stats.distinctEvents).toBe(1);
  });

  it('handles the empty dataset', () => {
    const stats = computeSnapshotStats([]);
    expect(stats.total).toBe(0);
    expect(stats.viewsAvg).toBe(0);
  });
});

describe('countNewborns', () => {
  const HOUR = 3_600_000;
  const NOW = 1_000_000 * HOUR; // arbitrary fixed "now" (TZ-independent)

  it('counts releases within 24h / 7d / 30d, cumulatively', () => {
    const times = [
      NOW - 40 * 24 * HOUR, // 40d ago: outside every window
      NOW - 20 * 24 * HOUR, // 20d ago: 30d only
      NOW - 5 * 24 * HOUR, // 5d ago: 7d + 30d
      NOW - 10 * HOUR, // 10h ago: all windows
    ].sort((a, b) => a - b);
    expect(countNewborns(times, NOW)).toEqual({
      last24h: 1,
      last7d: 2,
      last30d: 3,
    });
  });

  it('ignores releases dated after now (clock skew)', () => {
    const times = [NOW - HOUR, NOW + HOUR].sort((a, b) => a - b);
    expect(countNewborns(times, NOW)).toEqual({
      last24h: 1,
      last7d: 1,
      last30d: 1,
    });
  });

  it('returns zeros when there are no releases', () => {
    expect(countNewborns([], NOW)).toEqual({
      last24h: 0,
      last7d: 0,
      last30d: 0,
    });
  });
});

describe('TopApp', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'pptop-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('auto-loads the latest snapshot and shows the top-style header', async () => {
    await writeSnapshotFixture(dir);
    const { lastFrame, unmount } = render(<TopApp snapshotDir={dir} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 total');
    });
    const frame = lastFrame() ?? '';
    expect(frame).toContain('1 idea');
    expect(frame).toContain('1 done');
    // top(1)-style header. The context line shows the snapshot time in
    // the local timezone; derive the expected value with the same
    // formatter so this assertion stays TZ-independent.
    const taken = formatLocalDateTime(
      new Date('2026-07-15T10:00:00.000Z'),
    ).slice(0, 16);
    expect(frame).toContain(`pptop - ${taken}`);
    expect(frame).toContain('%Status: 50.0 idea, 0.0 dev, 50.0 done, 0.0 eol');
    // releaseDate is unset in the fixture, so newborns are 0 regardless
    // of the wall clock (also TZ-independent).
    expect(frame).toContain('Newborns: 0, 0, 0');
    expect(frame).toContain(
      'Engagement: 120 views, 100 max, 5 goods, 0 comments',
    );
    expect(frame).toContain('Catalog: 1 usr, 0 tm, 1 tag, 0 mat, 0 awd, 0 ev');
    // Table with the fixed header labels; command-mode hint.
    expect(frame).toContain('PID');
    expect(frame).toContain('NAME');
    // Rows render without a marker column. The cyan highlight is not
    // assertable here (colors are disabled in the test environment).
    expect(frame).toMatch(/\s10\s.*Alpha Machine/);
    // The preview shows the ProtoPedia page URL of the selected row.
    expect(frame).toContain('url: https://protopedia.net/prototype/10');
    expect(frame).toContain('s: Snapshot | ?: Help | q: Quit');
    unmount();
  });

  it('starts with an empty table when no snapshot exists', async () => {
    const { lastFrame, unmount } = render(<TopApp snapshotDir={dir} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 0 total');
    });
    expect(lastFrame()).toContain('pptop - (no snapshot)');
    expect(lastFrame()).toContain('Prototypes: 0 / 0');
    unmount();
  });

  it('filters via the / input mode and returns to command mode', async () => {
    await writeSnapshotFixture(dir);
    const { lastFrame, stdin, unmount } = render(<TopApp snapshotDir={dir} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 total');
    });

    stdin.write('/'); // enter input mode (the ID field is active)
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Search (input mode');
    });
    stdin.write(TAB); // ID -> Name
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('> Name: [');
    });
    stdin.write('alpha'); // live filter on the name field
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 1 / 2 (1/1)');
    });
    // The active condition appears above the table.
    expect(lastFrame()).toContain('Name: alpha');
    stdin.write(ESCAPE); // back to command mode; the filter persists
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('s: Snapshot | ?: Help | q: Quit');
    });
    expect(lastFrame()).toContain('Prototypes: 1 / 2 (1/1)');

    stdin.write(ENTER); // detail of the selected row (JSON default)
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('"prototypeNm": "Alpha Machine"');
    });
    stdin.write(ESCAPE);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('s: Snapshot | ?: Help | q: Quit');
    });
    unmount();
  });

  it('opens snapshot management with s and returns with Esc', async () => {
    await writeSnapshotFixture(dir);
    const { lastFrame, stdin, unmount } = render(<TopApp snapshotDir={dir} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 total');
    });

    stdin.write('s');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Select a snapshot');
    });
    // The loaded snapshot is marked; the create option is present.
    expect(lastFrame()).toContain('* 2026-07-15');
    expect(lastFrame()).toContain('[Create and select]');

    stdin.write(ESCAPE); // back to the table
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('s: Snapshot | ?: Help | q: Quit');
    });
    unmount();
  });

  it('moves the selection with arrows in command mode', async () => {
    await writeSnapshotFixture(dir);
    const { lastFrame, stdin, unmount } = render(<TopApp snapshotDir={dir} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 total');
    });
    stdin.write(ARROW_DOWN);
    await vi.waitFor(() => {
      // The preview follows the selection to the second row (the cyan
      // highlight is not assertable: colors are off in tests).
      expect(lastFrame()).toContain('Name: Beta Device');
    });
    unmount();
  });

  it('keeps the cursor when the ID field rejects typed input', async () => {
    await writeSnapshotFixture(dir);
    const { lastFrame, stdin, unmount } = render(<TopApp snapshotDir={dir} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 total');
    });
    stdin.write(ARROW_DOWN); // select the second row
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 / 2 (2/2)');
    });

    stdin.write('/'); // input mode; the ID field is active
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Search (input mode');
    });
    stdin.write('x'); // rejected by the ID field; values are unchanged
    stdin.write(TAB); // observable follow-up event: ID -> Name
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('> Name: [');
    });
    // The rejected input must not reset the selection to the top.
    expect(lastFrame()).toContain('Prototypes: 2 / 2 (2/2)');
    expect(lastFrame()).toContain('Name: Beta Device');
    unmount();
  });

  it('scrolls the detail JSON with PgDn', async () => {
    await writeSnapshotFixture(dir);
    const { lastFrame, stdin, unmount } = render(<TopApp snapshotDir={dir} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 total');
    });

    stdin.write(ENTER); // detail of the first row (JSON default)
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('"prototypeNm": "Alpha Machine"');
    });
    // Longer than the pane: the position indicator starts at line 1
    // and the tail keys are not visible yet.
    expect(lastFrame()).toContain('(1-');
    expect(lastFrame()).not.toContain('"commentCount"');

    stdin.write(PAGE_DOWN);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('"commentCount": 0');
    });
    expect(lastFrame()).not.toContain('(1-');
    unmount();
  });

  it('shows the full raw JSON with r and returns with Esc', async () => {
    await writeSnapshotFixture(dir);
    const { lastFrame, stdin, unmount } = render(<TopApp snapshotDir={dir} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 total');
    });

    stdin.write(ENTER); // detail (scrollable JSON)
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('r: Raw JSON');
    });

    stdin.write('r'); // full raw output, no border, no window
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Esc: back to detail');
    });
    const frame = lastFrame() ?? '';
    expect(frame).toContain('"id": 10');
    expect(frame).toContain('"commentCount": 0'); // tail is present too
    expect(frame).not.toContain('╭'); // no border to pollute copies

    stdin.write(ESCAPE); // back to the detail view
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('r: Raw JSON');
    });
    unmount();
  });

  it('reverses the sort order with R and resets the cursor to the top', async () => {
    await writeSnapshotFixture(dir);
    const { lastFrame, stdin, unmount } = render(<TopApp snapshotDir={dir} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 total');
    });
    // Default: PID ascending, so id 10 (Alpha) is the top row.
    expect(lastFrame()).toContain('Sort: PID asc');
    expect(lastFrame()).toContain('Name: Alpha Machine');

    stdin.write(ARROW_DOWN); // move the cursor off the top row
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 / 2 (2/2)');
    });

    stdin.write('R'); // reverse -> PID descending
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Sort: PID desc');
    });
    // The cursor is reset to the top, which is now id 30 (Beta).
    expect(lastFrame()).toContain('Prototypes: 2 / 2 (1/2)');
    expect(lastFrame()).toContain('Name: Beta Device');
    unmount();
  });

  it('moves the sort column right with > (keeps direction, resets cursor)', async () => {
    await writeSnapshotFixture(dir);
    const { lastFrame, stdin, unmount } = render(<TopApp snapshotDir={dir} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 total');
    });
    expect(lastFrame()).toContain('Sort: PID asc');

    stdin.write(ARROW_DOWN); // move the cursor off the top row
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 / 2 (2/2)');
    });

    // GROUP (minColumns 120) is hidden at the 100-column test width, so
    // the next visible column to the right of PID is USER.
    stdin.write('>');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Sort: USER asc');
    });
    // Direction is preserved (asc) and the cursor is reset to the top.
    expect(lastFrame()).toContain('Prototypes: 2 / 2 (1/2)');
    unmount();
  });

  it('clamps < at the leftmost column: no column change, no cursor reset', async () => {
    await writeSnapshotFixture(dir);
    const { lastFrame, stdin, unmount } = render(<TopApp snapshotDir={dir} />);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 total');
    });
    expect(lastFrame()).toContain('Sort: PID asc'); // PID is the leftmost column

    stdin.write(ARROW_DOWN); // move the cursor to id 30 (Beta)
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Prototypes: 2 / 2 (2/2)');
    });

    stdin.write('<'); // clamped: PID has no visible column to its left
    // The sort column stays PID and the cursor is not reset.
    expect(lastFrame()).toContain('Sort: PID asc');
    stdin.write(ENTER); // observable follow-up: open the current row's detail
    await vi.waitFor(() => {
      // Still on the second row (Beta), proving < neither moved the sort
      // column nor reset the cursor to the top (which would be Alpha).
      expect(lastFrame()).toContain('"prototypeNm": "Beta Device"');
    });
    unmount();
  });
});
