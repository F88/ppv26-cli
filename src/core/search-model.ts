/**
 * Shared search model: field definitions and the match predicate,
 * used by both ppex (SearchScreen) and pptop (TopApp).
 *
 * Semantics (decided 2026-07-15): terms within a field are ANDed, and
 * fields are ANDed with each other. Note this intentionally differs
 * from the CLI facets (repeated options are ORed there): live
 * narrowing feels natural as AND. The ID field is the exception:
 * prefix match with space-separated terms ORed, matching the CLI's
 * repeated --id semantics.
 */
import type { NormalizedPrototype } from 'promidas/types';

export const SEARCH_FIELDS = [
  { key: 'id', label: { ja: 'ID', en: 'ID' } },
  { key: 'name', label: { ja: '作品名', en: 'Name' } },
  { key: 'summary', label: { ja: '概要', en: 'Summary' } },
  { key: 'tag', label: { ja: 'タグ', en: 'Tag' } },
  { key: 'material', label: { ja: '素材', en: 'Material' } },
  { key: 'user', label: { ja: 'ユーザー', en: 'User' } },
] as const;
export type SearchFieldKey = (typeof SEARCH_FIELDS)[number]['key'];
export type FieldValues = Record<SearchFieldKey, string>;

export const EMPTY_VALUES: FieldValues = {
  id: '',
  name: '',
  summary: '',
  tag: '',
  material: '',
  user: '',
};

function terms(value: string): readonly string[] {
  return value.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Returns true when the prototype satisfies every field (fields are
 * ANDed; terms within a field are ANDed as well).
 */
export function matchesFields(
  prototype: NormalizedPrototype,
  values: FieldValues,
): boolean {
  // ID: prefix match; space-separated terms are ORed ("10 30" shows
  // both), matching the CLI's repeated --id semantics.
  const idTerms = terms(values.id);
  if (idTerms.length > 0) {
    const idString = String(prototype.id);
    if (!idTerms.some((term) => idString.startsWith(term))) return false;
  }

  const name = prototype.prototypeNm.toLowerCase();
  if (!terms(values.name).every((term) => name.includes(term))) return false;

  const summary = prototype.summary.toLowerCase();
  if (!terms(values.summary).every((term) => summary.includes(term))) {
    return false;
  }

  const tags = prototype.tags.map((tag) => tag.toLowerCase());
  if (
    !terms(values.tag).every((term) => tags.some((tag) => tag.includes(term)))
  ) {
    return false;
  }

  const materials = prototype.materials.map((material) =>
    material.toLowerCase(),
  );
  if (
    !terms(values.material).every((term) =>
      materials.some((material) => material.includes(term)),
    )
  ) {
    return false;
  }

  const users = prototype.users.map((user) => user.toLowerCase());
  if (
    !terms(values.user).every((term) =>
      users.some((user) => user.includes(term)),
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Appends typed text to a field value, applying per-field input rules
 * (the ID field accepts digits and spaces only).
 */
function appendFieldInput(
  key: SearchFieldKey,
  current: string,
  input: string,
): string {
  const text = key === 'id' ? input.replace(/[^0-9 ]/g, '') : input;
  return (current + text).slice(0, 50);
}

/**
 * FieldValues update for typed text. Preserves object identity when
 * nothing effectively changes (e.g. non-digits typed into the ID
 * field), so effects keyed on the values object (cursor reset) do
 * not fire spuriously.
 */
export function withFieldInput(
  values: FieldValues,
  key: SearchFieldKey,
  input: string,
): FieldValues {
  const next = appendFieldInput(key, values[key], input);
  return next === values[key] ? values : { ...values, [key]: next };
}

/** FieldValues update for backspace; identity-preserving like above. */
export function withFieldBackspace(
  values: FieldValues,
  key: SearchFieldKey,
): FieldValues {
  return values[key] === ''
    ? values
    : { ...values, [key]: values[key].slice(0, -1) };
}
