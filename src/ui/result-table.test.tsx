import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { ResultTable } from './result-table.js';

import type { NormalizedPrototype } from 'promidas/types';

const ITEM = {
  id: 7,
  createDate: '2026-01-01T00:00:00.000Z',
  releaseFlg: 1,
  status: 3,
  prototypeNm: 'Responsive Widget',
  summary: '',
  freeComment: '',
  systemDescription: '',
  // Real-data username encoding: displayName + '@' + profileId
  // (the display name may be empty).
  users: ['Alice@alice', '@carol', 'Bob Example@bob'],
  teamNm: 'team-x',
  tags: [],
  materials: [],
  events: ['MF Tokyo', 'HackDay'],
  awards: [],
  mainUrl: 'https://protopedia.net/prototype/7',
  // Midday UTC keeps the local date stable across CI timezones.
  releaseDate: '2026-03-01T12:00:00.000Z',
  viewCount: 12,
  goodCount: 3,
  commentCount: 4,
} as unknown as NormalizedPrototype;

function renderTable(columns: number) {
  return render(
    <ResultTable items={[ITEM]} cursor={0} rows={3} columns={columns} />,
  );
}

describe('ResultTable responsive columns', () => {
  it('shows every column on a wide terminal', () => {
    const { lastFrame, unmount } = renderTable(140);
    const frame = lastFrame() ?? '';
    for (const label of ['PID', 'GROUP', 'USER', 'UC', 'NAME', 'RELEASED']) {
      expect(frame).toContain(label);
    }
    expect(frame).toContain('EV');
    expect(frame).toContain('CC');
    expect(frame).toContain('team-x');
    // USER shows the profileIds only, not the display names.
    expect(frame).toContain('alice,carol');
    expect(frame).not.toContain('Alice');
    // UC and EV are counts; released is a local date-time.
    expect(frame).toMatch(/\s3\s/); // 3 users
    expect(frame).toMatch(/\s2\s/); // 2 events
    expect(frame).toContain('2026-03-01');
    unmount();
  });

  it('drops GROUP and RELEASED below their thresholds', () => {
    const { lastFrame, unmount } = renderTable(100);
    const frame = lastFrame() ?? '';
    expect(frame).not.toContain('GROUP');
    expect(frame).not.toContain('RELEASED');
    expect(frame).toContain('EV'); // 95 <= 100
    unmount();
  });

  it('drops EV below 95 columns', () => {
    const { lastFrame, unmount } = renderTable(70);
    const frame = lastFrame() ?? '';
    expect(frame).not.toContain('GROUP');
    expect(frame).not.toContain('EV');
    expect(frame).not.toContain('RELEASED');
    unmount();
  });

  it('always keeps the top-style core columns', () => {
    const { lastFrame, unmount } = renderTable(50);
    const frame = lastFrame() ?? '';
    for (const label of ['PID', 'USER', 'UC', 'NAME', 'ST', 'VC', 'GC', 'CC']) {
      expect(frame).toContain(label);
    }
    expect(frame).not.toContain('GROUP');
    expect(frame).toContain('Responsive Widget');
    unmount();
  });
});
