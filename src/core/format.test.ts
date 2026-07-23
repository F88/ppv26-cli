import { describe, expect, it } from 'vitest';

import { formatSizeMB, formatSnapshotRow } from './format.js';

import type { SnapshotFileInfo } from './snapshot-catalog.js';

describe('formatSizeMB', () => {
  it('formats sizes in SI units with one decimal', () => {
    expect(formatSizeMB(18_400_000)).toBe('18.4 MB');
    expect(formatSizeMB(1_000_000)).toBe('1.0 MB');
    expect(formatSizeMB(512_300)).toBe('512.3 KB');
    expect(formatSizeMB(2_500_000_000)).toBe('2.5 GB');
  });

  it('returns ? for unknown sizes', () => {
    expect(formatSizeMB(null)).toBe('?');
    expect(formatSizeMB(undefined)).toBe('?');
  });
});

describe('formatSnapshotRow', () => {
  it('shows date, count, size and file name', () => {
    const info: SnapshotFileInfo = {
      fileName: 'snapshot-20260715T100000Z-6479.json',
      filePath: '/tmp/snapshot-20260715T100000Z-6479.json',
      takenAt: new Date('2026-07-15T10:00:00Z'),
      count: 6479,
      sizeBytes: 18_400_000,
    };
    const row = formatSnapshotRow(info);
    expect(row).toContain('6479件');
    expect(row).toContain('18.4 MB');
    expect(row).toContain('snapshot-20260715T100000Z-6479.json');
  });

  it('marks non-conforming names and unknown sizes', () => {
    const info: SnapshotFileInfo = {
      fileName: 'hoge.json',
      filePath: '/tmp/hoge.json',
      takenAt: null,
      count: null,
      sizeBytes: null,
    };
    const row = formatSnapshotRow(info);
    expect(row).toContain('(命名規則外)');
    expect(row).toContain('?');
    expect(row).toContain('hoge.json');
  });
});
