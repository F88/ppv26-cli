/**
 * Cursor-following sliding window for vertical lists. Ink cannot
 * scroll frames taller than the terminal, so every list component
 * shows a slice and reports how many rows are hidden. This is the
 * single home of that calculation (Menu, MultiSelectList).
 */

export type ListWindow = {
  /** First visible index (inclusive). */
  readonly start: number;
  /** Last visible index (exclusive). */
  readonly end: number;
  readonly hiddenAbove: number;
  readonly hiddenBelow: number;
};

/**
 * Computes the visible slice so that the cursor stays inside,
 * clamped to the list bounds (also when the list shrinks, e.g.
 * after a deletion).
 */
export function computeListWindow(
  cursor: number,
  itemCount: number,
  maxVisible: number | undefined,
): ListWindow {
  const visible =
    maxVisible !== undefined
      ? Math.min(Math.max(1, maxVisible), itemCount)
      : itemCount;
  const boundedCursor = Math.min(cursor, Math.max(0, itemCount - 1));
  const start = Math.min(
    Math.max(0, boundedCursor - visible + 1),
    Math.max(0, itemCount - visible),
  );
  const end = start + visible;
  return {
    start,
    end,
    hiddenAbove: start,
    hiddenBelow: itemCount - end,
  };
}
