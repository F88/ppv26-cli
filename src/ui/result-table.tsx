/**
 * Presentational: table-style result view (top-command style), an
 * alternative to ResultList implementing the same ResultListProps
 * contract — swap the component in the container to switch views.
 *
 * A header line followed by multi-column data rows. Columns are
 * fixed-width Ink Boxes (not padEnd), so East Asian wide characters
 * in names do not break the alignment; overflow is truncated.
 *
 * Column definitions, responsive visibility, and cell rendering all
 * live in table-columns.ts (shared with the monitor container).
 */
import { Box, Text } from 'ink';

import { cellValue, visibleColumnsForWidth } from './table-columns.js';
import { useTerminalSize } from './use-terminal-size.js';

import type { ResultListProps } from './result-list.js';
import type { Column } from './table-columns.js';

export function ResultTable({
  items,
  cursor,
  rows,
  columns,
  sortKey,
}: ResultListProps & {
  /** Terminal-width override for tests; defaults to the terminal. */
  readonly columns?: number;
  /** Column key currently used as the sort key; its header is highlighted. */
  readonly sortKey?: Column['key'];
}) {
  const { columns: terminalColumns } = useTerminalSize();
  const width = columns ?? terminalColumns;
  const visibleColumns = visibleColumnsForWidth(width);

  // Same stateless windowing as ResultList.
  const maxOffset = Math.max(0, items.length - rows);
  const offset = Math.min(
    maxOffset,
    Math.max(0, cursor - Math.floor(rows / 2)),
  );
  const windowItems = items.slice(offset, offset + rows);

  return (
    <Box flexDirection="column">
      <Box>
        {visibleColumns.map((column) => (
          <Box
            key={column.key}
            {...(column.width !== undefined
              ? { width: column.width, flexShrink: 0 }
              : { flexGrow: 1 })}
            marginRight={1}
            justifyContent={
              column.align === 'right' ? 'flex-end' : 'flex-start'
            }
          >
            <Text
              bold
              inverse
              color={column.key === sortKey ? 'yellow' : undefined}
              wrap="truncate"
            >
              {column.label}
            </Text>
          </Box>
        ))}
      </Box>
      {windowItems.map((prototype, index) => {
        const absolute = offset + index;
        const selected = absolute === cursor;
        return (
          <Box key={prototype.id}>
            {visibleColumns.map((column) => (
              <Box
                key={column.key}
                {...(column.width !== undefined
                  ? { width: column.width, flexShrink: 0 }
                  : { flexGrow: 1 })}
                marginRight={1}
                justifyContent={
                  column.align === 'right' ? 'flex-end' : 'flex-start'
                }
              >
                <Text color={selected ? 'cyan' : undefined} wrap="truncate">
                  {cellValue(column.key, prototype)}
                </Text>
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}
