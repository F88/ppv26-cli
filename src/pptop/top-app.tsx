/**
 * pptop: top(1)-style snapshot monitor (command-key driven).
 *
 * Startup loads the latest snapshot automatically (empty table when
 * none exists). Keys are commands, like top:
 *
 *   s          snapshot management (the table area is replaced by the
 *              snapshot list; Esc returns)
 *   /          search input mode (typing edits the fields; Esc / Enter
 *              return to command mode; filters apply live)
 *   ↑↓ PgUp/PgDn  row selection (wrap-around)
 *   Enter      detail of the selected prototype (JSON / card tabs)
 *   q          quit
 */
import {
  Box,
  measureElement,
  Text,
  useApp,
  useInput,
  type DOMElement,
} from 'ink';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TopHeader } from './top-header.js';
import {
  computeSnapshotStats,
  countNewborns,
  releaseTimestamps,
} from './top-stats.js';
import {
  EMPTY_VALUES,
  matchesFields,
  SEARCH_FIELDS,
  withFieldBackspace,
  withFieldInput,
} from '../core/search-model.js';
import { createSession, loadSession } from '../core/session.js';
import {
  findLatestSnapshot,
  listSnapshots,
  type SnapshotFileInfo,
} from '../core/snapshot-catalog.js';
import { resolveToken } from '../core/token.js';
import {
  CreatingProgress,
  progressToCreatingProgress,
} from '../ui/creating-progress.js';
import { HelpPanel } from '../ui/help-panel.js';
import { PreviewPane } from '../ui/preview-pane.js';
import { PrototypeDetail } from '../ui/prototype-detail.js';
import { PrototypeRaw } from '../ui/prototype-raw.js';
import { ResultTable } from '../ui/result-table.js';
import { SearchForm } from '../ui/search-form.js';
import { SnapshotManager } from '../ui/snapshot-manager.js';
import { SnapshotPicker } from '../ui/snapshot-picker.js';
import {
  COLUMNS,
  columnLabel,
  compareByColumn,
  visibleColumnsForWidth,
} from '../ui/table-columns.js';
import { useTerminalSize } from '../ui/use-terminal-size.js';

import type { FieldValues } from '../core/search-model.js';
import type { SessionResult, SnapshotSession } from '../core/session.js';
import type { Column } from '../ui/table-columns.js';
import type { ProtopediaInMemoryRepository } from 'promidas';
import type { NormalizedPrototype } from 'promidas/types';

export const CREATE_LABEL = '[Create and select]';

// Reserved height of the preview area, matching PrototypeCard's fixed
// height (14 fields + 2 border lines) with wrap='truncate'. Reserving it
// even when no prototype is shown keeps the layout from jumping: without
// it the table's measured row count inflates while the preview is empty
// (0 rows) and then cannot shrink when data loads and the card appears
// (measureElement grows the window but never shrinks it once the frame
// overflows), pushing the preview / form off the bottom by the card's
// height. See PreviewPane height + the measureElement windowing effect.
const PREVIEW_HEIGHT = 16;

type Mode =
  | { kind: 'boot' }
  | { kind: 'command' }
  | { kind: 'input' }
  | { kind: 'manage'; snapshots: readonly SnapshotFileInfo[]; notice?: string }
  | { kind: 'manager' }
  | { kind: 'help' }
  | { kind: 'creating'; progress: string };

export function TopApp({ snapshotDir }: { readonly snapshotDir: string }) {
  const { exit } = useApp();
  const { columns: terminalColumns, rows: terminalRows } = useTerminalSize();
  const [mode, setMode] = useState<Mode>({ kind: 'boot' });
  const [session, setSession] = useState<SnapshotSession | null>(null);
  const [items, setItems] = useState<readonly NormalizedPrototype[]>([]);
  const [values, setValues] = useState<FieldValues>(EMPTY_VALUES);
  const [active, setActive] = useState(0);
  const [cursor, setCursor] = useState(0);
  // Table sort state: the column (< / > move it among visible columns)
  // and the direction (R toggles asc/desc). See top-app sort spec
  // (2026-07-21). PID is the secondary key (see compareByColumn).
  const [sortColumn, setSortColumn] = useState<Column['key']>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<NormalizedPrototype | null>(null);
  // Full raw-JSON view of the selected prototype (r from the detail).
  const [rawView, setRawView] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Windowed data-row count of the table, measured from the layout.
  const [rows, setRows] = useState(3);
  const repositoryRef = useRef<ProtopediaInMemoryRepository | null>(null);
  const tableAreaRef = useRef<DOMElement | null>(null);
  // Reject a snapshot selection while a load is already in flight. The
  // picker stays mounted during the await, so without this a fast
  // double-select could start two loads and let the earlier one finish
  // last, overwriting the newer selection (issue #20).
  const loadingRef = useRef(false);

  useEffect(
    () => () => {
      repositoryRef.current?.dispose();
      repositoryRef.current = null;
    },
    [],
  );

  const adoptSessionResult = useCallback(
    async (result: SessionResult, failureNotice: string): Promise<boolean> => {
      if (!result.ok) {
        setNotice(`${failureNotice}: ${result.message}`);
        return false;
      }
      repositoryRef.current?.dispose();
      repositoryRef.current = result.repository;
      const all = await result.repository.getAllFromSnapshot();
      setItems([...all]);
      setSession(result.session);
      setCursor(0);
      setNotice(null);
      return true;
    },
    [],
  );

  // Startup: load the latest snapshot automatically; an empty table
  // when none exists (decided 2026-07-16).
  useEffect(() => {
    void (async () => {
      const latest = await findLatestSnapshot(snapshotDir);
      if (latest) {
        const result = await loadSession(latest.filePath);
        await adoptSessionResult(result, `Failed to load ${latest.fileName}`);
      }
      setMode({ kind: 'command' });
    })();
  }, []);

  const openManage = useCallback(
    async (manageNotice?: string) => {
      const snapshots = await listSnapshots(snapshotDir);
      setMode({
        kind: 'manage',
        snapshots,
        ...(manageNotice !== undefined ? { notice: manageNotice } : {}),
      });
    },
    [snapshotDir],
  );

  const loadSnapshotFile = useCallback(
    async (info: SnapshotFileInfo) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const result = await loadSession(info.filePath);
        const ok = await adoptSessionResult(
          result,
          `Failed to load ${info.fileName}`,
        );
        if (ok) {
          setMode({ kind: 'command' });
        } else {
          await openManage();
        }
      } finally {
        loadingRef.current = false;
      }
    },
    [adoptSessionResult, openManage],
  );

  const startCreate = useCallback(async () => {
    const token = resolveToken();
    // The picker guards the token before calling onCreate; bail here
    // defensively so token is a string for createSession.
    if (token === null) return;
    setMode({ kind: 'creating', progress: 'Preparing the API request...' });
    const result = await createSession({
      token,
      snapshotDir,
      onProgress: (event) => {
        const progress = progressToCreatingProgress(event, {
          downloading: (pct, received) => `Downloading ${pct} (${received})`,
          saving: 'Saving...',
        });
        if (progress !== null) {
          setMode({ kind: 'creating', progress });
        }
      },
    });
    await adoptSessionResult(result, 'Fetch failed');
    setMode({ kind: 'command' });
  }, [snapshotDir, adoptSessionResult]);

  const visibleColumns = useMemo(
    () => visibleColumnsForWidth(terminalColumns),
    [terminalColumns],
  );

  const filtered = useMemo(() => {
    // filter() returns a fresh array, so the in-place sort is safe.
    const direction = sortDirection === 'asc' ? 1 : -1;
    const compare = compareByColumn(sortColumn);
    return items
      .filter((item) => matchesFields(item, values))
      .sort((a, b) => compare(a, b) * direction);
  }, [items, values, sortColumn, sortDirection]);
  const stats = useMemo(() => computeSnapshotStats(items), [items]);
  // Release timestamps depend only on the data; the cheap window count
  // re-runs each render against the current time (see TopHeader now).
  const releaseTimes = useMemo(() => releaseTimestamps(items), [items]);
  // Read once per render (no periodic timer): the header's age and
  // newborn counts update on interaction and never redraw on their own.
  const now = Date.now();

  // Any query change resets the selection to the top.
  useEffect(() => {
    setCursor(0);
  }, [values]);

  // If a narrower terminal hid the sort column, fall back to the
  // nearest visible column to its left (PID is always visible, so a
  // fallback always exists). A wider terminal does not restore it.
  useEffect(() => {
    if (visibleColumns.some((column) => column.key === sortColumn)) return;
    const index = COLUMNS.findIndex((column) => column.key === sortColumn);
    for (let i = index - 1; i >= 0; i--) {
      const candidate = COLUMNS[i];
      if (candidate && visibleColumns.some((c) => c.key === candidate.key)) {
        setSortColumn(candidate.key);
        // Reset the cursor to the top, like the explicit sort changes
        // (R, < / >): the re-sort reorders the rows, so keeping the old
        // index would silently select a different prototype.
        setCursor(0);
        return;
      }
    }
  }, [visibleColumns, sortColumn]);

  // Non-empty conditions, in SEARCH_FIELDS order, for the filter line.
  const activeConditions = SEARCH_FIELDS.map((field) => ({
    key: field.key,
    label: field.label.en,
    value: values[field.key].trim(),
  })).filter((condition) => condition.value !== '');

  // The table area flex-grows into whatever height the fixed parts
  // leave over; measure it after every commit to know how many data
  // rows to window. This replaces a manual line-count budget, which
  // broke whenever the surrounding layout changed.
  useEffect(() => {
    if (tableAreaRef.current === null) return;
    const { height } = measureElement(tableAreaRef.current);
    const next = Math.max(3, height - 1); // minus the table header line
    if (next !== rows) setRows(next);
  });

  useInput((input, key) => {
    if (mode.kind === 'boot' || mode.kind === 'creating') return;
    // The manage screen (SnapshotPicker) owns the keys via its Menu,
    // and the snapshot manager owns its own keys likewise.
    if (mode.kind === 'manage' || mode.kind === 'manager') return;
    if (mode.kind === 'help') {
      // Any key dismisses the help overlay (top's behavior); the key
      // is consumed here so it does not also fire a command.
      setMode({ kind: 'command' });
      return;
    }
    if (selected) {
      if (rawView) {
        // Raw JSON: Esc (or Enter / b) returns to the detail view.
        if (key.escape || key.return || input === 'b') setRawView(false);
        return;
      }
      if (input === 'r') {
        setRawView(true);
        return;
      }
      if (key.escape || key.return || input === 'b') setSelected(null);
      return;
    }
    if (mode.kind === 'input') {
      if (key.escape || key.return) {
        setMode({ kind: 'command' });
        return;
      }
      if (key.tab || key.downArrow) {
        setActive(
          (current) =>
            (current + (key.shift ? SEARCH_FIELDS.length - 1 : 1)) %
            SEARCH_FIELDS.length,
        );
        return;
      }
      if (key.upArrow) {
        setActive(
          (current) =>
            (current - 1 + SEARCH_FIELDS.length) % SEARCH_FIELDS.length,
        );
        return;
      }
      const field = SEARCH_FIELDS[active];
      if (!field) return;
      if (key.backspace || key.delete) {
        setValues((current) => withFieldBackspace(current, field.key));
        return;
      }
      if (input !== '' && !key.ctrl && !key.meta) {
        setValues((current) => withFieldInput(current, field.key, input));
      }
      return;
    }
    // Command mode.
    if (input === 'q') {
      exit();
      return;
    }
    if (input === 's') {
      void openManage();
      return;
    }
    if (input === '?' || input === 'h') {
      setMode({ kind: 'help' });
      return;
    }
    if (input === '/') {
      setMode({ kind: 'input' });
      return;
    }
    if (input === 'R') {
      // Reverse the sort order (top's R). Reset the cursor to the top,
      // matching how a query change resets it.
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      setCursor(0);
      return;
    }
    if (input === '<' || input === '>' || key.leftArrow || key.rightArrow) {
      // Move the sort column among the currently visible columns,
      // clamped at the ends; the direction is kept. < or Left moves
      // left, > or Right moves right.
      const forward = input === '>' || key.rightArrow;
      const index = visibleColumns.findIndex(
        (column) => column.key === sortColumn,
      );
      // The sort column can be transiently absent from visibleColumns
      // during a resize, before the fallback effect re-homes it. Guard
      // the -1: otherwise '>' would compute index -1 + 1 === 0 and jump
      // to the first column.
      if (index === -1) return;
      const next = visibleColumns[forward ? index + 1 : index - 1];
      if (next) {
        setSortColumn(next.key);
        setCursor(0);
      }
      return;
    }
    if (key.upArrow) {
      setCursor((current) =>
        current === 0 ? Math.max(0, filtered.length - 1) : current - 1,
      );
    } else if (key.downArrow) {
      setCursor((current) =>
        current >= filtered.length - 1 ? 0 : current + 1,
      );
    } else if (key.pageUp) {
      setCursor((current) => Math.max(0, current - rows));
    } else if (key.pageDown) {
      // Clamp at 0: with an empty result list, length - 1 is -1.
      setCursor((current) =>
        Math.max(0, Math.min(filtered.length - 1, current + rows)),
      );
    } else if (key.return) {
      const item = filtered[cursor];
      if (item) setSelected(item);
    }
  });

  if (mode.kind === 'boot') {
    return <Text>Loading snapshot...</Text>;
  }

  if (selected) {
    if (rawView) {
      return (
        <Box flexDirection="column">
          <PrototypeRaw prototype={selected} />
          <Text dimColor>Esc: back to detail</Text>
        </Box>
      );
    }
    return (
      // minHeight so the detail's flex-grown JSON pane gets the
      // leftover terminal height (see PrototypeDetail).
      <Box flexDirection="column" minHeight={terminalRows}>
        <PrototypeDetail prototype={selected} initialTab="json" />
        <Text dimColor>Esc: back | r: Raw JSON</Text>
      </Box>
    );
  }

  const usageForSearch = 'Tab/arrows: move fields / Enter, Esc: command mode';
  const usageForList =
    '↑↓: Select | Enter: Show detail | /: Search | s: Snapshot | ?: Help | q: Quit';

  return (
    // minHeight (not height): fill the terminal so the flex-grown
    // table area absorbs the leftover rows, but let the frame grow
    // naturally instead of clipping when the terminal is too small
    // for the fixed parts (header, preview, form).
    <Box flexDirection="column" minHeight={terminalRows}>
      {/* now is read at render time (no periodic timer): the age line
          updates on interaction and stays put while idle, so it never
          redraws on its own and never drops a terminal selection. */}
      <TopHeader
        stats={stats}
        session={session}
        now={now}
        newborns={countNewborns(releaseTimes, now)}
      />
      <Box height={1} />
      {notice && <Text color="red">{notice}</Text>}

      {mode.kind === 'manage' && (
        <SnapshotPicker
          snapshots={mode.snapshots}
          {...(mode.notice !== undefined ? { notice: mode.notice } : {})}
          {...(session !== null ? { currentFileName: session.fileName } : {})}
          createLabel={CREATE_LABEL}
          lang="en"
          onSelectSnapshot={(info) => void loadSnapshotFile(info)}
          onCreate={() => void startCreate()}
          onOpenManager={() => setMode({ kind: 'manager' })}
          onBack={() => setMode({ kind: 'command' })}
          onQuit={exit}
        />
      )}

      {mode.kind === 'manager' && (
        <SnapshotManager
          snapshotDir={snapshotDir}
          {...(session !== null ? { loadedFileName: session.fileName } : {})}
          lang="en"
          onExit={() => void openManage()}
        />
      )}

      {mode.kind === 'creating' && (
        <CreatingProgress progress={mode.progress} lang="en" />
      )}

      {mode.kind === 'help' && <HelpPanel />}

      {(mode.kind === 'command' || mode.kind === 'input') && (
        <Box flexDirection="column" flexGrow={1}>
          {activeConditions.length > 0 && (
            <Box flexWrap="wrap">
              {activeConditions.map((condition, index) => (
                <Text key={condition.key}>
                  {index > 0 ? ', ' : ''}
                  {condition.label}: {condition.value}
                </Text>
              ))}
            </Box>
          )}
          <Box justifyContent="space-between">
            <Text>
              Prototypes: {filtered.length} / {items.length}
              {filtered.length > 0 ? ` (${cursor + 1}/${filtered.length})` : ''}
            </Text>
            <Text>
              Sort: {columnLabel(sortColumn)} {sortDirection}
            </Text>
          </Box>
          <Box height={1} />

          <Box
            ref={tableAreaRef}
            flexDirection="column"
            flexGrow={1}
            overflow="hidden"
          >
            <ResultTable
              items={filtered}
              cursor={cursor}
              rows={rows}
              sortKey={sortColumn}
            />
          </Box>
          <PreviewPane
            prototype={filtered[cursor]}
            wrap="truncate"
            height={PREVIEW_HEIGHT}
          />
          <SearchForm
            title={
              mode.kind === 'input'
                ? 'Search (input mode - Esc to return)'
                : 'Search (/: input mode)'
            }
            fields={SEARCH_FIELDS}
            values={values}
            active={mode.kind === 'input' ? active : -1}
            lang="en"
          />

          <Box gap={1}>
            {mode.kind === 'input' ? (
              <>
                <Text dimColor inverse>
                  Search
                </Text>
                <Text dimColor>{usageForSearch}</Text>
              </>
            ) : (
              <>
                <Text dimColor inverse>
                  List
                </Text>
                <Text dimColor>{usageForList}</Text>
              </>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
