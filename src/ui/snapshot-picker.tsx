/**
 * Snapshot picker: the startup / re-select screen. Lists snapshot
 * files (newest first, the loaded one marked with *) plus the create
 * option; create-only when no snapshot exists. When the host wires
 * onOpenManager, the m key opens the snapshot manager (the only
 * entry to it - issue #10).
 */
import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

import { formatSnapshotRow } from '../core/format.js';
import { resolveToken } from '../core/token.js';
import { Menu, type MenuItem } from './menu.js';
import { TokenMissingNotice } from './token-missing-notice.js';
import { useTerminalSize } from './use-terminal-size.js';

import type { SnapshotFileInfo } from '../core/snapshot-catalog.js';

export type SnapshotPickerLang = 'en' | 'ja';

const MESSAGES: Record<
  SnapshotPickerLang,
  {
    readonly latest: string;
    readonly empty: string;
    readonly select: string;
    readonly hint: string;
    readonly hintManager: string;
    readonly hintWithBack: string;
    readonly moreAbove: (count: number) => string;
    readonly moreBelow: (count: number) => string;
  }
> = {
  ja: {
    latest: ' [最新]',
    empty: 'snapshot がありません。API から取得してください。',
    select: 'snapshot を選択 (Enter でロード)',
    hint: '↑↓: 移動 / Enter: 決定 / q: 終了',
    hintManager: ' / m: スナップショット管理',
    hintWithBack: ' / Esc: 戻る / * = ロード中',
    moreAbove: (count) => `↑ 他 ${count} 件`,
    moreBelow: (count) => `↓ 他 ${count} 件`,
  },
  en: {
    latest: ' [latest]',
    empty: 'No snapshots. Fetch one from the API.',
    select: 'Select a snapshot (Enter to load)',
    hint: '↑↓: Move / Enter: Select / q: Quit',
    hintManager: ' / m: Snapshot manager',
    hintWithBack: ' / Esc: Back / * = loaded',
    moreAbove: (count) => `↑ ${count} more`,
    moreBelow: (count) => `↓ ${count} more`,
  },
};

export type SnapshotPickerProps = {
  readonly snapshots: readonly SnapshotFileInfo[];
  readonly notice?: string;
  /** File name of the currently loaded snapshot, if any. */
  readonly currentFileName?: string;
  /** Label of the create entry (owned by the screen-flow registry). */
  readonly createLabel: string;
  /** Language for the picker's own messages. */
  readonly lang: SnapshotPickerLang;
  readonly onSelectSnapshot: (info: SnapshotFileInfo) => void;
  readonly onCreate: () => void;
  /** Present when the host offers the snapshot manager (m key). */
  readonly onOpenManager?: () => void;
  /** Present only when a session exists (Esc returns to main). */
  readonly onBack?: () => void;
  readonly onQuit: () => void;
};

export function SnapshotPicker({
  snapshots,
  notice,
  currentFileName,
  createLabel,
  lang,
  onSelectSnapshot,
  onCreate,
  onOpenManager,
  onBack,
  onQuit,
}: SnapshotPickerProps) {
  const messages = MESSAGES[lang];
  const { rows: terminalRows } = useTerminalSize();
  // The token check for the create entry lives here so every host
  // shares it; the token-missing notice is shown in the picker (via the
  // shared TokenMissingNotice) instead of bubbling up to each shell.
  const [tokenMissing, setTokenMissing] = useState(false);

  useInput((input) => {
    if (onOpenManager && input === 'm') onOpenManager();
  });

  const items: MenuItem[] = [
    ...snapshots.map((info, index) => {
      const current = info.fileName === currentFileName ? '* ' : '  ';
      const latest = index === 0 && info.takenAt ? messages.latest : '';
      return { label: `${current}${formatSnapshotRow(info)}${latest}` };
    }),
    { label: `  ${createLabel}` },
  ];

  return (
    <Box flexDirection="column">
      <Text bold>
        {snapshots.length === 0 ? messages.empty : messages.select}
      </Text>
      {notice && <Text color="red">{notice}</Text>}
      {tokenMissing && <TokenMissingNotice lang={lang} />}
      <Menu
        items={items}
        // Heading, notice, more indicators and the hint line (~5 rows)
        // stay visible; each item takes one row. The token-missing
        // notice adds two more rows, so drop the budget by two while it
        // shows or the menu could exceed the terminal (the very
        // frame-taller-than-terminal overflow we avoid elsewhere).
        maxVisible={Math.max(1, terminalRows - 5 - (tokenMissing ? 2 : 0))}
        moreAbove={messages.moreAbove}
        moreBelow={messages.moreBelow}
        onSelect={(index) => {
          const selected = snapshots[index];
          if (selected) {
            setTokenMissing(false);
            onSelectSnapshot(selected);
          } else if (resolveToken() === null) {
            // Create requires a token; show the reason in place rather
            // than proceeding.
            setTokenMissing(true);
          } else {
            setTokenMissing(false);
            onCreate();
          }
        }}
        {...(onBack ? { onBack } : {})}
        onQuit={onQuit}
      />
      <Text dimColor>
        {messages.hint}
        {onOpenManager ? messages.hintManager : ''}
        {onBack ? messages.hintWithBack : ''}
      </Text>
    </Box>
  );
}
