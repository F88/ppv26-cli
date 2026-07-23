/**
 * Search and filter logic over normalized prototypes.
 *
 * Pure functions, independent of the repository, so that the logic is
 * unit-testable and reusable from both one-shot commands and the future
 * interactive mode.
 */
import type { NormalizedPrototype } from 'promidas/types';

export type SearchCriteria = {
  /**
   * Keywords combined with AND, Google-search style: every keyword must
   * partially match prototypeNm or summary (case-insensitive).
   */
  readonly keywords?: readonly string[];
  /** Values are ORed; each is an exact prototype ID match. */
  readonly ids?: readonly number[];
  /** Values are ORed; each partially matches a tag (case-insensitive). */
  readonly tags?: readonly string[];
  /** Values are ORed; each partially matches a user name (case-insensitive). */
  readonly users?: readonly string[];
  /** Values are ORed; each partially matches an event name (case-insensitive). */
  readonly events?: readonly string[];
  /** Values are ORed; each partially matches a material name (case-insensitive). */
  readonly materials?: readonly string[];
  /** Values are ORed; each is an exact status code match. */
  readonly statuses?: readonly number[];
};

function isSet<T>(values: readonly T[] | undefined): values is readonly T[] {
  return values !== undefined && values.length > 0;
}

/**
 * Returns true when at least one criterion is set.
 */
export function hasAnyCriteria(criteria: SearchCriteria): boolean {
  return (
    isSet(criteria.keywords) ||
    isSet(criteria.ids) ||
    isSet(criteria.tags) ||
    isSet(criteria.users) ||
    isSet(criteria.events) ||
    isSet(criteria.materials) ||
    isSet(criteria.statuses)
  );
}

function includesIgnoreCase(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function someIncludesIgnoreCase(
  values: readonly string[],
  needle: string,
): boolean {
  return values.some((value) => includesIgnoreCase(value, needle));
}

/**
 * Filters prototypes by the given criteria and returns the hits sorted
 * by prototype ID (ascending).
 *
 * Different criteria are combined with AND; values within one facet
 * (tags, users, events, materials, statuses) are combined with OR.
 * An empty criteria object matches everything.
 */
export function filterPrototypes(
  prototypes: readonly NormalizedPrototype[],
  criteria: SearchCriteria,
): NormalizedPrototype[] {
  const matchesFacet = (
    values: readonly string[] | undefined,
    targets: readonly string[],
  ): boolean =>
    !isSet(values) ||
    values.some((value) => someIncludesIgnoreCase(targets, value));

  return prototypes
    .filter((prototype) => {
      if (
        isSet(criteria.keywords) &&
        !criteria.keywords.every(
          (keyword) =>
            includesIgnoreCase(prototype.prototypeNm, keyword) ||
            includesIgnoreCase(prototype.summary, keyword),
        )
      ) {
        return false;
      }
      if (isSet(criteria.ids) && !criteria.ids.includes(prototype.id)) {
        return false;
      }
      if (!matchesFacet(criteria.tags, prototype.tags)) return false;
      if (!matchesFacet(criteria.users, prototype.users)) return false;
      if (!matchesFacet(criteria.events, prototype.events)) return false;
      if (!matchesFacet(criteria.materials, prototype.materials)) return false;
      if (
        isSet(criteria.statuses) &&
        !criteria.statuses.includes(prototype.status)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.id - b.id);
}
