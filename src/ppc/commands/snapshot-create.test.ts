import { afterEach, describe, expect, it, vi } from 'vitest';

import { createProgressRenderer } from './snapshot-create.js';

import type { FetchProgressEvent } from 'promidas/fetcher';

/** Runs the events through a fresh renderer and returns the stderr text. */
function renderToStderr(events: readonly FetchProgressEvent[]): string {
  let out = '';
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    out += String(chunk);
    return true;
  });
  const emit = createProgressRenderer();
  for (const event of events) emit(event);
  return out;
}

describe('createProgressRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows size, percentage, and completion for a successful (2xx) download', () => {
    const out = renderToStderr([
      {
        type: 'response-received',
        status: 200,
        prepareTimeMs: 100,
        estimatedTotal: 2048,
        limit: 10_000,
      },
      {
        type: 'download-progress',
        status: 200,
        received: 1024,
        total: 2048,
        percentage: 50,
      },
      {
        type: 'complete',
        status: 200,
        received: 2048,
        estimatedTotal: 2048,
        downloadTimeMs: 10,
        totalTimeMs: 120,
      },
    ]);
    expect(out).toContain('推定サイズ');
    expect(out).toContain('ダウンロード中');
    expect(out).toContain('ダウンロード完了');
    expect(out).not.toContain('HTTP');
  });

  it('does not present a 4xx error body as a successful download (promidas #126)', () => {
    // A 401 without Content-Length: the small error JSON streams to the
    // end, so `complete` fires carrying status 401.
    const out = renderToStderr([
      {
        type: 'response-received',
        status: 401,
        prepareTimeMs: 100,
        estimatedTotal: 26_738_688,
        limit: 10_000,
      },
      {
        type: 'download-progress',
        status: 401,
        received: 97,
        total: 0,
        percentage: 0,
      },
      {
        type: 'complete',
        status: 401,
        received: 97,
        estimatedTotal: 26_738_688,
        downloadTimeMs: 5,
        totalTimeMs: 119,
      },
    ]);
    // The status replaces the meaningless size estimate...
    expect(out).toContain('レスポンス受信 (HTTP 401)');
    expect(out).not.toContain('推定サイズ');
    // ...the meaningless progress line is suppressed...
    expect(out).not.toContain('ダウンロード中');
    // ...and completion does not read as a success.
    expect(out).toContain('HTTP 401');
    expect(out).not.toContain('ダウンロード完了');
  });
});
