/**
 * Presentational: pptop's own header - dense aggregate summary lines in
 * the style of top(1), instead of the boxed metadata header used by ppex.
 */
import { Box, Text } from 'ink';

import { resolveSnapshotStaleAfterMs } from '../core/constants.js';
import { formatLocalDateTime } from '../core/format.js';

import type { NewbornCounts, SnapshotStats } from './top-stats.js';
import type { SnapshotSession } from '../core/session.js';

// Status code labels for the breakdown line (ProtoPedia statuses).
// Short labels for the ProtoPedia statuses (JP: アイデア / 開発中 / 完成
// / 供養). "eol" (end of life) stands in for 供養 - the work is still
// published but retired: development stopped, site taken down, or
// discarded.
const STATUS_LABELS: ReadonlyMap<number, string> = new Map([
  [1, 'idea'],
  [2, 'dev'],
  [3, 'done'],
  [4, 'eol'],
]);

function n(value: number): string {
  return value.toLocaleString('en-US');
}

export type TopHeaderProps = {
  readonly stats: SnapshotStats;
  /** null when no snapshot is loaded (empty table startup). */
  readonly session: SnapshotSession | null;
  readonly now: number;
  readonly newborns: NewbornCounts;
};

export function TopHeader({ stats, session, now, newborns }: TopHeaderProps) {
  const statuses = [...STATUS_LABELS.entries()];
  const breakdown = statuses
    .map(([code, label]) => `${n(stats.statusCounts.get(code) ?? 0)} ${label}`)
    .join(', ');
  const percentages = statuses
    .map(([code, label]) => {
      const pct =
        stats.total === 0
          ? '0.0'
          : (((stats.statusCounts.get(code) ?? 0) / stats.total) * 100).toFixed(
              1,
            );
      return `${pct} ${label}`;
    })
    .join(', ');

  // top(1)'s "top - <time> up <uptime> ... load average" line: the
  // snapshot's capture time (local timezone, like the table's RELEASED
  // column) + data age (uptime), then "newborns" (releases in the last
  // 24h / 7d / 30d) as top's load-average analog - three bare numbers,
  // windows implicit. "pptop - " and the newborns tail stay default; the
  // snapshot time / age / [stale] group turns yellow when the data is
  // stale (an at-a-glance freshness cue). With no snapshot, the hint is
  // dimmed and only the "s" key to press is highlighted (cyan).
  let freshness = '';
  let newbornsText = '';
  let stale = false;
  if (session) {
    const ageMs = now - session.serializedAt.getTime();
    stale = ageMs >= resolveSnapshotStaleAfterMs();
    const taken = formatLocalDateTime(session.serializedAt).slice(0, 16);
    freshness =
      `${taken} up ${(ageMs / 3_600_000).toFixed(1)}h` +
      `${stale ? ' [stale]' : ''}`;
    newbornsText =
      ` Newborns: ${n(newborns.last24h)}, ${n(newborns.last7d)},` +
      ` ${n(newborns.last30d)}`;
  }

  return (
    <Box flexDirection="column">
      <Text>
        {'pptop - '}
        {session ? (
          <>
            <Text color={stale ? 'yellow' : undefined}>{freshness}</Text>
            {newbornsText}
          </>
        ) : (
          <>
            <Text dimColor>(no snapshot) - press </Text>
            <Text color="cyan">s</Text>
            <Text dimColor> to create or select one</Text>
          </>
        )}
      </Text>
      <Text bold>
        Prototypes: {n(stats.total)} total, {breakdown}
      </Text>
      <Text>%Status: {percentages}</Text>
      <Text>
        Engagement: {n(stats.viewsTotal)} views, {n(stats.viewsMax)} max,{' '}
        {n(stats.goodsTotal)} goods, {n(stats.commentsTotal)} comments
      </Text>
      <Text>
        Catalog: {n(stats.distinctUsers)} usr, {n(stats.distinctTeams)} tm,{' '}
        {n(stats.distinctTags)} tag, {n(stats.distinctMaterials)} mat,{' '}
        {n(stats.distinctAwards)} awd, {n(stats.distinctEvents)} ev
      </Text>
    </Box>
  );
}
