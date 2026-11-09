import { describe, expect, it } from 'vitest';

import { sanitizeDisplayText } from '../core/sanitize-display-text.js';
import {
  cellValue,
  columnLabel,
  compareByColumn,
  visibleColumnsForWidth,
} from './table-columns.js';

import type { NormalizedPrototype } from 'promidas/types';

// Minimal builder: only the fields the sort/label logic reads matter,
// so the rest are filled with harmless defaults and cast (mirrors the
// pattern used in top-stats tests).
function proto(fields: Partial<Record<string, unknown>>): NormalizedPrototype {
  return {
    id: 0,
    prototypeNm: '',
    teamNm: '',
    users: [],
    tags: [],
    materials: [],
    awards: [],
    events: [],
    status: 1,
    viewCount: 0,
    goodCount: 0,
    commentCount: 0,
    ...fields,
  } as unknown as NormalizedPrototype;
}

describe('compareByColumn', () => {
  it('orders a numeric column by value (ascending)', () => {
    const items = [
      proto({ id: 2, viewCount: 20 }),
      proto({ id: 1, viewCount: 100 }),
    ];
    const sorted = [...items].sort(compareByColumn('views'));
    expect(sorted.map((p) => p.id)).toEqual([2, 1]);
  });

  it('orders the id column numerically, not lexically', () => {
    const items = [proto({ id: 100 }), proto({ id: 20 }), proto({ id: 3 })];
    const sorted = [...items].sort(compareByColumn('id'));
    // Lexical order would be [100, 20, 3]; numeric order is [3, 20, 100].
    expect(sorted.map((p) => p.id)).toEqual([3, 20, 100]);
  });

  it('orders a text column with localeCompare', () => {
    const items = [
      proto({ id: 1, prototypeNm: 'Beta' }),
      proto({ id: 2, prototypeNm: 'Alpha' }),
    ];
    const sorted = [...items].sort(compareByColumn('name'));
    expect(sorted.map((p) => p.prototypeNm)).toEqual(['Alpha', 'Beta']);
  });

  it('breaks ties by PID (id) ascending', () => {
    // Equal primary value (both viewCount 50): PID is the secondary key.
    const items = [
      proto({ id: 30, viewCount: 50 }),
      proto({ id: 10, viewCount: 50 }),
    ];
    const sorted = [...items].sort(compareByColumn('views'));
    expect(sorted.map((p) => p.id)).toEqual([10, 30]);
  });
});

describe('visibleColumnsForWidth', () => {
  it('shows every column at 120 columns', () => {
    const keys = visibleColumnsForWidth(120).map((c) => c.key);
    expect(keys).toContain('team'); // GROUP, minColumns 120
    expect(keys).toContain('released'); // RELEASED, minColumns 120
  });

  it('drops GROUP and RELEASED below 120 columns', () => {
    const keys = visibleColumnsForWidth(100).map((c) => c.key);
    expect(keys).not.toContain('team');
    expect(keys).not.toContain('released');
    // AW / EV (minColumns 80) are still visible at 100.
    expect(keys).toContain('awards');
    expect(keys).toContain('events');
  });

  it('drops AW and EV below 80 columns, keeping the always-on columns', () => {
    const keys = visibleColumnsForWidth(79).map((c) => c.key);
    expect(keys).not.toContain('awards');
    expect(keys).not.toContain('events');
    expect(keys).toContain('id'); // PID is always visible
    expect(keys).toContain('name'); // NAME is always visible
  });
});

describe('columnLabel', () => {
  it('maps a column key to its display label', () => {
    expect(columnLabel('id')).toBe('PID');
    expect(columnLabel('users')).toBe('USER');
    expect(columnLabel('name')).toBe('NAME');
  });
});

describe('cellValue sanitizes untrusted text columns', () => {
  const TAB = String.fromCodePoint(0x09);

  it('replaces a control char in the name with a space', () => {
    expect(cellValue('name', proto({ prototypeNm: `A${TAB}B` }))).toBe('A B');
  });

  it('replaces a control char in the team with a space', () => {
    expect(cellValue('team', proto({ teamNm: `A${TAB}B` }))).toBe('A B');
  });

  it('leaves no control character in the users cell', () => {
    const out = cellValue('users', proto({ users: [`u${TAB}v@id${TAB}x`] }));
    expect(out).not.toMatch(/\p{Cc}/u);
  });
});

describe('compareByColumn sorts NAME by the sanitized (displayed) text', () => {
  const TAB = String.fromCodePoint(0x09);

  it('matches sorting by the sanitized name, not the raw bytes', () => {
    // A displays as "  zzz", B as "  xxx". On raw bytes A < B (a leading
    // TAB sorts before a leading space), but what the user sees is
    // B < A ("xxx" < "zzz"); only the sanitized order matches the screen.
    const items = [
      proto({ id: 1, prototypeNm: `${TAB} zzz` }),
      proto({ id: 2, prototypeNm: '  xxx' }),
    ];
    const byColumn = [...items].sort(compareByColumn('name')).map((p) => p.id);
    const bySanitized = [...items]
      .sort(
        (a, b) =>
          sanitizeDisplayText(a.prototypeNm).localeCompare(
            sanitizeDisplayText(b.prototypeNm),
          ) || a.id - b.id,
      )
      .map((p) => p.id);
    expect(byColumn).toEqual(bySanitized);
  });

  it('treats names equal after sanitizing as tied (falls back to PID)', () => {
    // "a<TAB>b" and "a b" sanitize to the same "a b", so they must tie
    // on name and order by PID; a raw comparison would not tie them.
    const items = [
      proto({ id: 5, prototypeNm: `a${TAB}b` }),
      proto({ id: 3, prototypeNm: 'a b' }),
    ];
    const sorted = [...items].sort(compareByColumn('name')).map((p) => p.id);
    expect(sorted).toEqual([3, 5]);
  });
});
