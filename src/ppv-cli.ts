#!/usr/bin/env node
/**
 * ppv-cli - one-shot CLI for inspecting ProtoPedia API data offline,
 * from local snapshots.
 *
 * Entry point: parses arguments and dispatches to subcommands.
 *
 * Command structure is noun (operation target) -> verb:
 *   config    - the CLI tool's own configuration
 *   data      - the loaded snapshot data as a whole (PROMIDAS repository)
 *   prototype - individual prototypes
 *   snapshot  - snapshot files on disk
 * Groups and their subcommands are registered in alphabetical order so
 * that the help output lists them alphabetically.
 */
import { Command } from 'commander';

import { initConfigEntries } from './core/config-entries.js';
import { configGateErrors } from './core/config-validation.js';
import { FETCH_ALL_LIMIT, PPV_CLI_TOOL_NAME } from './core/constants.js';
import { resolveLogLevel } from './core/logger.js';
import { VERSION } from './core/version.js';
import { runConfigInit } from './ppc/commands/config-init.js';
import { runConfigSetToken } from './ppc/commands/config-set-token.js';
import { runConfigShow } from './ppc/commands/config-show.js';
import { runDataAnalyze } from './ppc/commands/data-analyze.js';
import { runDataStats } from './ppc/commands/data-stats.js';
import { runPrototypeList } from './ppc/commands/prototype-list.js';
import { runPrototypeSearch } from './ppc/commands/prototype-search.js';
import { runPrototypeShow } from './ppc/commands/prototype-show.js';
import { runSnapshotCreate } from './ppc/commands/snapshot-create.js';
import { runSnapshotList } from './ppc/commands/snapshot-list.js';
import { printError } from './ppc/output.js';

// Exit quietly when the output pipe is closed early
// (e.g. `ppv-cli prototype search ... | head`), as standard CLI tools do.
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

type GlobalOptions = {
  snapshotDir?: string;
  verbose?: boolean;
  quiet?: boolean;
};

const program = new Command();

program
  .name(PPV_CLI_TOOL_NAME)
  .description(
    'One-shot CLI for inspecting ProtoPedia API data offline, from local snapshots',
  )
  .version(VERSION)
  .option('--snapshot-dir <dir>', 'directory for snapshot files')
  .option('--verbose', 'enable debug logging')
  .option('--quiet', 'suppress logs except errors');

// Load the global config file before any command runs. A broken
// config (unreadable file, or a value outside its prescribed set -
// invalid -> error, never fall back) stops every
// settings-consuming command. The config commands keep working:
// config init is the repair path, show displays the file as
// written, and set-token handles the state itself.
program.hook('preAction', (_thisCommand, actionCommand) => {
  const entries = initConfigEntries();
  if (actionCommand.parent?.name() === 'config') return;

  const gateErrors = configGateErrors(entries, 'ja');
  if (gateErrors !== null) {
    for (const line of gateErrors) {
      printError(line);
    }
    process.exit(1);
  }
});

// config - the CLI tool's own configuration
const configCommand = program
  .command('config')
  .description("manage the CLI tool's configuration");

configCommand
  .command('init')
  .description('create the global config file from the documented template')
  .action(async () => {
    process.exitCode = await runConfigInit();
  });

configCommand
  .command('show')
  .description('show the configuration state (token masked)')
  .action(async () => {
    process.exitCode = await runConfigShow();
  });

configCommand
  .command('set-token')
  .description(
    'store the ProtoPedia API token in the global config file (interactive)',
  )
  .action(async () => {
    process.exitCode = await runConfigSetToken();
  });

// data - the loaded snapshot data as a whole
const dataCommand = program
  .command('data')
  .description('operate on the loaded snapshot data as a whole');

dataCommand
  .command('analyze')
  .description("run PROMIDAS' analyzePrototypes() on the loaded data")
  .option('--snapshot <file>', 'snapshot file to load (default: latest)')
  .action(async (options: { snapshot?: string }, command: Command) => {
    const globals = command.optsWithGlobals<GlobalOptions>();
    process.exitCode = await runDataAnalyze({
      ...(options.snapshot !== undefined ? { snapshot: options.snapshot } : {}),
      ...(globals.snapshotDir !== undefined
        ? { snapshotDir: globals.snapshotDir }
        : {}),
      logLevel: resolveLogLevel(globals),
    });
  });

dataCommand
  .command('stats')
  .description('show store stats of the loaded data')
  .option('--snapshot <file>', 'snapshot file to load (default: latest)')
  .action(async (options: { snapshot?: string }, command: Command) => {
    const globals = command.optsWithGlobals<GlobalOptions>();
    process.exitCode = await runDataStats({
      ...(options.snapshot !== undefined ? { snapshot: options.snapshot } : {}),
      ...(globals.snapshotDir !== undefined
        ? { snapshotDir: globals.snapshotDir }
        : {}),
      logLevel: resolveLogLevel(globals),
    });
  });

// prototype - individual prototypes
const prototypeCommand = program
  .command('prototype')
  .description('operate on individual prototypes');

// Accumulates repeated occurrences of the same option into an array.
// No default value is registered on the options (it would show up in
// the help output as a meaningless "(default: [])"), so the first call
// receives undefined.
const collect = (value: string, previous: string[] = []): string[] => [
  ...previous,
  value,
];

// Strictly parses a non-negative integer: the whole string must be
// digits (Number.parseInt alone would silently accept "1O" as 1).
const parseStrictInt = (value: string): number | undefined =>
  /^\d+$/.test(value) ? Number.parseInt(value, 10) : undefined;

// Parses a positive integer option value; returns undefined on failure.
const parsePositiveInt = (value: string): number | undefined => {
  const parsed = parseStrictInt(value);
  return parsed === undefined || parsed <= 0 ? undefined : parsed;
};

prototypeCommand
  .command('list')
  .description(
    'list prototypes, ID ascending (requires --all, --first, or --last)',
  )
  .option('--all', 'show all prototypes')
  .option('--first <n>', 'show only the n smallest IDs')
  .option('--last <n>', 'show only the n largest IDs')
  .option('--snapshot <file>', 'snapshot file to load (default: latest)')
  .action(
    async (
      options: {
        all?: boolean;
        first?: string;
        last?: string;
        snapshot?: string;
      },
      command: Command,
    ) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      let first: number | undefined;
      let last: number | undefined;
      if (options.first !== undefined) {
        first = parsePositiveInt(options.first);
        if (first === undefined) {
          process.stderr.write(
            `[error] --first は正の整数で指定してください: ${options.first}\n`,
          );
          process.exitCode = 1;
          return;
        }
      }
      if (options.last !== undefined) {
        last = parsePositiveInt(options.last);
        if (last === undefined) {
          process.stderr.write(
            `[error] --last は正の整数で指定してください: ${options.last}\n`,
          );
          process.exitCode = 1;
          return;
        }
      }
      process.exitCode = await runPrototypeList({
        ...(options.all === true ? { all: true } : {}),
        ...(first !== undefined ? { first } : {}),
        ...(last !== undefined ? { last } : {}),
        ...(options.snapshot !== undefined
          ? { snapshot: options.snapshot }
          : {}),
        ...(globals.snapshotDir !== undefined
          ? { snapshotDir: globals.snapshotDir }
          : {}),
        logLevel: resolveLogLevel(globals),
      });
    },
  );

prototypeCommand
  .command('search')
  .description(
    'search prototypes (keywords are ANDed; repeated options are ORed)',
  )
  .argument(
    '[keywords...]',
    'keywords; every keyword must match name or summary (AND)',
  )
  .option(
    '--id <id>',
    'filter by prototype ID (exact match, repeatable)',
    collect,
  )
  .option('--tag <tag>', 'filter by tag (partial match, repeatable)', collect)
  .option(
    '--user <user>',
    'filter by user name (partial match, repeatable)',
    collect,
  )
  .option(
    '--event <event>',
    'filter by event name (partial match, repeatable)',
    collect,
  )
  .option(
    '--material <material>',
    'filter by material name (partial match, repeatable)',
    collect,
  )
  .option(
    '--status <code>',
    'filter by status code (exact match, repeatable)',
    collect,
  )
  .option('--snapshot <file>', 'snapshot file to load (default: latest)')
  .action(
    async (
      keywords: string[],
      options: {
        id?: string[];
        tag?: string[];
        user?: string[];
        event?: string[];
        material?: string[];
        status?: string[];
        snapshot?: string;
      },
      command: Command,
    ) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const ids: number[] = [];
      for (const value of options.id ?? []) {
        const id = parseStrictInt(value);
        if (id === undefined) {
          process.stderr.write(
            `[error] --id は数値で指定してください: ${value}\n`,
          );
          process.exitCode = 1;
          return;
        }
        ids.push(id);
      }
      const statuses: number[] = [];
      for (const value of options.status ?? []) {
        const status = parseStrictInt(value);
        if (status === undefined) {
          process.stderr.write(
            `[error] --status は数値で指定してください: ${value}\n`,
          );
          process.exitCode = 1;
          return;
        }
        statuses.push(status);
      }
      process.exitCode = await runPrototypeSearch({
        criteria: {
          ...(keywords.length > 0 ? { keywords } : {}),
          ...(ids.length > 0 ? { ids } : {}),
          ...(options.tag?.length ? { tags: options.tag } : {}),
          ...(options.user?.length ? { users: options.user } : {}),
          ...(options.event?.length ? { events: options.event } : {}),
          ...(options.material?.length ? { materials: options.material } : {}),
          ...(statuses.length > 0 ? { statuses } : {}),
        },
        ...(options.snapshot !== undefined
          ? { snapshot: options.snapshot }
          : {}),
        ...(globals.snapshotDir !== undefined
          ? { snapshotDir: globals.snapshotDir }
          : {}),
        logLevel: resolveLogLevel(globals),
      });
    },
  );

prototypeCommand
  .command('show')
  .description('show one prototype as JSON by ID')
  .argument('<id>', 'prototype ID')
  .option('--snapshot <file>', 'snapshot file to load (default: latest)')
  .action(
    async (id: string, options: { snapshot?: string }, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const prototypeId = parseStrictInt(id);
      if (prototypeId === undefined) {
        process.stderr.write(`[error] ID は数値で指定してください: ${id}\n`);
        process.exitCode = 1;
        return;
      }
      process.exitCode = await runPrototypeShow({
        prototypeId,
        ...(options.snapshot !== undefined
          ? { snapshot: options.snapshot }
          : {}),
        ...(globals.snapshotDir !== undefined
          ? { snapshotDir: globals.snapshotDir }
          : {}),
        logLevel: resolveLogLevel(globals),
      });
    },
  );

// snapshot - snapshot files on disk
const snapshotCommand = program
  .command('snapshot')
  .description('manage snapshot files');

snapshotCommand
  .command('create')
  .description(
    'fetch all prototypes from the ProtoPedia API and save a new snapshot',
  )
  .option(
    '--limit <number>',
    'maximum number of prototypes to fetch',
    String(FETCH_ALL_LIMIT),
  )
  .action(async (options: { limit: string }, command: Command) => {
    const globals = command.optsWithGlobals<GlobalOptions>();
    const limit = parsePositiveInt(options.limit);
    if (limit === undefined) {
      process.stderr.write(
        `[error] --limit は正の整数で指定してください: ${options.limit}\n`,
      );
      process.exitCode = 1;
      return;
    }
    process.exitCode = await runSnapshotCreate({
      limit,
      ...(globals.snapshotDir !== undefined
        ? { snapshotDir: globals.snapshotDir }
        : {}),
      logLevel: resolveLogLevel(globals),
    });
  });

snapshotCommand
  .command('list')
  .description('list saved snapshot files (newest first)')
  .action(async (_options: Record<string, never>, command: Command) => {
    const globals = command.optsWithGlobals<GlobalOptions>();
    process.exitCode = await runSnapshotList({
      ...(globals.snapshotDir !== undefined
        ? { snapshotDir: globals.snapshotDir }
        : {}),
      logLevel: resolveLogLevel(globals),
    });
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[error] 予期しないエラーが発生しました: ${message}\n`);
  if (process.argv.includes('--verbose') && error instanceof Error) {
    process.stderr.write(`${error.stack ?? ''}\n`);
  }
  process.exitCode = 1;
}
