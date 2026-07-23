/**
 * Shared row format for `ppc prototype list` / `ppc prototype search`:
 * a tab-separated `id \t name \t users` line (no trailing newline).
 *
 * The untrusted name / user fields are run through sanitizeDisplayText,
 * so a control character in the data cannot corrupt the tab-delimited
 * columns or inject a terminal escape sequence when printed. Single
 * source of truth so the two commands stay in sync and the
 * sanitization can never be applied to one but forgotten on the other.
 */
import { sanitizeDisplayText } from '../core/sanitize-display-text.js';

import type { NormalizedPrototype } from 'promidas/types';

export function formatPrototypeRow(prototype: NormalizedPrototype): string {
  const name = sanitizeDisplayText(prototype.prototypeNm);
  const users = sanitizeDisplayText(prototype.users.join(','));
  return `${prototype.id}\t${name}\t${users}`;
}
