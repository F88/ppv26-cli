/**
 * Prototype detail presentation: the compact card and the
 * tab-switchable detail view (card / raw JSON), used by 作品探索.
 *
 * The JSON tab scrolls: the pane flex-grows into the leftover
 * terminal height, and the JSON is hard-wrapped to the pane width
 * beforehand (indentation preserved, nothing truncated), so one
 * array line equals one terminal row and the scroll window is exact.
 */
import { Box, measureElement, Text, useInput, type DOMElement } from 'ink';
import { useEffect, useMemo, useRef, useState } from 'react';
import wrapAnsi from 'wrap-ansi';

import { copyToClipboard } from '../core/clipboard.js';
import { buildPrototypeLink } from '../core/protopedia-utils.js';
import { sanitizeDisplayText } from '../core/sanitize-display-text.js';

import type { NormalizedPrototype } from 'promidas/types';

// Detail view tabs. Add entries here to extend the detail display.
const DETAIL_TABS = [
  { key: 'card', label: 'カード' },
  { key: 'json', label: 'JSON' },
] as const;
type DetailTabKey = (typeof DETAIL_TABS)[number]['key'];

/**
 * Prototype detail with tab-switchable representations (card / raw
 * JSON). Tab or ←→ switches at any time while the detail is open;
 * c copies the JSON to the system clipboard (byte-exact, unlike a
 * terminal selection over wrapped lines).
 */
export function PrototypeDetail({
  prototype,
  initialTab = 'card',
  copyText = copyToClipboard,
}: {
  readonly prototype: NormalizedPrototype;
  readonly initialTab?: DetailTabKey;
  /** Clipboard writer override for tests. */
  readonly copyText?: (text: string) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<DetailTabKey>(initialTab);
  const [offset, setOffset] = useState(0);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );
  // Viewport of the JSON pane content (inside border and padding),
  // measured from the layout.
  const [viewport, setViewport] = useState({ rows: 1, columns: 80 });
  const jsonAreaRef = useRef<DOMElement | null>(null);

  useEffect(() => {
    if (jsonAreaRef.current === null) return;
    const { width, height } = measureElement(jsonAreaRef.current);
    const next = {
      rows: Math.max(1, height - 2), // border
      columns: Math.max(20, width - 4), // border + paddingX
    };
    if (next.rows !== viewport.rows || next.columns !== viewport.columns) {
      setViewport(next);
    }
  });

  // Hard-wrap to the pane width, keeping indentation (trim: false)
  // and every character; wrapAnsi is width-aware for East Asian
  // wide characters.
  const jsonLines = useMemo(
    () =>
      wrapAnsi(JSON.stringify(prototype, null, 2), viewport.columns, {
        hard: true,
        trim: false,
      }).split('\n'),
    [prototype, viewport.columns],
  );
  const maxOffset = Math.max(0, jsonLines.length - viewport.rows);
  const scrollOffset = Math.min(offset, maxOffset);

  useEffect(() => {
    setOffset(0);
    setCopyStatus('idle');
  }, [prototype]);

  // The copy status is a transient notice.
  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timer = setTimeout(() => setCopyStatus('idle'), 2_000);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  useInput((input, key) => {
    if (key.tab || key.leftArrow || key.rightArrow) {
      setTab((current) => (current === 'card' ? 'json' : 'card'));
      return;
    }
    if (input === 'c') {
      void copyText(JSON.stringify(prototype, null, 2)).then((ok) => {
        setCopyStatus(ok ? 'copied' : 'failed');
      });
      return;
    }
    if (tab !== 'json') return;
    if (key.upArrow) {
      setOffset((current) => Math.max(0, Math.min(current, maxOffset) - 1));
    } else if (key.downArrow) {
      setOffset((current) => Math.min(maxOffset, current + 1));
    } else if (key.pageUp) {
      setOffset((current) =>
        Math.max(0, Math.min(current, maxOffset) - viewport.rows),
      );
    } else if (key.pageDown) {
      setOffset((current) => Math.min(maxOffset, current + viewport.rows));
    }
  });

  const visibleLines = jsonLines.slice(
    scrollOffset,
    scrollOffset + viewport.rows,
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box>
        {DETAIL_TABS.map((entry, index) => (
          <Text key={entry.key}>
            {index > 0 ? ' │ ' : ' '}
            <Text
              bold={tab === entry.key}
              color={tab === entry.key ? 'cyan' : undefined}
              dimColor={tab !== entry.key}
            >
              {entry.label}
            </Text>
          </Text>
        ))}
        <Text dimColor> (Tab / ←→: 切替 / c: copy JSON)</Text>
        {tab === 'json' && jsonLines.length > viewport.rows && (
          <Text dimColor>
            {' '}
            ({scrollOffset + 1}-{scrollOffset + visibleLines.length} /{' '}
            {jsonLines.length})
          </Text>
        )}
        {copyStatus !== 'idle' && (
          <Text color={copyStatus === 'copied' ? 'green' : 'red'}>
            {copyStatus === 'copied' ? ' Copied' : ' Copy failed'}
          </Text>
        )}
      </Box>
      {tab === 'card' ? (
        <PrototypeCard prototype={prototype} />
      ) : (
        <Box
          ref={jsonAreaRef}
          flexGrow={1}
          flexDirection="column"
          overflow="hidden"
          borderStyle="round"
          paddingX={1}
        >
          {visibleLines.map((line, index) => (
            // An empty Text renders zero-height; keep a space so
            // blank JSON lines still occupy their row.
            <Text key={scrollOffset + index}>{line === '' ? ' ' : line}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function PrototypeCard({
  prototype,
  wrap = 'wrap',
}: {
  readonly prototype: NormalizedPrototype;
  /**
   * Long-line handling. 'truncate' keeps one field per row, so the
   * card height stays constant (used by the fixed-height preview);
   * 'wrap' shows full values where height is unconstrained.
   */
  readonly wrap?: 'wrap' | 'truncate';
}) {
  const summary =
    prototype.summary.length > 200
      ? `${prototype.summary.slice(0, 200)}…`
      : prototype.summary;
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text wrap={wrap}>ID: {prototype.id}</Text>
      <Text wrap={wrap}>
        Name: {sanitizeDisplayText(prototype.prototypeNm)}
      </Text>
      <Text wrap={wrap}>team: {sanitizeDisplayText(prototype.teamNm)}</Text>
      <Text wrap={wrap}>
        users: {sanitizeDisplayText(prototype.users.join(', '))}
      </Text>
      <Text wrap={wrap}>
        status: {prototype.status} / views: {prototype.viewCount} / goods:{' '}
        {prototype.goodCount}
      </Text>
      <Text wrap={wrap}>
        tags: {sanitizeDisplayText(prototype.tags.join(', '))}
      </Text>
      <Text wrap={wrap}>
        materials: {sanitizeDisplayText(prototype.materials.join(', '))}
      </Text>
      <Text wrap={wrap}>
        events: {sanitizeDisplayText(prototype.events.join(', '))}
      </Text>
      <Text wrap={wrap}>created: {prototype.createDate}</Text>
      <Text wrap={wrap}>updated: {prototype.updateDate}</Text>
      <Text wrap={wrap}>released: {prototype.releaseDate}</Text>
      <Text wrap={wrap}>
        link: {sanitizeDisplayText(prototype.officialLink ?? '')}
      </Text>
      <Text wrap={wrap}>url: {buildPrototypeLink(prototype.id)}</Text>
      <Text wrap={wrap}>summary: {sanitizeDisplayText(summary)}</Text>
    </Box>
  );
}
