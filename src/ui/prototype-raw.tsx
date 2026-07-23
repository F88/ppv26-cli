/**
 * Presentational: the raw JSON of a prototype, printed in full with
 * no border, padding, or scroll window, so a terminal selection
 * copies clean text. The frame grows beyond the terminal height;
 * the top is reachable through the terminal's own scrollback.
 */
import { Text } from 'ink';

import type { NormalizedPrototype } from 'promidas/types';

export function PrototypeRaw({
  prototype,
}: {
  readonly prototype: NormalizedPrototype;
}) {
  return <Text>{JSON.stringify(prototype, null, 2)}</Text>;
}
