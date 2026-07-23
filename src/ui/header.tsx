/**
 * Presentational: the always-visible snapshot metadata header
 * (file, generation time + age with stale highlight, count, ID range).
 */
import { Box, Text } from 'ink';

import { resolveSnapshotStaleAfterMs } from '../core/constants.js';
import { formatLocalDateTime } from '../core/format.js';

import type { SnapshotSession } from '../core/session.js';

function formatAge(ageMs: number): string {
  return `約${(ageMs / 3_600_000).toFixed(1)}時間前`;
}

export type HeaderProps = {
  readonly session: SnapshotSession;
  /** Current time (ms); passed in so the age refreshes on a timer. */
  readonly now: number;
};

export function Header({ session, now }: HeaderProps) {
  const ageMs = now - session.serializedAt.getTime();
  const stale = ageMs >= resolveSnapshotStaleAfterMs();
  const idRange =
    session.minId !== null && session.maxId !== null
      ? `${session.minId} - ${session.maxId}`
      : '-';

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text>
        ファイル: {session.fileName} (v{session.version})
      </Text>
      <Text color={stale ? 'yellow' : undefined}>
        出力日時: {formatLocalDateTime(session.serializedAt)} (
        {formatAge(ageMs)}
        {stale ? ' / stale: snapshot create で更新推奨' : ''})
      </Text>
      <Text>
        作品: {session.size} 件 / ID: {idRange}
      </Text>
    </Box>
  );
}
