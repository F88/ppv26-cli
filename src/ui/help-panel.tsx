/**
 * pptop help overlay (top's `?` / `h`). A static list of interactive
 * commands grouped by mode; any key returns to the list.
 */
import { Box, Text } from 'ink';

type Row = readonly [keys: string, description: string];

const LIST: readonly Row[] = [
  ['Up / Down', 'Select a row'],
  ['PgUp / PgDn', 'Page up / down'],
  ['Enter', 'Show prototype detail'],
  ['/', 'Search (filter) mode'],
  ['R', 'Reverse sort order'],
  ['Left / Right, < / >', 'Move the sort column'],
  ['s', 'Select snapshot'],
  ['? / h', 'This help'],
  ['q', 'Quit'],
];

const SEARCH: readonly Row[] = [
  ['Tab / Up / Down', 'Move between fields'],
  ['(type)', 'Edit the active field (filters live)'],
  ['Esc / Enter', 'Return to List'],
];

const DETAIL: readonly Row[] = [
  ['r', 'Raw JSON view'],
  ['Esc / b', 'Back'],
];

const KEY_WIDTH = 20;

function Section({
  title,
  rows,
}: {
  readonly title: string;
  readonly rows: readonly Row[];
}) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>{title}</Text>
      {rows.map(([keys, description]) => (
        <Box key={keys} marginLeft={2}>
          <Box width={KEY_WIDTH} flexShrink={0}>
            <Text color="yellow">{keys}</Text>
          </Box>
          <Text>{description}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function HelpPanel() {
  return (
    <Box flexDirection="column">
      <Text bold>pptop - Help for Interactive Commands</Text>
      <Section title="List" rows={LIST} />
      <Section title="Search" rows={SEARCH} />
      <Section title="Detail" rows={DETAIL} />
      <Box marginTop={1}>
        <Text dimColor>Press any key to return</Text>
      </Box>
    </Box>
  );
}
