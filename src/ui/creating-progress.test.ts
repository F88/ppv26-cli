import { describe, expect, it } from 'vitest';

import { progressToCreatingProgress } from './creating-progress.js';

import type { FetchProgressEvent } from 'promidas/fetcher';

const messages = {
  downloading: (pct: string, received: string) =>
    `Downloading ${pct} (${received})`,
  saving: 'Saving...',
};

describe('progressToCreatingProgress', () => {
  it('advances through progress then saving for a successful (2xx) download', () => {
    const progress: FetchProgressEvent = {
      type: 'download-progress',
      status: 200,
      received: 1024,
      total: 2048,
      percentage: 50,
    };
    expect(progressToCreatingProgress(progress, messages)).toContain('50.0%');

    const complete: FetchProgressEvent = {
      type: 'complete',
      status: 200,
      received: 2048,
      estimatedTotal: 2048,
      downloadTimeMs: 10,
      totalTimeMs: 120,
    };
    expect(progressToCreatingProgress(complete, messages)).toBe('Saving...');
  });

  it('keeps the screen (null) for a 4xx error body so it does not read as a download (promidas #126)', () => {
    const progress: FetchProgressEvent = {
      type: 'download-progress',
      status: 401,
      received: 97,
      total: 0,
      percentage: 0,
    };
    expect(progressToCreatingProgress(progress, messages)).toBeNull();

    const complete: FetchProgressEvent = {
      type: 'complete',
      status: 401,
      received: 97,
      estimatedTotal: 26_738_688,
      downloadTimeMs: 5,
      totalTimeMs: 119,
    };
    expect(progressToCreatingProgress(complete, messages)).toBeNull();
  });

  it('ignores events without a body transfer', () => {
    expect(
      progressToCreatingProgress({ type: 'request-start' }, messages),
    ).toBeNull();
  });
});
