#!/usr/bin/env node
/**
 * ppex - interactive snapshot explorer for ProtoPedia data
 * (ProtoPedia EXplorer; renamed from ppc-ui on 2026-07-16).
 *
 * Separate binary from the one-shot `ppv-cli` CLI so that the CLI never
 * loads Ink/React and the two surfaces stay independent.
 */
import { render } from 'ink';

import { initConfigEntries } from './core/config-entries.js';
import { configGateErrors } from './core/config-validation.js';
import { resolveSnapshotDir } from './core/snapshot-catalog.js';
import { VERSION } from './core/version.js';
import { PpexApp } from './ppex/ppex-app.js';

const USAGE = `Usage: ppex [options]

Interactive snapshot explorer for ProtoPedia data.

Options:
  --snapshot-dir <dir>  directory for snapshot files
  -V, --version         output the version number
  -h, --help            display this help
`;

function parseArgs(argv: readonly string[]): {
  snapshotDir?: string;
  help?: boolean;
  version?: boolean;
  error?: string;
} {
  const result: {
    snapshotDir?: string;
    help?: boolean;
    version?: boolean;
    error?: string;
  } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (arg === '-V' || arg === '--version') {
      result.version = true;
    } else if (arg === '--snapshot-dir') {
      const value = argv[index + 1];
      if (value === undefined) {
        result.error = '--snapshot-dir にはディレクトリを指定してください。';
        return result;
      }
      result.snapshotDir = value;
      index += 1;
    } else {
      result.error = `不明な引数です: ${arg}`;
      return result;
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
if (args.error !== undefined) {
  process.stderr.write(`[error] ${args.error}\n`);
  process.exitCode = 1;
} else if (args.help === true) {
  process.stdout.write(USAGE);
} else if (args.version === true) {
  process.stdout.write(`${VERSION}\n`);
} else if (!process.stdin.isTTY || !process.stdout.isTTY) {
  process.stderr.write(
    '[error] ppex は対話的なターミナル (TTY) でのみ実行できます。\n',
  );
  process.exitCode = 1;
} else {
  // A broken config (unreadable, or a value outside its prescribed
  // set) stops the app; running as if nothing were
  // configured would be misleading. config init (ppv-cli) is the repair
  // path.
  const gateErrors = configGateErrors(initConfigEntries(), 'ja');
  if (gateErrors !== null) {
    for (const line of gateErrors) {
      process.stderr.write(`[error] ${line}\n`);
    }
    process.exitCode = 1;
  } else {
    const snapshotDir = resolveSnapshotDir(args.snapshotDir);
    const { waitUntilExit } = render(<PpexApp snapshotDir={snapshotDir} />);
    await waitUntilExit();
  }
}
