<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Adopted the GitHub Actions workflow lockfile
  (`.github/workflows/actions.lock`), which pins every action used by the
  workflows, including the npm publish workflow, to a verified commit. A new
  `verify-lockfile` workflow checks it on pull requests and pushes to `main`
  (#13).

## [0.2.0] - 2026-11-09

### Changed

- Updated `promidas` to 5.0.0, `promidas-utils` to 5.0.0, and
  `protopedia-api-v2-client` to 5.2.0 (#5).
- Fetching from the API now times out after 60 seconds instead of 15, and the
  timeout covers receiving the whole response body, not only the headers.
- Some fetch error messages changed. A timeout message now suggests lowering
  the number of items to fetch, and a network error message also lists a
  dropped connection as a possible cause.
- Updated other dependencies, including `dotenv` 18, `commander` 15.1, and
  React 19.3.

### Security

- Updated `zod`, a dependency of `promidas`, from 4.4.3 to 4.6.7 to fix
  [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
  where validating an oversized collection could exhaust memory.

## [0.1.0] - 2026-07-23

### Added

- Initial release.
- `ppv-cli`: one-shot, pipe-friendly CLI for inspecting ProtoPedia API
  data offline from local snapshots (JSON or tab-separated output).
- `ppex`: interactive explorer with instant filtering, detail and raw
  JSON views, and snapshot management.
- `pptop`: top(1)-style monitor with sortable columns and aggregate
  statistics.
