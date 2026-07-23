/**
 * ppex: interactive snapshot explorer (issue #1; renamed from
 * ppc-ui on 2026-07-16).
 *
 * Screen flow:
 *
 *   boot -> picker (snapshot list + [作成して選択]; create-only when
 *        |  empty; marks the loaded snapshot on re-select;
 *        |  m -> snapshot manager: multi-select delete / create)
 *        -> main (always-visible metadata header + menu)
 *             ├── 作品探索 -> live-filter form + result list +
 *             │              fixed-height preview; Enter opens the
 *             │              detail (JSON / card tabs)
 *             └── スナップショット -> picker (再選択; m -> manager)
 *
 * This module is the screen-flow container (state machine + wiring);
 * the screens themselves live under components/ and search-screen.tsx.
 * Everything Ink-related stays inside src/interactive/; all data
 * operations go through core/* and session.ts.
 */
import { Box, Text, useApp } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';

import { SearchScreen } from './search-screen.js';
import { createSession, loadSession } from '../core/session.js';
import { listSnapshots } from '../core/snapshot-catalog.js';
import { resolveToken } from '../core/token.js';
import {
  CreatingProgress,
  progressToCreatingProgress,
} from '../ui/creating-progress.js';
import { Header } from '../ui/header.js';
import { Menu } from '../ui/menu.js';
import { SnapshotManager } from '../ui/snapshot-manager.js';
import { SnapshotPicker } from '../ui/snapshot-picker.js';

import type { SessionResult, SnapshotSession } from '../core/session.js';
import type { SnapshotFileInfo } from '../core/snapshot-catalog.js';
import type { ProtopediaInMemoryRepository } from 'promidas';
import type { NormalizedPrototype } from 'promidas/types';

// All user-facing menu labels in one place. Exported so that tests
// reference the same values and wording changes never break them.
export const CREATE_LABEL = '[作成して選択]';
export const MAIN_MENU = {
  search: '作品探索',
  snapshot: 'スナップショット',
} as const;

type Screen =
  | { kind: 'boot' }
  | { kind: 'picker'; snapshots: readonly SnapshotFileInfo[]; notice?: string }
  | { kind: 'manager' }
  | { kind: 'creating'; progress: string }
  | { kind: 'main'; notice?: string }
  | { kind: 'search'; prototypes: readonly NormalizedPrototype[] };

export function PpexApp({ snapshotDir }: { readonly snapshotDir: string }) {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>({ kind: 'boot' });
  const [session, setSession] = useState<SnapshotSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const repositoryRef = useRef<ProtopediaInMemoryRepository | null>(null);

  // Keep the header age display current while the app stays open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Dispose the repository when the app unmounts (q / Ctrl+C).
  useEffect(
    () => () => {
      repositoryRef.current?.dispose();
      repositoryRef.current = null;
    },
    [],
  );

  const openPicker = useCallback(
    async (notice?: string) => {
      const snapshots = await listSnapshots(snapshotDir);
      setScreen({
        kind: 'picker',
        snapshots,
        ...(notice !== undefined ? { notice } : {}),
      });
    },
    [snapshotDir],
  );

  useEffect(() => {
    void openPicker();
  }, []);

  const adoptSessionResult = useCallback(
    async (result: SessionResult, failureNotice: string) => {
      if (!result.ok) {
        await openPicker(`${failureNotice}: ${result.message}`);
        return;
      }
      repositoryRef.current?.dispose();
      repositoryRef.current = result.repository;
      setSession(result.session);
      setNow(Date.now());
      setScreen({ kind: 'main' });
    },
    [openPicker],
  );

  const startCreate = useCallback(async () => {
    const token = resolveToken();
    // The picker guards the token before calling onCreate; bail here
    // defensively so token is a string for createSession.
    if (token === null) return;
    setScreen({ kind: 'creating', progress: 'API リクエストを準備中...' });
    const result = await createSession({
      token,
      snapshotDir,
      onProgress: (event) => {
        const progress = progressToCreatingProgress(event, {
          downloading: (pct, received) => `ダウンロード中 ${pct} (${received})`,
          saving: '保存中...',
        });
        if (progress !== null) {
          setScreen({ kind: 'creating', progress });
        }
      },
    });
    await adoptSessionResult(result, '取得に失敗しました');
  }, [snapshotDir, openPicker, adoptSessionResult]);

  const loadSnapshotFile = useCallback(
    async (info: SnapshotFileInfo) => {
      const result = await loadSession(info.filePath);
      await adoptSessionResult(
        result,
        `ロードに失敗しました (${info.fileName})`,
      );
    },
    [adoptSessionResult],
  );

  const openSearch = useCallback(() => {
    void repositoryRef.current?.getAllFromSnapshot().then((all) =>
      setScreen({
        kind: 'search',
        prototypes: [...all].sort((a, b) => a.id - b.id),
      }),
    );
  }, []);

  switch (screen.kind) {
    case 'boot':
      return <Text>snapshot を確認中...</Text>;

    case 'picker':
      return (
        <SnapshotPicker
          snapshots={screen.snapshots}
          {...(screen.notice !== undefined ? { notice: screen.notice } : {})}
          {...(session !== null
            ? {
                currentFileName: session.fileName,
                onBack: () => setScreen({ kind: 'main' }),
              }
            : {})}
          createLabel={CREATE_LABEL}
          lang="ja"
          onSelectSnapshot={(info) => void loadSnapshotFile(info)}
          onCreate={() => void startCreate()}
          onOpenManager={() => setScreen({ kind: 'manager' })}
          onQuit={exit}
        />
      );

    case 'manager':
      return (
        <SnapshotManager
          snapshotDir={snapshotDir}
          {...(session !== null ? { loadedFileName: session.fileName } : {})}
          lang="ja"
          onExit={() => void openPicker()}
        />
      );

    case 'creating':
      return <CreatingProgress progress={screen.progress} lang="ja" />;

    default:
      break;
  }

  // Screens below require a loaded session. The session implies a
  // live repository (both are only set together in
  // adoptSessionResult), and reading the ref here would violate the
  // no-refs-during-render rule.
  if (session === null) {
    return <Text color="red">内部エラー: セッションがありません。</Text>;
  }

  return (
    <Box flexDirection="column">
      <Header session={session} now={now} />
      {screen.kind === 'main' && (
        <Box flexDirection="column">
          {screen.notice && <Text color="red">{screen.notice}</Text>}
          <Menu
            items={[
              //
              { label: MAIN_MENU.search },
              { label: MAIN_MENU.snapshot },
            ]}
            onSelect={(index) => {
              switch (index) {
                case 0:
                  openSearch();
                  break;
                case 1:
                  void openPicker();
                  break;
                default:
                  break;
              }
            }}
            onQuit={exit}
          />
          <Text dimColor>↑↓: 移動 / Enter: 決定 / q: 終了</Text>
        </Box>
      )}
      {screen.kind === 'search' && (
        <SearchScreen
          items={screen.prototypes}
          onBack={() => setScreen({ kind: 'main' })}
        />
      )}
    </Box>
  );
}
