/**
 * Single source of truth for the pptop result table's columns.
 *
 * Both the presentational table (result-table.tsx) and the monitor
 * container (top-app.tsx) read from here: the table renders columns,
 * while the container needs the same metadata to move the sort column
 * (< / >), fall back on resize, and label the sort state.
 *
 * width: undefined means "take the rest"; minColumns: undefined means
 * "always shown" (responsive columns appear only when the terminal is
 * at least that many cells wide).
 */
import { parseUsername } from 'promidas-utils/utils';

import { formatLocalDateTime } from '../core/format.js';
import { sanitizeDisplayText } from '../core/sanitize-display-text.js';

import type { NormalizedPrototype } from 'promidas/types';

export const COLUMNS = [
  { key: 'id', label: 'PID', width: 5, align: 'right' },
  { key: 'team', label: 'GROUP', width: 10, align: 'left', minColumns: 120 },
  { key: 'users', label: 'USER', width: 12, align: 'left' },
  { key: 'userCount', label: 'UC', width: 2, align: 'right' },
  { key: 'status', label: 'ST', width: 2, align: 'right' },
  {
    key: 'released',
    label: 'RELEASED',
    width: 16,
    align: 'left',
    minColumns: 120,
  },
  // tags, materials, awards, events
  { key: 'tags', label: 'TG', width: 2, align: 'right' },
  { key: 'materials', label: 'MT', width: 2, align: 'right' },
  { key: 'awards', label: 'AW', width: 2, align: 'right', minColumns: 80 },
  { key: 'events', label: 'EV', width: 2, align: 'right', minColumns: 80 },
  // views, goods, comments
  { key: 'views', label: 'VC', width: 6, align: 'right' },
  { key: 'goods', label: 'GC', width: 3, align: 'right' },
  { key: 'comments', label: 'CC', width: 3, align: 'right' },
  // name
  { key: 'name', label: 'NAME', width: undefined, align: 'left' },
] as const;

export type Column = (typeof COLUMNS)[number];

/** Columns visible at the given terminal width (responsive drop). */
export function visibleColumnsForWidth(width: number): readonly Column[] {
  return COLUMNS.filter(
    (column) => !('minColumns' in column) || width >= column.minColumns,
  );
}

/** Display label for a column key (used by the sort-state line). */
export function columnLabel(key: Column['key']): string {
  const column = COLUMNS.find((c) => c.key === key);
  return column ? column.label : key;
}

/** Rendered cell text for a column. */
export function cellValue(
  key: Column['key'],
  prototype: NormalizedPrototype,
): string {
  switch (key) {
    case 'id':
      return String(prototype.id);
    case 'team':
      return sanitizeDisplayText(prototype.teamNm);
    case 'users':
      // The stable handle only; profileId is '' for malformed input
      // (no '@'), which then shows as an empty slot.
      return sanitizeDisplayText(
        prototype.users.map((user) => parseUsername(user).profileId).join(','),
      );
    case 'userCount':
      return String(prototype.users.length);
    case 'name':
      return sanitizeDisplayText(prototype.prototypeNm);
    case 'status':
      return String(prototype.status);
    case 'tags':
      return String(prototype.tags.length);
    case 'materials':
      return String(prototype.materials.length);
    case 'awards':
      return String(prototype.awards.length);
    case 'views':
      return String(prototype.viewCount);
    case 'goods':
      return String(prototype.goodCount);
    case 'comments':
      return String(prototype.commentCount);
    case 'events':
      return String(prototype.events.length);
    case 'released':
      return prototype.releaseDate !== undefined
        ? formatLocalDateTime(new Date(prototype.releaseDate)).slice(0, 16)
        : '';
  }
}

/** Raw comparable value for sorting (number for counts, string else). */
function sortValue(
  key: Column['key'],
  prototype: NormalizedPrototype,
): number | string {
  switch (key) {
    case 'id':
      return prototype.id;
    case 'team':
      return sanitizeDisplayText(prototype.teamNm);
    case 'users':
      return sanitizeDisplayText(
        prototype.users.map((user) => parseUsername(user).profileId).join(','),
      );
    case 'userCount':
      return prototype.users.length;
    case 'status':
      return prototype.status;
    case 'tags':
      return prototype.tags.length;
    case 'materials':
      return prototype.materials.length;
    case 'awards':
      return prototype.awards.length;
    case 'events':
      return prototype.events.length;
    case 'views':
      return prototype.viewCount;
    case 'goods':
      return prototype.goodCount;
    case 'comments':
      return prototype.commentCount;
    case 'released':
      // ISO 8601, so a plain string compare is chronological; a
      // missing date sorts as '' (first in ascending order).
      return prototype.releaseDate ?? '';
    case 'name':
      return sanitizeDisplayText(prototype.prototypeNm);
  }
}

/**
 * Ascending comparator for a column. Numeric columns compare by value;
 * text and date columns compare with localeCompare. PID (id) is the
 * secondary key, so equal primary values have a stable, predictable
 * order. The caller applies the direction (multiply by -1 for
 * descending), so a reversed sort reverses ties too (top's R reverses
 * the whole order).
 */
export function compareByColumn(
  key: Column['key'],
): (a: NormalizedPrototype, b: NormalizedPrototype) => number {
  // Memoize sortValue per prototype id for this one sort. The
  // comparator runs O(N log N) times, so without this the users
  // column recomputes parseUsername().map().join() on every
  // comparison (~17ms at N=6500); memoized, sortValue runs at most N
  // times (~2.5ms). The cache lives only for this comparator (one
  // sort) and holds one entry per row, so memory is negligible. It
  // does not speed up localeCompare, so text columns (name/team) are
  // unaffected — only the heavy-sortValue users column benefits.
  const cache = new Map<number, number | string>();
  const valueOf = (p: NormalizedPrototype): number | string => {
    const cached = cache.get(p.id);
    if (cached !== undefined) return cached;
    const value = sortValue(key, p);
    cache.set(p.id, value);
    return value;
  };
  return (a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    const primary =
      typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb));
    return primary !== 0 ? primary : a.id - b.id;
  };
}
