/**
 * Generic vertical menu: cursor movement, Enter to select, optional
 * Esc/b back and q quit. Self-contained interactive component.
 * With maxVisible, shows a cursor-following window (Ink cannot
 * scroll frames taller than the terminal).
 */
import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

import { computeListWindow } from '../core/list-window.js';

export type MenuItem = { readonly label: string; readonly dim?: boolean };

export type MenuProps = {
  readonly items: readonly MenuItem[];
  /** Items shown at once; omit to show all. */
  readonly maxVisible?: number;
  /** Hidden-row indicators (localized by the parent). */
  readonly moreAbove?: (count: number) => string;
  readonly moreBelow?: (count: number) => string;
  readonly onSelect: (index: number) => void;
  readonly onBack?: () => void;
  readonly onQuit?: () => void;
};

export function Menu({
  items,
  maxVisible,
  moreAbove,
  moreBelow,
  onSelect,
  onBack,
  onQuit,
}: MenuProps) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (onQuit && input === 'q') {
      onQuit();
      return;
    }
    if (onBack && (key.escape || input === 'b')) {
      onBack();
      return;
    }
    if (key.upArrow) {
      setCursor((current) => Math.max(0, current - 1));
    } else if (key.downArrow) {
      setCursor((current) => Math.min(items.length - 1, current + 1));
    } else if (key.return) {
      onSelect(cursor);
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
        return (
          <Text
            key={item.label}
            color={index === cursor ? 'cyan' : undefined}
            dimColor={item.dim === true && index !== cursor}
          >
            {index === cursor ? '> ' : '  '}
            {item.label}
          </Text>
        );
      })}
      {hiddenBelow > 0 && moreBelow !== undefined && (
        <Text dimColor>{moreBelow(hiddenBelow)}</Text>
      )}
    </Box>
  );
}
