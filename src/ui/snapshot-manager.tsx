/**
 * Snapshot manager: the one place that deletes snapshot files, plus
 * create (issue #10). Self-contained container - hosts (the ppex /
 * pptop pickers via the m key; a standalone binary later) only choose
 * the language and what "exit" means.
 *
 * Deletion is permanent (confirmation required; Trash was permanently
 * rejected). The loaded snapshot, when the host
 * passes one, cannot be selected. Creation reuses the existing
 * createSession path and disposes the loaded repository right away:
 * the manager creates files, it does not load them.
 */
import { Box, Text, useInput } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';

import { formatLocalDateTime, formatSizeMB } from '../core/format.js';
import { createSession, loadSession } from '../core/session.js';
import { listSnapshots } from '../core/snapshot-catalog.js';
import { deleteSnapshotFiles } from '../core/snapshot-delete.js';
import { resolveToken } from '../core/token.js';
import {
  CreatingProgress,
  progressToCreatingProgress,
} from './creating-progress.js';
import { MultiSelectList } from './multi-select-list.js';
import { TokenMissingNotice } from './token-missing-notice.js';
import { useTerminalSize } from './use-terminal-size.js';

import type { SnapshotFileInfo } from '../core/snapshot-catalog.js';
import type { DeleteResult } from '../core/snapshot-delete.js';

/**
 * Result of verifying one file: valid means the REAL load path
 * (loadSession, the same code the hosts use) accepted it - being
 * well-formed JSON alone is meaningless if promidas rejects it.
 */
export type VerifyInfo =
  | {
      readonly ok: true;
      /** Real generation time (serializedAt from the file content). */
      readonly serializedAt: Date;
      readonly count: number;
      readonly minId: number | null;
      readonly maxId: number | null;
    }
  | { readonly ok: false; readonly reason: string };

export type SnapshotManagerLang = 'en' | 'ja';

const MESSAGES: Record<
  SnapshotManagerLang,
  {
    readonly title: string;
    readonly empty: string;
    readonly loaded: string;
    readonly total: (count: number, size: string) => string;
    readonly selected: (count: number, size: string) => string;
    readonly hint: string;
    readonly verifyingStatus: (done: number, total: number) => string;
    readonly moreAbove: (count: number) => string;
    readonly moreBelow: (count: number) => string;
    readonly pending: string;
    readonly countLabel: (count: number) => string;
    readonly nameMismatch: string;
    readonly confirm: (count: number, size: string) => string;
    readonly confirmHint: string;
    readonly deleting: string;
    readonly resultOk: (count: number) => string;
    readonly resultFailed: (count: number) => string;
    readonly resultHint: string;
    readonly created: (fileName: string) => string;
    readonly createFailed: (message: string) => string;
    readonly preparing: string;
    readonly downloading: (pct: string, received: string) => string;
    readonly saving: string;
  }
> = {
  ja: {
    title: 'Snapshot管理',
    empty: 'snapshot がありません。',
    loaded: '(ロード中)',
    total: (count, size) => `合計: ${count} 件 / ${size}`,
    selected: (count, size) => `選択: ${count} 件 / ${size}`,
    hint: '↑↓: 移動 / Space: 選択 / d: 削除 / c: 作成 / Esc: 戻る',
    verifyingStatus: (done, total) => `検証中 (${done}/${total})...`,
    moreAbove: (count) => `↑ 他 ${count} 件`,
    moreBelow: (count) => `↓ 他 ${count} 件`,
    pending: '(検証中...)',
    countLabel: (count) => `${count}件`,
    nameMismatch: '(ファイル名と不一致)',
    confirm: (count, size) =>
      `選択した ${count} 件 (${size}) を削除しますか? 元に戻せません。 (y/N)`,
    confirmHint: 'y: 削除 / それ以外: 中止',
    deleting: '削除しています...',
    resultOk: (count) => `削除: ${count} 件成功`,
    resultFailed: (count) => `失敗: ${count} 件`,
    resultHint: '任意のキーで一覧に戻る',
    created: (fileName) => `作成しました: ${fileName}`,
    createFailed: (message) => `作成に失敗しました: ${message}`,
    preparing: 'API リクエストを準備中...',
    downloading: (pct, received) => `ダウンロード中 ${pct} (${received})`,
    saving: '保存中...',
  },
  en: {
    title: 'Snapshot manager',
    empty: 'No snapshots.',
    loaded: '(loaded)',
    total: (count, size) => `Total: ${count} file(s) / ${size}`,
    selected: (count, size) => `Selected: ${count} file(s) / ${size}`,
    hint: '↑↓: Move / Space: Mark / d: Delete / c: Create / Esc: Back',
    verifyingStatus: (done, total) => `Verifying (${done}/${total})...`,
    moreAbove: (count) => `↑ ${count} more`,
    moreBelow: (count) => `↓ ${count} more`,
    pending: '(verifying...)',
    countLabel: (count) => `${count} items`,
    nameMismatch: '(name mismatch)',
    confirm: (count, size) =>
      `Delete the selected ${count} file(s) (${size})? This cannot be undone. (y/N)`,
    confirmHint: 'y: Delete / anything else: Cancel',
    deleting: 'Deleting...',
    resultOk: (count) => `Deleted: ${count} file(s)`,
    resultFailed: (count) => `Failed: ${count} file(s)`,
    resultHint: 'Press any key to return to the list',
    created: (fileName) => `Created: ${fileName}`,
    createFailed: (message) => `Failed to create: ${message}`,
    preparing: 'Preparing the API request...',
    downloading: (pct, received) => `Downloading ${pct} (${received})`,
    saving: 'Saving...',
  },
};

type ManagerScreen =
  | {
      kind: 'list';
      snapshots: readonly SnapshotFileInfo[];
      notice?: string;
      tokenMissing?: boolean;
    }
  | { kind: 'confirm'; selected: readonly SnapshotFileInfo[] }
  | { kind: 'deleting' }
  | { kind: 'result'; results: readonly DeleteResult[] }
  | { kind: 'creating'; progress: string };

export type SnapshotManagerProps = {
  readonly snapshotDir: string;
  /** File name of the snapshot the HOST has loaded (not selectable). */
  readonly loadedFileName?: string;
  readonly lang: SnapshotManagerLang;
  readonly onExit: () => void;
};

function totalSize(selected: readonly SnapshotFileInfo[]): string {
  return formatSizeMB(
    selected.reduce((sum, info) => sum + (info.sizeBytes ?? 0), 0),
  );
}

/**
 * Line 1 of a row: the FILE's metadata - name and size on disk.
 */
function fileLine(info: SnapshotFileInfo): string {
  return `${info.fileName}  ${formatSizeMB(info.sizeBytes)}`;
}

/**
 * Line 2 of a row: VERIFIED facts about the CONTENT only (real
 * serializedAt, count, ID range) - never the file-name estimates.
 * "(検証中...)" until the auto-verification reaches the file.
 */
function detailLine(
  info: SnapshotFileInfo,
  verify: VerifyInfo | undefined,
  messages: (typeof MESSAGES)['ja'],
): string {
  if (verify === undefined) return messages.pending;
  if (!verify.ok) return `✗ ${verify.reason}`;
  const ids =
    verify.minId !== null && verify.maxId !== null
      ? `  ID ${verify.minId}-${verify.maxId}`
      : '';
  const mismatch =
    info.count !== null && info.count !== verify.count
      ? ` ${messages.nameMismatch}`
      : '';
  return `${formatLocalDateTime(verify.serializedAt)}  ${messages.countLabel(verify.count)}${ids}${mismatch}`;
}

export function SnapshotManager({
  snapshotDir,
  loadedFileName,
  lang,
  onExit,
}: SnapshotManagerProps) {
  const messages = MESSAGES[lang];
  const { rows: terminalRows } = useTerminalSize();
  const [screen, setScreen] = useState<ManagerScreen>({
    kind: 'list',
    snapshots: [],
  });
  // Marks and verify results are keyed by file name (indices shift
  // when the list refreshes after a deletion).
  const [markedNames, setMarkedNames] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [verified, setVerified] = useState<ReadonlyMap<string, VerifyInfo>>(
    new Map(),
  );

  const openList = useCallback(
    async (notice?: string, tokenMissing = false) => {
      const snapshots = await listSnapshots(snapshotDir);
      setScreen({
        kind: 'list',
        snapshots,
        ...(notice !== undefined ? { notice } : {}),
        ...(tokenMissing ? { tokenMissing: true } : {}),
      });
    },
    [snapshotDir],
  );

  useEffect(() => {
    void openList();
  }, [openList]);

  const startCreate = useCallback(async () => {
    const token = resolveToken();
    if (token === null) {
      await openList(undefined, true);
      return;
    }
    setScreen({ kind: 'creating', progress: messages.preparing });
    const result = await createSession({
      token,
      snapshotDir,
      onProgress: (event) => {
        const progress = progressToCreatingProgress(event, messages);
        if (progress !== null) {
          setScreen({ kind: 'creating', progress });
        }
      },
    });
    if (result.ok) {
      // The manager creates files, it does not load them.
      result.repository.dispose();
      await openList(messages.created(result.session.fileName));
    } else {
      await openList(messages.createFailed(result.message));
    }
  }, [snapshotDir, openList, messages]);

  const runDelete = useCallback(
    async (selected: readonly SnapshotFileInfo[]) => {
      setScreen({ kind: 'deleting' });
      const results = await deleteSnapshotFiles(
        selected.map((info) => info.filePath),
      );
      // Deleted files no longer exist: drop their marks.
      const deleted = new Set(
        results.filter((result) => result.ok).map((result) => result.fileName),
      );
      setMarkedNames(
        (current) => new Set([...current].filter((name) => !deleted.has(name))),
      );
      setScreen({ kind: 'result', results });
    },
    [],
  );

  // Auto-verification: whenever the list shows files without a
  // verify result, work through them in the background, one at a
  // time (the list stays interactive; rows fill in as facts arrive).
  // Results are cached by file name, so a refresh after a delete or
  // create only verifies the new faces.
  const verifyingRef = useRef(false);
  useEffect(() => {
    if (screen.kind !== 'list' || verifyingRef.current) return;
    const pending = screen.snapshots.filter(
      (info) => !verified.has(info.fileName),
    );
    if (pending.length === 0) return;
    verifyingRef.current = true;
    void (async () => {
      for (const info of pending) {
        // Valid = the real load path accepts it. The throwaway
        // repository never touches the host's loaded one.
        const result = await loadSession(info.filePath);
        const verify: VerifyInfo = result.ok
          ? {
              ok: true,
              serializedAt: result.session.serializedAt,
              count: result.session.size,
              minId: result.session.minId,
              maxId: result.session.maxId,
            }
          : { ok: false, reason: result.message };
        if (result.ok) result.repository.dispose();
        setVerified((current) => {
          const next = new Map(current);
          next.set(info.fileName, verify);
          return next;
        });
      }
      verifyingRef.current = false;
    })();
  }, [screen, verified]);

  useInput((input, key) => {
    switch (screen.kind) {
      case 'list':
        if (input === 'c') {
          void startCreate();
        } else if (input === 'd') {
          // The one action on the marked set: delete (via the
          // confirmation step).
          const selected = screen.snapshots.filter((info) =>
            markedNames.has(info.fileName),
          );
          if (selected.length > 0) setScreen({ kind: 'confirm', selected });
        }
        break;
      case 'confirm':
        if (input === 'y' || input === 'Y') {
          void runDelete(screen.selected);
        } else if (input !== '' || key.return || key.escape) {
          void openList();
        }
        break;
      case 'result':
        void openList();
        break;
      default:
        break;
    }
  });

  switch (screen.kind) {
    case 'list': {
      const { snapshots, notice, tokenMissing } = screen;
      const verifiedCount = snapshots.filter((info) =>
        verified.has(info.fileName),
      ).length;
      const markedSnapshots = snapshots.filter((info) =>
        markedNames.has(info.fileName),
      );
      // Fixed chrome: title, blank, totals, verifying status, more
      // indicators and the hint line (~8 rows); each item takes 2.
      const maxVisible = Math.max(1, Math.floor((terminalRows - 8) / 2));
      return (
        <Box flexDirection="column">
          <Text bold>{messages.title}</Text>
          <Box height={1} />
          {tokenMissing ? (
            <TokenMissingNotice lang={lang} />
          ) : (
            notice && <Text color="yellow">{notice}</Text>
          )}
          <Text>
            {messages.total(snapshots.length, totalSize(snapshots))}
            {markedSnapshots.length > 0
              ? ` / ${messages.selected(markedSnapshots.length, totalSize(markedSnapshots))}`
              : ''}
          </Text>
          {verifiedCount < snapshots.length && (
            <Text dimColor>
              {messages.verifyingStatus(verifiedCount, snapshots.length)}
            </Text>
          )}
          {snapshots.length === 0 ? (
            <Text>{messages.empty}</Text>
          ) : (
            <MultiSelectList
              items={snapshots.map((info) => ({
                label: fileLine(info),
                detail: detailLine(info, verified.get(info.fileName), messages),
                ...(info.fileName === loadedFileName
                  ? { disabled: true, disabledNote: messages.loaded }
                  : {}),
              }))}
              marked={
                new Set(
                  snapshots.flatMap((info, index) =>
                    markedNames.has(info.fileName) ? [index] : [],
                  ),
                )
              }
              onToggle={(index) => {
                const name = snapshots[index]?.fileName;
                if (name === undefined) return;
                setMarkedNames((current) => {
                  const next = new Set(current);
                  if (next.has(name)) {
                    next.delete(name);
                  } else {
                    next.add(name);
                  }
                  return next;
                });
              }}
              maxVisible={maxVisible}
              moreAbove={messages.moreAbove}
              moreBelow={messages.moreBelow}
              onBack={onExit}
            />
          )}
          <Text dimColor>{messages.hint}</Text>
        </Box>
      );
    }

    case 'confirm':
      return (
        <Box flexDirection="column">
          <Text bold>{messages.title}</Text>
          {screen.selected.map((info) => (
            <Box key={info.fileName} flexDirection="column">
              <Text> {fileLine(info)}</Text>
              <Text dimColor>
                {'   '}
                {detailLine(info, verified.get(info.fileName), messages)}
              </Text>
            </Box>
          ))}
          <Text color="red">
            {messages.confirm(
              screen.selected.length,
              totalSize(screen.selected),
            )}
          </Text>
          <Text dimColor>{messages.confirmHint}</Text>
        </Box>
      );

    case 'deleting':
      return <Text>{messages.deleting}</Text>;

    case 'result': {
      const succeeded = screen.results.filter((result) => result.ok);
      const failed = screen.results.filter((result) => !result.ok);
      return (
        <Box flexDirection="column">
          <Text bold>{messages.title}</Text>
          <Text>{messages.resultOk(succeeded.length)}</Text>
          {failed.length > 0 && (
            <Text color="red">{messages.resultFailed(failed.length)}</Text>
          )}
          {failed.map((result) => (
            <Text color="red" key={result.fileName}>
              {'  '}
              {result.fileName}: {result.message ?? '?'}
            </Text>
          ))}
          <Text dimColor>{messages.resultHint}</Text>
        </Box>
      );
    }

    case 'creating':
      return <CreatingProgress progress={screen.progress} lang={lang} />;

    default:
      return null;
  }
}
