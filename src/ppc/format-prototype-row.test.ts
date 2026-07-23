import { describe, expect, it } from 'vitest';

import { formatPrototypeRow } from './format-prototype-row.js';

import type { NormalizedPrototype } from 'promidas/types';

function proto(fields: Partial<Record<string, unknown>>): NormalizedPrototype {
  return {
    id: 0,
    prototypeNm: '',
    users: [],
    ...fields,
  } as unknown as NormalizedPrototype;
}

describe('formatPrototypeRow', () => {
  const TAB = String.fromCodePoint(0x09);

  it('formats id, name and users as a tab-separated row', () => {
    const row = formatPrototypeRow(
      proto({ id: 42, prototypeNm: 'LED Cube', users: ['alice', 'bob'] }),
    );
    expect(row).toBe('42\tLED Cube\talice,bob');
  });

  it('sanitizes a control char in the name without adding a column', () => {
    const row = formatPrototypeRow(
      proto({ id: 1, prototypeNm: `A${TAB}B`, users: ['u'] }),
    );
    expect(row).toBe('1\tA B\tu');
    // Still exactly three tab-separated columns; the data control char
    // was neutralized to a space and did not corrupt the structure.
    expect(row.split('\t')).toHaveLength(3);
  });

  it('sanitizes a control char inside a user name', () => {
    const row = formatPrototypeRow(
      proto({ id: 2, prototypeNm: 'N', users: [`x${TAB}y`] }),
    );
    expect(row).toBe('2\tN\tx y');
  });
});
