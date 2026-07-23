import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { SEARCH_FIELDS, SearchScreen } from './search-screen.js';

import type { NormalizedPrototype } from 'promidas/types';

const TAB = '\t';
const ARROW_DOWN = '\u001B[B';
const ENTER = '\r';
const ESCAPE = '\u001B';

function prototype(
  id: number,
  overrides: Partial<NormalizedPrototype>,
): NormalizedPrototype {
  return {
    id,
    createDate: '2026-01-01T00:00:00.000Z',
    releaseFlg: 1,
    status: 1,
    prototypeNm: `Prototype ${id}`,
    summary: '',
    freeComment: '',
    systemDescription: '',
    users: ['tester'],
    teamNm: '',
    tags: [],
    materials: [],
    events: [],
    awards: [],
    mainUrl: `https://protopedia.net/prototype/${id}`,
    viewCount: 0,
    goodCount: 0,
    commentCount: 0,
    ...overrides,
  } as NormalizedPrototype;
}

const ITEMS: readonly NormalizedPrototype[] = [
  prototype(1, {
    prototypeNm: 'LED Cube',
    summary: 'A shiny cube',
    tags: ['LED', 'Arduino'],
    materials: ['M5Stack'],
    users: ['alice'],
  }),
  prototype(2, {
    prototypeNm: 'Robot Arm',
    summary: 'Arm with led indicator',
    tags: ['robot'],
    materials: ['Raspberry Pi'],
    users: ['bob'],
  }),
  prototype(3, {
    prototypeNm: 'LED Robot',
    summary: 'Walking led robot',
    tags: ['LED', 'robot'],
    materials: ['M5StickC'],
    users: ['carol'],
  }),
];

describe('SearchScreen', () => {
  it('shows all fields and every item before any input', () => {
    const { lastFrame, unmount } = render(
      <SearchScreen items={ITEMS} onBack={() => {}} visibleRows={10} />,
    );
    const frame = lastFrame() ?? '';
    for (const field of SEARCH_FIELDS) {
      expect(frame).toContain(`${field.label.ja}: [`);
    }
    expect(frame).toContain('ヒット: 3件 (全3件)');
    expect(frame).toContain('> 1 LED Cube');
    unmount();
  });

  it('filters live as the name field is typed (terms are ANDed)', async () => {
    const { lastFrame, stdin, unmount } = render(
      <SearchScreen items={ITEMS} onBack={() => {}} visibleRows={10} />,
    );

    stdin.write(TAB); // ID -> 作品名
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('> 作品名: [');
    });
    stdin.write('led');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('ヒット: 2件 (全3件)');
    });
    expect(lastFrame()).toContain('LED Cube');
    expect(lastFrame()).toContain('LED Robot');

    stdin.write(' robot'); // "led robot" both must match the name
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('ヒット: 1件 (全3件)');
    });
    expect(lastFrame()).toContain('LED Robot');
    unmount();
  });

  it('filters by ID prefix; space-separated terms are ORed', async () => {
    const { lastFrame, stdin, unmount } = render(
      <SearchScreen items={ITEMS} onBack={() => {}} visibleRows={10} />,
    );

    // The ID field is the first field, already active.
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('> ID: [');
    });
    stdin.write('x'); // letters are ignored on the ID field
    stdin.write('1');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('ヒット: 1件 (全3件)');
    });
    expect(lastFrame()).toContain('LED Cube');
    expect(lastFrame()).not.toContain('ID: [x');

    stdin.write(' 3'); // "1 3" -> IDs 1 and 3 (OR)
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('ヒット: 2件 (全3件)');
    });
    expect(lastFrame()).toContain('LED Robot');
    unmount();
  });

  it('combines fields with AND (name + material)', async () => {
    const { lastFrame, stdin, unmount } = render(
      <SearchScreen items={ITEMS} onBack={() => {}} visibleRows={10} />,
    );

    stdin.write(TAB); // ID -> 作品名
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('> 作品名: [');
    });
    stdin.write('led');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('ヒット: 2件 (全3件)');
    });

    // Move to 素材: 作品名 -> 概要 -> タグ -> 素材.
    stdin.write(TAB);
    stdin.write(TAB);
    stdin.write(TAB);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('> 素材: [');
    });
    stdin.write('m5stack');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('ヒット: 1件 (全3件)');
    });
    expect(lastFrame()).toContain('LED Cube');
    unmount();
  });

  it('selects a result with arrows and opens the detail directly', async () => {
    const { lastFrame, stdin, unmount } = render(
      <SearchScreen items={ITEMS} onBack={() => {}} visibleRows={10} />,
    );

    stdin.write(TAB); // ID -> 作品名
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('> 作品名: [');
    });
    stdin.write('led');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('ヒット: 2件 (全3件)');
    });
    expect(lastFrame()).toContain('> 1 LED Cube');

    // The card of the selected result is previewed below the list.
    expect(lastFrame()).toContain('Name: LED Cube');

    stdin.write(ARROW_DOWN); // arrows move the result selection directly
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('> 3 LED Robot');
    });
    // The preview follows the selection.
    expect(lastFrame()).toContain('Name: LED Robot');

    stdin.write(ENTER); // open the detail (JSON tab by default)
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('"prototypeNm": "LED Robot"');
    });
    stdin.write(ESCAPE); // back to the search; query and selection kept
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('作品名: [');
    });
    expect(lastFrame()).toContain('led');
    expect(lastFrame()).toContain('> 3 LED Robot');
    unmount();
  });

  it('keeps the frame height stable while the preview follows the cursor', async () => {
    // ITEMS[0] has tags/materials populated; ITEMS[1] has fewer fields.
    const { lastFrame, stdin, unmount } = render(
      <SearchScreen items={ITEMS} onBack={() => {}} visibleRows={10} />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('> 1 LED Cube');
    });
    const linesBefore = (lastFrame() ?? '').split('\n').length;

    stdin.write(ARROW_DOWN); // move to a prototype with fewer fields
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('> 2 Robot Arm');
    });
    const linesAfter = (lastFrame() ?? '').split('\n').length;
    expect(linesAfter).toBe(linesBefore);
    unmount();
  });

  it('places the preview beside the form in the wide layout', async () => {
    const { lastFrame, unmount } = render(
      <SearchScreen items={ITEMS} onBack={() => {}} visibleRows={10} wide />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('> 1 LED Cube');
    });
    // In the two-column layout the field lines share terminal rows
    // with the preview card. The form draws its own border (2 '│'),
    // so the card border beside it brings the count above 2.
    const fieldLine = (lastFrame() ?? '')
      .split('\n')
      .find((line) => line.includes('タグ: ['));
    expect(fieldLine).toBeDefined();
    expect((fieldLine?.match(/│/g) ?? []).length).toBeGreaterThan(2);
    unmount();
  });

  it('keeps the preview below the form in the narrow layout', async () => {
    const { lastFrame, unmount } = render(
      <SearchScreen
        items={ITEMS}
        onBack={() => {}}
        visibleRows={10}
        wide={false}
      />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('> 1 LED Cube');
    });
    // Only the form's own border is on the field line (2 '│'); the
    // preview card sits below, not beside.
    const fieldLine = (lastFrame() ?? '')
      .split('\n')
      .find((line) => line.includes('タグ: ['));
    expect(fieldLine).toBeDefined();
    expect((fieldLine?.match(/│/g) ?? []).length).toBe(2);
    unmount();
  });

  it('calls onBack with Esc on the form', async () => {
    const onBack = vi.fn();
    const { lastFrame, stdin, unmount } = render(
      <SearchScreen items={ITEMS} onBack={onBack} visibleRows={10} />,
    );
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('検索');
    });
    stdin.write(ESCAPE);
    await vi.waitFor(() => {
      expect(onBack).toHaveBeenCalledOnce();
    });
    unmount();
  });

  it('sanitizes control chars in the list and preview, keeping ZWJ emoji', () => {
    const emoji =
      String.fromCodePoint(0x1f646) +
      String.fromCodePoint(0x200d) +
      String.fromCodePoint(0x2640) +
      String.fromCodePoint(0xfe0f);
    const item = prototype(9, {
      prototypeNm: `Ctrl${TAB}${emoji}`,
      users: [`u${TAB}v`],
    });
    const { lastFrame, unmount } = render(
      <SearchScreen items={[item]} onBack={() => {}} visibleRows={10} />,
    );
    const frame = lastFrame() ?? '';
    // List row: TAB becomes a space, the ZWJ emoji survives, users clean.
    expect(frame).toContain(`9 Ctrl ${emoji}`);
    expect(frame).toContain('u v');
    // The preview card shows the sanitized name too.
    expect(frame).toContain(`Name: Ctrl ${emoji}`);
    expect(frame).not.toContain(TAB); // no raw control char on screen
    unmount();
  });
});
