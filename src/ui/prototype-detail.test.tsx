import { Box } from 'ink';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { PrototypeCard, PrototypeDetail } from './prototype-detail.js';

import type { NormalizedPrototype } from 'promidas/types';

const PROTOTYPE = {
  id: 42,
  createDate: '2026-01-01T00:00:00.000Z',
  releaseFlg: 1,
  status: 1,
  prototypeNm: 'Copy Target',
  summary: '',
  freeComment: '',
  systemDescription: '',
  users: ['tester'],
  teamNm: '',
  tags: [],
  materials: [],
  events: [],
  awards: [],
  mainUrl: 'https://protopedia.net/prototype/42',
  viewCount: 0,
  goodCount: 0,
  commentCount: 0,
} as unknown as NormalizedPrototype;

describe('PrototypeDetail copy feature', () => {
  it('copies the exact JSON with c and shows a notice', async () => {
    const copyText = vi.fn().mockResolvedValue(true);
    // A fixed-height parent stands in for the app screens, which
    // give the detail the terminal height via minHeight.
    const { lastFrame, stdin, unmount } = render(
      <Box flexDirection="column" height={20}>
        <PrototypeDetail
          prototype={PROTOTYPE}
          initialTab="json"
          copyText={copyText}
        />
      </Box>,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('"prototypeNm": "Copy Target"');
    });

    stdin.write('c');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Copied');
    });
    expect(copyText).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify(PROTOTYPE, null, 2),
    );
    unmount();
  });

  it('reports a failure when the clipboard is unavailable', async () => {
    const copyText = vi.fn().mockResolvedValue(false);
    // A fixed-height parent stands in for the app screens, which
    // give the detail the terminal height via minHeight.
    const { lastFrame, stdin, unmount } = render(
      <Box flexDirection="column" height={20}>
        <PrototypeDetail
          prototype={PROTOTYPE}
          initialTab="json"
          copyText={copyText}
        />
      </Box>,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('"id": 42');
    });

    stdin.write('c');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Copy failed');
    });
    unmount();
  });

  it('keeps JSON and clipboard byte-faithful for data with control chars', async () => {
    const withControl = {
      ...PROTOTYPE,
      prototypeNm: `Raw${String.fromCodePoint(0x09)}Name`,
    } as unknown as NormalizedPrototype;
    const copyText = vi.fn().mockResolvedValue(true);
    const { lastFrame, stdin, unmount } = render(
      <Box flexDirection="column" height={20}>
        <PrototypeDetail
          prototype={withControl}
          initialTab="json"
          copyText={copyText}
        />
      </Box>,
    );
    // The JSON view shows the escaped control char (\t), not a
    // sanitized space - the machine-readable path is not touched.
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Raw\\tName');
    });

    stdin.write('c');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Copied');
    });
    // The clipboard gets the exact JSON of the original, control char
    // intact - applying sanitizeDisplayText here would break this.
    expect(copyText).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify(withControl, null, 2),
    );
    unmount();
  });
});

describe('PrototypeCard sanitizes untrusted fields', () => {
  const TAB = String.fromCodePoint(0x09);

  it('renders control chars in every wired field as spaces', () => {
    // One control char per rendered untrusted field, so a missed wiring
    // (e.g. summary or officialLink) is caught by the assertions below
    // and by the frame-wide "no raw control char" check.
    const proto = {
      ...PROTOTYPE,
      prototypeNm: `Ctrl${TAB}Name`,
      teamNm: `T${TAB}m`,
      users: [`u${TAB}v`],
      tags: [`t${TAB}g`],
      materials: [`m${TAB}t`],
      events: [`e${TAB}v`],
      officialLink: `http://x${TAB}y`,
      summary: `sum${TAB}mary`,
    } as unknown as NormalizedPrototype;
    const { lastFrame, unmount } = render(
      <PrototypeCard prototype={proto} wrap="truncate" />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Name: Ctrl Name');
    expect(frame).toContain('team: T m');
    expect(frame).toContain('users: u v');
    expect(frame).toContain('tags: t g');
    expect(frame).toContain('materials: m t');
    expect(frame).toContain('events: e v');
    expect(frame).toContain('link: http://x y');
    expect(frame).toContain('summary: sum mary');
    expect(frame).not.toContain(TAB); // no raw control char reaches the screen
    unmount();
  });
});
