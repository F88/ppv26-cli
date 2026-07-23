/**
 * Multi-select list: cursor movement, Space to toggle a mark, Enter
 * to confirm the marked set, Esc to go back. Disabled rows (e.g. the
 * loaded snapshot in the manager) cannot be marked and show a note.
 *
 * Controlled: the marks live in the parent (the snapshot manager
 * also acts on them via its own keys, e.g. v to verify), only the
 * cursor is internal.
 */
import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

import { computeListWindow } from '../core/list-window.js';

export type MultiSelectItem = {
  readonly label: string;
  /** Second line under the label (indented, dimmed). */
  readonly detail?: string;
  readonly disabled?: boolean;
  /** Shown after the label of a disabled row, e.g. "(ロード中)". */
  readonly disabledNote?: string;
};

export type MultiSelectListProps = {
  readonly items: readonly MultiSelectItem[];
  /** Indices currently marked (owned by the parent). */
  readonly marked: ReadonlySet<number>;
  /**
   * Items shown at once; the window follows the cursor (Ink cannot
   * scroll frames taller than the terminal). Omit to show all.
   */
  readonly maxVisible?: number;
  /** Hidden-row indicators, e.g. "↑ 他 3 件" (localized by the parent). */
  readonly moreAbove?: (count: number) => string;
  readonly moreBelow?: (count: number) => string;
  readonly onToggle: (index: number) => void;
  readonly onBack: () => void;
};

/**
 * The list only marks; what happens to the marked set is the
 * parent's business, expressed as command keys there (d: delete,
 * c: create in the snapshot manager). Enter is deliberately
 * unassigned.
 */
export function MultiSelectList({
  items,
  marked,
  maxVisible,
  moreAbove,
  moreBelow,
  onToggle,
  onBack,
}: MultiSelectListProps) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === 'b') {
      onBack();
      return;
    }
    if (key.upArrow) {
      setCursor((current) => Math.max(0, current - 1));
    } else if (key.downArrow) {
      setCursor((current) => Math.min(items.length - 1, current + 1));
    } else if (input === ' ') {
      if (items[cursor]?.disabled === true) return;
      onToggle(cursor);
    }
  });

  const { start, end, hiddenAbove, hiddenBelow } = computeListWindow(
    cursor,
    items.length,
    maxVisible,
  );

  return (
    <Box flexDirection="column">
      {hiddenAbove > 0 && moreAbove !== undefined && (
        <Text dimColor>{moreAbove(hiddenAbove)}</Text>
      )}
      {items.slice(start, end).map((item, sliceIndex) => {
        const index = start + sliceIndex;
        const mark =
          item.disabled === true ? '[-]' : marked.has(index) ? '[x]' : '[ ]';
        const note =
          item.disabled === true && item.disabledNote !== undefined
            ? ` ${item.disabledNote}`
            : '';
        return (
          <Box key={index} flexDirection="column">
            <Text
              color={index === cursor ? 'cyan' : undefined}
              dimColor={item.disabled === true && index !== cursor}
            >
              {index === cursor ? '> ' : '  '}
              {mark} {item.label}
              {note}
            </Text>
            {item.detail !== undefined && (
              <Text
                color={index === cursor ? 'cyan' : undefined}
                dimColor={index !== cursor}
              >
                {'      '}
                {item.detail}
              </Text>
            )}
          </Box>
        );
      })}
      {hiddenBelow > 0 && moreBelow !== undefined && (
        <Text dimColor>{moreBelow(hiddenBelow)}</Text>
      )}
    </Box>
  );
}
