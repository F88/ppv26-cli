/**
 * Output helpers shared by the ppc config commands and the startup
 * gate. Single home for these - the same implementation must not be
 * repeated per file.
 *
 * Results go to stdout and errors directly to stderr, outside of the
 * log-level control: config commands (and the gate that guards the
 * config) are upstream of the logging configuration, so nothing they
 * say may be silenced by PPV_CLI_LOG_LEVEL or --quiet.
 */

/** Writes one line of a command's result to stdout. */
export function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Writes an always-visible error line to stderr. */
export function printError(line: string): void {
  process.stderr.write(`[error] ${line}\n`);
}
