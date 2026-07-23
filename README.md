# ppv26-cli

[![CI](https://github.com/F88/ppv26-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/F88/ppv26-cli/actions/workflows/ci.yml)
[![CodeQL](https://github.com/F88/ppv26-cli/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/F88/ppv26-cli/actions/workflows/github-code-scanning/codeql)
[![GitHub Advanced Security](https://github.com/F88/ppv26-cli/actions/workflows/agents/github-advanced-security/badge.svg)](https://github.com/F88/ppv26-cli/actions/workflows/agents/github-advanced-security)
[![Publish package to npmjs.com](https://github.com/F88/ppv26-cli/actions/workflows/publish-package-to-npmjs.yml/badge.svg)](https://github.com/F88/ppv26-cli/actions/workflows/publish-package-to-npmjs.yml)

[![npm version](https://badge.fury.io/js/ppv26-cli.svg?icon=si%3Anpm)](https://badge.fury.io/js/ppv26-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Issues](https://img.shields.io/github/issues/F88/ppv26-cli?label=issues)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/F88/ppv26-cli)
[![View Code Wiki](https://www.gstatic.com/_/boq-sdlc-agents-ui/_/r/YUi5dj2UWvE.svg)](https://codewiki.google/github.com/f88/ppv26-cli)

ProtoPedia Viewer CLI tools - inspect ProtoPedia API data offline, from local snapshots.

## Overview

Tools for developers who build applications with the [ProtoPedia API Ver 2.0](https://protopediav2.docs.apiary.io/): fetch all prototypes once into a local snapshot file, then search, filter, and inspect the exact data - field values, raw JSON, counts - offline, without hitting the API again.

Built on [🧰 PROMIDAS](https://protopedia.net/prototype/7917), which normalizes parts of the API response to be easier to work with - for example, date-time values gain a timezone offset, and pipe-joined strings such as users and tags become arrays. What the tools display is this normalized data, not the verbatim response.

Three tools share the same snapshot files, each trying a different UI style:

- `ppv-cli` - one-shot, pipe-friendly UNIX-like CLI
- `ppex` - interactive explorer (Ink; ProtoPedia EXplorer)
- `pptop` - top(1)-style snapshot monitor (Ink)

## About ProtoPedia

[ProtoPedia](https://protopedia.net/) (プロトペディア) とは、ITものづくりに関する作品を記録・公開できるWEBサービス。ソフト、ハード、XR、アート、ロボット作品など、様々なジャンルの作品の登録があり、アイデアの宝庫です。作品を登録していくと、沢山の人に見られ、フィードバックがもらえます。時々コンテストも開催しており、個人開発者のポートフォリオとしても活用されています。

ProtoPediaでは、作品一覧の取得、開発資料の管理、作品とイベントの紐付けなど、プログラムによる創作活動の支援を行う [ProtoPedia API Ver 2.0](https://protopediav2.docs.apiary.io/) も提供しています。

[ProtoPedia](https://protopedia.net/) (プロトペディア) is a web service for recording and publishing IT maker works - software, hardware, XR, art, robots, and more. It is a treasure trove of ideas: registered works reach a wide audience and gather feedback, contests are held from time to time, and many individual developers use it as their portfolio. The site's motto: つくる、たのしむ、ひろがる.

ProtoPedia also offers the [ProtoPedia API Ver 2.0](https://protopediav2.docs.apiary.io/), which supports creative activity programmatically - retrieving lists of works, managing development materials, and associating works with events.

## Requirements

- Node.js >= 22
- ProtoPedia API Ver 2.0 access token (only needed for `snapshot create`; see <https://protopediav2.docs.apiary.io/>)

## Quick start

Install the commands, set your token, and create the first snapshot. After that, everything works offline.

```console
# 1. Install ppv-cli / ppex / pptop onto your PATH.
npm install -g ppv26-cli

# 2. Set the ProtoPedia API token (interactive; saved to ~/.ppv-cli/config).
ppv-cli config set-token

# 3. Fetch all prototypes once and save them as a local snapshot.
ppv-cli snapshot create
```

Now the data is ready - explore it any way you like:

```console
ppv-cli prototype list          # one-shot, pipe-friendly
ppex                            # interactive explorer
pptop                           # top(1)-style monitor
```

> A token is only required for `snapshot create`. Starting `pptop` / `ppex` before a token and a snapshot exist just shows a setup hint, so run steps 2-3 first.

Uninstall with `npm uninstall -g ppv26-cli`.

## The tools

### ppv-cli - one-shot CLI

A pipe-friendly, UNIX-like CLI: one command per invocation, results on stdout (JSON or tab-separated), logs on stderr. Run `ppv-cli --help` for the command list.

```console
ppv-cli prototype search --tag M5Stack   # facet search
ppv-cli prototype show 1234              # one work as JSON
```

### ppex - interactive explorer (Japanese UI)

An Ink-based explorer: pick a snapshot, then filter works live via 作品探索 and inspect each one down to its raw JSON. Key hints are shown on screen. Requires a TTY.

```console
ppex                  # installed via npm
node dist/ppex.js     # from a source clone
```

### pptop - snapshot monitor (English UI)

A top(1)-style monitor: auto-loads the latest snapshot and shows an aggregate header above a sortable, filterable table. Press `?` for the built-in help. Requires a TTY.

```console
pptop                 # installed via npm
node dist/pptop.js    # from a source clone
```

## Configuration

The settings live in a single file under your home directory: `~/.ppv-cli/config` on macOS / Linux, `%USERPROFILE%\.ppv-cli\config` on Windows.

This file (KEY=VALUE format) is the single source of truth for every setting, the API token included - no .env files and no environment-variable overrides. One-shot overrides are the CLI options (`--snapshot`, `--snapshot-dir`, `--verbose` / `--quiet`). Keys:

| Key                            | Description                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `PROTOPEDIA_API_V2_TOKEN`      | ProtoPedia API Ver 2.0 token (required for `snapshot create`)                                                |
| `PPV_CLI_LOG_LEVEL`            | Default log level: debug / info / warn / error / silent. CLI flags (`--verbose` / `--quiet`) take precedence |
| `PPV_CLI_SNAPSHOT_DIR`         | Snapshot directory (default: `~/.ppv-cli/snapshots`). The `--snapshot-dir` option takes precedence           |
| `PPV_CLI_SNAPSHOT_STALE_HOURS` | Hours after which a snapshot is considered stale (default: 1). Also used as the in-memory store TTL          |

## Documents

- [PRD.md](PRD.md) - requirements and design summary (Japanese)
- [DEVELOPMENT.md](DEVELOPMENT.md) - building and running from source, development notes, and dependencies management policy
