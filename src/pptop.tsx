#!/usr/bin/env node
/**
 * pptop - top(1)-style monitor for ProtoPedia snapshot data.
 *
 * Third binary alongside `ppv-cli` (pure UNIX-like command) and `ppex`
 * (modern interactive CLI): command-key driven, dense aggregate
 * header, table-centric display.
 */
import { render } from 'ink';

import { initConfigEntries } from './core/config-entries.js';
import { configGateErrors } from './core/config-validation.js';
import { resolveSnapshotDir } from './core/snapshot-catalog.js';
import { VERSION } from './core/version.js';
import { TopApp } from './pptop/top-app.js';

const USAGE = `Usage: pptop [options]

top-style monitor for ProtoPedia snapshot data.

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
        result.error = '--snapshot-dir requires a directory.';
        return result;
      }
      result.snapshotDir = value;
      index += 1;
    } else {
      result.error = `Unknown argument: ${arg}`;
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
    '[error] pptop requires an interactive terminal (TTY).\n',
  );
  process.exitCode = 1;
} else {
  // A broken config (unreadable, or a value outside its prescribed
  // set) stops the app; running as if nothing were
  // configured would be misleading. config init (ppv-cli) is the repair
  // path. pptop's UI language is English.
  const gateErrors = configGateErrors(initConfigEntries(), 'en');
  if (gateErrors !== null) {
    for (const line of gateErrors) {
      process.stderr.write(`[error] ${line}\n`);
    }
    process.exitCode = 1;
  } else {
    const snapshotDir = resolveSnapshotDir(args.snapshotDir);
    const { waitUntilExit } = render(<TopApp snapshotDir={snapshotDir} />);
    await waitUntilExit();
  }
}
