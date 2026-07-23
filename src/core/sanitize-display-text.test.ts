import { describe, expect, it } from 'vitest';

import { sanitizeDisplayText } from './sanitize-display-text.js';

// Build control / invisible characters from their code points so the
// source stays plain ASCII and each case is unambiguous.
const TAB = String.fromCodePoint(0x09);
const BACKSPACE = String.fromCodePoint(0x08);
const FILE_SEPARATOR = String.fromCodePoint(0x1c);
const DEL = String.fromCodePoint(0x7f);
const CSI = String.fromCodePoint(0x9b); // C1
const LINE_SEP = String.fromCodePoint(0x2028);
const ZWJ = String.fromCodePoint(0x200d); // Cf - must be preserved
const ZWSP = String.fromCodePoint(0x200b); // Cf - must be preserved
const FULL_WIDTH_SPACE = String.fromCodePoint(0x3000);

describe('sanitizeDisplayText', () => {
  it('leaves clean text unchanged', () => {
    expect(sanitizeDisplayText('Responsive Widget')).toBe('Responsive Widget');
  });

  it('replaces a leading TAB with a space, without trimming (prototype 3064)', () => {
    // TAB + existing space -> two leading spaces; edges are not trimmed.
    expect(sanitizeDisplayText(`${TAB} 超低電力ソーラーモータ`)).toBe(
      '  超低電力ソーラーモータ',
    );
  });

  it('replaces a leading BACKSPACE with a space, without trimming (prototype 1054)', () => {
    expect(sanitizeDisplayText(`${BACKSPACE}魚(ぎょ)パニック`)).toBe(
      ' 魚(ぎょ)パニック',
    );
  });

  it('turns an internal control char into a space (prototype 577)', () => {
    expect(sanitizeDisplayText(`ai-kai（八${FILE_SEPARATOR}菜戒）`)).toBe(
      'ai-kai（八 菜戒）',
    );
  });

  it('replaces each CR/LF with a space and does not collapse them', () => {
    // Four control chars become four spaces: internal runs are never
    // collapsed, so intentional spacing in the data is preserved.
    expect(sanitizeDisplayText('a\r\n\r\nb')).toBe('a    b');
  });

  it('handles the Unicode line separator U+2028', () => {
    expect(sanitizeDisplayText(`前${LINE_SEP}後`)).toBe('前 後');
  });

  it('sanitizes a C1 control (CSI U+009B)', () => {
    expect(sanitizeDisplayText(`a${CSI}b`)).toBe('a b');
  });

  it('sanitizes DEL (U+007F)', () => {
    expect(sanitizeDisplayText(`a${DEL}b`)).toBe('a b');
  });

  it('preserves ZERO WIDTH JOINER in emoji sequences', () => {
    // Woman gesturing OK: person-gesturing + ZWJ + female sign + VS16.
    const emoji =
      String.fromCodePoint(0x1f646) +
      ZWJ +
      String.fromCodePoint(0x2640) +
      String.fromCodePoint(0xfe0f);
    expect(sanitizeDisplayText(`OK ${emoji}`)).toBe(`OK ${emoji}`);
  });

  it('preserves ZERO WIDTH SPACE (Cf is not touched)', () => {
    expect(sanitizeDisplayText(`a${ZWSP}b`)).toBe(`a${ZWSP}b`);
  });

  it('preserves the full-width space U+3000', () => {
    expect(sanitizeDisplayText(`モータ${FULL_WIDTH_SPACE}消費電力`)).toBe(
      `モータ${FULL_WIDTH_SPACE}消費電力`,
    );
  });

  it('preserves intentional consecutive spaces', () => {
    expect(sanitizeDisplayText('a  b')).toBe('a  b');
  });

  it('turns all-control input into the same number of spaces', () => {
    expect(sanitizeDisplayText('\t\n\r')).toBe('   ');
  });
});
