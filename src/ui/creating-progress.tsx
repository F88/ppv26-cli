/**
 * Presentational: fetch progress while creating a snapshot. The heading
 * is localized via lang (pptop = en, ppex / manager = per host); the
 * progress line is passed in already in the host's language.
 */
import { Box, Text } from 'ink';

import { formatBytes } from '../core/format.js';

import type { FetchProgressEvent } from 'promidas/fetcher';

export type CreatingProgressLang = 'en' | 'ja';

/**
 * Maps a fetch progress event to the next "creating" progress line, or null
 * to keep the current screen. A 4xx/5xx response body still streams to the
 * end (WHATWG fetch semantics), so its `download-progress` / `complete` must
 * not advance the UI as if the fetch succeeded - check `status` and skip
 * them, letting the failure message speak instead (promidas #126). Shared by
 * every create surface (the pptop / ppex pickers and the snapshot manager).
 */
export function progressToCreatingProgress(
  event: FetchProgressEvent,
  messages: {
    readonly downloading: (pct: string, received: string) => string;
    readonly saving: string;
  },
): string | null {
  if (event.type === 'download-progress') {
    if (event.status >= 400) return null;
    const pct =
      typeof event.percentage === 'number'
        ? `${event.percentage.toFixed(1)}%`
        : '?%';
    return messages.downloading(pct, formatBytes(event.received));
  }
  if (event.type === 'complete') {
    if (event.status >= 400) return null;
    return messages.saving;
  }
  return null;
}

const HEADING: Record<CreatingProgressLang, string> = {
  ja: 'ProtoPedia API からデータを取得しています...',
  en: 'Fetching data from the ProtoPedia API...',
};

export type CreatingProgressProps = {
  readonly progress: string;
  readonly lang: CreatingProgressLang;
};

export function CreatingProgress({ progress, lang }: CreatingProgressProps) {
  return (
    <Box flexDirection="column">
      <Text bold>{HEADING[lang]}</Text>
      <Text color="yellow">{progress}</Text>
    </Box>
  );
}
