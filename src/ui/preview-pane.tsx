/**
 * Presentational: the fixed-height preview of a prototype.
 *
 * Reserving a constant height keeps the surrounding layout from
 * jumping while the selection moves across prototypes with more or
 * fewer populated fields; longer content is clipped.
 */
import { Box } from 'ink';

import { PrototypeCard } from './prototype-detail.js';

import type { NormalizedPrototype } from 'promidas/types';

export type PreviewPaneProps = {
  /** Prototype to preview; renders an empty reserved area when absent. */
  readonly prototype: NormalizedPrototype | undefined;
  /**
   * Space allocated to the pane; longer content is clipped. Omit it
   * with wrap='truncate': one field is one row there, so the card's
   * natural height is already constant (no clipping, no jumping) and
   * follows card changes without a hand-counted number.
   */
  readonly height?: number;
  /**
   * Long-line handling of the card. 'truncate' keeps one field per
   * row, so every field stays visible; 'wrap' shows full values but
   * may clip the bottom fields at the allocated height.
   */
  readonly wrap: 'wrap' | 'truncate';
};

export function PreviewPane({ prototype, height, wrap }: PreviewPaneProps) {
  return (
    <Box
      flexDirection="column"
      {...(height !== undefined ? { height, overflow: 'hidden' } : {})}
    >
      {prototype && <PrototypeCard prototype={prototype} wrap={wrap} />}
    </Box>
  );
}
