import { describe, expect, it } from 'vitest';

import { computeListWindow } from './list-window.js';

describe('computeListWindow', () => {
  it('shows everything when maxVisible is omitted', () => {
    expect(computeListWindow(3, 10, undefined)).toEqual({
      start: 0,
      end: 10,
      hiddenAbove: 0,
      hiddenBelow: 0,
    });
  });

  it('keeps the cursor inside the window', () => {
    // Cursor at the top: window starts at 0.
    expect(computeListWindow(0, 10, 3)).toEqual({
      start: 0,
      end: 3,
      hiddenAbove: 0,
      hiddenBelow: 7,
    });
    // Cursor beyond the window: it slides down.
    expect(computeListWindow(5, 10, 3)).toEqual({
      start: 3,
      end: 6,
      hiddenAbove: 3,
      hiddenBelow: 4,
    });
    // Cursor at the bottom: window ends at the list end.
    expect(computeListWindow(9, 10, 3)).toEqual({
      start: 7,
      end: 10,
      hiddenAbove: 7,
      hiddenBelow: 0,
    });
  });

  it('clamps when the list shrinks below the cursor', () => {
    // e.g. rows were deleted while the cursor sat near the end.
    expect(computeListWindow(9, 4, 3)).toEqual({
      start: 1,
      end: 4,
      hiddenAbove: 1,
      hiddenBelow: 0,
    });
  });

  it('handles lists smaller than the window and empty lists', () => {
    expect(computeListWindow(0, 2, 5)).toEqual({
      start: 0,
      end: 2,
      hiddenAbove: 0,
      hiddenBelow: 0,
    });
    expect(computeListWindow(0, 0, 5)).toEqual({
      start: 0,
      end: 0,
      hiddenAbove: 0,
      hiddenBelow: 0,
    });
  });
});
