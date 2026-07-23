/**
 * Presentational: the windowed result list.
 *
 * Pure props-to-JSX. The window (which slice of the items is visible)
 * is derived from the cursor and the row budget, so scrolling state
 * lives entirely in the container. Swap this component (keeping
 * ResultListProps) to change how results are rendered.
 */
import { Box, Text } from 'ink';

import { sanitizeDisplayText } from '../core/sanitize-display-text.js';

import type { NormalizedPrototype } from 'promidas/types';

export type ResultListProps = {
  /** Filtered prototypes to list (already sorted). */
  readonly items: readonly NormalizedPrototype[];
  /** Index of the selected row within items. */
  readonly cursor: number;
  /** Number of rows to render. */
  readonly rows: number;
};

export function ResultList({ items, cursor, rows }: ResultListProps) {
  // Stateless window centered on the cursor, clamped to the ends.
  const maxOffset = Math.max(0, items.length - rows);
  const offset = Math.min(
    maxOffset,
    Math.max(0, cursor - Math.floor(rows / 2)),
  );
  const windowItems = items.slice(offset, offset + rows);

  return (
    <Box flexDirection="column">
      {windowItems.map((prototype, index) => {
        const absolute = offset + index;
        return (
          <Text
            key={prototype.id}
            color={absolute === cursor ? 'cyan' : undefined}
            wrap="truncate"
          >
            {absolute === cursor ? '> ' : '  '}
            {prototype.id} {sanitizeDisplayText(prototype.prototypeNm)}{' '}
            <Text dimColor>
              {sanitizeDisplayText(prototype.users.join(','))}
            </Text>
          </Text>
        );
      })}
    </Box>
  );
}
