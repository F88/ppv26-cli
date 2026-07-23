import { describe, expect, it } from 'vitest';

import { filterPrototypes, hasAnyCriteria } from './explorer.js';

import type { NormalizedPrototype } from 'promidas/types';

function prototype(
  overrides: Partial<NormalizedPrototype> & { id: number },
): NormalizedPrototype {
  return {
    createDate: '2026-01-01T00:00:00.000Z',
    releaseFlg: 1,
    status: 1,
    prototypeNm: `Prototype ${overrides.id}`,
    summary: '',
    freeComment: '',
    systemDescription: '',
    users: [],
    teamNm: '',
    tags: [],
    materials: [],
    events: [],
    awards: [],
    mainUrl: `https://protopedia.net/prototype/${overrides.id}`,
    viewCount: 0,
    goodCount: 0,
    commentCount: 0,
    ...overrides,
  } as NormalizedPrototype;
}

// Deliberately unordered by ID to verify result sorting.
const FIXTURES: readonly NormalizedPrototype[] = [
  prototype({
    id: 3,
    prototypeNm: 'Weather Station',
    summary: 'Rainfall logger',
    tags: ['IoT'],
    users: ['carol'],
    events: ['ヒーローズ・リーグ'],
    materials: ['M5StickC'],
    status: 3,
  }),
  prototype({
    id: 1,
    prototypeNm: 'LED Cube',
    summary: 'A shiny cube',
    tags: ['LED', 'Arduino'],
    users: ['alice'],
    events: ['Maker Faire Tokyo'],
    materials: ['M5Stack'],
    status: 3,
  }),
  prototype({
    id: 2,
    prototypeNm: 'Robot Arm',
    summary: 'Arm with led indicator',
    tags: ['robot'],
    users: ['bob', 'carol'],
    events: [],
    materials: ['Raspberry Pi'],
    status: 1,
  }),
];

describe('hasAnyCriteria', () => {
  it('is false for an empty criteria object', () => {
    expect(hasAnyCriteria({})).toBe(false);
  });

  it('is false for empty arrays', () => {
    expect(hasAnyCriteria({ keywords: [], tags: [], statuses: [] })).toBe(
      false,
    );
  });

  it('is true when any criterion is set', () => {
    expect(hasAnyCriteria({ keywords: ['x'] })).toBe(true);
    expect(hasAnyCriteria({ tags: ['LED'] })).toBe(true);
    expect(hasAnyCriteria({ statuses: [1] })).toBe(true);
  });
});

describe('filterPrototypes', () => {
  it('returns hits sorted by ID ascending', () => {
    expect(filterPrototypes(FIXTURES, {}).map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it('matches a keyword against name and summary, case-insensitively', () => {
    const hits = filterPrototypes(FIXTURES, { keywords: ['led'] });
    expect(hits.map((p) => p.id)).toEqual([1, 2]);
  });

  it('combines multiple keywords with AND (Google-search style)', () => {
    expect(
      filterPrototypes(FIXTURES, { keywords: ['led', 'cube'] }).map(
        (p) => p.id,
      ),
    ).toEqual([1]);
    expect(filterPrototypes(FIXTURES, { keywords: ['led', 'rain'] })).toEqual(
      [],
    );
  });

  it('matches a tag partially and case-insensitively', () => {
    expect(
      filterPrototypes(FIXTURES, { tags: ['arduino'] }).map((p) => p.id),
    ).toEqual([1]);
  });

  it('matches IDs exactly, ORed, and returns them sorted', () => {
    expect(
      filterPrototypes(FIXTURES, { ids: [3, 1] }).map((p) => p.id),
    ).toEqual([1, 3]);
    expect(filterPrototypes(FIXTURES, { ids: [999] })).toEqual([]);
  });

  it('combines values within one facet with OR', () => {
    expect(
      filterPrototypes(FIXTURES, { tags: ['LED', 'robot'] }).map((p) => p.id),
    ).toEqual([1, 2]);
    expect(
      filterPrototypes(FIXTURES, { statuses: [1, 3] }).map((p) => p.id),
    ).toEqual([1, 2, 3]);
  });

  it('matches users, events, and materials', () => {
    expect(
      filterPrototypes(FIXTURES, { users: ['carol'] }).map((p) => p.id),
    ).toEqual([2, 3]);
    expect(
      filterPrototypes(FIXTURES, { events: ['リーグ'] }).map((p) => p.id),
    ).toEqual([3]);
    expect(
      filterPrototypes(FIXTURES, { materials: ['m5'] }).map((p) => p.id),
    ).toEqual([1, 3]);
  });

  it('matches status exactly', () => {
    expect(
      filterPrototypes(FIXTURES, { statuses: [3] }).map((p) => p.id),
    ).toEqual([1, 3]);
  });

  it('combines different facets with AND', () => {
    const hits = filterPrototypes(FIXTURES, {
      materials: ['m5'],
      statuses: [3],
      users: ['alice'],
    });
    expect(hits.map((p) => p.id)).toEqual([1]);
  });
});
