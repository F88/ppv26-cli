/**
 * 作品検索: a form of per-field filters with live (incremental)
 * filtering — results update on every keystroke.
 *
 * Semantics (decided 2026-07-15): terms within a field are ANDed, and
 * fields are ANDed with each other. Note this intentionally differs
 * from the CLI facets (repeated options are ORed there): live
 * narrowing feels natural as AND.
 *
 * Key model (fzf-style, no focus switching): typing always edits the
 * active field, Tab / Shift+Tab switch fields, ↑↓ always move the
 * result selection, and Enter opens the detail (card / JSON tabs) of
 * the selected result.
 */
import { Box, Text, useInput } from 'ink';
import { useEffect, useMemo, useState } from 'react';

import {
  EMPTY_VALUES,
  matchesFields,
  SEARCH_FIELDS,
  withFieldBackspace,
  withFieldInput,
} from '../core/search-model.js';
import { PreviewPane } from '../ui/preview-pane.js';
import { PrototypeDetail } from '../ui/prototype-detail.js';
import { PrototypeRaw } from '../ui/prototype-raw.js';
import { ResultList } from '../ui/result-list.js';
import { SearchForm } from '../ui/search-form.js';
import { useTerminalSize } from '../ui/use-terminal-size.js';

import type { FieldValues } from '../core/search-model.js';
import type { NormalizedPrototype } from 'promidas/types';

// Re-exported for existing tests; the model lives in search-model.ts.
export { matchesFields, SEARCH_FIELDS } from '../core/search-model.js';

// Fixed height reserved for the preview card so that the layout does
// not jump as the selection moves across prototypes with more or fewer
// populated fields. Longer content is clipped.
const PREVIEW_HEIGHT = 15;

// Two-column layout kicks in at this terminal width: the preview moves
// to the right of the form + result list (media-query equivalent).
const WIDE_THRESHOLD_COLUMNS = 110;
// Maximum width of the preview column in the wide layout; the actual
// pane is clamped to half the terminal so the form and result list
// always keep at least the other half.
const PREVIEW_MAX_WIDTH = 100;

export function SearchScreen({
  items,
  onBack,
  visibleRows,
  wide,
}: {
  /** All prototypes, sorted by ID ascending. */
  readonly items: readonly NormalizedPrototype[];
  readonly onBack: () => void;
  /** Row-count override for tests. */
  readonly visibleRows?: number;
  /** Layout override for tests; defaults to the terminal width. */
  readonly wide?: boolean;
}) {
  const size = useTerminalSize();
  const [values, setValues] = useState<FieldValues>(EMPTY_VALUES);
  const [active, setActive] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<NormalizedPrototype | null>(null);
  // Full raw-JSON view of the selected prototype (r from the detail).
  const [rawView, setRawView] = useState(false);

  const filtered = useMemo(
    () => items.filter((item) => matchesFields(item, values)),
    [items, values],
  );

  // Any query change resets the result selection to the top.
  useEffect(() => {
    setCursor(0);
  }, [values]);

  const isWide = wide ?? size.columns >= WIDE_THRESHOLD_COLUMNS;

  // Budget: fields + summary + hints + the form border (2), plus the
  // fixed-height preview when it sits below the list (narrow layout).
  // In the wide layout the preview is beside the list, so the rows
  // are not contested.
  const rows =
    visibleRows ??
    Math.max(
      3,
      size.rows - 15 - SEARCH_FIELDS.length - (isWide ? 0 : PREVIEW_HEIGHT),
    );

  useInput((input, key) => {
    if (selected) {
      if (rawView) {
        // Raw JSON: Esc (or Enter) returns to the detail view.
        if (key.escape || key.return) setRawView(false);
        return;
      }
      if (input === 'r') {
        setRawView(true);
        return;
      }
      if (key.escape || key.return) setSelected(null);
      return;
    }
    if (key.escape) {
      onBack();
      return;
    }
    if (key.return) {
      const item = filtered[cursor];
      if (item) setSelected(item);
      return;
    }
    if (key.tab) {
      setActive(
        (current) =>
          (current + (key.shift ? SEARCH_FIELDS.length - 1 : 1)) %
          SEARCH_FIELDS.length,
      );
      return;
    }
    if (key.upArrow) {
      setCursor((current) =>
        current === 0 ? Math.max(0, filtered.length - 1) : current - 1,
      );
      return;
    }
    if (key.downArrow) {
      setCursor((current) =>
        current >= filtered.length - 1 ? 0 : current + 1,
      );
      return;
    }
    if (key.pageUp) {
      setCursor((current) => Math.max(0, current - rows));
      return;
    }
    if (key.pageDown) {
      // Clamp at 0: with an empty result list, length - 1 is -1.
      setCursor((current) =>
        Math.max(0, Math.min(filtered.length - 1, current + rows)),
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
  });

  if (selected) {
    if (rawView) {
      return (
        <Box flexDirection="column">
          <PrototypeRaw prototype={selected} />
          <Text dimColor>Esc: 詳細に戻る</Text>
        </Box>
      );
    }
    // The card is already visible as the preview, so the detail opens
    // on the JSON tab (switchable as usual).
    return (
      // minHeight so the detail's flex-grown JSON pane gets the
      // leftover terminal height (see PrototypeDetail).
      <Box flexDirection="column" minHeight={size.rows}>
        <PrototypeDetail prototype={selected} initialTab="json" />
        <Text dimColor>Esc: 戻る / r: Raw JSON</Text>
      </Box>
    );
  }

  // Presentation is delegated to the components/ modules; this
  // container only wires state into their props.
  const form = (
    <SearchForm
      title="検索 (入力で即時絞り込み)"
      fields={SEARCH_FIELDS}
      values={values}
      active={active}
      lang="ja"
    />
  );

  const summary = (
    <Text>
      ヒット: {filtered.length}件 (全{items.length}件)
      {filtered.length > 0 ? ` (${cursor + 1}/${filtered.length})` : ''}
    </Text>
  );

  // Narrow layout: the preview competes with the list for rows, so
  // its height stays fixed. Wide layout: the right column is
  // otherwise empty below the card, so the preview may use the full
  // terminal height (minus the hint line) and wrapped long fields
  // (e.g. summary) stay fully visible.
  const preview = (height: number) => (
    <PreviewPane prototype={filtered[cursor]} height={height} wrap="wrap" />
  );

  const list = <ResultList items={filtered} cursor={cursor} rows={rows} />;

  const hint = (
    <Text dimColor>
      Tab: フィールド移動 / ↑↓: 結果選択 / Enter: 詳細 (JSON) / Esc: 戻る
    </Text>
  );

  if (isWide) {
    // Wide layout: form + list on the left, the preview on the right.
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Box flexDirection="column" flexGrow={1}>
            {form}
            {summary}
            {list}
          </Box>
          <Box
            flexDirection="column"
            width={Math.min(PREVIEW_MAX_WIDTH, Math.floor(size.columns / 2))}
          >
            {preview(size.rows - 1)}
          </Box>
        </Box>
        {hint}
      </Box>
    );
  }

  // Narrow layout: everything stacked, the preview above the list.
  return (
    <Box flexDirection="column">
      {form}
      {summary}
      {preview(PREVIEW_HEIGHT)}
      {list}
      {hint}
    </Box>
  );
}
