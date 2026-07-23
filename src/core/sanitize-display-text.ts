/**
 * Clean an untrusted string for display to a human.
 *
 * ProtoPedia data (names, summaries, ...) sometimes carries stray
 * control codes. Printed raw to a terminal they wreck the layout - Ink
 * measures e.g. TAB as zero width, yet the terminal still expands it, so
 * a one-line table row overflows and wraps - or, worse, an ESC / C1 byte
 * injects a terminal escape sequence. This turns those bytes into plain
 * spaces so the text is safe and stays on a single line.
 *
 * Examples (only control chars change; spacing is never collapsed or
 * trimmed, so a control char at an edge leaves a space there):
 *   "a\tb"                -> "a b"
 *   "\t 超低電力モータ "  -> "  超低電力モータ "
 *
 * Use it for anything human-facing (table cells, the preview / detail
 * card, ppv-cli's plain-text output). Do NOT use it for machine-readable
 * output: the JSON views (pptop detail / raw JSON, `ppv-cli prototype show`)
 * and clipboard copies must stay byte-for-byte faithful.
 *
 * What it REPLACES (each becomes one ASCII space):
 *   - Every control character, i.e. Unicode category Cc:
 *       - C0  U+0000-U+001F  (TAB, LF, CR, BACKSPACE, ESC, ...)
 *       - DEL U+007F
 *       - C1  U+0080-U+009F  (8-bit escape introducers such as CSI/OSC)
 *   - The Unicode line / paragraph separators U+2028 / U+2029 - they act
 *     as newlines but are not part of Cc.
 *   (This is the whole job: the single CONTROL_OR_LINE_SEPARATOR replace
 *   below and nothing else - no whitespace collapsing, no trimming.)
 *
 * What it deliberately KEEPS (does not touch):
 *   - Unicode category Cf (format characters): zero-width joiner U+200D,
 *     zero-width space U+200B, bidi marks U+200E-U+202E, ... These have
 *     real uses - ZWJ builds composed emoji, bidi marks make
 *     right-to-left scripts display correctly - so removing them would
 *     corrupt valid text. `\p{Cc}` never matches Cf, so they pass
 *     straight through.
 *   - All whitespace other than the targets above: runs of spaces,
 *     leading / trailing spaces, and non-ASCII spaces such as the
 *     full-width space U+3000 are left exactly as they appear in the
 *     data. Single responsibility - neutralize control codes, normalize
 *     nothing. (A control char at an edge therefore leaves one space
 *     there; harmless, and it marks that something was removed.)
 */
const CONTROL_OR_LINE_SEPARATOR = /[\p{Cc}\u2028\u2029]/gu;

export function sanitizeDisplayText(text: string): string {
  // Single responsibility: turn each control / line-separator char into
  // an ASCII space and change nothing else - no collapsing, no trimming.
  // All other characters and every existing space (internal or at the
  // edges) are preserved exactly as they appear in the data.
  return text.replace(CONTROL_OR_LINE_SEPARATOR, ' ');
}
