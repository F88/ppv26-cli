/**
 * Aggregate statistics over the loaded prototypes for the pptop
 * header (top-command style summary lines). Pure and unit-testable.
 */
import type { NormalizedPrototype } from 'promidas/types';

export type SnapshotStats = {
  readonly total: number;
  /** Counts by status code (1-4). */
  readonly statusCounts: ReadonlyMap<number, number>;
  readonly viewsTotal: number;
  readonly viewsAvg: number;
  readonly viewsMax: number;
  readonly goodsTotal: number;
  readonly commentsTotal: number;
  readonly distinctUsers: number;
  readonly distinctTeams: number;
  readonly distinctTags: number;
  readonly distinctMaterials: number;
  readonly distinctAwards: number;
  readonly distinctEvents: number;
};

export function computeSnapshotStats(
  prototypes: readonly NormalizedPrototype[],
): SnapshotStats {
  const statusCounts = new Map<number, number>();
  let viewsTotal = 0;
  let viewsMax = 0;
  let goodsTotal = 0;
  let commentsTotal = 0;
  const users = new Set<string>();
  const teams = new Set<string>();
  const tags = new Set<string>();
  const materials = new Set<string>();
  const awards = new Set<string>();
  const events = new Set<string>();

  for (const prototype of prototypes) {
    statusCounts.set(
      prototype.status,
      (statusCounts.get(prototype.status) ?? 0) + 1,
    );
    viewsTotal += prototype.viewCount;
    if (prototype.viewCount > viewsMax) viewsMax = prototype.viewCount;
    goodsTotal += prototype.goodCount;
    commentsTotal += prototype.commentCount;
    for (const user of prototype.users) users.add(user);
    if (prototype.teamNm !== '') teams.add(prototype.teamNm);
    for (const tag of prototype.tags) tags.add(tag);
    for (const material of prototype.materials) materials.add(material);
    for (const award of prototype.awards) awards.add(award);
    for (const event of prototype.events) events.add(event);
  }

  return {
    total: prototypes.length,
    statusCounts,
    viewsTotal,
    viewsAvg:
      prototypes.length === 0 ? 0 : Math.round(viewsTotal / prototypes.length),
    viewsMax,
    goodsTotal,
    commentsTotal,
    distinctUsers: users.size,
    distinctTeams: teams.size,
    distinctTags: tags.size,
    distinctMaterials: materials.size,
    distinctAwards: awards.size,
    distinctEvents: events.size,
  };
}

/** Count of prototypes released within each recent window. */
export type NewbornCounts = {
  readonly last24h: number;
  readonly last7d: number;
  readonly last30d: number;
};

const HOUR_MS = 3_600_000;

/**
 * Release timestamps (ms since epoch), ascending, with missing /
 * unparseable releaseDate dropped. Depends only on the prototype set,
 * so callers memoize this and re-run the cheap window count as `now`
 * advances.
 */
export function releaseTimestamps(
  prototypes: readonly NormalizedPrototype[],
): number[] {
  const times: number[] = [];
  for (const prototype of prototypes) {
    if (prototype.releaseDate === undefined) continue;
    const t = Date.parse(prototype.releaseDate);
    if (!Number.isNaN(t)) times.push(t);
  }
  return times.sort((a, b) => a - b);
}

/**
 * "Newborns": prototypes released in the last 24h / 7d / 30d, measured
 * against `now` (the current time, not the snapshot time), so a stale
 * snapshot naturally shows fewer. Windows are rolling and cumulative
 * (30d includes 7d includes 24h), like top's load average. Releases
 * dated after `now` (clock skew) are ignored.
 */
export function countNewborns(
  sortedReleaseTimes: readonly number[],
  now: number,
): NewbornCounts {
  const within = (hours: number): number => {
    const lo = now - hours * HOUR_MS;
    let count = 0;
    for (let i = sortedReleaseTimes.length - 1; i >= 0; i--) {
      const t = sortedReleaseTimes[i];
      if (t === undefined || t > now) continue; // future release: skip
      if (t < lo) break; // ascending: everything earlier is older
      count += 1;
    }
    return count;
  };
  return {
    last24h: within(24),
    last7d: within(24 * 7),
    last30d: within(24 * 30),
  };
}
